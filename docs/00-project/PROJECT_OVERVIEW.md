# Project Overview — InfraOps AI

## Missão

Permitir que uma equipe de infraestrutura saiba rapidamente **o que precisa de atenção agora**, compreenda o motivo e, quando autorizado, execute ações seguras e auditáveis — evoluindo para um sistema capaz de acompanhar, proteger e auto-remediar a infraestrutura continuamente dentro de políticas explícitas.

## Público-Alvo

- MSPs (Managed Service Providers);
- Empresas de suporte e terceirização de TI;
- Equipes e departamentos de infraestrutura corporativa;
- Provedores de hospedagem e data centers que administram múltiplos clientes;
- Ambientes Linux/Windows, Proxmox VE, Virtualizor, servidores standalone e cloud VMs.

## Capacidades Centrais Atuais (Produção 🟢)

1. **Monitoramento e Observabilidade:** Nós, workloads (VMs/LXCs), telemetria temporal (Prometheus) e heartbeats.
2. **Saúde e Governança de Backups:** Políticas de RPO/RTO, compliance de snapshots e retenção segura.
3. **Prevenção de Incidentes e Anomalias:** Detecção proativa de esgotamento de disco e sobrecarga de CPU/RAM.
4. **Disparo de Alertas Omnichannel por Tenant:** Chatwoot API (Account & Public), Quepasa WhatsApp Gateway, Telegram, E-mail SMTP e Webhooks com teste em tempo real.
5. **IA Contextual via Provider Registry Extensível (ADR-022):** Arquitetura agnóstica governada pelo backend (com suporte a Groq Cloud, OpenAI, DeepSeek, Claude, Gemini, Ollama Local e gateways REST), validação de chaves ao vivo (`🟢 CHAVE ATIVA`), histórico multi-turn sincronizado em nuvem e **exigência estrita de chave válida (zero respostas simuladas/mocks)**.
6. **Catálogo de Actions Homologadas:** Ações tipadas com contratos declarativos (Precheck, Postcheck, Idempotência) e níveis de autonomia por tenant.
7. **Autonomous Scheduler & Automation Engine (Etapa 21):** Agendamento recorrente (Cron/Intervalos/One-Shot), briefings matinais e sweep diagnóstico.
8. **Conditional Triggers & Event Automation (Etapa 22):** Gatilhos reativos orientados a eventos com travas anti-flapping (Debounce, Cooldown, Circuit Breaker e Deduplicação SHA-256).
9. **Autonomous Policies & Self-Healing Engine (Etapa 23):** Matriz de autonomia Níveis 0 a 5, auto-remediação em cadeia, orçamentos de risco (*Risk Budget*) e escalonamento para plantonistas.
10. **Goal-Oriented Infrastructure Management (Etapa 24):** Gerenciamento e auto-tuning orientados a metas contínuas de SLO (Storage $\ge$ 20%, RPO $\le$ 24h, Uptime $\ge$ 99.9%) com medidores visuais de conformidade.
11. **Infrastructure Intelligence & Advisor (Etapa 25):** Mineração de causas-raiz de incidentes repetitivos, recomendações evidence-backed, previsão preditiva de capacidade (7 a 180 dias), detecção de SPOFs, Score de Dívida Técnica (0–100) e relatórios executivos de MSP.
12. **Native Infrastructure Source of Truth & Physical Topology (Etapa 26):** Customer Infrastructure Book completo (Sites, Racks 42U com elevação visual, Ativos físicos, Switch Port Wizard, conexões porta-a-porta, VLANs, Subnets CIDR, IPAM operacional, Checklists de Visita Técnica com assinatura e Discovery SNMP/LLDP).
13. **Network Device Monitoring & Governed WAN Actions (Etapa 27):** Drivers nativos para **MikroTik RouterOS** e **pfSense**, telemetria de hardware (CPU/RAM/Temp), monitoramento em tempo real de links WAN (latência, perda de pacotes, banda) e comutação governada de link primário com Precheck, Snapshot atômico, Postcheck, Rollback em 1 clique e motor anti-flapping.
14. **Simple Experience, Guided Operations & Frontend Refactor (Etapa 28):** Central de Operações Diárias (*"O que precisa de atenção hoje?"*), alternador dinâmico de apresentação (**Modo Simples vs. Modo Técnico** — ADR-023), Central de Relatórios Executivos/QBR, Checklist de Onboarding Guiado de 4 passos e usabilidade responsiva em Português-first.
15. **Production Hardening & Real-World pfSense Telemetry (Etapa 29):** Leitura de CPU calculada via FreeBSD Ticks (`(total - idle) / total * 100`), fusão híbrida de telemetria (CPU, RAM, SWAP e Disco `/`), Diagnóstico Sanitizado com mascaramento de segredos, auto-migração de chaves do Vault (`data/vault-master.key`) e 8 testes unitários automatizados.
16. **Development Control Center & Human Validation Governance (Etapa 30):** Painel interno de governança técnica do produto, motor de 16 invariantes matemáticas estritas, segregação em 3 dimensões (Implementação, Validação Humana e Prontidão), componentes congelados (🔒 Frozen), timeline auditável de checkpoints e cobertura de homologação por ID de teste.
17. **Governança Estrita:** Policy Engine, RBAC multi-tenant estrito e Audit Hash Chain SHA-256 à prova de adulteração.
18. **Portal do Cliente:** Visão isolada e segura por organização.

## Princípio de Produto

> O dashboard mostra exceções; a IA explica o contexto com histórico sincronizado em nuvem; a Fonte da Verdade mapeia ativos e conexões físicas; o Catálogo de Actions executa mudanças governadas em servidores e roteadores de borda; o Automation Engine toma iniciativa autônoma sob travas anti-flapping; e o Policy Engine garante que nenhuma regra seja violada.
