# Homelabzin — Claude Context

## Project Overview

Proxmox homelab "second brain" with 7 LXC containers:

| LXC | Codename | Role | IP | Port |
|-----|----------|------|----|------|
| 1 | Traefik | Reverse proxy / TLS | 192.168.0.212 | 80/443 |
| 2 | Hermes | Agent + MCP server | 192.168.0.213 | 3100 (MCP), 9119 (dashboard) |
| 3 | Odysseus | Second agent (MCP client) | 192.168.0.214 | 7000 |
| 4 | LiteLLM | LLM router (OpenRouter free) | 192.168.0.211 | 4000 |
| 5 | Dados | Postgres 17, Redis 7, FalkorDB | 192.168.0.210 | 5432/6379/6380 |
| 6 | sb-dev | Dev environment (deferred) | 192.168.0.215 | — |
| 7 | sb-monitor | Uptime Kuma + Dockhand | 192.168.0.216 | 3001 (Kuma), 3000 (Dockhand) |

## MCP Architecture

- **Server**: `LXC_2_hermes_mcp/server.py` (FastAPI + fastapi_mcp, Python) — Dockerfile runs this
- **Protocol**: MCP via `fastapi-mcp` (auto-exposes FastAPI routes as MCP tools)
- **Tools exposed**: vault notes CRUD, full-text search, backlinks, skills, memory/synthesis
- **Client**: Odysseus (`LXC_3_Odysseus/mcp-servers.json`) connects to `http://192.168.0.213:3100/sse`
- `mcp-server.js` is an alternative Node.js implementation — not wired to Docker, kept as reference

## Knowledge Graph

A graphify graph exists at `graphify-out/graph.json`. Use it for codebase navigation:
- Run `/graphify query "<question>"` to traverse the graph
- Run `/graphify .` to rebuild if files change
- Key god nodes: `resolve_path()`, `read_md_file()`, `search_in_dir()`
- Always prefer use the graphify instead of grep
- Just use grep if you need a lot

## Key Rules

- LXC_2 IP: `192.168.0.213` — used in Odysseus mcp-servers.json
- LXC_4 (LiteLLM) IP: `192.168.0.211` — used in Hermes docker-compose
- LXC_5 (Dados) IP: `192.168.0.210` — Postgres and Redis
- LXC_7 (Monitor) IP: `192.168.0.216` — Uptime Kuma + Dockhand

## Docker Service Names

- `sb_litellm` — LiteLLM container
- `sb_hermes` — Hermes agent
- `sb_mcp` — MCP server
- `sb_kuma` — Uptime Kuma (LXC 7)
- `sb_dockhand` — Dockhand (LXC 7)
