# Etapa 05 — Autenticação, RBAC e Multi-tenancy

## Objetivo

Garantir que usuários, IA, agents e integrações sejam atores distintos.

## Actor types

```text
user
ai
agent
system
integration
```

## Roles iniciais

### Viewer
- leitura de nodes;
- métricas;
- backups;
- alertas;
- auditoria permitida.

### Operator
Viewer +
- ações de baixo risco;
- restart de serviço autorizado;
- `apt_update`;
- diagnósticos.

### Administrator
Operator +
- actions de médio/alto risco;
- manutenção;
- policies;
- integrações.

### Owner
Administrador +
- usuários;
- roles;
- secrets;
- tenant config.

## Permission naming

```text
node.read
node.manage
metrics.read
logs.read
backup.read
backup.create
backup.delete
backup.restore
system.diagnostics
system.packages.update
system.packages.upgrade
system.reboot
service.read
service.restart
vm.read
vm.power
vm.migrate
storage.read
storage.cleanup
policy.manage
audit.read
integration.manage
ai.use
approval.decide
```

## Escopo

Uma permissão nunca é apenas "tem/não tem".

Avaliar:
1. actor;
2. tenant;
3. site;
4. node;
5. workload;
6. action;
7. policy local.

## Permissão efetiva da IA

Obrigatório:

```text
effective =
user_permissions
INTERSECT ai_permissions
INTERSECT tenant_policy
INTERSECT node_policy
INTERSECT action_policy
```

Qualquer DENY explícito vence.

## Autenticação web

MVP:
- email/senha ou provedor configurado;
- sessão/JWT curto;
- refresh seguro;
- rate limit;
- MFA previsto e obrigatório antes de expor produção crítica.

## Agent auth

Não usar JWT de usuário.

Agent possui:
- identity;
- enrollment;
- certificado/token próprio;
- revogação independente.

## RLS

Para tabelas sensíveis multi-tenant:
- habilitar RLS quando modelo ORM suportar de forma segura;
- sessão da DB deve carregar tenant context;
- default deny.

## Testes obrigatórios

1. Viewer não executa action.
2. Operator do Tenant A não acessa Node B.
3. Admin do Tenant A não vê Tenant B.
4. IA não executa permissão que usuário não possui.
5. IA não executa permissão bloqueada para `ai`.
6. Agent X não consulta jobs de Agent Y.

## Critérios de aceite

- [ ] Guard de autorização central.
- [ ] Nenhum controller reimplementa autorização manualmente.
- [ ] Deny explícito suportado.
- [ ] Testes cross-tenant passam.
- [ ] Agent separado da autenticação humana.
