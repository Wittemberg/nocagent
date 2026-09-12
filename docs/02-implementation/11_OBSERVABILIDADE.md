# Etapa 11 — Observabilidade

## Objetivo

Observar hosts e também o próprio InfraOps AI.

## Prometheus

Usar para:
- CPU;
- memória;
- filesystem;
- network;
- disponibilidade;
- métricas do agent/API/workers.

Node Exporter pode coexistir com InfraOps Agent.

Não duplicar sem necessidade métricas maduras já expostas pelo Node Exporter.

## Métricas customizadas Agent

Exemplos:

```text
infraops_agent_info
infraops_agent_heartbeat_timestamp_seconds
infraops_action_executions_total
infraops_action_duration_seconds
infraops_action_failures_total
```

Evitar labels de alta cardinalidade, como jobId.

## API metrics

```text
http_requests_total
http_request_duration_seconds
jobs_created_total
jobs_running
policy_decisions_total
ai_requests_total
```

## OpenTelemetry

Propagar:
- trace context;
- request ID;
- job ID como atributo, não label Prometheus de alta cardinalidade.

Traçar:
- API request;
- policy;
- DB;
- queue;
- worker;
- provider AI;
- agent dispatch quando possível.

## Alertmanager

Usar para alerts métricos tradicionais:
- host down;
- disk threshold;
- agent missing;
- high memory sustained.

Alertas de negócio de backup podem ser gerados pelo Backup Engine e consolidados no módulo Alert.

## Health endpoints

Cada app:
- `/health/live`
- `/health/ready`

Readiness deve validar dependências essenciais.

## SLO inicial

Medir:
- disponibilidade API;
- atraso heartbeat;
- job dispatch latency;
- job success;
- alert processing delay.

## Critérios de aceite

- [ ] Prometheus scrape funciona.
- [ ] Node online/offline visível.
- [ ] Trace API → worker correlacionável.
- [ ] Alertmanager recebe alerta de teste.
- [ ] Labels não incluem segredo/job ID.
