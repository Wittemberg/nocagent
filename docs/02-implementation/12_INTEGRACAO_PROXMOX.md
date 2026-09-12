# Etapa 12 — Integração Proxmox VE

## Objetivo

Descobrir cluster, nodes, VMs, containers, storage, tasks e informações de backup usando API oficial sempre que possível.

## Credenciais

Criar token Proxmox específico para InfraOps.

Separar idealmente:
- integração read-only;
- integração operacional.

Aplicar menor privilégio.

## Adapter

Criar interface:

```ts
interface HypervisorProvider {
  testConnection(): Promise<ConnectionResult>;
  listNodes(): Promise<NodeDto[]>;
  listWorkloads(): Promise<WorkloadDto[]>;
  listStorages(): Promise<StorageDto[]>;
  getTasks(...): Promise<TaskDto[]>;
}
```

Implementação:
`ProxmoxProvider`.

## Não misturar IDs

Guardar:
- `externalId`;
- `provider`;
- `providerNodeId`.

VMID não é PK global.

## Sync

Worker:
- inventory rápido: 1-5 min configurável;
- detalhes: frequência maior;
- tasks/backups: de acordo com custo.

Usar backoff.

## Dados essenciais

### Cluster
- name/status;
- quorum quando disponível;
- membros.

### Node
- status;
- CPU;
- memory;
- uptime;
- version.

### VM/LXC
- VMID;
- name;
- type;
- status;
- node;
- resources.

### Storage
- type;
- total;
- used;
- available;
- active.

### Tasks
Importantes para:
- vzdump;
- migration;
- restore;
- backup.

## Actions Proxmox futuras

MVP read:
- `proxmox.cluster.status`
- `proxmox.vm.list`
- `proxmox.vm.status`

Posterior:
- start;
- shutdown;
- reboot;
- migrate;
- snapshot.

Operações via API, não shell, quando endpoint suportar.

## Erros

Mapear erro remoto para códigos internos.
Não retornar corpo sensível da API.

## Rate limiting

Não inundar Proxmox.
Cachear resultados de leitura apropriados.

## Critérios de aceite

- [ ] Test Connection.
- [ ] Sync nodes.
- [ ] Sync VM/LXC.
- [ ] Sync storage.
- [ ] Falha de API não derruba worker.
- [ ] Token não aparece em log.
