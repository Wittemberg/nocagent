---
type: project
created: 2026-07-18
updated: 2026-07-18
---

# Technical Decisions

- Component metadata uses SemVer while the toolkit release keeps CalVer.
- `manifest.json` and `manifest.lock.json` must remain synchronized with component frontmatter.
- **NOC-Agent Core Decisions (10/09/2026)**:
  1. **Nome Oficial:** NOC-Agent.
  2. **URL / Host:** `nocagent.awecloudsolution.com` (roteado via Traefik existente com TLS).
  3. **Repositório:** `https://github.com/Wittemberg/nocagent` (inicialmente público, futuramente privado).
  4. **AI Runtime & Gateway:** `NousResearch/hermes-agent` adaptado para NOC, aproveitando o gateway multicanal, agendamento cron nativo e aprovações Human-in-the-Loop (`approval.py`).
  5. **Integração Chatwoot:** Dual-API obrigatória: **Account API** para gestão/admin/bot e **Public API** para conversas e mensageria no Inbox.
  6. **Infraestrutura Reutilizada:** Portainer (stack `noc-agent`), Traefik, PostgreSQL (db `nocagent`), Redis (prefix `nocagent:`), Storage S3 (bucket `nocagent`).
  7. **Zabbix:** Conexão via Webhook + API REST oficial assim que o host estiver provisionado.
  8. **Zero Shell Arbitrário:** IA restrita estritamente a ferramentas tipadas MCP (Proxmox, Mikrotik RouterOS, pfSense, Zabbix).
  9. **Frontend Web:** Conforme `witteberg-development-standards` (zoom 100%, 4 breakpoints responsivos, PT-BR, zero secrets no client).
