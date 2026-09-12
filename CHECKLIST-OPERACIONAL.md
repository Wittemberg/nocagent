# Checklist Operacional — NOC-Agent

Atualizado em 10/09/2026.

Guia rápido para provisionamento, validação e colocação do NOC-Agent em operação no servidor com Portainer e Traefik.

---

## 1. Preparar Diretórios e Permissões no Host

No servidor Linux via SSH:

```bash
mkdir -p /var/data/nocagent/core
mkdir -p /root/nocagent
```

Garantir permissões adequadas:

```bash
chmod -R 755 /var/data/nocagent
```

---

## 2. Provisionar Banco de Dados PostgreSQL

No container PostgreSQL existente (via Portainer ou psql CLI):

```sql
CREATE DATABASE nocagent;
-- Se desejar criar usuário exclusivo:
-- CREATE USER nocagent WITH ENCRYPTED PASSWORD 'senha_forte_aqui';
-- GRANT ALL PRIVILEGES ON DATABASE nocagent TO nocagent;
```

Validar:
- Conexão ao banco `nocagent` respondendo na porta `5432` através da rede `interna`.

---

## 3. Provisionar Bucket no Storage S3

No painel do S3 ou via CLI:

- Criar bucket: `nocagent`.
- Configurar política de acesso para leitura pública quando aplicável para relatórios/diagramas.
- Confirmar que as credenciais `S3_ACCESS_KEY` e `S3_SECRET_KEY` têm acesso total ao bucket.

---

## 4. Configurar Chatwoot (Dual-API)

### A. Account API (Nível Administrador / Bot)
1. No Chatwoot, acesse: **Configurações da Conta → API Access Tokens**.
2. Copie o token de acesso de administrador → salvar em `CHATWOOT_ACCOUNT_API_KEY`.
3. Anote o `CHATWOOT_ACCOUNT_ID` (geralmente `1`).

### B. Public API & Webhook (Inbox)
1. No Chatwoot, vá em **Caixas de Entrada (Inboxes) → Configurações da Caixa WhatsApp/Web**.
2. Copie o Token de API do Inbox → salvar em `CHATWOOT_INBOX_API_KEY`.
3. Anote o `CHATWOOT_INBOX_ID`.
4. Em **Integrações → Webhooks**, cadastre um novo webhook:
   - **URL**: `https://nocagent.awecloudsolution.com/api/webhooks/chatwoot`
   - **Eventos marcados**: `message_created`, `conversation_status_changed`, `conversation_assigned`.

---

## 5. Criar a Stack no Portainer

1. No Portainer, acesse: **Stacks → Add stack**.
2. Nome da Stack: `noc-agent`.
3. Cole o conteúdo de [`STACK_SPEC.md`](file:///var/www/netagent/STACK_SPEC.md#L10-L75).
4. Em **Environment variables**, configure as variáveis do `.env`:
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `POSTGRES_USER` e `POSTGRES_PASSWORD`
   - `CHATWOOT_*`
5. Ative a opção **Service webhook** no serviço `nocagent-core` e `nocagent-web` para gerar as URLs de webhook.
6. Clique em **Deploy the stack**.

---

## 6. Configurar CI/CD no GitHub (`Wittemberg/nocagent`)

No repositório do GitHub:

1. Acesse: **Settings → Secrets and variables → Actions**.
2. Cadastre os seguintes segredos:
   - `PORTAINER_CORE_WEBHOOK_URL`: URL de webhook do serviço `core` no Portainer.
   - `PORTAINER_WEB_WEBHOOK_URL`: URL de webhook do serviço `web` no Portainer.
3. A cada `git push origin main`, o GitHub Actions:
   - Constrói a imagem Docker.
   - Publica no GitHub Container Registry (`ghcr.io`).
   - Dispara o webhook do Portainer para atualizar o container em produção sem intervenção manual.

---

## 7. Diagnóstico Rápido & Healthchecks

Healthcheck do Frontend Web:
```text
https://nocagent.awecloudsolution.com/health
```
Resposta esperada: `healthy` (HTTP 200).

Healthcheck da API & Core:
```text
https://nocagent.awecloudsolution.com/api/health
```
Resposta esperada: JSON com status de conexão com PostgreSQL, Redis e Chatwoot.

---

## 8. Sinais de Problema e Solução Rápida

### O container não inicia:
- Confira os logs do container no Portainer.
- Verifique se a migration do Prisma falhou por falta de conectividade com o PostgreSQL na rede `interna`.
- Verifique se o diretório `/var/data/nocagent/core` existe no host.

### Traefik retorna erro 502 / Bad Gateway:
- Verifique se o container está conectado à rede externa `interna`.
- Verifique se a porta declarada no Traefik confere (`3000` para a API, `80` para o Web).

### Mensagens do Chatwoot não chegam à IA:
- Acesse **Configurações → Webhooks** no Chatwoot e verifique o log de envios do webhook.
- Confirme se a URL `https://nocagent.awecloudsolution.com/api/webhooks/chatwoot` é acessível publicamente.

---

## 9. Gestão de Acesso, Superadmin & Resolução de Falhas de Login

### Acesso Inicial:
- **URL do Console:** `https://nocagent.awecloudsolution.com`
- **E-mail:** `admin@nocagent.local` (ou o valor de `DCC_DEVELOPER_USERNAME`)
- **Senha Inicial:** `NocAgent@2026!` (ou o valor de `DCC_DEVELOPER_PASSWORD`)
- O superadmin é provisionado no primeiro startup com `totpEnabled: false` para permitir login imediato sem bloqueio.

### Ativação do 2FA TOTP:
1. Após logar, clique em **• Ativar 2FA** no topo direito do dashboard.
2. Escaneie o QR Code no Google Authenticator ou Authy.
3. Digite o código de 6 dígitos para validar e ativar permanentemente.

### Recuperação de Acesso / Auto-Reparo:
Se por qualquer motivo as credenciais do superadmin precisarem ser restauradas para a senha padrão:
1. Adicione a variável `DCC_RESET_ADMIN=true` no `.env` do container `core`.
2. Reinicie o container `core`. No startup ele detectará a flag e reparará o hash Scrypt e salt imediatamente.
3. Remova a variável `DCC_RESET_ADMIN` após a recuperação.

---

## 10. Governança, Feature Flags e Emergency Kill-Switch (Fase 5)

### Status do Kill-Switch da IA:
- Visível no cabeçalho do Dashboard:
  - **Verde:** `IA: Operação Normal`
  - **Vermelho Pulsante:** `🚨 KILL-SWITCH ATIVO`
- Pode ser acionado ou liberado a qualquer momento em **Governança & APM** ou via API:
  - `POST /api/flags/kill-switch` com `{ "active": true, "reason": "Motivo da pausa" }` (Requer token de Superadmin).

### Telemetria APM em Tempo Real:
- Acesse a aba **Governança & APM** para visualizar a latência RTT em milissegundos das chamadas Proxmox, Mikrotik, pfSense e modelos de IA.
- Inspecione a tabela de **Live Traces** para diagnosticar falhas de conectividade ou timeouts de API.

