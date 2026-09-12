# 🗺️ Roadmap de Implementação — NOC-Agent
> **Estratégia:** Do Zero à Produção em 5 Fases  
> **Host de Produção:** Portainer + Traefik (`nocagent.awecloudsolution.com`)  
> **Repositório:** `https://github.com/Wittemberg/nocagent`  

---

## 📅 VISÃO GERAL DAS FASES

```
FASE 0: Fundação do Repositório & Docker Stack Spec
                 ↓
FASE 1: Runtime Hermes Agent + Chatwoot Dual-API Bridge
                 ↓
FASE 2: Servidores MCP de Rede (Proxmox, Mikrotik, pfSense, Zabbix)
                 ↓
FASE 3: Dashboard Web (React + Vite, Witteberg Standards)
                 ↓
FASE 4: Validação em Staging, Pre-Flight & Produção
                 ↓
FASE 5: Enterprise Engine, Observabilidade & Feature Flags (Pennant + Telescope + Pulse)
```

---

## 📌 STATUS ATUAL: FASES 0, 1, 2, 3, 4 E 5 CONCLUÍDAS E EM OPERAÇÃO 🚀
- **API Healthcheck & APM:** `https://nocagent.awecloudsolution.com/api/health` e `/api/observability/apm` → ✅ `HTTP 200 OK`
- **Dashboard Web:** `https://nocagent.awecloudsolution.com` → ✅ `HTTP 200 OK` (Web Nginx operacional com SSL Traefik)
- **Governança de Autonomia da IA & Emergency Kill-Switch:** Módulo de controle de autonomia (L1 Leitura, L2 Remediação, L3 Crítico) e corte imediato global de ações ativas da IA.
- **Observabilidade APM & Traces MCP em Tempo Real:** Medição contínua de latência em milissegundos para Proxmox VE, pfSense, Mikrotik RouterOS e LLMs com histórico ponta a ponta.
- **Regra Imutável:** **Zero Dados Fictícios** — todas as telas consom dados 100% reais do banco e das APIs de rede.
- **Hierarquia Multi-Tenant / Grupos e Lojas:** Gestão de clientes/tenants (`group`), filiais/unidades (`subgroup`) e tags funcionais com agrupamento visual por loja e filtros combinados.
- **Cofre Criptográfico Exclusivo:** Chaves de equipamentos (pfSense, Mikrotik, Proxmox) gerenciadas com criptografia AES-256-GCM no PostgreSQL com suporte a `backupSchedule`.
- **Cofre de Storages Ativo:** Gestão de repositórios S3/MinIO/Wasabi/SFTP/NFS vinculados aos equipamentos com agendamento de backups.
- **Hermes AI Engine com RAG & Diagnóstico Autônomo:** Processamento de linguagem natural com injeção em tempo real de telemetria de nós Proxmox, Mikrotik, pfSense e diagnóstico estruturado multi-caso (Casos 0 a 5).
- **Agentes de Host Outbound:** Suporte a 1-clique para servidores Linux (`curl ... | bash`) e Windows (`irm ... | iex`) com telemetria periódica (CPU, RAM, Disco, Uptime).
- **Dashboard Web de Alta Densidade:** Cards compactos com barras de métricas proporcionais, modo "Agrupar por Unidade", silenciador de alertas com persistência em localStorage, polling automático de 30s e retry.
- **Stacks Dedicadas (Portainer):** `docker-compose.core.yml` e `docker-compose.web.yml` para deploys atômicos e zero downtime cruzado.

---

## 📌 FASE 0: FUNDAÇÃO DO REPOSITÓRIO & INFRAESTRUTURA ✅ (Concluída em Produção)
- [x] Criar estrutura base do monorepo / módulos limpos em `Wittemberg/nocagent` (`core/`, `web/`).
- [x] Configurar `.env.example` com todas as chaves (OpenAI/Anthropic, Chatwoot, Traefik, PostgreSQL, Redis, S3, Vault).
- [x] Elaborar especificações modulares: `docker-compose.core.yml` e `docker-compose.web.yml` com labels Traefik.
- [x] Criar banco de dados `nocagent` no PostgreSQL e bucket `nocagent` no Storage S3.
- [x] Criar schema inicial Prisma com suporte a OpenSSL 3 no Alpine (`binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`).
- [x] Deploy realizado com sucesso no Portainer da infraestrutura.

---

## 📌 FASE 1: RUNTIME HERMES AGENT & CHATWOOT BRIDGE ✅ (Concluída em Produção)
- [x] Configurar container do Hermes Agent adaptado como serviço central de IA (`core/src/agent/hermes.js`).
- [x] Implementar a **Chatwoot Bridge** (`core/src/chatwoot/bridge.js`):
  - Webhook listener para eventos `message_created` do Chatwoot (Public API).
  - Client REST para a Account API do Chatwoot (gerenciamento de conversas e despacho).
- [x] Injetar o **System Prompt do NOC-Agent** com as 10 Invariantes Éticas de IA (`core/src/agent/prompts.js`).
- [x] Implementar o Cofre Criptográfico de Credenciais AES-256-GCM (`core/src/security/vault.js`).
- [x] Habilitar o sistema de aprovações Human-in-the-Loop (`core/src/agent/approvals.js`) com código em 2 etapas.
- [x] Criar Favicon oficial SVG e purgar todos os dados fictícios do frontend (`Zero Dados Fictícios`).

---

## 📌 FASE 2: SERVIDORES MCP & DRIVERS DE REDE NATIVOS ✅ (Concluída em Produção)
- [x] **Proxmox MCP Server & Driver API REST (`/api2/json`)**:
  - `proxmox_get_node_status`: consumo real de CPU, RAM alocada/total, Uptime e Quorum.
  - `proxmox_list_workloads`: inventário em tempo real de VMs QEMU e Containers LXC (`running` vs `stopped`).
  - `proxmox_storage_pools`: ocupação de storages locais/ZFS/Directory com percentual de uso.
  - `proxmox_restart_vm`: reiniciar VM com trava de aprovação obrigatória L2.
  - `proxmox_snapshot_vm`: tirar snapshot preventivo antes de janelas de manutenção.
- [x] **Mikrotik RouterOS MCP Server**:
  - `mikrotik_ping`: teste de latência e perda de pacotes via porta 8728 / RouterOS API.
  - `mikrotik_bgp_status`: checagem de sessões e interfaces de rede ativas.
  - `mikrotik_interface_traffic`: leitura de tráfego por interface.
- [x] **pfSense MCP Server**:
  - Leitura de status de gateways, perda de pacotes e latência via REST API estrita (`Accept: application/json`).
  - Autenticação resiliente tripla: `X-API-Key`, `Authorization: Bearer` e `Basic Auth`.
- [x] **Zabbix MCP Server**:
  - `zabbix_get_active_triggers`: consulta de alertas críticos ativos via JSON-RPC 2.0.
  - `zabbix_acknowledge_event`: suporte a reconhecimento e mapeamento de host.
- [x] **Hermes AI Engine MCP Integration & RAG (`core/src/agent/hermes.js`)**:
  - Telemetria em tempo real injetada no contexto conversacional do Hermes (RAG sem alucinações).
  - Raciocínio Diagnóstico Autônomo com 6 casos operacionais mapeados (Casos 0 a 5).
  - Reconhecimento automático de Grupos/Tenants e Unidades/Lojas no prompt do usuário.

---

## 📌 FASE 3: DASHBOARD WEB DE ALTA DENSIDADE ✅ (Concluída em Produção)
- [x] Setup do projeto frontend com Vite + React + Tailwind + Lucide Icons.
- [x] Implementação estrita do Design System (Witteberg Development Standards):
  - 100% responsivo em 1920px (4 cols), 1366px (3 cols), 1280px (3 cols), Tablet (2 cols), Mobile (1 col).
  - `min-width: 0` em grids e flexbox, truncamento seguro com `title` nativo.
  - Cards compactos de alta densidade acomodando dezenas de nós na mesma viewport.
  - Interface e rótulos 100% em Português (PT-BR).
- [x] Telas e Módulos do Dashboard:
  - **Visão Geral (NOC)**: Status em tempo real, métricas compactas de CPU/RAM/Disco, workloads Proxmox e gateways pfSense.
  - **Hierarquia Multi-Tenant**: Filtros por Grupo (Cliente/Tenant), Subgrupo (Loja/Filial) e Tipo de Equipamento.
  - **Visualização por Unidade**: Botão "Agrupar por Unidade" organizando equipamentos em raias dedicadas por loja com contadores.
  - **Silenciador de Alertas (Snooze)**: Mecanismo de ocultar alertas críticos (ex: link redundante) por 15m, 30m, 1h, 4h ou 24h com persistência no navegador.
  - **Cofre de Equipamentos**: Inventário criptografado com credenciais protegidas em AES-256-GCM, badges hierárquicas e agendamento de backups.
  - **Cofre de Storages**: Gerenciamento de destinos S3, MinIO, Wasabi, SFTP e NFS.
  - **Terminal IA (Chat)**: Console interativo integrado com o Hermes AI Engine para diagnósticos operacionais.
  - **Resiliência**: Polling automático de telemetria a cada 30 segundos e botão de "Tentar Novamente" com retry instantâneo.

---

## 📌 FASE 4: VALIDAÇÃO OPERACIONAL EM PRODUÇÃO ✅ (Concluída em Produção)
- [x] Subir e validar stack de produção no Portainer sob o domínio `nocagent.awecloudsolution.com`.
- [x] Validação de roteamento seguro com Traefik + SSL Let's Encrypt automático.
- [x] Teste de ponta a ponta com equipamentos reais:
  - Proxmox SuperTop e Proxmox Calvi reportando métricas de nós, VMs, LXCs e pools de storage.
  - Mikrotik SuperTop ADM reportando latência e perda de pacotes.
  - pfSense Libra reportando status dos gateways WAN em tempo real.
- [x] Validação do Cofre Criptográfico: Zero credenciais expostas na interface ou no trânsito.
- [x] CI/CD automatizado via GitHub Actions com build e webhook direto no Portainer sem intervenção manual.

---

## 📌 FASE 5: ENTERPRISE ENGINE, OBSERVABILIDADE E FEATURE FLAGS (PENNANT + TELESCOPE + PULSE)
> **Objetivo:** Escalar a plataforma para operação Enterprise e SaaS Multi-Tenant (MSPs), introduzindo controle granular de rollout para ações de IA, depuração profunda de requisições/MCPs e monitoramento de desempenho em tempo real (APM).

### 1. 🏳️ Laravel Pennant (Controle de Rollout, Kill-Switches e Autonomia de IA)
[Documentação Oficial: Laravel Pennant](https://laravel.com/framework/docs/pennant)

* **Casos de Uso no NOC-Agent:**
  * **Níveis Graduais de Autonomia da IA (L1 / L2 / L3):**
    * `Feature::define('ai-autonomous-l1-read', fn (Tenant $tenant) => true);` — Leitura autônoma de métricas e diagnósticos sem aprovação.
    * `Feature::define('ai-autonomous-l2-remediation', fn (Tenant $tenant) => $tenant->hasPlan('pro'));` — Libera remediações não-destrutivas (limpar rotas ARP, reiniciar serviços locais, limpar spool de logs).
    * `Feature::define('ai-autonomous-l3-critical', fn (Tenant $tenant) => false);` — Desligamento ou failover crítico (reboot de VM Proxmox, alteração de regras de firewall pfSense). Requer ativação explícita por cliente.
  * **Emergency Kill-Switch Imediato:**
    * Flag global `Feature::deactivate('ai-actions-global')` que corta instantaneamente todas as ações ativas da IA em caso de anomalia, sem necessidade de restart de containers ou novo deploy.
  * **Liberação Gradual de Drivers MCP (Canary Releases):**
    * Rollout de novos drivers (ex: Mikrotik RouterOS v7 BGP REST API ou Proxmox SDN) para apenas 10% ou 20% dos clientes antes da liberação geral:
      `Feature::define('driver-mikrotik-v7-rest', fn ($tenant) => Lottery::odds(1, 5));`
  * **Planos Comerciais SaaS (Feature Gating):**
    * Segmentação de recursos por plano: `storage-s3-wasabi`, `host-agent-telemetry`, `whatsapp-interactive-approvals`, `audit-log-retention-1year`.

### 2. 🔭 Laravel Telescope (Depuração Profunda, Auditoria e Rastreabilidade)
[Documentação Oficial: Laravel Telescope](https://laravel.com/framework/docs/12.x/telescope)

* **Casos de Uso no NOC-Agent:**
  * **Inspeção de Chamadas MCP & APIs de Rede (Request & Client Watchers):**
    * Visualização detalhada de cada requisição HTTP/REST despachada para o Proxmox (8006), pfSense (8181) e APIs de LLM (OpenAI/Anthropic).
    * Gravação exata de headers, payloads, códigos HTTP de retorno e tempo de resposta de cada equipamento.
  * **Webhook Watcher (Chatwoot & Zabbix):**
    * Captura de cada payload recebido no webhook do Chatwoot (`message_created`, `conversation_status_changed`) e triggers do Zabbix, permitindo reexecutar requisições de teste em ambiente de staging.
  * **Auditoria de Operações no Cofre Criptográfico (Database Watcher):**
    * Registro de queries ao PostgreSQL identificando consultas lentas e validando que campos confidenciais transitam cifrados via AES-256-GCM.
  * **Job & Queue Watcher (Telemetria dos Agentes):**
    * Acompanhamento dos processamentos assíncronos de telemetria dos agentes de host (Linux e Windows) enviados a cada 60s, detectando travamentos ou filas acumuladas no Redis.
  * **Exception Watcher & Stack Trace:**
    * Alerta imediato no painel de debug com rastreamento completo de falhas de rede (ex: handshake TLS recusado em pfSense, timeout de socket no RouterOS).

### 3. 💓 Laravel Pulse (APM em Tempo Real, Saúde do Sistema e Métricas de Produção)
[Documentação Oficial: Laravel Pulse](https://laravel.com/framework/docs/pulse)

* **Casos de Uso no NOC-Agent:**
  * **Monitoramento ao Vivo de Recursos da Aplicação (Servers Card):**
    * Uso de CPU, memória RAM e capacidade de disco dos containers/nós do NOC-Agent em tempo real, alertando antes que ocorra exaustão de memória.
  * **Slow Outgoing Requests Watcher (Identificador de Gargalos Externos):**
    * Medição precisa de latência para equipamentos remotos gerenciados:
      * Tempo de resposta da API do Proxmox VE (`/api2/json`).
      * Tempo de resposta da REST API do pfSense (`/api/v2/...`).
      * Tempo de resposta da API do RouterOS Mikrotik.
      * Latência da API do provedor LLM (OpenAI / Claude).
  * **Slow Queries & Slow Jobs:**
    * Monitoramento contínuo das rotinas de auditoria de backup e sincronização periódica de status no PostgreSQL e Redis.
  * **Cards Customizados Específicos para o NOC (Livewire Custom Cards):**
    * `NOC Fleet Health`: Contagem instantânea de equipamentos Online vs Degradados vs Offline.
    * `MCP Engine Response Time`: Gráfico de latência média agrupada por driver de equipamento.
    * `AI Approval Latency`: Tempo médio que os operadores levam para autorizar intervenções L2 no WhatsApp/Dashboard.
    * `Host Agents Pulse`: Frequência e volume de heartbeats recebidos por minuto dos servidores Linux/Windows.

---

### 📋 Entregáveis da Fase 5 Concluídos

| Etapa | Ação Técnica | Componentes | Entregável | Status |
| :--- | :--- | :--- | :--- | :--- |
| **5.1** | Modelagem de Dados & Schema Prisma | `core/prisma/schema.prisma` | Modelos `FeatureFlag`, `McpTrace` e `SystemMetric` com índices e relações | ✅ Concluído |
| **5.2** | Motor de Feature Flags & Kill-Switch | `core/src/security/flags.js` | Suporte a Redis + fallback em memória, níveis L1/L2/L3 e trava de segurança ativa | ✅ Concluído |
| **5.3** | Motor APM de Baixa Latência | `core/src/observability/apm.js` | Coleta de RTT em ms por driver (Proxmox, pfSense, Mikrotik, LLM) com buffer e flush | ✅ Concluído |
| **5.4** | Instrumentação MCP & Trava no Hermes | `core/src/agent/mcpTools.js` e `hermes.js` | Chamadas MCP protegidas pelo Kill-Switch e traces gravados automaticamente | ✅ Concluído |
| **5.5** | Endpoints REST de Governança | `core/src/server.js` | `/api/flags`, `/api/flags/kill-switch`, `/api/observability/apm`, `/api/observability/traces` | ✅ Concluído |
| **5.6** | Painel Web "Governança & APM" | `web/src/App.jsx` | Nova aba com cards de APM, matriz de flags, live inspector de traces e modal de Kill-Switch | ✅ Concluído |
| **5.7** | Status Indicator em Tempo Real | Header do Dashboard | Badge dinâmico no topo com alerta pulsante quando o Kill-Switch estiver ativo | ✅ Concluído |
| **5.8** | Isolamento Estrito Multi-Tenant & Zero Data Leak | `core/src/server.js`, `hermes.js`, `schema.prisma` | Particionamento por `tenantId` em 100% dos endpoints, RAG contextualizado e migração de órfãos | ✅ Concluído |
| **5.9** | Gestão Visual de Planos & Cotas Operacionais | `web/src/App.jsx`, `core/src/server.js` | Modal e cards com cotas (Equipamentos, Usuários, Storages, IA L1-L3, Retenção) e bloqueio 403 | ✅ Concluído |



