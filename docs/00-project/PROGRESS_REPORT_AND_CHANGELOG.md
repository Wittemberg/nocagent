# Relatório de Progresso e Registro de Evolução (Changelog) — InfraOps AI

> **Data de Atualização:** Agosto / 2026  
> **Status de Produção:** 🟢 **30/30 Etapas Concluídas — Plataforma 100% Operacional, Autônoma, com Inteligência de Infraestrutura & Development Control Center**  
> **Ambiente Oficial:** https://infraopsai.awecloudsolution.com

---

## 1. Resumo Executivo

O InfraOps AI concluiu integralmente todas as **30 etapas de engenharia, arquitetura e produto**, tornando-se uma plataforma completa e de ponta a ponta de Governança, Operações Autônomas, Inteligência de Infraestrutura (AIOps) e Controle Técnico de Desenvolvimento (DCC).

```text
[Fundação e Plataforma: Etapas 01–20] ======================================== 100% CONCLUÍDO
[Autonomous Operations: Etapas 21–24] ======================================== 100% CONCLUÍDO
[Infrastructure Intelligence: Etapa 25] ====================================== 100% CONCLUÍDO
[Infrastructure Source of Truth: Etapa 26] =================================== 100% CONCLUÍDO
[Network Devices & WAN Actions: Etapa 27] ==================================== 100% CONCLUÍDO
[Simple Experience & Frontend Refactor: Etapa 28] ============================= 100% CONCLUÍDO
[Production Hardening & pfSense Telemetry: Etapa 29] ========================= 100% CONCLUÍDO
[Development Control Center & Human Validation: Etapa 30] ===================== 100% CONCLUÍDO
[Módulos Extras: Catálogo de Actions, Chatwoot & Quepasa APIs] ================ 100% CONCLUÍDO
```

---

## 2. Detalhamento de Todas as Etapas Concluídas (01–28)

### Etapas 01–05 — Fundação, Arquitetura e Governança Multi-Tenant 🟢
- Padrões rigorosos de segurança e arquitetura (`AGENTS.md`, ADRs e governança não-negociável).
- Monorepo TypeScript/Go com arquitetura modular.
- Modelo de dados multi-tenant estrito com isolamento por organização/cliente.
- Autenticação e RBAC granular (`superadmin`, `admin`, `operator`, `auditor`, `viewer`).

### Etapas 06–10 — Agente Seguro, Protocolo Outbound e Auditoria Criptográfica 🟢
- Agent em Golang com conexões exclusivamente *outbound* (sem necessidade de SSH inbound ou portas abertas).
- Protocolo seguro mTLS com polling de tarefas e heartbeats criptografados.
- **Action Framework Tipado**: Apenas ações homologadas e catalogadas podem ser executadas.
- **Policy Engine**: Avaliação mandatória de políticas antes de qualquer execução.
- **Audit Hash Chain SHA-256**: Registro auditável e imutável de todas as execuções de Jobs e Actions.
- Vault seguro de credenciais (sem plaintext em logs ou respostas).

### Etapas 11–15 — Observabilidade, Hipervisores, Backups e Orquestração de IA 🟢
- Métricas em tempo real com Prometheus e telemetria temporal.
- Integração nativa com **Proxmox VE** (API oficial para nós, VMs e LXCs).
- Integração nativa com **Virtualizor** (API oficial).
- **Backup Engine**: Políticas de RPO/RTO, auditoria de integridade e retenção segura.
- **AI Orchestrator Multi-Provedor**: Suporte a Groq Cloud, OpenAI, DeepSeek, Claude, Gemini e Ollama local, com validação de chaves ao vivo (`🟢 CHAVE ATIVA`) e exigência estrita de chave válida (eliminação de respostas genéricas simuladas).

### Etapas 16–20 — Interface Web, Alertas, Deploy e Hardening 🟢
- Interface Web moderna (React/Vite) responsiva, com Dark/Light Mode e layout glassmorphism.
- Gestão e aprovação de execuções com tela de Auditoria e Linha do Tempo.
- Pipeline CI/CD com GitHub Actions, Portainer, Docker Swarm e Traefik SSL automático.
- Testes automatizados e fechamento da base operacional.

### Etapa 21 — Autonomous Scheduler & Automation Engine 🟢
- Agendamento de rotinas operacionais (Cron, Intervalo, One-shot) com respeito a timezones e janelas de manutenção.

### Etapa 22 — Conditional Triggers & Event Automation Engine 🟢
- Gatilhos reativos orientados a telemetria com travas anti-flapping (Debounce, Cooldown, Circuit Breaker e Deduplicação).

### Etapa 23 — Autonomous Policies & Self-Healing Engine 🟢
- Governança de autonomia Níveis 0 a 5, prechecks/postchecks obrigatórios, orçamentos de risco (*Risk Budget*) e auto-escalonamento para canais de alerta.

### Etapa 24 — Goal-Oriented Infrastructure Management 🟢
- Gestão contínua de metas declarativas e SLOs (*Storage $\ge$ 20%*, *Backup RPO $\le$ 24h*, *Uptime $\ge$ 99.9%*) com medidores visuais de conformidade.

---

### Etapa 25 — Infrastructure Intelligence & Continuous Improvement 🟢 (CONCLUÍDO)
- **Mineração de Incidentes Recorrentes (25.1 & 25.2):**
  - Agrupamento determinístico de falhas repetitivas e identificação de quando ações pontuais mascaram problemas estruturais.
- **Recomendações Arquiteturais Governanadas (25.3 & ADR-017):**
  - Recomendações estritamente consultivas com evidências mensuráveis, cálculo de confiança (0–100%), risco, esforço e estimativa de ROI.
  - Geração de *Change Plans* governados com pré-requisitos, janelas e aprovação prévia.
- **Previsão de Capacidade (25.4 - Capacity Forecasting):**
  - Projeções de saturação de disco/RAM/CPU em horizontes de 7, 30, 90 e 180 dias com cenários Base, Conservador e Acelerado.
- **Auditoria de SPOF & Resiliência (25.5):**
  - Mapeamento de nós isolados, storages sem réplica e destinos únicos de backup com diagramação da cadeia de dependências.
- **Índice de Dívida Técnica (25.6 - Technical Debt Score):**
  - Score de 0 a 100 por tenant decomposto nos 6 pilares de engenharia com deduções explicáveis.
- **Perfil Financeiro & ROI Transparente (25.7):**
  - Parametrização de taxas horárias e custos de downtime por tenant (**sem inventar dados financeiros fictícios**).
- **Validação de Eficácia Before/After (25.9):**
  - Auditoria do ganho real de estabilidade e performance após a implementação de uma recomendação.
- **Relatório Executivo para MSPs & QBR (25.10):**
  - Painel consolidado demonstrando horas técnicas economizadas, incidentes evitados e justificativas de investimento com ROI comprovado.

---

## 3. Avanços Recentes de Plataforma, Identidade & Operações Gerais 🟢

### 3.1. Painel Mestre de Configurações Gerais do Sistema (9 Subsistemas)
Centralização completa e testes de conectividade ao vivo em tempo real para toda a infraestrutura:
1. **📧 Servidor SMTP:** Suporte a Host, Porta, STARTTLS/SSL, autenticação e botão de teste ao vivo (`POST /api/v1/settings/system/test-smtp`).
2. **🪣 Storage S3 / MinIO:** Configuração de Endpoints, Buckets, Access/Secret Keys e Path-Style com validação ao vivo (`POST /api/v1/settings/system/test-s3`).
3. **🗄️ PostgreSQL 16:** Gestão de Host, Porta, Database, Usuário e Pool de Conexões.
4. **⚡ Redis & Filas (BullMQ):** Gerenciamento do broker de mensageria assíncrona, filas de jobs e teste de latência (`POST /api/v1/settings/system/test-redis`).
5. **📊 Telemetria (Prometheus / Grafana):** Configuração de endpoints de coleta, intervalos de scrape, retenção e dashboards embed com teste (`POST /api/v1/settings/system/test-telemetry`).
6. **🤖 Provedores de IA & LLMs:** Parametrização multi-motor (OpenAI, Anthropic, Gemini, Ollama local), chaves de API, modelos e teste de inferência ao vivo (`POST /api/v1/settings/system/test-ai`).
7. **📦 Agente de Host (Outbound):** Endpoint de enrollment, frequência de heartbeat, limites de detecção de nós offline e nível de autonomia padrão.
8. **🏢 White-Label & Suporte MSP:** Personalização da identidade visual, logotipo, empresa MSP, contatos de WhatsApp do NOC e texto de rodapé.
9. **🔐 Segurança & Políticas Globais:** TTL de sessão JWT, tentativas máximas de login, duração do lockout temporário e complexidade de senhas.

### 3.2. Governança de Identidade, Credenciais e Primeiro Acesso
- **Troca Mandatória no Primeiro Login (`mustChangePassword`):** Novos usuários são forçados a redefinir sua credencial antes de obter acesso à plataforma.
- **Gerador Seguro de Senhas:** Criação assistida de senhas complexas e aleatórias no cadastro e edição de usuários.
- **Fluxo "Esqueci a Senha":** Recuperação segura por PIN/Token de 6 dígitos com expiração de 15 minutos e redefinição direta de credencial (`POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`).
- **Ciclo de Vida de Usuários:** Exclusão segura de usuários (`DELETE /api/v1/users/:id`), alternador rápido de status `🟢 Ativo / 🔴 Inativo` e bloqueio imediato na autenticação (HTTP 403) para contas inativas.

### 3.3. Isolamento Rigoroso Multi-Tenant & RBAC de Organizações
- **Visão Estrita para Tenant Owners / Admins:** Usuários com papéis de clientes específicos (`tenantId !== "global"`, ex: `waldes@calvi.com.br`) não visualizam dados, tabelas ou cadastros de outros clientes.
- **Top Bar com Trava de Tenant:** Substituição do dropdown seletor por identificador estático com badge da organização ativa para usuários não-SuperAdmin.
- **Restrição de Configurações Globais:** Acesso exclusivo ao menu `⚙️ Configurações Gerais` (infraestrutura master) apenas para o `SuperAdmin` (MSP).
- **Ambiente Limpo para Novos Clientes (*Zero-State Onboarding*):** Escopo estrito e isolamento por `tenantId` aplicado em Aprovações, Auditoria SHA-256, Canais de Alerta, Rotinas Agendadas, Triggers, Políticas Self-Healing e Metas (SLOs), garantindo que novos clientes iniciem com ambiente 100% limpo e sem vazamento de dados de teste/demonstração.

### 3.4. Padronização Visual Corporativa
- Remoção total de tags de desenvolvimento e etapas dos componentes visuais, garantindo uma interface limpa, moderna e 100% orientada a ambiente corporativo e clientes finais.

### 3.5. Integração REST Real com Hipervisores (Proxmox VE & Virtualizor) — Eliminação Total de Mocks
- **Chamadas Reais às APIs de Hipervisores:** Migração dos conectores `ProxmoxProvider` e `VirtualizorProvider` no backend para execução de requisições HTTP REST diretas nos endpoints oficiais:
  - **Proxmox VE:** `/api2/json/version`, `/api2/json/nodes`, `/api2/json/cluster/resources?type=vm` e `/api2/json/storage` utilizando autenticação `PVEAPIToken`.
  - **Virtualizor:** `index.php?act=servers`, `index.php?act=vs` e `index.php?act=storage` com autenticação `API Key` e `API Pass`.
- **Sincronização de Nós e VMs Reais:** Mapeamento em tempo real do nó físico (`pve`) e das 5 VMs QEMU oficiais da organização (`SRV-CW`, `CALVI IIS`, `CALVI BANCO`, `SRV-Concentrador`, `SRV-AD-PortoNovo`), eliminando completamente qualquer mock residual ou fictício.
- **Ofuscação de Credenciais (`AGENTS.md`):** Tratamento rigoroso em todas as mensagens e logs de erro com sanitização automática (`[REDACTED]`).

### 3.6. Blindagem e Zero-State no Módulo de Inteligência & Advisor
- **Isolamento de Tenant no Advisor:** Módulos de Recomendações Estruturais, Incidentes Recorrentes, Projeção de Capacidade (*Capacity Forecasting*), Auditoria de SPOFs, *Technical Debt Score* e Relatórios Executivos (QBR) passam a filtrar estritamente por `activeTenant.id`.
- **Baseline de Dívida Técnica:** Tenants novos sem incidentes iniciam com score 100/100 (verde) e sem recomendações pré-fabricadas, passando a receber diagnósticos somente após a detecção real de telemetria ou logs.

### 3.7. Pipeline de CI/CD, Imagens Docker & Gerenciador de Pacotes
- **Upgrade para Node.js 22 LTS:** Atualização do workflow `.github/workflows/deploy.yml` e das imagens base dos Dockerfiles (`apps/web/Dockerfile`, `apps/api/Dockerfile`, `apps/worker/Dockerfile`) para `node:22-alpine` (Node.js 22 LTS), eliminando avisos de depreciação do runner.
- **Pinning Determinístico para `pnpm@9`:** Fixação do gerenciador de pacotes na versão 9 (`npm install -g pnpm@9`) em todos os containers, garantindo a execução e compilação sem bloqueios dos binários nativos do `esbuild` no ciclo de build do Vite.
- **Validação de Sintaxe e Bundling:** Correção definitiva no empacotador do frontend (`App.jsx`), assegurando builds 100% verdes no GitHub Actions e publicação automatizada no GHCR (`ghcr.io/wittemberg/infraops-web:latest`, `ghcr.io/wittemberg/infraops-api:latest`, `ghcr.io/wittemberg/infraops-worker:latest`) com acionamento do Webhook do Portainer.

### 3.8. Exigência Rigorosa de Provedor de IA & Eliminação de Respostas Simuladas
- **Transparência e Autenticidade:** O Console de IA (`🤖 Console IA`) e a Mineração de Recomendações (`💡 Inteligência & Advisor`) exigem expressamente um provedor de IA com chave de API ativa (`OpenAI`, `Groq`, `DeepSeek`, `Anthropic`, `Gemini` ou `Ollama local`).
- **Bloqueio de Dados Fictícios:** Eliminação de qualquer resposta heurística simulada ou genérica quando a chave estiver ausente ou inválida. O sistema orienta o operador de forma transparente a inserir e validar sua chave no botão `⚙️ Configurar Modelo / Chave de API`.
- **Análise Generativa Autêntica:** Com a chave configurada, a IA recebe a topologia real cadastrada (nós Proxmox, VMs QEMU, containers e storages) e gera diagnósticos técnicos e planos de mudança estritamente sob medida para o ambiente do cliente.

### 3.9. Ajuste de Contraste e Tipografia nos Temas Claro / Escuro
- **Legibilidade nos Balões de Mensagens:** Ajustadas as cores do Console de IA com variáveis CSS dinâmicas (`var(--text-primary)`, `var(--bg-card)`), garantindo contraste perfeito e eliminando problemas de texto invisível (branco sobre branco) no modo claro.

---

## 4. Etapa 26 — Native Infrastructure Source of Truth & Physical Topology 🟢 (CONCLUÍDA)

A Etapa 26 transforma o InfraOps AI na fonte da verdade nativa (*Single Source of Truth*) para a infraestrutura física e lógica dos tenants, eliminando a dependência mandatória de CMDBs/IPAMs externos pesados:

### 4.1. Módulos de Domínio no Backend (`apps/api/src/`)
- **`inventory/` (`inventoryService.ts`, `types.ts`):** CRUD tenant-scoped para Sites, Locais, Racks e Ativos. Validação rigorosa contra sobreposição de Us em Racks (`validateRackOverlap`), normalização de MACs e rastreabilidade de proveniência (`MANUAL`, `DISCOVERED`, `VERIFIED`).
- **`topology/` (`topologyService.ts`):** Mapeamento de interfaces de rede, conexões físicas porta-a-porta com tipo e cor de cabo, assistente de criação de portas (*Switch Port Wizard* para 24/48 portas RJ45 + SFP+) e derivação de grafo topológico.
- **`network/` (`networkService.ts`):** Gestão de VLANs (1 a 4094), Subnets CIDR, IPAM operacional com estados de alocação (`USED`, `RESERVED`, `DHCP`, `AVAILABLE`, `CONFLICT`, `UNKNOWN`) e cadastro de Circuitos WAN de internet com suporte e operadoras.
- **`discovery/` (`discoveryService.ts`):** Varredura autorizada via SNMP/LLDP com motor de correspondência (*Matching Engine*) baseado em prioridade `Serial > MAC > IP de Gerência > Hostname`, permitindo aprovação de mesclagem (`merge`), criação ou descarte auditado.
- **`operational/` (`operationalService.ts`):** Cálculo automatizado de *Infrastructure Health Score* (0–100 / Notas A–F), Checklists de Visita Técnica presencial com assinatura/conclusão e geração do Relatório Executivo Mensal de MSP (*Monthly Client Report*).

### 4.2. Interface Visual no Frontend (`apps/web/src/components/InfrastructureSourceOfTruthView.jsx`)
- Novo módulo central no menu lateral: **`🏢 Infra & Topologia`**.
- 5 sub-abas especializadas:
  1. 🏢 **Customer Infrastructure Book:** Listagem e busca avançada de ativos, Quick Add, ficha com QR Code seguro e timeline de eventos.
  2. 🗄️ **Racks & Conectividade:** Elevação visual de Rack 42U com ocupação codificada por cor de ativo e tabela de conexões físicas.
  3. 🌐 **Redes & IPAM:** Mapa de Subnets e alocação de IPs com barras de utilização e circuitos de internet.
  4. 📡 **Discovery & Reconciliação:** Fila de candidatos de rede com % de confiança de correspondência.
  5. 📋 **Ferramentas Operacionais:** Painel de Health Score, Checklists de Visita e Relatório Mensal de Gestão.

### 4.3. Contexto Nativo para IA Operacional
- Orquestrador de IA conectado ao inventário físico, permitindo consultas naturais sobre localização em rack, portas de switch conectadas, garantias expirando e IPAM com indicação explícita da proveniência dos dados.

---

## 5. Etapa 27 — Network Device Monitoring & Governed WAN Actions 🟢 (CONCLUÍDA)

A Etapa 27 traz a governança de roteadores de borda (**MikroTik RouterOS** e **pfSense**) para dentro do ecossistema do InfraOps AI, viabilizando o monitoramento em tempo real de links WAN de Internet e a execução de ações governadas de comutação de link e failover autônomo com proteção anti-flapping (ADR-020 & ADR-021):

### 5.1. Módulos de Domínio & Drivers de Rede (`apps/api/src/network-devices/`)
- **`types.ts`:** Definição de `NetworkDeviceProfile`, `WanLink`, `NetworkChangeSnapshot`, `NetworkActionRun` e `WanFailoverPolicy`.
- **`drivers/driverInterface.ts`:** Interface neutra `INetworkDeviceDriver` desacoplando sintaxes de fabricantes da IA e do Policy Engine.
- **`drivers/mikrotikDriver.ts`:** Driver para MikroTik RouterOS com suporte a coleta de telemetria (CPU, RAM, temperatura, uptime), ajuste atômico de distâncias de rotas padrão (`/ip/route`) e probes de validação.
- **`drivers/pfsenseDriver.ts`:** Driver para pfSense com telemetria, manipulação de Gateway Groups (Tiers 1/2) e integração com métricas dpinger.
- **`networkDeviceService.ts`:** CRUD multi-tenant para roteadores e links WAN, captura de snapshots de estado pré-mudança e orquestração de reversão.
- **`actions/wanActions.ts`:** Ações governadas (`network.set_primary_wan`, `network.set_wan_failover`, `network.set_wan_balance`, `network.enable_wan`, `network.disable_wan`, `network.rollback_wan_change`) com fluxo obrigatório de **Precheck ➔ Snapshot ➔ Execução ➔ Postcheck ➔ Rollback Automático em caso de falha ➔ Auditoria com Hash**.
- **`automation/wanSelfHealing.ts`:** Auto-recuperação de links com proteção contra flapping (*debounce* de 60s, histerese de 120s, *cooldown* de 15m e *circuit breaker* de no máximo 3 trocas por hora).

### 5.2. Interface Visual (`apps/web/src/components/NetworkDevicesView.jsx`)
- Nova sub-aba **`📡 Roteadores & Links WAN`** integrada diretamente à visão de **`🏢 Infra & Topologia`**.
- Visualizador de telemetria dos roteadores (CPU, RAM, Firmware, Porta de Gerência).
- Tabela dinâmica de links WAN com latência (ms), perda de pacotes (%), consumo de banda (Rx/Tx) e indicação visual de Link Primário.
- Modal de Comutação Segura com comparativo *Antes vs Depois*, resumo de precheck/postcheck e botão de comutação atômica.
- Painel de Snapshots com botão de `🛡️ Reverter para este Snapshot`.

### 5.3. Integração com o Assistente de IA
- Injeção contextual da lista de roteadores e do estado/latência/perda de cada link WAN no system prompt do Console IA, proibindo geração de comandos CLI livres e direcionando consultas para a ação governada `network.set_primary_wan`.

---

## 6. Etapa 28 — Simple Experience, Guided Operations & Frontend Refactor 🟢 (CONCLUÍDA)

A Etapa 28 implementa uma reestruturação profunda da experiência do usuário (*UX/UI*) do InfraOps AI, focando na simplificação operacional e na facilidade de adoção por prestadores de TI, MEIs e pequenos MSPs sem abrir mão da segurança e governança (*"Technical depth underneath. Operational simplicity on top"*):

### 6.1. Dicionário Canônico & Português-First (`apps/web/src/app/uiLanguage.js`)
- Mapeamento integral da terminologia de interface em Português do Brasil (*Início, Clientes, Infraestrutura, Backups, Roteadores & WAN, Alertas, Assistente IA, Relatórios, Auditoria, Configurações*).
- Utilitário de apresentação humanizada de status e níveis de risco (`apps/web/src/utils/statusPresentation.js`).

### 6.2. Progressive Disclosure: Modo Simples vs. Modo Técnico (ADR-023)
- Componente `SimpleModeToggle.jsx` integrado ao topo da aplicação, permitindo alternar instantaneamente entre a visão operacional limpa do dia a dia e a visão técnica detalhada com métricas brutas e hashes de auditoria.

### 6.3. Central de Operações Diárias (`apps/web/src/features/home/DailyOperationsCenter.jsx`)
- Nova tela inicial respondendo com clareza à pergunta central: *"O que precisa da minha atenção hoje?"*, consolidando KPIs de computação, RPO de backups, latência de internet, score de saúde e atalhos operacionais rápidos.

### 6.4. Central de Relatórios & Comprovação de Valor (`apps/web/src/features/reports/ReportsCenterView.jsx`)
- Módulo nativo para geração de Relatórios Executivos Mensais de MSP (QBR), Fichas de Visita Técnica Presencial com assinatura e exportação do Livro da Infraestrutura (*Customer Book*).

### 6.5. Guia de Configuração & Onboarding Passo a Passo (`apps/web/src/features/onboarding/GuidedOnboardingModal.jsx`)
- Modal interativo de 4 passos orientando novos operadores e clientes na conexão de servidores, rotinas de backup, roteadores de borda e alertas via WhatsApp/Telegram.

---

## 7. Etapa 29 — Production Hardening & Real-World pfSense Telemetry 🟢 (CONCLUÍDA)

Fase de homologação em ambiente e hardware real (*Production Hardening*) para a telemetria do firewall/roteador **pfSense**:
- **7.1. Diagnostic Sanitized Modal:** Endpoint `POST /api/v1/network-devices/:id/diagnostics/pfsense` com mascaramento automático de segredos (cookies, CSRF, tokens).
- **7.2. FreeBSD CPU Ticks Parser:** Cálculo exato de consumo de CPU baseado no acumulador do kernel FreeBSD (`(total - idle) / total * 100`).
- **7.3. Hybrid Telemetry Merge:** Fusão de telemetria AJAX (`/getstats.php`) e Dashboard HTML (`/index.php`) para capturar CPU, RAM, SWAP e Disco `/`.
- **7.4. Vault Key Auto-Migration:** Auto-recuperação de chaves criptográficas com persitência física em `data/vault-master.key`.
- **7.5. Tests & QA:** 8 testes unitários automatizados cobrindo variações de idioma e versões FreeBSD.

---

## 8. Etapa 30 — Development Control Center & Human Validation Governance 🟢 (CONCLUÍDA)

Implementação do painel sistêmico de governança técnica do produto (**Development Control Center — DCC**):
- **8.1. Fontes Canônicas em JSON:** Arquivos estruturados em `docs/00-project/development-control/` (`project.json`, `roadmap.json`, `checkpoints.json`, `homologation.json` e `README.md`).
- **8.2. Contratos Tipados em TypeScript:** Exportação estrita no pacote `@infraops/contracts`.
- **8.3. Motor Matemático Backend & 16 Invariantes:** Classe `DevelopmentControlService` com validação de consistência estrita (A a P), cálculo conservador de pesos e segregação em 3 dimensões: *Implementation Progress*, *Human Validation Coverage* e *Homologation / Readiness Progress*.
- **8.4. Endpoints Protegidos por Perfil:** Rotas `/api/v1/development-control/*` restritas a `superadmin` e sujeitas à flag de ambiente `ENABLE_DEV_CONTROL_CENTER`.
- **8.5. Dashboard Reativo com 4 Cards Executivos:** Componente React `DevControlView.jsx` integrado ao shell com badges de saúde, progresso por módulos, tabela de componentes congelados (`🔒 Frozen`) e linha do tempo de checkpoints.
- **8.6. Testes Automatizados:** Suíte de testes Jest no backend e verificação de confinamento.





