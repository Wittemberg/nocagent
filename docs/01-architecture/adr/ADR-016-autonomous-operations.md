# ADR-016 — Autonomous Scheduler, Event Automation e Goal-Oriented Operations

## Status

Proposed / Planned

## Contexto

O InfraOps AI já possui monitoramento, IA contextual, Policy Engine, Actions governadas, RBAC, locks, auditoria e integrações operacionais. A próxima evolução natural é permitir que o sistema execute análises e ações sem depender de uma solicitação humana a cada ocorrência, mantendo os mesmos limites de segurança.

A necessidade inclui:

- tarefas agendadas;
- análises recorrentes por IA;
- triggers condicionais derivados de telemetria e eventos;
- remediação automática de cenários previamente autorizados;
- objetivos operacionais contínuos.

## Decisão

Será introduzida uma camada de **Autonomous Operations** composta por quatro capacidades:

1. **Scheduler Engine** — agenda jobs por data, horário, cron ou recorrência.
2. **Event/Condition Engine** — dispara workflows quando condições persistentes são satisfeitas.
3. **Autonomy Policy** — define o nível máximo de autonomia permitido por tenant, node, workload, action e risco.
4. **Goal Engine** — mantém objetivos declarativos contínuos através de observação, análise, decisão e Actions permitidas.

Nenhuma dessas camadas terá capacidade de executar shell arbitrário.

## Fluxo obrigatório

```text
Schedule / Event / Goal
        ↓
Context Builder
        ↓
Rule Engine / AI Analyzer
        ↓
Decision / Plan
        ↓
Policy Engine
        ↓
Action Registry
        ↓
Approval (quando exigido)
        ↓
Resource Lock
        ↓
Precheck
        ↓
Execute
        ↓
Postcheck / Validation
        ↓
Audit Hash Chain
        ↓
Notification / Report
```

## Níveis de autonomia

| Nível | Nome | Comportamento |
|---|---|---|
| 0 | Observe | Coleta e registra. |
| 1 | Analyze | Analisa e relata. |
| 2 | Recommend | Recomenda ações, sem executá-las. |
| 3 | Approval | Prepara a Action e exige aprovação humana. |
| 4 | Autonomous | Executa Actions explicitamente autorizadas pela policy. |
| 5 | Self-Healing | Detecta, diagnostica, corrige, valida e documenta cenários previamente governados. |

## Regras não negociáveis

- `DENY` explícito sempre prevalece.
- IA não pode elevar seu próprio nível de autonomia.
- Scheduler não equivale a autorização: a execução continua sujeita ao Policy Engine.
- Actions críticas/destrutivas mantêm suas regras específicas de aprovação.
- Anti-Self Approval continua obrigatório.
- Jobs agendados e condicionais são idempotentes.
- Triggers devem possuir cooldown, hysteresis e deduplicação quando aplicável.
- Toda execução deve registrar evidência, decisão, policy, action, resultado e validação.
- Falha de postcheck interrompe qualquer escalada automática subsequente.
- Goals são intenções declarativas; não concedem shell, wildcard permission ou bypass de policy.

## Consequências positivas

- redução de tarefas operacionais repetitivas;
- menor MTTR;
- operação preventiva em vez de apenas reativa;
- possibilidade de NOC autônomo governado para MSPs;
- maior valor do histórico, telemetria e Policy Engine já existentes.

## Riscos

- loop de automação;
- alert/job storms;
- correção incorreta por contexto insuficiente;
- excesso de custo de LLM;
- decisões baseadas em telemetria ruidosa;
- escalada de impacto caso uma policy seja mal configurada.

## Mitigações

- limites de frequência e orçamento;
- circuit breakers;
- cooldown/hysteresis;
- max actions per window;
- confidence/evidence thresholds;
- dry-run quando aplicável;
- approvals por risco;
- rollback para actions compatíveis;
- tenant isolation e auditabilidade completa.
