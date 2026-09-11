# ✅ Checklist do Usuário — NOC-Agent
> Atualizado em: 11/09/2026 — Seções 1–6 concluídas ✅

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

## 🗄️ 6. Próximos Passos de Operação

- `[ ]` Testar o cadastro do primeiro equipamento no Cofre (com a chave AES-256 corrigida)
- `[ ]` Criar primeiro Storage no Cofre de Storages (MinIO/S3/SFTP)
- `[ ]` Vincular equipamento ao Storage de backup
