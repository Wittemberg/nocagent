# Features — InfraOps AI

## Implemented / Production (100% Homologado 🟢)
- **Core Platform & Multi-Tenancy:** Isolamento estrito de tenants, RBAC granular (`superadmin`, `admin`, `operator`, `auditor`, `viewer`), auditoria SHA-256 criptográfica, controle seguro de credenciais e onboarding limpo (*Zero-State*) para novos clientes.
- **Production Hardening & Real-World pfSense Telemetry (Stage 29):** Leitura de CPU calculada via FreeBSD Ticks (`(total - idle) / total * 100`), fusão híbrida de telemetria (CPU, RAM, SWAP e Disco `/`), Diagnóstico Sanitizado com mascaramento de segredos, auto-migração de chaves do Vault (`data/vault-master.key`) e 8 testes unitários automatizados.
- **Fonte da Verdade Nativa & Topologia Física (Stage 26):** Customer Infrastructure Book completo (Sites, Locais, Racks 42U com elevação visual, Ativos físicos, Switch Port Wizard 24/48p, mapeamento de conexões físicas porta-a-porta com cor de cabo, VLANs 1-4094, Subnets CIDR, IPAM operacional com detecção de conflitos, Checklists de Visita Técnica com assinatura e Discovery SNMP/LLDP com matching determinístico).
- **Governança de Roteadores & Links WAN (Stage 27):** Drivers nativos para **MikroTik RouterOS** e **pfSense**, telemetria de hardware (CPU/RAM/Temp), monitoramento contínuo de latência/perda/banda por link e comutação governada de link primário (`network.set_primary_wan`) com Precheck, Snapshot atômico, Postcheck, Rollback determinístico em 1 clique e motor anti-flapping (Debounce, Histerese, Cooldown, Circuit Breaker).
- **Experiência Simples, Operações Guiadas & Refatoração Frontend (Stage 28):** Reorganização orientada a tarefas em Português-first (*Início, Clientes, Infraestrutura, Backups, Roteadores & WAN, Alertas, Assistente IA, Relatórios, Auditoria, Configurações*), alternador dinâmico de apresentação (**Modo Simples vs. Modo Técnico** — ADR-023), Central de Operações Diárias (*"O que precisa de atenção hoje?"*), Central de Relatórios Executivos/QBR e Checklist de Onboarding Guiado de 4 passos.
- **IA Orquestrada via Provider Registry Extensível (ADR-022):** Arquitetura agnóstica governada pelo *AI Provider Registry* do backend (com suporte homologado a Groq Cloud, OpenAI, DeepSeek, Anthropic/Claude, Google Gemini, Ollama Local e gateways REST compatíveis), validação ao vivo de chaves (`🟢 CHAVE ATIVA`), histórico multi-turn sincronizado em nuvem e **exigência estrita de credenciais ativas (eliminação de respostas genéricas simuladas ou dados fictícios)**.
- **Painel de Configurações Gerais (9 Subsistemas):** Gestão centralizada e testes ao vivo para SMTP, Storage S3/MinIO, PostgreSQL 16, Redis (BullMQ), Telemetria Prometheus/Grafana, Provedores de IA, Agente de Host, White-Label MSP e Políticas Globais.
- **Gestão de Identidade & Primeiro Acesso:** Troca mandatória de senha no primeiro login (`mustChangePassword`), gerador seguro de senhas, fluxo interativo de "Esqueci a Senha" (PIN de 6 dígitos), exclusão e alternador rápido de status (Ativo/Inativo com HTTP 403).
- **Agentes de Host:** Golang Linux & PowerShell Windows com conexões mTLS exclusivamente outbound e auto-registro (Enrollment).
- **Hipervisores & Workloads:** Integração nativa com APIs REST oficiais do Proxmox VE e Virtualizor com sincronização em tempo real de nós, VMs QEMU, LXCs e storages (zero mocks residuais).
- **Backup Engine:** Políticas RPO/RTO, retenção segura, verificação de integridade e auditoria de destinos.
- **Action Framework & Policy Engine:** Ações homologadas, precheck, postcheck, idempotência e governança não-negociável (`DENY` prioritário).
- **Alertas Omnichannel:** Chatwoot API (Account & Public API), Quepasa WhatsApp API, Telegram, SMTP e Webhooks com disparo de teste ao vivo.
- **Autonomous Scheduler & Cron:** Agendamentos de rotinas periódicas, one-shot e presets diários.
- **Conditional Triggers & Anti-Flapping:** Gatilhos reativos à telemetria com debounce, cooldown, deduplicação e circuit breaker.
- **Self-Healing & Autonomous Policies:** Matriz de autonomia Níveis 0 a 5 com orçamentos de risco (*Risk Budget*) e auto-escalonamento.
- **Goal-Oriented Operations & SLOs:** Metas declarativas contínuas com medidores visuais de conformidade (*Compliance Gauges*).
- **Infrastructure Intelligence & Advisor:** Mineração de causa-raiz, recomendações estruturais governadas (ADR-017), previsão de capacidade (7 a 180 dias), detecção de SPOFs, score de dívida técnica e relatórios executivos para MSPs.

## Deferred / Prohibited (Regras Não-Negociáveis)
- Arbitrary shell por LLM (`shell.exec`, `bash.run`);
- Execução livre de comandos CLI em roteadores MikroTik/pfSense;
- AI self-escalation (a IA não pode elevar seu próprio privilégio);
- Respostas com dados fictícios ou simulações opacas na ausência de chaves de IA;
- Modificação dinâmica de código pelo agente;
- Execução de ações estruturais sem Change Plan aprovado;
- Autonomia destrutiva irrestrita.

