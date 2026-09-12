# UI Terminology & Status Standard

## Goal
Prevent the interface from drifting back into internal/English terminology.

## Primary rule
Internal engineering terminology may exist in code and technical details. Main UI should use terms that a small IT provider can understand without a glossary.

## Approved primary labels
- Início
- Clientes
- Infraestrutura
- Servidores e Máquinas Virtuais
- Equipamentos
- Rede e Internet
- Racks
- Backups
- Alertas
- Assistente IA
- Automações
- Recomendações
- Relatórios
- Histórico
- Configurações

## Prohibited as primary labels
Unless in Technical Mode/details:
- Workload
- Source of Truth
- RBAC
- Action Registry
- Advisor
- Schedule
- Trigger
- Hysteresis
- Circuit Breaker
- Non-compliant
- Degraded

## Status mapping
| Internal | Simple UI |
|---|---|
| online/healthy/compliant | Normal |
| warning/degraded | Atenção |
| critical/down/failed | Problema |
| unknown | Sem dados |
| pending_approval | Aguardando aprovação |
| running | Em execução |
| succeeded | Concluído |
| failed | Falhou |
| skipped | Não executado |

## Writing style
Prefer:
> “O backup está atrasado há 31 horas.”

Avoid:
> “RPO policy non-compliant.”

Prefer:
> “O link Vivo está com 26% de perda.”

Avoid:
> “WAN1 DEGRADED threshold exceeded.”

## Technical detail pattern
Primary:
> Backup atrasado

Secondary:
> Último backup válido há 31h. Limite configurado: 24h.

Expandable:
> Detalhes técnicos: RPO=24h, compliance=false, policyId=...
