# Etapa 03 — Configuração, Ambientes e Padrões

## Ambientes

Obrigatórios:
- `development`
- `test`
- `staging`
- `production`

Nunca decidir comportamento sensível somente por `NODE_ENV`. Usar configurações explícitas.

## Variáveis centrais

Exemplo conceitual:

```env
APP_ENV=development
APP_BASE_URL=https://infraops.example.com

DATABASE_URL=postgresql://...
REDIS_URL=redis://...

JWT_ISSUER=infraops-ai
JWT_AUDIENCE=infraops-web

ENCRYPTION_MASTER_KEY=...

S3_ENDPOINT=...
S3_BUCKET=infraops-artifacts

PROMETHEUS_URL=http://prometheus:9090

AI_PROVIDER=...
AI_MODEL=...
```

## Regras

- `.env` nunca entra no Git.
- `.env.example` contém nomes, não segredos.
- startup falha se configuração obrigatória estiver ausente.
- validar config por schema.
- segredos não aparecem em logs.
- mascarar tokens/passwords em erros.

## IDs

Entidades:
- UUID.

Nunca usar hostname como chave primária.

## Datas

- persistir UTC;
- API usa ISO-8601;
- UI converte para timezone configurado.

## Estado de node

Enum sugerido:

```text
unknown
online
degraded
offline
maintenance
disabled
```

## Riscos

Enum:

```text
read
low
medium
high
critical
```

## Jobs

Estados:

```text
requested
validating
planned
awaiting_approval
queued
dispatched
running
validating_result
succeeded
failed
partial
cancelled
expired
```

## Erros de API

Contrato padrão:

```json
{
  "error": {
    "code": "NODE_NOT_FOUND",
    "message": "Node not found",
    "requestId": "..."
  }
}
```

Não vazar stack trace.

## Idempotência HTTP

Endpoints de criação de actions devem aceitar:

```http
Idempotency-Key: <uuid>
```

## Correlation IDs

Toda requisição:
- `requestId`;
- toda execução:
- `jobId`;
- traces:
- `traceId`.

## Critérios de aceite

- [ ] Config validada no startup.
- [ ] Redaction de secrets testada.
- [ ] Padrão de erros implementado.
- [ ] Request ID atravessa API/worker.
- [ ] Enums compartilhados definidos.
