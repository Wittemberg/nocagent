# Etapa 01 — Visão, Escopo e Princípios Arquiteturais

## Objetivo

Transformar a visão do InfraOps AI em requisitos implementáveis antes de criar código de negócio.

## Problema principal

O operador precisa responder rapidamente:

1. Quais nodes estão offline ou degradados?
2. Quais backups falharam, atrasaram ou não existem?
3. Quais storages estão próximos de esgotar?
4. Quais workloads estão em risco?
5. O que precisa da atenção humana agora?
6. Quais ações podem ser executadas com segurança?
7. O que a IA recomenda e por quê?
8. Quem executou cada alteração?

## Domínios principais

### Tenant/Cliente
Agrupa infraestrutura pertencente a uma empresa/cliente.

### Site
Local ou ambiente lógico opcional do cliente.

### Node
Host físico/virtual monitorado.

Tipos iniciais:
- linux
- proxmox
- virtualizor

### Workload
VM, container ou VPS.

### Storage
Filesystem, pool, datastore ou backup target.

### Backup
Uma cópia/artefato de backup identificável.

### Backup Policy
Define expectativa, retenção e tolerância.

### Metric
Série temporal; não armazenar todas as métricas no PostgreSQL.

### Event
Evento operacional.

### Alert
Condição ativa que exige atenção.

### Incident
Agrupamento operacional de alertas/eventos.

### Action Definition
Contrato de uma operação permitida.

### Job
Instância de uma action solicitada.

### Approval
Autorização humana para job.

### Audit Event
Registro imutável da atividade.

## Princípios obrigatórios

### 1. Observabilidade não depende da IA
Prometheus/alertas/jobs continuam funcionando sem LLM.

### 2. IA não executa shell arbitrário
A IA seleciona uma Action cadastrada.

### 3. Menor privilégio
Tokens e agentes recebem apenas privilégios necessários.

### 4. Outbound-first
Hosts iniciam comunicação com a central em TCP 443.

### 5. Multi-tenant desde o banco
Toda entidade operacional relevante deve pertencer a tenant.

### 6. Auditoria por padrão
Toda mudança deve produzir rastreabilidade.

### 7. Segurança antes de conveniência
Nunca adicionar um recurso "temporário" que contorne Action Engine/Policy Engine.

### 8. API-first
Frontend deve usar a mesma API versionada disponível para integrações.

## Casos de uso MVP

### Monitoramento
- listar nodes;
- status online/offline;
- heartbeat;
- CPU;
- RAM;
- load;
- filesystems;
- uptime.

### Backup
- último backup;
- resultado;
- idade;
- tamanho;
- retenção;
- backup esperado e não executado.

### Ações
- `node.health`
- `node.inventory`
- `system.apt_update`
- `system.apt_upgrade`
- `system.reboot`
- `service.status`
- `service.restart`
- `storage.analyze`
- `storage.usage`
- `backup.list`
- `backup.status`
- `backup.cleanup`
- `logs.tail`
- `logs.search`
- `network.ping`

### IA
- responder sobre estado da infraestrutura;
- investigar;
- propor plano;
- solicitar Actions;
- explicar riscos;
- nunca contornar policies.

## Critérios de aceite

- [ ] Domínios acima documentados no repositório.
- [ ] ADR-001 registra o uso de Agent + Action Engine.
- [ ] ADR-002 registra proibição de shell arbitrário.
- [ ] ADR-003 registra multi-tenancy.
- [ ] ADR-004 registra outbound-first.
- [ ] Backlog MVP contém somente itens desta etapa ou das etapas seguintes.
