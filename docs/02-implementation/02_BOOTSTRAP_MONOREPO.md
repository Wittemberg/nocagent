# Etapa 02 — Bootstrap do Monorepo

## Objetivo

Criar a estrutura física inicial do projeto.

## Estrutura obrigatória

```text
infraops-ai/
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
├── agents/
│   └── linux/
├── packages/
│   ├── contracts/
│   ├── action-schema/
│   ├── policy-engine/
│   ├── audit/
│   ├── observability/
│   └── shared/
├── deployments/
│   ├── docker/
│   └── portainer/
├── docs/
│   ├── adr/
│   ├── api/
│   └── runbooks/
├── scripts/
├── .github/
│   └── workflows/
├── .env.example
├── docker-compose.dev.yml
└── README.md
```

## JavaScript/TypeScript workspace

Usar workspace único. Preferência: `pnpm`.

Configurar:
- TypeScript strict;
- ESLint;
- Prettier;
- testes;
- build;
- lint;
- typecheck.

Não compartilhar ORM entities diretamente com frontend. Compartilhar somente contratos/DTOs apropriados em `packages/contracts`.

## Agent Go

Criar módulo separado:

```text
agents/linux/
├── cmd/infraops-agent/
├── internal/
│   ├── config/
│   ├── identity/
│   ├── enrollment/
│   ├── heartbeat/
│   ├── jobs/
│   ├── actions/
│   ├── executor/
│   ├── inventory/
│   ├── telemetry/
│   └── storage/
├── pkg/
├── go.mod
└── go.sum
```

## Aplicações

### `apps/web`
Responsabilidades:
- UI;
- autenticação via API;
- dashboard;
- nodes;
- backups;
- AI chat;
- approvals;
- auditoria.

### `apps/api`
Responsabilidades:
- REST API;
- auth;
- tenancy;
- cadastro;
- policies;
- AI orchestration;
- agent API;
- integrations.

### `apps/worker`
Responsabilidades:
- jobs assíncronos;
- análise de backups;
- alertas;
- sincronização Proxmox/Virtualizor;
- notificações;
- processamento de auditoria pesada.

## CI mínimo

Em cada pull request:

```text
install
lint
typecheck
unit tests
Go fmt
Go vet
Go tests
build web
build api
build worker
build agent
```

## Branching

- `main`: produção.
- branches curtas por feature/fix.
- PR obrigatório.
- evitar branch de desenvolvimento permanente.

## Commits

Conventional Commits:
- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `test:`
- `chore:`
- `security:`

## Critérios de aceite

- [ ] Monorepo inicia localmente.
- [ ] `pnpm lint` passa.
- [ ] `pnpm test` passa.
- [ ] `pnpm build` passa.
- [ ] `go test ./...` passa.
- [ ] Docker Compose sobe PostgreSQL e Redis.
- [ ] `/health` da API responde.
- [ ] README contém bootstrap local reproduzível.
