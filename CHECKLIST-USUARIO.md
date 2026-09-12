# ✅ Checklist do Usuário — NOC-Agent
> Atualizado em: 12/09/2026 — Seções 1–7 concluídas ✅

---

## 🔐 1. Credenciais & API Keys ✅ CONCLUÍDO

| Variável | Status |
|---|---|
| `ANTHROPIC_API_KEY` | ✅ Coletado |
| `OPENAI_API_KEY` | ✅ Coletado |
| `CHATWOOT_BASE_URL` | ✅ Coletado |
| `CHATWOOT_ACCOUNT_ID` | ✅ Coletado |
| `CHATWOOT_ACCOUNT_API_KEY` | ✅ Coletado |
| `CHATWOOT_INBOX_ID` | ✅ Coletado |
| `CHATWOOT_INBOX_API_KEY` | ✅ Coletado |
| `CHATWOOT_WEBHOOK_SECRET` | ✅ Definido |
| `ZABBIX_API_URL` | ✅ Coletado |
| `ZABBIX_API_TOKEN` | ✅ Coletado |
| `POSTGRES_USER` | ✅ Coletado |
| `POSTGRES_PASSWORD` | ✅ Coletado |
| `S3_ENDPOINT` | ✅ Coletado |
| `S3_REGION` | ✅ Coletado |
| `S3_ACCESS_KEY` | ✅ Coletado |
| `S3_SECRET_KEY` | ✅ Coletado |
| `S3_BUCKET` | ✅ Coletado |
| `DCC_ENABLED` | ✅ Definido |
| `DCC_DEVELOPER_USERNAME` | ✅ Definido |
| `DCC_TOTP_SECRET` | ✅ Gerado e salvo no autenticador |
| `VAULT_MASTER_KEY` | ✅ Configurada (Derivação estrita de 32 bytes AES-256) |
| `PFSENSE_BASE_URL` | ✅ `https://pfsense.seudominio.com.br:8181` (Exemplo) |
| `PFSENSE_API_KEY` | ✅ Gerado e salvo |

---

## 🖥️ 2. Infraestrutura do Servidor ✅ CONCLUÍDO

- `[x]` Diretórios `/var/data/nocagent/core` criados no host
- `[x]` Banco `nocagent` criado no PostgreSQL existente
- `[x]` Storage S3/MinIO configurado — provedor e bucket definidos
- `[x]` DCC_TOTP_SECRET gerado e configurado no Google Authenticator/Authy

---

## 💬 3. Configuração do Chatwoot ✅ CONCLUÍDO

- `[x]` Account API (admin token) coletado
- `[x]` `CHATWOOT_ACCOUNT_ID` anotado
- `[x]` Token da Inbox coletado
- `[x]` `CHATWOOT_INBOX_ID` anotado
- `[x]` Webhook cadastrado em **Integrações → Webhooks**
  - URL: `https://nocagent.awecloudsolution.com/api/webhooks/chatwoot`
  - Eventos: `message_created`, `conversation_status_changed`, `conversation_assigned`

---

## 🌐 4. DNS & Traefik ✅ CONCLUÍDO

- `[x]` `nocagent.awecloudsolution.com` apontando para o servidor com Traefik
- `[x]` `letsencryptresolver` configurado no Traefik
- `[x]` Rede Docker externa `interna` existente no Swarm/Portainer

---

## 🐙 5. GitHub — Repositório & CI/CD ✅ CONCLUÍDO

- `[x]` Repositório `Wittemberg/nocagent` criado no GitHub
- `[x]` GitHub Container Registry (GHCR) habilitado
- `[x]` Primeira sincronização inicial concluída (`main` sincronizada com sucesso)
- `[x]` Webhook da Stack `nocagent-core` no Portainer → `PORTAINER_CORE_WEBHOOK_URL`
- `[x]` Webhook da Stack `nocagent-web` no Portainer → `PORTAINER_WEB_WEBHOOK_URL`

---

## 🗄️ 6. Operação & Cofre de Equipamentos ✅ CONCLUÍDO

- `[x]` Primeiro equipamento cadastrado no Cofre com chave AES-256 (pfSense Libra)
- `[x]` Validação de conectividade real via API do pfSense
- `[x]` Nós Proxmox (SuperTop e Calvi) e roteadores Mikrotik cadastrados e operacionais
- `[x]` Cofre criptográfico operacional e integrado ao Hermes AI Engine

---

## 📊 7. Dashboard Web & Gestão Multi-Tenant ✅ CONCLUÍDO

- `[x]` Painel Web responsivo em produção (`nocagent.awecloudsolution.com`) com SSL automático
- `[x]` Cards compactos de alta densidade com métricas de CPU, RAM e Disco
- `[x]` Hierarquia de Clientes/Tenants (`group`) e Unidades/Lojas (`subgroup`) com auto-complete no cadastro
- `[x]` Modo visual "Agrupar por Unidade" organizando equipamentos por loja/filial
- `[x]` Filtros dinâmicos por Cliente, Unidade e Tipo de Equipamento
- `[x]` Mecanismo de silenciamento de alertas (Snooze) por 15m, 30m, 1h, 4h ou 24h
- `[x]` Polling automático de telemetria a cada 30 segundos e botão de retry inteligente
- `[x]` Cofre de Storages gerenciando destinos S3, MinIO, Wasabi, SFTP e NFS vinculados aos ativos
- `[x]` Terminal IA integrado com RAG de telemetria em tempo real e raciocínio diagnóstico multi-caso

---

## 🔐 8. Autenticação Segura, Gestão de Usuários & 2FA TOTP ✅ CONCLUÍDO

- `[x]` Criptografia de senhas Scrypt com salt aleatório de 16 bytes e verificação `timingSafeEqual`
- `[x]` Bootstrap automático e resiliente do Superadmin com auto-reparo de credenciais no startup
- `[x]` Suporte a perfis RBAC: `SUPERADMIN`, `TENANT_MASTER`, `OPERATOR`, `VIEWER`
- `[x]` Gestão visual de usuários no Dashboard com filtros por Tenant e modal de cadastro/edição
- `[x]` Autenticação de dois fatores (2FA TOTP) com QR Code Base32 para Google Authenticator e Authy
- `[x]` Interceptor global no frontend para purgar sessões expiradas (HTTP 401) do `localStorage`

---

## ⚡ 9. Governança de IA, Feature Flags & Observabilidade APM (Fase 5) ✅ CONCLUÍDO

- `[x]` Motor de Feature Flags com suporte a Redis e persistência relacional no PostgreSQL
- `[x]` Níveis granulares de autonomia da IA: L1 (Leitura), L2 (Remediação Supervisionada), L3 (Crítico)
- `[x]` Emergency Kill-Switch global com corte instantâneo de comandos e remediações ativas
- `[x]` Badge dinâmico no cabeçalho alertando status de operação normal vs kill-switch ativo
- `[x]` Motor Pulse APM medindo latência RTT em ms por driver (Proxmox, pfSense, Mikrotik, Zabbix, LLM)
- `[x]` Telescope Inspector com histórico ponta a ponta de chamadas MCP, status code e diagnósticos de erro
- `[x]` Aba dedicada "Governança & APM" exclusiva para superadministradores no Dashboard Web

