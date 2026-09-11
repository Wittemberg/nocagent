# 🚀 Guia de Separação de Stacks no Portainer (Core & Web)

> **Objetivo:** Isolar o serviço de **Backend/IA (Core)** do serviço de **Frontend (Web)** em duas Stacks independentes no Portainer, garantindo **Zero Downtime Cruzado** e deploys atômicos independentes.

---

## 🏗️ 1. Por que separar as Stacks?

| Cenário Anterior (1 Stack Unificada) | Novo Cenário (2 Stacks Dedicadas) |
|---|---|
| Qualquer ajuste no React (Frontend) disparava o webhook da stack inteira e podia reiniciar o Core. | O Frontend atualiza em segundos sem afetar o Core. |
| O atendimento WhatsApp / Chatwoot e rotinas da IA podiam ter breves quedas durante deploys do Web. | **Zero Downtime no Core:** O motor Hermes e o WhatsApp ficam 100% online 24/7. |
| Um único webhook genérico para tudo. | Dois Webhooks atômicos: `PORTAINER_CORE_WEBHOOK_URL` e `PORTAINER_WEB_WEBHOOK_URL`. |

Ambas as stacks continuam se comunicando através da rede Docker externa `interna` e compartilham o mesmo domínio público `nocagent.awecloudsolution.com` gerenciado pelo Traefik:
* `https://nocagent.awecloudsolution.com/api/*` ➔ **nocagent-core**
* `https://nocagent.awecloudsolution.com/*` ➔ **nocagent-web**

---

## 📦 2. Stack 1: `nocagent-core` (Backend & IA)

### 2.1 Criar a Stack no Portainer
1. No Portainer, vá em **Stacks** ➔ **Add stack**.
2. **Name:** `nocagent-core`
3. **Build method:** *Web editor*
4. Cole o conteúdo do arquivo [`docker-compose.core.yml`](file:///var/www/nocagent/docker-compose.core.yml):

```yaml
services:
  core:
    image: ghcr.io/wittemberg/nocagent-core:latest
    restart: unless-stopped
    networks:
      - interna
    environment:
      PORT: 3000
      NODE_ENV: production
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
      OPENAI_API_KEY: "${OPENAI_API_KEY}"
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-nocagent}?schema=public"
      REDIS_URL: "redis://redis:6379/0"
      REDIS_KEY_PREFIX: "nocagent:"
      S3_ENDPOINT: "${S3_ENDPOINT}"
      S3_REGION: "${S3_REGION:-us-east-1}"
      S3_ACCESS_KEY: "${S3_ACCESS_KEY}"
      S3_SECRET_KEY: "${S3_SECRET_KEY}"
      S3_BUCKET: "${S3_BUCKET:-nocagent}"
      S3_PUBLIC_URL: "${S3_PUBLIC_URL:-https://storage.awecloudsolution.com/nocagent}"
      VAULT_MASTER_KEY: "${VAULT_MASTER_KEY}"
      DCC_ENABLED: "${DCC_ENABLED:-true}"
      DCC_DEVELOPER_USERNAME: "${DCC_DEVELOPER_USERNAME}"
      DCC_TOTP_SECRET: "${DCC_TOTP_SECRET}"
      CHATWOOT_BASE_URL: "${CHATWOOT_BASE_URL}"
      CHATWOOT_ACCOUNT_ID: "${CHATWOOT_ACCOUNT_ID}"
      CHATWOOT_ACCOUNT_API_KEY: "${CHATWOOT_ACCOUNT_API_KEY}"
      CHATWOOT_INBOX_ID: "${CHATWOOT_INBOX_ID}"
      CHATWOOT_INBOX_API_KEY: "${CHATWOOT_INBOX_API_KEY}"
      CHATWOOT_WEBHOOK_SECRET: "${CHATWOOT_WEBHOOK_SECRET}"
      ZABBIX_API_URL: "${ZABBIX_API_URL:-}"
      ZABBIX_API_TOKEN: "${ZABBIX_API_TOKEN:-}"
    volumes:
      - /var/data/nocagent/core:/app/data
    deploy:
      replicas: 1
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.nocagent-api.rule=Host(`nocagent.awecloudsolution.com`) && PathPrefix(`/api`)"
        - "traefik.http.routers.nocagent-api.entrypoints=websecure"
        - "traefik.http.routers.nocagent-api.tls.certresolver=letsencryptresolver"
        - "traefik.http.services.nocagent-api.loadbalancer.server.port=3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 4

networks:
  interna:
    external: true
```

5. Na seção **Environment variables**, mantenha as variáveis de banco, chaves de IA, S3, Chatwoot e Vault (copie as mesmas que você já havia preenchido na stack anterior).
6. Habilite a opção **Webhook** na stack e copie a URL gerada:
   * URL do Webhook da Stack Core ➔ Guarde para o passo 4.
7. Clique em **Deploy the stack**.

---

## 🌐 3. Stack 2: `nocagent-web` (Dashboard React)

### 3.1 Criar a Stack no Portainer
1. No Portainer, vá em **Stacks** ➔ **Add stack**.
2. **Name:** `nocagent-web`
3. **Build method:** *Web editor*
4. Cole o conteúdo do arquivo [`docker-compose.web.yml`](file:///var/www/nocagent/docker-compose.web.yml):

```yaml
services:
  web:
    image: ghcr.io/wittemberg/nocagent-web:latest
    restart: unless-stopped
    networks:
      - interna
    deploy:
      replicas: 1
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.nocagent-web.rule=Host(`nocagent.awecloudsolution.com`)"
        - "traefik.http.routers.nocagent-web.entrypoints=websecure"
        - "traefik.http.routers.nocagent-web.tls.certresolver=letsencryptresolver"
        - "traefik.http.services.nocagent-web.loadbalancer.server.port=80"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  interna:
    external: true
```

5. Essa stack **não precisa de variáveis de ambiente secretas** (o frontend consome a API do Core via navegador e Traefik).
6. Habilite a opção **Webhook** na stack e copie a URL gerada:
   * URL do Webhook da Stack Web ➔ Guarde para o passo 4.
7. Clique em **Deploy the stack**.

---

## 🔑 4. Configurar os Secrets no GitHub

No repositório do GitHub (`https://github.com/Wittemberg/nocagent`):
1. Vá em **Settings** ➔ **Secrets and variables** ➔ **Actions**.
2. Cadastre / Atualize os dois segredos:
   * **`PORTAINER_CORE_WEBHOOK_URL`**: Cole a URL do webhook da stack `nocagent-core`.
   * **`PORTAINER_WEB_WEBHOOK_URL`**: Cole a URL do webhook da stack `nocagent-web`.
3. *(Opcional)* Se ainda existir o segredo unificado `PORTAINER_STACK_WEBHOOK_URL`, você pode removê-lo ou mantê-lo como fallback.

---

## 🧹 5. Limpeza da Stack Antiga Unificada
Depois de subir `nocagent-core` e `nocagent-web` e validar que ambos estão respondendo com `HTTP 200`, remova a stack unificada antiga `nocagent` no Portainer para não manter containers duplicados na porta do Traefik.

---

## ✅ 6. Validação dos Endpoints

```bash
# Validar API do Core
curl -sk https://nocagent.awecloudsolution.com/api/health
# Resposta esperada: {"status":"ok","service":"nocagent-core", ...}

# Validar Dashboard Web
curl -sk https://nocagent.awecloudsolution.com/
# Resposta esperada: HTML do Dashboard (HTTP 200)
```
