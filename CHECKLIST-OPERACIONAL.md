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

---

## 11. Política de Segurança Multi-Tenant & Governança de Cotas

### A. Regra Geral de Isolamento de Dados
1. **Escopo Obrigatório por Tenant:**
   - Todo usuário autenticado possui `tenantId` e `role` gravados no token JWT.
   - Requisições emitidas por perfis não-`SUPERADMIN` (`TENANT_MASTER`, `OPERATOR`, `VIEWER`) são automaticamente filtradas no banco de dados por `where: { tenantId }`.
   - Endpoints cobertos: `/api/equipments/status`, `/api/equipments`, `/api/gateways`, `/api/storages`, `/api/backups`, `/api/audit-logs`, `/api/chat`.
2. **Prevenção de Vazamento Cruzado:**
   - Nenhum equipamento, gateway ou alerta de contingência de um cliente pode ser visível no painel de outro cliente.
   - Tenants recém-cadastrados sem ativos iniciam em estado limpo (`empty state`), solicitando o cadastro do primeiro equipamento no Cofre.
3. **Auto-Migração de Registros Órfãos:**
   - Durante a inicialização do container `core`, a rotina de bootstrap associa automaticamente quaisquer registros legados sem `tenantId` ao tenant padrão do sistema (`noc-corp`), impedindo que fiquem acessíveis a novos tenants.

### B. Gestão de Planos e Limites de Cotas
1. **Presets Padrão:**
   - **STARTER:** 10 equipamentos, 3 usuários, 1 storage, IA L1 (Diagnóstico), 7 dias de retenção.
   - **PROFESSIONAL:** 50 equipamentos, 10 usuários, 3 storages, IA L2 (Remediação), 30 dias de retenção.
   - **ENTERPRISE:** Cotas ilimitadas (`0`), IA L3 (Crítico / Autônomo), 90 dias de retenção.
2. **Comportamento ao Atingir a Cota:**
   - A tentativa de cadastrar novos equipamentos, usuários ou repositórios de backup além da cota configurada retorna `HTTP 403 Forbidden` com a mensagem indicando a capacidade máxima atingida.
   - Para expandir os limites de uma organização, o Superadmin deve acessar **Tenants → Editar**, ajustar os valores de cota desejados e salvar.

### C. Procedimento Operacional: Clonagem de Equipamentos (Cadastro em Massa)
1. **Fluxo Rápido:**
   - No card do equipamento (Visão Geral) ou na tabela do Cofre, clique no ícone **Clonar Equipamento** (`Copy`).
   - O modal de cadastro se abrirá com tipo, grupo, subgrupo, tags, políticas de backup e usuário (`username`) pré-preenchidos.
   - Senhas, tokens e chaves privadas são zerados por política de segurança.
2. **Prevenção de Duplicidade:**
   - O sistema bloqueia a gravação se o nome ou o endpoint (`host:port`) forem idênticos a qualquer equipamento já cadastrado na organização.
   - O operador deve obrigatoriamente preencher o novo IP/Host e definir a senha/token do novo ativo.

### D. Identificação de Internet Ativa no Mikrotik (RouterOS)
1. **Boas Práticas de Nomenclatura e Comentários:**
   - Para que o NOC-Agent identifique e exiba o link com máxima clareza, adicione comentários descritivos nas portas WAN do Mikrotik (ex: `"VIVO FIBRA 600M"`, `"CLARO 4G BACKUP"`, `"STARLINK DEDICADO"`).
2. **Detecção Automática:**
   - O driver RouterOS inspeciona a rota padrão ativa (`dst-address=0.0.0.0/0`, `active=true`), mapeando a interface de saída principal como `INTERNET ATIVA`.
   - Links secundários conectados e em espera são sinalizados como `STANDBY / BACKUP`.
   - Portas desativadas ou sem link físico são exibidas como `DOWN`.
   - O tráfego acumulado `RX` (download) e `TX` (upload) é lido diretamente das interfaces e exibido no card.

