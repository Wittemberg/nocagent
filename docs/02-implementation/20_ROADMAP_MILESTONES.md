# Etapa 20 — Roadmap, Milestones e Gates

## Milestone 0 — Fundação

Entrega:
- monorepo;
- API/web/worker;
- PostgreSQL;
- Redis;
- CI.

Gate:
- build/test verdes.

## Milestone 1 — Node Online

Entrega:
- tenant;
- auth;
- node;
- agent enrollment;
- heartbeat;
- inventory.

Gate:
- instalar agent em Linux;
- node aparece online;
- fica offline corretamente.

## Milestone 2 — Observabilidade

Entrega:
- Prometheus;
- CPU/RAM/disk;
- Node detail;
- alerts básicos.

Gate:
- alerta real/simulado aparece e resolve.

## Milestone 3 — Job Engine

Entrega:
- action registry;
- job state machine;
- idempotência;
- locks;
- audit.

Actions:
- node.health;
- node.inventory;
- network.ping.

Gate:
- replay não duplica.

## Milestone 4 — Operações Seguras

Actions:
- apt_update;
- apt_upgrade;
- reboot;
- service.status;
- service.restart.

Entrega:
- Policy Engine;
- approvals;
- pre/postchecks.

Gate:
- upgrade medium não executa sem aprovação.

## Milestone 5 — Proxmox

Entrega:
- provider;
- nodes;
- VM/LXC;
- storage;
- tasks.

Gate:
- cluster real de teste sincronizado.

## Milestone 6 — Backup Core

Entrega:
- artifacts;
- policies;
- expectations;
- missing;
- failed;
- size anomaly;
- cleanup dry-run.

Gate:
- nunca viola minimum copies.

## Milestone 7 — Virtualizor

Entrega:
- VPS;
- servers;
- backups;
- normalização.

## Milestone 8 — IA Read-only

Entrega:
- chat;
- context;
- metrics/backups/log tools;
- audit AI.

Gate:
- respostas usam dados reais.

## Milestone 9 — IA + Actions

Entrega:
- requestAction;
- plan;
- approval;
- execution tracking.

Gate:
- prompt injection não contorna policy.

## Milestone 10 — Hardening

- mTLS;
- MFA;
- secrets rotation;
- penetration tests;
- recovery;
- monitoring externo.

## Definition of Done geral

Uma feature não está pronta sem:
- código;
- migration se necessário;
- tests;
- docs;
- observability;
- auth/policy;
- audit para mudanças;
- error handling;
- rollback/compatibilidade quando pertinente.
