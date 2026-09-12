# Stage 28 — Simple Experience, Guided Operations & Frontend Refactor

## 1. Purpose

InfraOps AI has reached a point where technical capability is no longer the main bottleneck. The next product challenge is **comprehension**.

The target user is often:
- a small IT business owner;
- a MEI;
- a technician working alone;
- a small MSP with 1–5 operators;
- someone responsible for several customers but with limited time for platform administration;
- someone who understands practical IT but may not know terms such as RBAC, SLO, Workload, Source of Truth, Action Registry, Hysteresis or Circuit Breaker.

The interface must therefore prioritize:
1. what needs attention;
2. which customer is affected;
3. what the problem means;
4. what can be done;
5. whether the action is safe;
6. what was done;
7. how to prove the work to the customer.

## 2. North Star

> **A user must not need to understand the internal architecture of InfraOps AI in order to operate InfraOps AI well.**

## 3. UX principles

### 3.1 Task-first, architecture-second
The menu should reflect user tasks, not backend modules.

### 3.2 Portuguese-first
Technical English stays in code/docs. UI uses Brazilian Portuguese whenever there is a clear equivalent.

### 3.3 Progressive disclosure
Simple users see the operational meaning first. Technical details are available on demand.

### 3.4 Customer-centered context
For MSP users, the customer/tenant is the primary mental model.

### 3.5 Action-oriented dashboards
Prefer “what requires attention” over charts that require interpretation.

### 3.6 Safe defaults
Default settings should be recommended and explainable. Advanced tuning remains available.

### 3.7 Humanized status
Enums remain technical internally; UI presents human-readable labels.

### 3.8 AI as help, not mystery
AI should be the easiest way to ask operational questions but must still respect Action Registry, Policy Engine and evidence boundaries.

### 3.9 Reports are product value
Reports are not an export feature. They are proof of service and professionalism.

## 4. Proposed top-level navigation

### MSP / Superadmin
- Início
- Clientes
- Infraestrutura
- Backups
- Alertas
- Assistente IA
- Automações
- Recomendações
- Relatórios
- Histórico
- Configurações

### Tenant / Customer
- Início
- Minha Infraestrutura
- Backups
- Internet & Rede
- Alertas
- Assistente
- Recomendações
- Relatórios

## 5. Terminology map

| Technical/current | User-facing |
|---|---|
| Dashboard | Início |
| Tenant | Cliente / Organização |
| Nodes | Servidores / Hosts |
| Workloads | Máquinas Virtuais e Serviços |
| Hypervisor | Virtualização |
| Source of Truth | Inventário da Infraestrutura |
| Actions | Ações |
| Action Catalog | Ações disponíveis |
| Scheduler | Agendamentos |
| Trigger | Regra automática |
| Policy | Regra de segurança |
| Advisor | Recomendações |
| Infrastructure Intelligence | Recomendações de melhoria |
| RBAC | Permissões de acesso |
| SLO | Meta de serviço |
| RPO | Limite de atraso do backup |
| Degraded | Atenção / Degradado |
| Non-compliant | Fora do esperado |
| Pending approval | Aguardando aprovação |
| Circuit Breaker | Proteção contra repetição |
| Hysteresis | Margem de estabilização |

Internal identifiers remain unchanged.

## 6. Simple Mode vs Technical Mode

### Simple Mode
Default for new users.

Show:
- human-readable labels;
- recommended values;
- concise explanations;
- task buttons;
- plain-language risks;
- operational status.

Hide behind “Detalhes técnicos”:
- internal IDs;
- raw action keys;
- policy IDs;
- cron expressions;
- raw metrics labels;
- advanced thresholds;
- low-level provider fields.

### Technical Mode
For advanced users.

Show:
- raw metrics;
- action keys;
- policy evaluations;
- thresholds;
- cron;
- provider-specific fields;
- topology details;
- advanced automation controls.

### Rule
Mode changes presentation, never permissions.

## 7. Home — Daily Operations Center

Default landing page should answer:
> “O que precisa da minha atenção agora?”

Sections:
1. Precisa da sua atenção
2. Clientes saudáveis
3. Backups
4. Internet e rede
5. Equipamentos offline
6. Automações executadas
7. Recomendações
8. Garantias / contratos próximos do vencimento
9. AI Daily Brief

Example:
```text
Bom dia, João.

Você administra 18 clientes.

🔴 2 precisam de atenção
🟡 4 possuem avisos
🟢 12 estão normais

Backup atrasado
Mercado ABC — ERP sem backup válido há 31h

Link degradado
Clínica XYZ — Vivo com 26% de perda

[Ver prioridades]
[Resumir meu dia com IA]
```

## 8. Customer Summary

Every customer should have a summary page.

Tabs:
- Visão Geral
- Equipamentos
- Servidores & VMs
- Rede & Internet
- Backups
- Alertas
- Automações
- Recomendações
- Relatórios
- Histórico

Summary cards:
- Health Score
- Servers
- VMs
- Backups
- WAN
- Network devices
- Inventory
- Open alerts
- Recommendations
- Warranty/lifecycle

## 9. Guided onboarding

Wizard:
1. Dados do cliente
2. Locais
3. Servidores e virtualização
4. Firewall / roteador
5. Switches / Wi-Fi
6. Backups
7. InfraOps Agent
8. Alert channels
9. First health check
10. Summary

Completion score:
- 30% Basic
- 60% Monitored
- 80% Automated
- 100% Professionally documented

Never block usage because completion is <100%.

## 10. Recommended defaults

Each advanced feature should offer:
- Recomendado
- Personalizado

Example WAN failover:
Recommended:
- check 60s;
- unhealthy after 5m;
- recovery after 15m;
- anti-flapping enabled.

Simple UI avoids exposing debounce/cooldown/hysteresis unless customized.

## 11. AI Assistant

Rename “Console IA” to “Assistente IA”.

Home prompt:
> “O que você quer saber?”

Suggestions:
- Como estão meus clientes hoje?
- Algum backup falhou?
- Qual cliente precisa de atenção?
- Como está o link do Cliente X?
- O que devo verificar na próxima visita?
- Há equipamentos sem garantia?
- Quais melhorias você recomenda?

## 12. Humanized approvals

Do not lead with:
`network.set_primary_wan`.

Lead with:
> “Trocar o link principal para Claro”

Show:
- customer;
- device;
- reason;
- current state;
- proposed state;
- target health;
- risk;
- rollback availability.

Then “Ver detalhes técnicos”.

## 13. Reports

First-class menu item.

Initial report types:
- Relatório mensal do cliente
- Relatório de visita técnica
- Saúde da infraestrutura
- Backups
- Inventário patrimonial
- Recomendações
- Histórico de serviços

## 14. Accessibility and visual language

Use consistent status vocabulary:
- 🟢 Normal
- 🟡 Atenção
- 🔴 Problema
- ⚪ Sem dados
- 🔵 Aguardando ação/aprovação

Color must never be the only signal.

## 15. Out of scope

Stage 28 is not:
- a visual redesign with no structural changes;
- a replacement for RBAC;
- a simplification that removes audit details;
- a removal of Technical Mode;
- a new backend monitoring stage;
- a rewrite of React from scratch.
