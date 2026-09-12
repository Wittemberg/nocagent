# Product Requirements — InfraOps AI

## Objetivo principal atual

Responder: **“O que precisa da minha atenção agora?”** e permitir que a equipe compreenda e trate o problema com segurança.

## Objetivo da próxima geração

Responder também: **“O que o sistema pode acompanhar e cuidar sozinho, dentro dos limites que eu defini?”**

## Baseline de produção

- tenants;
- nodes/workloads;
- agent heartbeat/inventory;
- CPU/RAM/disk/uptime;
- saúde e expectativa de backup;
- alerts/incidents;
- jobs/actions seguras;
- Proxmox;
- Virtualizor;
- standalone/cloud servers;
- IA contextual + Actions;
- RBAC/Policy Engine;
- portal read-only;
- auditabilidade.

## Requisitos da camada autônoma

### PR-AUTO-001 — Scheduling
O sistema deve permitir schedule futuro e recorrente com timezone explícito.

### PR-AUTO-002 — Idempotência
Um schedule não pode produzir execução duplicada da mesma ocorrência lógica.

### PR-AUTO-003 — Scope
Toda automação deve possuir tenant e target scope explícitos.

### PR-AUTO-004 — Policy Enforcement
Scheduler, trigger e Goal nunca podem contornar o Policy Engine.

### PR-AUTO-005 — Conditional Triggers
O sistema deve suportar triggers baseados em telemetria, backup, health e eventos.

### PR-AUTO-006 — Anti-Flapping
Triggers devem suportar duração mínima, hysteresis, cooldown e deduplicação.

### PR-AUTO-007 — Autonomy Level
Toda automação mutável deve declarar nível máximo de autonomia.

### PR-AUTO-008 — Risk Budget
Automações de nível 4/5 devem suportar limites de quantidade/frequência/risco.

### PR-AUTO-009 — Human Approval
Quando a policy exigir approval, a execução automática deve parar em `awaiting_approval`.

### PR-AUTO-010 — Validation
Toda remediação automática deve executar postcheck e registrar sucesso/falha.

### PR-AUTO-011 — Circuit Breaker
Falhas repetidas devem interromper a automação e escalar para humano.

### PR-AUTO-012 — AI Independence
Checks determinísticos e schedules sem IA devem continuar funcionando se o LLM estiver indisponível.

### PR-AUTO-013 — Goal Management
O sistema deve permitir objetivos declarativos com métrica/estado desejado, escopo, avaliação periódica, Actions permitidas e risk budget.

### PR-AUTO-014 — Explainability
Toda decisão autônoma deve ser explicável por evidências e policy aplicada.

### PR-AUTO-015 — Client Viewer
Usuários read-only podem visualizar automações e resultados de seu tenant conforme permissão, mas não criar/elevar automações mutáveis.

## Segurança

É proibido interpretar “autonomia” como:

- shell arbitrário;
- wildcard sudo;
- Action inventada pelo LLM;
- autoaprovação;
- elevação de privilégio;
- bypass de tenant scope;
- bypass de Safe Retention.
