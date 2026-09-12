# Etapa 08 — Action Framework

## Objetivo

Criar o componente mais importante da execução segura.

## Conceito

Uma Action representa intenção operacional permitida.

Exemplo:
`system.apt_upgrade`

Ela NÃO é um comando shell fornecido pelo usuário.

## Action Definition

Contrato:

```ts
interface ActionDefinition {
  key: string;
  version: number;
  name: string;
  description: string;
  risk: 'read' | 'low' | 'medium' | 'high' | 'critical';
  parameterSchema: JsonSchema;
  requiredPermissions: string[];
  supportsDryRun: boolean;
  supportsCancel: boolean;
  timeoutSeconds: number;
  lockStrategy: 'none' | 'shared' | 'exclusive';
  approvalPolicy: string;
  requiredCapabilities: string[];
}
```

## Executor no Agent

Contrato conceitual Go:

```go
type Action interface {
    Key() string
    Version() int
    Validate(ctx context.Context, params map[string]any) error
    Precheck(ctx context.Context, params map[string]any) (*PrecheckResult, error)
    Plan(ctx context.Context, params map[string]any) (*Plan, error)
    Execute(ctx context.Context, params map[string]any) (*ExecutionResult, error)
    Postcheck(ctx context.Context, params map[string]any, result *ExecutionResult) (*PostcheckResult, error)
}
```

## Pipeline

```text
Validate
↓
Precheck
↓
Plan
↓
Policy/Approval
↓
Execute
↓
Postcheck
↓
Finalize
```

## Actions MVP

### `node.health`
Read only.

Retorna:
- uptime;
- load;
- memory;
- critical filesystems;
- failed units.

### `node.inventory`
Read only.

### `system.apt_update`
Executa atualização de índices.
Risk: low.
Sem reboot.

### `system.apt_upgrade`
Risk: medium.
Requer:
- dry-run/simulation;
- espaço;
- dpkg lock;
- policy;
- aprovação padrão.

Não usar `dist-upgrade`/`full-upgrade` automaticamente no MVP.

### `system.reboot`
Risk: high.
Prechecks:
- maintenance;
- workload critical;
- cluster;
- jobs.
Aprovação obrigatória.

### `service.status`
Parâmetro:
`serviceName`.
Validar contra allowlist/config policy.

### `service.restart`
Risk: medium.
Não aceitar string com parâmetros shell.

### `storage.analyze`
Read only.

### `storage.usage`
Read only.

### `backup.list`
Read only.

### `backup.status`
Read only.

### `backup.cleanup`
Risk: high.
Nunca recebe caminho livre para deletar.

Parâmetros:

```json
{
  "policyId": "...",
  "olderThanDays": 4,
  "minimumCopies": 2,
  "dryRun": true
}
```

O executor só pode remover artefatos descobertos/identificados pelo Backup Engine.

### `logs.tail`
Read.
Fonte cadastrada; não path arbitrário inicialmente.

### `logs.search`
Read.

### `network.ping`
Read.
Validar destino por policy.

## Proibido

Nenhuma Action:
- `shell.exec`;
- `bash.run`;
- `file.delete_any`;
- `command.execute`.

## Versionamento

Mudança incompatível:
`system.apt_upgrade:v2`.

Jobs antigos continuam referenciando v1.

## Critérios de aceite

- [ ] Registry central e agent registry.
- [ ] JSON Schema valida parâmetros.
- [ ] Action desconhecida rejeitada.
- [ ] `backup.cleanup` não aceita path arbitrário.
- [ ] Precheck/postcheck presentes para actions mutáveis.
- [ ] Testes de injeção de shell.
