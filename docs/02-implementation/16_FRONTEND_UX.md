# Etapa 16 — Frontend e UX Operacional

## Objetivo

Criar interface centrada em exceções, não em gráficos.

## Navegação

```text
Dashboard
Attention
Clients/Tenants
Nodes
Workloads
Backups
Storage
Alerts
Incidents
Actions/Jobs
Approvals
AI
Audit
Settings
```

## Dashboard principal

Cards:
- nodes total/online/degraded/offline;
- backups OK/failed/missing;
- alerts by severity;
- storage pressure;
- pending approvals.

Tabela "Precisa de atenção":
ordenar por risco/criticidade.

## Node detail

Abas:
- Overview
- Metrics
- Workloads
- Storage
- Backups
- Services
- Jobs
- Alerts
- Audit
- Ask AI

## Backup view

Mostrar:
- expected;
- last valid;
- age;
- size;
- integrity;
- retention;
- anomaly;
- source;
- workload.

## Action execution UX

Nunca usar botão que dispara alteração sem contexto.

Tela/modal:
1. target;
2. action;
3. parameters;
4. dry-run/plan;
5. risk;
6. policy;
7. approval;
8. execution;
9. postcheck/result.

## AI panel

Chat contextual.

Exemplo:
"Pergunte sobre PVE01"

O frontend envia node context ID, não centenas de linhas de dados.

## Approvals

Lista deve mostrar:
- requester;
- AI involved?;
- target;
- action;
- plan;
- risk;
- expiration;
- approve;
- reject.

## Audit

Filtros:
- tenant;
- user;
- node;
- action;
- date;
- job.

## Segurança UX

Nunca renderizar secret de volta.
Nunca colocar API key em URL.
Confirmar high-risk por ação específica.

## Critérios de aceite

- [ ] Dashboard destaca exceções.
- [ ] Node detail funcional.
- [ ] Job progress em tempo real/polling.
- [ ] Approval mostra plano.
- [ ] AI chat é contextual.
- [ ] UI respeita RBAC.
