# 🐳 Especificação da Stack Portainer — NOC-Agent
> **Host Oficial:** `nocagent.awecloudsolution.com`  
> **Nome da Stack Portainer:** `noc-agent`  
> **Rede Externa:** `interna` (Rede padrão compartilhada com Traefik, Postgres e Redis)  
> **Certresolver Traefik:** `letsencryptresolver`  
> **Padrão de Infraestrutura:** Alinhado 100% aos projetos `admin-ofertas-front` e `api-ofertas`  

---

## 1. DOCKER COMPOSE / PORTAINER STACK (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  # --- 1. CORE / RUNTIME & GATEWAY DE IA (HERMES AGENT + CHATWOOT BRIDGE) ---
  core:
    image: ghcr.io/wittemberg/nocagent-core:latest
    networks:
      - interna
    environment:
      - NODE_ENV=production
      - PORT=3000
      # LLM Providers
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      # Banco de dados existente na rede interna
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/nocagent?schema=public
      # Redis existente na rede interna
      - REDIS_URL=redis://redis:6379/0
      - REDIS_KEY_PREFIX=nocagent:
      # Storage S3 (AWS S3, Cloudflare R2, Backblaze B2 ou S3 local)
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_REGION=${S3_REGION}
      - S3_ACCESS_KEY=${S3_ACCESS_KEY}
      - S3_SECRET_KEY=${S3_SECRET_KEY}
      - S3_BUCKET=${S3_BUCKET}
      - S3_PUBLIC_URL=https://storage.awecloudsolution.com/nocagent
      # DCC — Developer Control Channel (Superadmin Protection & 2FA)
      - DCC_ENABLED=${DCC_ENABLED}
      - DCC_DEVELOPER_USERNAME=${DCC_DEVELOPER_USERNAME}
      - DCC_TOTP_SECRET=${DCC_TOTP_SECRET}
      # Chatwoot Integration (Dual-API)
      - CHATWOOT_BASE_URL=${CHATWOOT_BASE_URL}
      - CHATWOOT_ACCOUNT_ID=${CHATWOOT_ACCOUNT_ID}
      - CHATWOOT_ACCOUNT_API_KEY=${CHATWOOT_ACCOUNT_API_KEY}
      - CHATWOOT_INBOX_ID=${CHATWOOT_INBOX_ID}
      - CHATWOOT_INBOX_API_KEY=${CHATWOOT_INBOX_API_KEY}
      - CHATWOOT_WEBHOOK_SECRET=${CHATWOOT_WEBHOOK_SECRET}
      # Zabbix Integration
      - ZABBIX_API_URL=${ZABBIX_API_URL}
      - ZABBIX_API_TOKEN=${ZABBIX_API_TOKEN}
    volumes:
      # Persistência de sessões locais, logs e dados do Hermes no host
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

  # --- 2. DASHBOARD WEB (REACT + VITE + NGINX) ---
  web:
    image: ghcr.io/wittemberg/nocagent-web:latest
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
      retries: 4

networks:
  interna:
    external: true
```

---

## 2. CI/CD AUTOMATIZADO VIA GITHUB ACTIONS

Seguindo o padrão dos seus repositórios (`admin-ofertas-front` e `api-ofertas`), o deploy é 100% automatizado no `push` para a branch `main`:

### Workflow do Core / API (`.github/workflows/docker-core.yml`)
```yaml
name: Build and Deploy NOC-Agent Core

on:
  push:
    branches: [ main ]
    paths:
      - 'core/**'
      - 'prisma/**'
      - 'Dockerfile.core'
      - '.github/workflows/docker-core.yml'

permissions:
  contents: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Login GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile.core
          push: true
          tags: ghcr.io/wittemberg/nocagent-core:latest

      - name: Redeploy Portainer (Webhook)
        run: |
          curl -X POST ${{ secrets.PORTAINER_CORE_WEBHOOK_URL }}
```

### Workflow do Frontend Web (`.github/workflows/docker-web.yml`)
```yaml
name: Build and Deploy NOC-Agent Web

on:
  push:
    branches: [ main ]
    paths:
      - 'web/**'
      - 'Dockerfile.web'
      - 'nginx.conf'
      - '.github/workflows/docker-web.yml'

permissions:
  contents: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Login GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: ./web
          file: ./web/Dockerfile
          push: true
          tags: ghcr.io/wittemberg/nocagent-web:latest

      - name: Redeploy Portainer (Webhook)
        run: |
          curl -X POST ${{ secrets.PORTAINER_WEB_WEBHOOK_URL }}
```

---

## 3. PADRÃO DOS DOCKERFILES

### Dockerfile do Core (Backend + Prisma + Hermes)
No mesmo modelo de inicialização com migração automática do `api-ofertas`:
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Dependências do sistema para o core e verificações
RUN apk add --no-cache curl python3 py3-pip bash

COPY package*.json ./
COPY prisma ./prisma

RUN npm install
RUN npx prisma generate

COPY . .

EXPOSE 3000

# Executa migrations do Prisma automaticamente e sobe o serviço
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

### Dockerfile do Web (Frontend React + Nginx)
No mesmo modelo multi-stage do `admin-ofertas-front` e `app-ofertas`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Conf Padronizado (`nginx.conf`)
```nginx
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

---

## 4. PERSISTÊNCIA DE DADOS NO SERVIDOR (VOLUMES & STORAGE)

Seguindo a política de **persistência estrita**:

1. **Host Bind Mounts**:
   - Diretório `/var/data/nocagent/core` criado no host para dados de estado local do Hermes (sessões SQLite FTS5, cache de mídia WhatsApp, chaves locais).
   - Diretório com permissões: `mkdir -p /var/data/nocagent/core && chown -R 1000:1000 /var/data/nocagent`.
2. **PostgreSQL Existente**:
   - Conexão direta via rede `interna` no container `postgres:5432`.
   - Novo database: `nocagent`.
3. **Redis Existente**:
   - Conexão direta via rede `interna` no container `redis:6379`.
   - Isolamento via prefixo `nocagent:`.
4. **Storage S3**:
   - Configurável via `S3_ENDPOINT` — aponta para o endpoint do storage S3 (`http://s3:9000`), AWS S3, Cloudflare R2 ou qualquer provedor S3 compatível.
   - Novo bucket: definido em `S3_BUCKET` (ex: `nocagent`) com URL pública apontada via Traefik.
   - `S3_REGION` obrigatório para compatibilidade com AWS SDK (usar `us-east-1` por padrão para S3 local).

---

## 5. SCRIPT DE DEPLOY MANUAL / FALLBACK (`deploy.sh`)

No mesmo padrão do `admin-ofertas-front/deploy.sh`:
```bash
#!/bin/bash
set -e

echo "=== Atualizando NOC-Agent ==="

# Puxa as imagens mais recentes do GHCR
docker pull ghcr.io/wittemberg/nocagent-core:latest
docker pull ghcr.io/wittemberg/nocagent-web:latest

# Aplica o stack no Swarm / Portainer
docker stack deploy -c /root/nocagent/docker-compose.yml noc-agent

echo "=== Aguardando subida dos containers ==="
sleep 5
docker service ls | grep noc-agent
```
