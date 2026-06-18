import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import matter from "gray-matter";

// ── Configuração ─────────────────────────────────────────────────────────────

const PORT        = process.env.PORT        ?? 3100;
const VAULT_PATH  = process.env.VAULT_PATH  ?? "/vault";
const SKILLS_PATH = process.env.SKILLS_PATH ?? "/skills";
const MEMORY_PATH = process.env.MEMORY_PATH ?? "/opt/data";   // volume do Hermes

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readNote(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  const { data: frontmatter, content } = matter(raw);
  return { frontmatter, content, raw };
}

async function listMarkdownFiles(basePath, subDir = "") {
  const searchPath = path.join(basePath, subDir, "**/*.md");
  const files = await glob(searchPath, { nodir: true });
  return files.map(f => path.relative(basePath, f));
}

async function searchInFiles(basePath, query, maxResults = 20) {
  const files = await listMarkdownFiles(basePath);
  const results = [];
  const lowerQuery = query.toLowerCase();

  for (const file of files) {
    if (results.length >= maxResults) break;
    try {
      const { content, frontmatter } = await readNote(path.join(basePath, file));
      const searchTarget = (content + JSON.stringify(frontmatter)).toLowerCase();
      if (searchTarget.includes(lowerQuery)) {
        // Extrai snippet de contexto à volta do match
        const idx = searchTarget.indexOf(lowerQuery);
        const start = Math.max(0, idx - 100);
        const snippet = content.slice(start, start + 300).trim();
        results.push({ file, snippet, frontmatter });
      }
    } catch {
      // Ignora ficheiros não legíveis
    }
  }
  return results;
}

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "second-brain-mcp",
  version: "1.0.0",
});

// ── VAULT: Ferramentas ────────────────────────────────────────────────────────

server.tool(
  "list_notes",
  "Lista todas as notas no vault Obsidian. Aceita um sub-directório opcional.",
  { subdir: z.string().optional().describe("Sub-directório dentro do vault (ex: 'projects', 'daily')") },
  async ({ subdir }) => {
    const files = await listMarkdownFiles(VAULT_PATH, subdir ?? "");
    return {
      content: [{
        type: "text",
        text: files.length
          ? `Notas encontradas (${files.length}):\n${files.join("\n")}`
          : "Nenhuma nota encontrada."
      }]
    };
  }
);

server.tool(
  "read_note",
  "Lê o conteúdo completo de uma nota do vault Obsidian.",
  { path: z.string().describe("Caminho relativo da nota dentro do vault (ex: 'projects/my-project.md')") },
  async ({ path: notePath }) => {
    const fullPath = path.join(VAULT_PATH, notePath);
    const { content, frontmatter } = await readNote(fullPath);
    return {
      content: [{
        type: "text",
        text: `# Frontmatter\n${JSON.stringify(frontmatter, null, 2)}\n\n# Conteúdo\n${content}`
      }]
    };
  }
);

server.tool(
  "search_notes",
  "Pesquisa notas no vault Obsidian por conteúdo ou palavras-chave.",
  {
    query:      z.string().describe("Texto a pesquisar nas notas"),
    max_results: z.number().optional().describe("Número máximo de resultados (default: 20)")
  },
  async ({ query, max_results }) => {
    const results = await searchInFiles(VAULT_PATH, query, max_results ?? 20);
    if (!results.length) {
      return { content: [{ type: "text", text: `Nenhuma nota encontrada para "${query}".` }] };
    }
    const formatted = results.map(r =>
      `## ${r.file}\n**Frontmatter:** ${JSON.stringify(r.frontmatter)}\n**Snippet:** ${r.snippet}`
    ).join("\n\n---\n\n");
    return { content: [{ type: "text", text: formatted }] };
  }
);

server.tool(
  "write_note",
  "Cria ou actualiza uma nota no vault Obsidian.",
  {
    path:    z.string().describe("Caminho relativo da nota (ex: 'synthesis/2026-06-17.md')"),
    content: z.string().describe("Conteúdo completo da nota em Markdown"),
    frontmatter: z.record(z.string(), z.any()).optional().describe("Metadados YAML da nota")
  },
  async ({ path: notePath, content, frontmatter }) => {
    const fullPath = path.join(VAULT_PATH, notePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    const fileContent = frontmatter
      ? matter.stringify(content, frontmatter)
      : content;

    await fs.writeFile(fullPath, fileContent, "utf-8");
    return { content: [{ type: "text", text: `Nota escrita em: ${notePath}` }] };
  }
);

server.tool(
  "get_backlinks",
  "Encontra todas as notas que fazem link para uma nota específica.",
  { path: z.string().describe("Caminho relativo da nota alvo") },
  async ({ path: targetPath }) => {
    const noteName = path.basename(targetPath, ".md");
    const allFiles = await listMarkdownFiles(VAULT_PATH);
    const backlinks = [];

    for (const file of allFiles) {
      if (file === targetPath) continue;
      try {
        const { content } = await readNote(path.join(VAULT_PATH, file));
        if (content.includes(`[[${noteName}]]`) || content.includes(`(${targetPath})`)) {
          backlinks.push(file);
        }
      } catch { /* ignora */ }
    }

    return {
      content: [{
        type: "text",
        text: backlinks.length
          ? `Backlinks para "${noteName}" (${backlinks.length}):\n${backlinks.join("\n")}`
          : `Nenhum backlink encontrado para "${noteName}".`
      }]
    };
  }
);

// ── SKILLS: Ferramentas ───────────────────────────────────────────────────────

server.tool(
  "list_skills",
  "Lista todas as skills disponíveis no hub centralizado.",
  {},
  async () => {
    const files = await glob(path.join(SKILLS_PATH, "**/*.md"), { nodir: true });
    const skills = files.map(f => path.relative(SKILLS_PATH, f));
    return {
      content: [{
        type: "text",
        text: skills.length
          ? `Skills disponíveis (${skills.length}):\n${skills.join("\n")}`
          : "Nenhuma skill encontrada."
      }]
    };
  }
);

server.tool(
  "get_skill",
  "Lê o conteúdo completo de uma skill.",
  { path: z.string().describe("Caminho relativo da skill (ex: 'engineering/tdd/SKILL.md')") },
  async ({ path: skillPath }) => {
    const fullPath = path.join(SKILLS_PATH, skillPath);
    const content = await fs.readFile(fullPath, "utf-8");
    return { content: [{ type: "text", text: content }] };
  }
);

server.tool(
  "search_skills",
  "Pesquisa skills por nome ou conteúdo.",
  { query: z.string().describe("Texto a pesquisar nas skills") },
  async ({ query }) => {
    const results = await searchInFiles(SKILLS_PATH, query, 10);
    if (!results.length) {
      return { content: [{ type: "text", text: `Nenhuma skill encontrada para "${query}".` }] };
    }
    const formatted = results.map(r => `## ${r.file}\n${r.snippet}`).join("\n\n---\n\n");
    return { content: [{ type: "text", text: formatted }] };
  }
);

// ── MEMÓRIA: Ferramentas (lê ficheiros do Hermes) ─────────────────────────────

server.tool(
  "get_user_model",
  "Retorna o modelo de utilizador acumulado pelo Hermes (USER.md).",
  {},
  async () => {
    try {
      const content = await fs.readFile(path.join(MEMORY_PATH, "USER.md"), "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch {
      return { content: [{ type: "text", text: "USER.md ainda não existe — o Hermes ainda não acumulou memória de utilizador." }] };
    }
  }
);

server.tool(
  "get_memory",
  "Retorna a memória de sessão acumulada pelo Hermes (MEMORY.md).",
  {},
  async () => {
    try {
      const content = await fs.readFile(path.join(MEMORY_PATH, "MEMORY.md"), "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch {
      return { content: [{ type: "text", text: "MEMORY.md ainda não existe — o Hermes ainda não acumulou memória." }] };
    }
  }
);

server.tool(
  "search_memory",
  "Pesquisa na memória e nas notas de síntese do Hermes.",
  { query: z.string().describe("Texto a pesquisar na memória") },
  async ({ query }) => {
    const results = await searchInFiles(MEMORY_PATH, query, 10);
    if (!results.length) {
      return { content: [{ type: "text", text: `Nada encontrado na memória para "${query}".` }] };
    }
    const formatted = results.map(r => `## ${r.file}\n${r.snippet}`).join("\n\n---\n\n");
    return { content: [{ type: "text", text: formatted }] };
  }
);

server.tool(
  "get_recent_synthesis",
  "Retorna as sínteses mais recentes geradas pelo Hermes no vault.",
  { days: z.number().optional().describe("Quantos dias para trás procurar (default: 7)") },
  async ({ days = 7 }) => {
    const synthPath = path.join(VAULT_PATH, "synthesis");
    try {
      const files = await glob(path.join(synthPath, "*.md"), { nodir: true });
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const recent = [];

      for (const file of files) {
        const stat = await fs.stat(file);
        if (stat.mtimeMs >= cutoff) {
          const { content } = await readNote(file);
          recent.push({ file: path.basename(file), content });
        }
      }

      if (!recent.length) {
        return { content: [{ type: "text", text: `Nenhuma síntese nos últimos ${days} dias.` }] };
      }

      const formatted = recent
        .map(r => `## ${r.file}\n${r.content.slice(0, 500)}...`)
        .join("\n\n---\n\n");
      return { content: [{ type: "text", text: formatted }] };
    } catch {
      return { content: [{ type: "text", text: "Directório de sínteses ainda não existe." }] };
    }
  }
);

// ── HTTP Server ───────────────────────────────────────────────────────────────

const httpServer = createServer(async (req, res) => {
  // Health check endpoint
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      vault:  VAULT_PATH,
      skills: SKILLS_PATH,
      memory: MEMORY_PATH
    }));
    return;
  }

  // MCP via Streamable HTTP
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

httpServer.listen(PORT, () => {
  console.log(`[MCP] Second Brain server activo em http://0.0.0.0:${PORT}`);
  console.log(`[MCP] Vault:  ${VAULT_PATH}`);
  console.log(`[MCP] Skills: ${SKILLS_PATH}`);
  console.log(`[MCP] Memory: ${MEMORY_PATH}`);
});