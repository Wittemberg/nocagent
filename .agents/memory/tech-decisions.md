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
  10. **Zero Dados Fictícios (Regra Fundamental):** Todo o painel web e respostas do agente devem refletir 100% de dados reais consumidos das APIs oficiais e banco de dados. Qualquer estado sem dados deve ser apresentado como empty state limpo.
  11. **Hierarquia Multi-Tenant (12/09/2026):** Mapeamento de `group` (default "Geral"), `subgroup` (unidade/loja), `tags` e `backupSchedule` no modelo `Equipment` com índices no PostgreSQL. Agrupamento visual por unidade no frontend ("Agrupar por Unidade") e suporte a RAG no Hermes AI Engine para queries multi-loja.
  12. **Alta Densidade e Resiliência Web (12/09/2026):** Cards compactos com barras de métricas proporcionais de CPU, RAM e Disco, silenciador de alertas com persistência em localStorage, polling automático de telemetria a cada 30 segundos com retry.
  13. **Raciocínio Diagnóstico Autônomo com RAG (12/09/2026):** O Hermes AI Engine avalia a telemetria ao vivo dos nós Proxmox, roteadores Mikrotik e firewalls pfSense antes de responder, diagnosticando incidentes sem alucinação com base em 6 padrões operacionais estruturados (Casos 0 a 5).
