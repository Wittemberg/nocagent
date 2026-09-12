# Etapa 09 — Policy Engine, Aprovações e Locks

## Objetivo

Separar "é possível executar" de "é permitido executar".

## Inputs da policy

```text
actor
tenant
target
action
parameters
risk
time
maintenance window
criticality
current health
permissions
AI actor
```

## Resultado

```json
{
  "decision": "allow|deny|require_approval",
  "reasonCodes": [],
  "requiredApprovals": 1,
  "constraints": {}
}
```

## Precedência

1. hard deny;
2. node policy;
3. tenant policy;
4. action policy;
5. role permission;
6. AI permission;
7. maintenance policy;
8. approval.

DENY vence ALLOW.

## Regras iniciais

### Read
Sem aprovação.

### Low
Pode ser automática conforme role/policy.

### Medium
Aprovação por padrão.

### High
Aprovação explícita sempre.

### Critical
MVP: deny para IA ou dupla aprovação futura.

## Maintenance windows

Persistir:
- timezone;
- dias;
- hora início/fim;
- actions permitidas.

Policy Engine usa hora do tenant, mas armazena UTC.

## Approval

A aprovação deve mostrar:
- action;
- target;
- parâmetros;
- plan;
- riscos;
- impacto;
- expiração.

Não permitir aprovação "em branco" antes do plano.

## TOCTOU

Após aprovação e antes de executar:
- revalidar prechecks;
- revalidar policy;
- revalidar lock.

Se contexto mudou significativamente, voltar a `awaiting_approval` ou falhar.

## Resource Locks

Chaves:
- `node:{id}`;
- `storage:{id}`;
- `workload:{id}`;
- `service:{node}:{name}`.

### Shared
Read-only compatível.

### Exclusive
Mudanças.

Exemplo:
`system.apt_upgrade` => exclusive `node:{id}`.

## Lock lease

Locks possuem TTL/lease e renovação pelo job.

Worker limpa locks órfãos expirados.

## Critérios de aceite

- [ ] DENY explícito vence.
- [ ] Upgrade fora de janela pode ser bloqueado.
- [ ] Approval expira.
- [ ] Dois jobs exclusivos não rodam juntos no mesmo node.
- [ ] Revalidação ocorre antes da execução.
