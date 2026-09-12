# Etapa 19 — Testes, Segurança e QA

## Pirâmide

### Unit
- policy;
- action validation;
- backup retention;
- permission;
- hash chain;
- adapters.

### Integration
- PostgreSQL;
- Redis/BullMQ;
- agent protocol;
- Proxmox mock;
- Virtualizor mock.

### E2E
- enroll;
- heartbeat;
- request job;
- approval;
- execute;
- result;
- audit.

## Testes críticos

### Tenant isolation
Tentativas cross-tenant devem falhar.

### Shell injection
Parâmetros contendo:
```text
; rm ...
$(...)
`...`
&&
|
newline
```
não podem transformar params em comandos.

Preferir execução de processo com argv, nunca concatenar shell.

### Job replay
Replay não executa segunda vez.

### Approval replay
Aprovação expirada/reutilizada falha.

### Agent impersonation
Agent A não usa ID de B.

### Secret leakage
Snapshots de logs não contêm secrets.

### Backup cleanup
Nunca apaga:
- latest valid;
- below minimum copies;
- não pertencente ao target/policy.

## Threat model

Documentar:
- central compromised;
- agent compromised;
- stolen token;
- malicious tenant user;
- prompt injection;
- dependency compromise;
- MITM;
- replay;
- log poisoning.

## Dependency security

- lockfiles;
- automated dependency alerts;
- container scans;
- Go vulnerability scan;
- npm audit equivalente conforme política.

## Chaos/failure tests

Simular:
- Redis indisponível;
- DB timeout;
- agent offline durante job;
- Proxmox API timeout;
- AI provider offline.

A plataforma não pode perder consistência.

## Critérios de aceite

- [ ] Test suite automatizada.
- [ ] E2E principal passa.
- [ ] Nenhuma execução usa `sh -c` com entrada do usuário.
- [ ] Threat model versionado.
- [ ] Restore test de banco de dev/staging.
