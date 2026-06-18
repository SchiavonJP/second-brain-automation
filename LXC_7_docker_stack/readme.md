# LXC 7 — docker-stack

Uptime Kuma · monitorização HTTP/TCP/SSL de todos os serviços
Dockhand · gestão de containers Docker via UI

## Specs recomendadas do LXC

```
CPU:  1 core
RAM:  1 GB
Disk: 10 GB
```

## Pré-requisitos

```bash
# LXC Debian 12 com nesting=1
# features: keyctl=1,nesting=1  no /etc/pve/lxc/<id>.conf

apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
```

## Pré-requisito — base de dados Dockhand

O Dockhand precisa de uma base de dados no Postgres (LXC 5).
Cria-a uma única vez — não recria volumes existentes:

```bash
# A partir do LXC 5 ou via docker exec no sb-dados
docker exec -it sb_postgres psql -U secondbrain -c "CREATE DATABASE dockhand;"
```

## Deploy via Git

```bash
# SSH access (run once from Proxmox host)
pct exec <VMID> -- mkdir -p /root/.ssh
cat ~/.ssh/id_ed25519.pub | pct exec <VMID> -- tee /root/.ssh/authorized_keys
pct exec <VMID> -- chmod 700 /root/.ssh
pct exec <VMID> -- chmod 600 /root/.ssh/authorized_keys

# Clone only this folder (run on LXC 7)
git clone --no-checkout --filter=blob:none https://github.com/SchiavonJP/second-brain-automation.git
cd second-brain-automation
git sparse-checkout init --cone
git sparse-checkout set LXC_7_docker_stack
git checkout main
cd LXC_7_docker_stack
```

## Editar variáveis

O `.env` já tem os valores correctos para o Postgres do LXC 5.
Confirma a password antes de subir:

```bash
nano .env
```

## Subir

```bash
docker compose up -d
docker compose ps
```

## Pull updates

```bash
cd ~/second-brain-automation && git pull
cd LXC_7_docker_stack && docker compose up -d
```

## Acesso

```
Uptime Kuma  http://192.168.0.216:3001   (ou https://monitor.joaopaulo.me)
Dockhand     http://192.168.0.216:3000   (ou https://dockhand.joaopaulo.me)
```

## Monitors a configurar no Kuma (após 1º login)

| Tipo  | Alvo                              | Nome                  |
|-------|-----------------------------------|-----------------------|
| HTTPS | https://hermes.joaopaulo.me       | Hermes dashboard      |
| HTTPS | https://litellm.joaopaulo.me      | LiteLLM UI            |
| HTTPS | https://odysseus.joaopaulo.me     | Odysseus              |
| HTTPS | https://traefik.joaopaulo.me      | Traefik               |
| HTTPS | https://monitor.joaopaulo.me      | Kuma (self)           |
| TCP   | 192.168.0.213:9119                | Hermes dashboard (LAN)|
| TCP   | 192.168.0.213:3100                | MCP server            |
| TCP   | 192.168.0.211:4000                | LiteLLM API           |
| TCP   | 192.168.0.210:5432                | Postgres              |
| TCP   | 192.168.0.210:6379                | Redis                 |

## Verificar

```bash
docker ps | grep -E "kuma|dockhand"
curl -s http://192.168.0.216:3001
curl -s http://192.168.0.216:3000
```
