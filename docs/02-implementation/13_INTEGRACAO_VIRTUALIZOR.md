# Etapa 13 — Integração Virtualizor

## Objetivo

Integrar Virtualizor via Admin API e normalizar dados para o mesmo domínio interno usado por Proxmox.

## Credenciais

Virtualizor Admin API usa credenciais próprias.
Guardar em Secrets.

## Provider

Implementar:
`VirtualizorProvider`.

Não expor peculiaridades do Virtualizor para a UI.

## Sync mínimo

- servers/nodes;
- VPS;
- estatísticas relevantes;
- backup servers;
- backup plans quando necessário;
- backups.

## Backup

A documentação oficial da Admin API possui operações de:
- listar backups;
- criar backup;
- restore;
- excluir backup.

No MVP, iniciar read-only:
- discovery;
- status;
- idade;
- tamanho quando disponível.

Actions destrutivas somente após Backup Engine e Policy Engine maduros.

## Normalização

Mapear:

```text
Virtualizor VPS → workload
Virtualizor server → node
backup server → storage/backup target
backup record → backup artifact
```

## Erros

Implementar adapter robusto para respostas inconsistentes/legadas.

Registrar:
- provider request ID interno;
- status;
- tempo;
- error class.

Nunca logar API password.

## Critérios de aceite

- [ ] Connection test.
- [ ] VPS sincronizadas.
- [ ] Backup discovery.
- [ ] Backup server discovery.
- [ ] Dados aparecem na mesma UI de Proxmox.
