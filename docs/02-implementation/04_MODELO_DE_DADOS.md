# Etapa 04 — Modelo de Dados PostgreSQL

## Objetivo

Construir um modelo relacional multi-tenant estável.

## Tabelas essenciais

### tenants

```text
id uuid pk
name varchar not null
slug varchar unique not null
status varchar not null
timezone varchar not null
created_at timestamptz
updated_at timestamptz
```

### users

```text
id
email
name
password_hash / external_subject
status
last_login_at
created_at
updated_at
```

### tenant_memberships

```text
id
tenant_id
user_id
role_id
created_at
```

Unique:
`(tenant_id, user_id, role_id)`

### sites

```text
id
tenant_id
name
code
description
```

### nodes

```text
id
tenant_id
site_id nullable
name
hostname
type
status
agent_status
criticality
last_seen_at
maintenance_until
metadata jsonb
created_at
updated_at
```

Indexes:
- tenant/status
- last_seen_at
- hostname
- type

### agent_identities

```text
id
node_id unique
agent_id unique
certificate_fingerprint
certificate_serial
status
enrolled_at
last_seen_at
revoked_at
agent_version
```

### workloads

```text
id
tenant_id
node_id
external_id
type
name
status
criticality
cpu_allocated
memory_bytes
metadata jsonb
```

Unique sugerido:
`(node_id, type, external_id)`

### storages

```text
id
tenant_id
node_id
external_id
name
type
total_bytes
used_bytes
available_bytes
status
metadata jsonb
last_observed_at
```

### backup_policies

```text
id
tenant_id
name
enabled
schedule_definition
max_age_seconds
retention_days
minimum_valid_copies
size_deviation_threshold_percent
require_integrity_check
criticality
```

### backup_policy_bindings

Permite ligar policy a:
- tenant;
- node;
- workload.

Campos:
```text
id
policy_id
tenant_id
node_id nullable
workload_id nullable
priority
```

### backup_artifacts

```text
id
tenant_id
node_id
workload_id nullable
external_id nullable
source
path_or_reference
started_at
finished_at
status
size_bytes
checksum nullable
integrity_status
retention_expires_at nullable
metadata jsonb
discovered_at
```

### backup_expectations

Materializa o esperado.

```text
id
tenant_id
policy_id
workload_id
window_start
window_end
status
satisfied_by_backup_id nullable
evaluated_at
```

### alerts

```text
id
tenant_id
node_id nullable
workload_id nullable
type
severity
status
title
description
fingerprint
first_seen_at
last_seen_at
resolved_at
metadata
```

Unique parcial/fingerprint para deduplicação.

### incidents

```text
id
tenant_id
status
severity
title
summary
opened_at
closed_at
owner_user_id nullable
```

### action_definitions

```text
id
action_key
version
name
risk
schema_json
capabilities_json
enabled
created_at
```

Unique:
`(action_key, version)`

### jobs

```text
id
tenant_id
node_id
action_definition_id
requested_by_actor_type
requested_by_actor_id
idempotency_key
status
parameters jsonb
plan jsonb
result jsonb
risk
requires_approval
requested_at
started_at
finished_at
expires_at
trace_id
```

Unique:
`(tenant_id, idempotency_key)`

### approvals

```text
id
job_id
required_stage
status
requested_at
decided_at
decided_by_user_id
decision_reason
```

### resource_locks

```text
id
resource_type
resource_id
lock_type
job_id
acquired_at
expires_at
```

### audit_events

```text
id
tenant_id
occurred_at
actor_type
actor_id
user_id nullable
node_id nullable
job_id nullable
event_type
action_key nullable
request_id nullable
trace_id nullable
payload jsonb
previous_hash nullable
event_hash
```

## Métricas

NÃO armazenar séries temporais de CPU/RAM a cada scrape em PostgreSQL.

Usar Prometheus.

PostgreSQL guarda snapshots úteis e estado de negócio.

## RLS

Preparar o design para Row Level Security por `tenant_id`.

Regra:
- nenhuma query multi-tenant deve depender exclusivamente de filtro vindo do frontend.

## Migrations

- migrations versionadas;
- migration nunca editada depois de aplicada;
- rollback planejado para mudanças críticas;
- seed somente dados técnicos seguros.

## Critérios de aceite

- [ ] Diagrama ER adicionado em `docs/`.
- [ ] Migrations criam todas as tabelas MVP.
- [ ] Índices validados.
- [ ] Testes provam isolamento de tenant.
- [ ] Idempotency unique testado.
- [ ] Audit hash fields existem desde o início.
