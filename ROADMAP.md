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

## 📌 STATUS ATUAL: FASES 0 E 1 CONCLUÍDAS E EM OPERAÇÃO 🚀
- **API Healthcheck:** `https://nocagent.awecloudsolution.com/api/health` → ✅ `HTTP 200 OK` (Core operacional)
- **Dashboard Web:** `https://nocagent.awecloudsolution.com` → ✅ `HTTP 200 OK` (Web Nginx operacional com SSL Traefik)
- **Regra Imutável:** **Zero Dados Fictícios** — todas as telas consom dados 100% reais do banco e das APIs.
- **Cofre Criptográfico Exclusivo:** Chaves de equipamentos gerenciadas 100% no PostgreSQL com criptografia AES-256-GCM.
- **Cofre de Storages Ativo:** Gestão de repositórios S3/MinIO/Wasabi/SFTP/NFS vinculados aos equipamentos com agendamento de backups.
- **Agentes de Host Outbound:** Suporte a 1-clique para servidores Linux (`curl ... | bash`) e Windows (`irm ... | iex`) com telemetria periódica (CPU, RAM, Disco, Uptime).
- **Stacks Dedicadas (Portainer):** `docker-compose.core.yml` e `docker-compose.web.yml` para deploys atômicos e zero downtime cruzado.

---

## 📌 FASE 0: FUNDAÇÃO DO REPOSITÓRIO & INFRAESTRUTURA ✅ (Deploy Validado)
- [x] Criar estrutura base do monorepo / módulos limpos em `Wittemberg/nocagent` (`core/`, `web/`).
- [x] Configurar `.env.example` com todas as chaves (OpenAI/Anthropic, Chatwoot, Traefik, PostgreSQL, Redis, S3, Vault).
- [x] Elaborar especificações modulares: `docker-compose.core.yml` e `docker-compose.web.yml` com labels Traefik.
- [x] Criar banco de dados `nocagent` no PostgreSQL e bucket `nocagent` no Storage S3.
- [x] Criar schema inicial Prisma com suporte a OpenSSL 3 no Alpine (`binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`).
- [x] Deploy realizado com sucesso no Portainer da infraestrutura.

---

## 📌 FASE 1: RUNTIME HERMES AGENT & CHATWOOT BRIDGE ✅ (Deploy Validado)
- [x] Configurar container do Hermes Agent adaptado como serviço central de IA (`core/src/agent/hermes.js`).
- [x] Implementar a **Chatwoot Bridge** (`core/src/chatwoot/bridge.js`):
  - Webhook listener para eventos `message_created` do Chatwoot (Public API).
  - Client REST para a Account API do Chatwoot (gerenciamento de conversas e despacho).
- [x] Injetar o **System Prompt do NOC-Agent** com as 10 Invariantes Éticas de IA (`core/src/agent/prompts.js`).
- [x] Implementar o Cofre Criptográfico de Credenciais AES-256-GCM (`core/src/security/vault.js`).
- [x] Habilitar o sistema de aprovações Human-in-the-Loop (`core/src/agent/approvals.js`) com código em 2 etapas.
- [x] Criar Favicon oficial SVG e purgar todos os dados fictícios do frontend (`Zero Dados Fictícios`).

---

## 📌 FASE 2: SERVIDORES MCP & DRIVERS DE REDE
- [ ] **Proxmox MCP Server & Driver API REST (`/api2/json`)**:
  - `proxmox_get_node_status`: consumo real de CPU, RAM alocada/total, Uptime e Quorum.
  - `proxmox_list_workloads`: inventário em tempo real de VMs QEMU e Containers LXC (`running` vs `stopped`).
  - `proxmox_storage_pools`: ocupação de storages locais/ZFS/Ceph.
  - `proxmox_restart_vm`: reiniciar VM com trava de aprovação obrigatória L2.
  - `proxmox_snapshot_vm`: tirar snapshot preventivo antes de janelas de manutenção.
- [ ] **Mikrotik RouterOS MCP Server**:
  - `mikrotik_ping`: teste de latência e perda de pacotes via porta 8728.
  - `mikrotik_bgp_status`: checagem de sessões BGP e peerings.
  - `mikrotik_interface_traffic`: leitura de tráfego por interface.
  - `mikrotik_dhcp_leases`: consulta de clientes e concessões.
- [ ] **pfSense MCP Server**:
  - Leitura de status de gateways, VPNs IPsec/OpenVPN e regras de firewall via REST API estrita (`Accept: application/json`).
- [ ] **Zabbix MCP Server**:
  - `zabbix_get_active_triggers`: consulta de alertas críticos ativos.
  - `zabbix_acknowledge_event`: reconhecimento de alarmes pelo operador.

---

## 📌 FASE 3: DASHBOARD WEB (WITTEBERG DEVELOPMENT STANDARDS)
- [ ] Setup do projeto frontend com Vite + React + TypeScript + Vanilla CSS.
- [ ] Implementação estrita do Design System:
  - 100% responsivo em 1920px (4 cols), 1366px (3 cols), 1280px (3 cols), Tablet (2 cols), Mobile (1 col).
  - `min-width: 0` em grids e flexbox, proibido `overflow:hidden` para mascarar quebras.
  - Ações em cards padronizadas (`grid-template-columns: repeat(2, minmax(0, 1fr))`).
  - Interface e rótulos 100% em Português (PT-BR).
- [ ] Telas do Dashboard:
  - **Overview**: Mapa de status da rede, incidentes ativos e carga.
  - **Aprovações**: Fila de ações pendentes aguardando aprovação humana.
  - **Equipamentos**: Inventário de nós Proxmox, Mikrotik e servidores monitorados.
  - **Cofre de Storages**: Gerenciamento de destinos S3, MinIO, Wasabi, SFTP e NFS.
  - **Auditoria**: Log imutável de todas as ações executadas pela IA e operadores.

---

## 📌 FASE 4: INTEGRAÇÃO COM ZABBIX & VALIDAÇÃO OPERACIONAL
- [ ] Subir/conectar o servidor Zabbix à rede interna.
- [ ] Configurar webhook no Zabbix para notificar o NOC-Agent em caso de trigger `High` ou `Disaster`.
- [ ] Teste de ponta a ponta:
  - Zabbix detecta queda de link → dispara webhook → Hermes analisa topologia via Mikrotik MCP → envia diagnóstico para Chatwoot/WhatsApp → operador autoriza rota de contingência → ação executada e confirmada.
- [ ] Validação de segurança (Zero secrets no frontend, RBAC por número).
- [ ] Deploy final da Stack no Portainer.

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

### 📋 Plano de Implementação da Fase 5 (Passo a Passo)

| Etapa | Ação Técnica | Ferramentas / Componentes | Entregável |
| :--- | :--- | :--- | :--- |
| **5.1** | Setup da Engine Enterprise no Stack | PHP 8.3+, Composer, Redis, PostgreSQL | Módulo central configurado com suporte a drivers e workers de alta performance |
| **5.2** | Instalação e Migrations do Pennant | `laravel/pennant` + Driver de Banco de Dados | Tabelas `features` criadas; classes de definição de flags para L1/L2/L3 e Kill-Switches |
| **5.3** | Configuração do Telescope (Staging/Restrito) | `laravel/telescope` + Auth Gate | Dashboard `/telescope` restrito a Sysadmins via Traefik/VPN; watchers de HTTP, Jobs e DB ativos |
| **5.4** | Instalação e Configuração do Pulse (Produção) | `laravel/pulse` + Livewire + Redis Ingest | Dashboard `/pulse` operacional em produção com métricas de servidores e requisições lentas |
| **5.5** | Criação dos Cards Customizados de NOC | Pulse Custom Recorders & Livewire Components | Cards de *MCP Latency*, *Host Telemetry Ingest* e *AI Cost & Approvals* ativos |
| **5.6** | Políticas de Retenção e Purga Automática | Cron de limpeza (`telescope:prune`, `pulse:clear`) | Política de retenção configurada (ex: 48h para Telescope em dev, 7 dias de agregação no Pulse) |
| **5.7** | Proteção de Segurança e Traefik Routing | Traefik Basic-Auth / OAuth2 Proxy | Endpoints administrativos 100% isolados da internet pública |

