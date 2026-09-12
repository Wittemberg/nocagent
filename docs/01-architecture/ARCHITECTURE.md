# Arquitetura — Visão de Alto Nível

```text
Usuário / Cliente
       │
       ▼
 Web / API
       │
 ┌─────┴──────────────────────────────┐
 │                                    │
 ▼                                    ▼
AI Orchestrator                  Observability
 │                                  │
 ▼                                  ├─ Prometheus
Policy Engine                     └─ Alertmanager
 │
 ▼
Action Engine / Jobs
 │
 ▼
Queue / Worker
 │
 ▼ outbound channel
InfraOps Agent (Go)
 │
 ├─ Inventory / Health
 ├─ Action Executors
 ├─ Logs / Diagnostics
 └─ Provider adapters/local helpers

Business state → PostgreSQL
Large outputs  → S3/MinIO
Telemetry      → OpenTelemetry
```

A especificação detalhada está em `docs/02-implementation/`.
