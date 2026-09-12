# InfraOps AI — Guia Mestre de Implementação

## Finalidade

Este pacote é o documento de handoff técnico para uma IA especialista em programação implementar o **InfraOps AI** de forma incremental, segura e testável.

O InfraOps AI será uma plataforma centralizada de observabilidade, monitoramento de backups, inventário, automação operacional e assistência por IA para ambientes compostos principalmente por:

- Proxmox VE;
- Virtualizor;
- Linux;
- VMs e containers;
- storages locais/remotos;
- rotinas de backup;
- serviços de infraestrutura.

A plataforma deverá ser executada inicialmente em Docker/Portainer, usando domínio HTTPS próprio.

## Regra de ouro

A IA **NUNCA** recebe acesso direto e irrestrito ao shell dos hosts.

Fluxo obrigatório:

```text
Usuário
  ↓
AI Orchestrator
  ↓
Policy Engine
  ↓
Action Engine
  ↓
Job
  ↓
InfraOps Agent
  ↓
Executor de Action permitido
  ↓
Host
```

A IA solicita `actions`. Ela não envia comandos arbitrários.

## Stack-base definida

### Plataforma central

- Frontend: Next.js + TypeScript
- API: NestJS + TypeScript
- Worker: NestJS + BullMQ
- Banco: PostgreSQL
- Queue/cache: Redis
- Métricas: Prometheus
- Alertas: Alertmanager
- Logs: Loki, em fase posterior
- Telemetria da própria plataforma: OpenTelemetry
- Object storage: S3/MinIO para outputs grandes e bundles
- Deploy: Docker Compose/Portainer

### Agent

- Linguagem: Go
- Serviço nativo systemd
- Comunicação outbound HTTPS 443
- Evolução prevista para stream persistente/gRPC ou WebSocket
- Identidade individual por node
- Enrollment token de uso único
- mTLS previsto/obrigatório antes de produção ampla

## Ordem obrigatória de implementação

A IA programadora deverá seguir os documentos nesta ordem:

1. `01_VISAO_ESCOPO_E_PRINCIPIOS.md`
2. `02_BOOTSTRAP_MONOREPO.md`
3. `03_CONFIG_AMBIENTES_E_PADROES.md`
4. `04_MODELO_DE_DADOS.md`
5. `05_AUTH_RBAC_MULTI_TENANCY.md`
6. `06_AGENT_GO_ENROLLMENT_HEARTBEAT.md`
7. `07_PROTOCOLO_AGENT_JOBS.md`
8. `08_ACTION_FRAMEWORK.md`
9. `09_POLICY_ENGINE_APPROVALS_LOCKS.md`
10. `10_AUDITORIA_SECRETS_E_SEGURANCA.md`
11. `11_OBSERVABILIDADE.md`
12. `12_INTEGRACAO_PROXMOX.md`
13. `13_INTEGRACAO_VIRTUALIZOR.md`
14. `14_BACKUP_ENGINE.md`
15. `15_AI_ORCHESTRATOR.md`
16. `16_FRONTEND_UX.md`
17. `17_ALERTAS_INCIDENTES_NOTIFICACOES.md`
18. `18_DEPLOY_PORTAINER_CICD.md`
19. `19_TESTES_SEGURANCA_QA.md`
20. `20_ROADMAP_MILESTONES.md`
21. `21_PROMPT_PARA_IA_PROGRAMADORA.md`
25. `25_INFRASTRUCTURE_INTELLIGENCE_CONTINUOUS_IMPROVEMENT.md`
26. `26_INFRASTRUCTURE_SOURCE_OF_TRUTH_IMPLEMENTATION.md`
27. `27_NETWORK_DEVICE_MONITORING_AND_GOVERNED_WAN_ACTIONS.md`
28. `28_SIMPLE_EXPERIENCE_FRONTEND_REFACTOR_IMPLEMENTATION.md`
29. `29_PRODUCTION_HARDENING_PFSENSE_TELEMETRY.md`
30. `INFRAOPS_AI_STAGE_30_DEVELOPMENT_CONTROL_CENTER_IMPLEMENTATION.md`

## Regra de avanço

Nenhuma etapa pode ser considerada concluída apenas porque "o código compila".

Cada documento contém critérios de aceite. A próxima etapa só deve começar quando os critérios do documento atual estiverem atendidos.

## Convenções

- IDs de domínio: UUID v7 quando disponível na stack escolhida; caso contrário UUID v4.
- Timestamps: UTC no banco; conversão para timezone na UI.
- API externa: `/api/v1/...`.
- API do agent: `/api/v1/agent/...`.
- JSON: `camelCase`.
- Banco: `snake_case`.
- Actions: namespace em minúsculas, por exemplo `system.apt_update`.
- Permissões: namespace em minúsculas, por exemplo `system.packages.upgrade`.
- Toda action é versionada.
- Toda execução recebe `jobId` e `idempotencyKey`.
- Toda alteração operacional gera auditoria.

## Não implementar no MVP

Evitar desvio de escopo. Não implementar antes dos fundamentos:

- terminal SSH genérico;
- shell remoto arbitrário;
- exclusão genérica de arquivos;
- alteração automática de firewall;
- destruição de VM/storage;
- execução autônoma de mudanças críticas pela IA;
- Kubernetes;
- billing;
- marketplace de plugins;
- multi-region;
- HA complexo da plataforma central.

## Fontes oficiais de referência

- Go: https://go.dev/doc/
- NestJS: https://docs.nestjs.com/
- PostgreSQL: https://www.postgresql.org/docs/current/
- Prometheus: https://prometheus.io/docs/
- OpenTelemetry: https://opentelemetry.io/docs/
- Proxmox API: https://pve.proxmox.com/wiki/Proxmox_VE_API
- Proxmox API Viewer: https://pve.proxmox.com/pve-docs/api-viewer/
- Virtualizor Admin API: https://www.virtualizor.com/docs/admin-api
