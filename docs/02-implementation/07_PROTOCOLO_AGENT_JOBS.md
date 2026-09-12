# Etapa 07 — Protocolo Agent ↔ Central e Jobs

## Objetivo

Implementar distribuição confiável de jobs sem abrir portas nos nodes.

## Modelo inicial

Polling HTTPS outbound.

Agent consulta:
`POST /api/v1/agent/jobs/claim`

Não expor endpoint HTTP no agent.

## Claim

Request:

```json
{
  "agentId": "...",
  "maxJobs": 1,
  "capabilities": ["system.apt_update:v1"]
}
```

Response:

```json
{
  "jobs": [
    {
      "jobId": "...",
      "idempotencyKey": "...",
      "action": "system.apt_update",
      "actionVersion": 1,
      "parameters": {},
      "timeoutSeconds": 600,
      "issuedAt": "...",
      "expiresAt": "..."
    }
  ]
}
```

## Assinatura

Antes de produção ampla, assinar envelope de job ou usar canal mTLS com autenticação forte.

Agent deve validar:
- node target;
- action suportada;
- versão;
- validade temporal;
- job ID;
- duplicidade.

## Acknowledge

`POST /api/v1/agent/jobs/{jobId}/status`

Estados reportáveis:
- accepted;
- running;
- progress;
- succeeded;
- failed;
- cancelled.

## Idempotência

Agent mantém journal local:

```text
job_id
idempotency_key
action
status
started_at
finished_at
result_digest
```

Se job já terminou:
- não executar novamente;
- devolver resultado armazenado/resumo.

Usar SQLite local ou store transacional leve.

## Timeout

Duas camadas:
- timeout da central;
- timeout executor local.

## Cancelamento

Action Definition declara:

```text
supportsCancel: true|false
```

Agent consulta cancel request entre fases.

Não matar processo arbitrariamente se action não puder ser cancelada com segurança.

## Outputs

Resultado pequeno:
- JSON para API.

Output grande:
- compactar;
- enviar para object storage via URL pré-assinada;
- enviar digest SHA-256;
- guardar referência no job.

## Progress

Exemplo:

```json
{
  "jobId": "...",
  "status": "progress",
  "progressPercent": 60,
  "phase": "installing_packages",
  "message": "..."
}
```

Nunca confiar em mensagem como indicador final de sucesso; usar exit code + postchecks.

## Retry

Só retry automático quando Action Definition declarar que a etapa é segura/idempotente.

## Critérios de aceite

- [ ] Mesmo job não executa duas vezes.
- [ ] Agent X não consegue claim de Node Y.
- [ ] Job expirado não executa.
- [ ] Timeout encerra corretamente.
- [ ] Resultado grande não incha PostgreSQL.
- [ ] Polling funciona apenas outbound 443.
