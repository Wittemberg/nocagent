# Etapa 25 — Guia de Implementação

## Fase A — Data contracts
Criar `Recommendation`, `RecommendationEvidence`, `IncidentCluster`, `CapacityForecast`, `SpofFinding`, `TechnicalDebtScore`, `CostProfile`, `ChangePlan` e `RecommendationValidation`. Todos com `tenantId`, lifecycle e audit.

**Gate:** contratos testados e tenant isolation comprovado.

## Fase B — Recurring Incident Analyzer
Normalizar incidents/alerts/triggers/self-healing; fingerprint determinístico; cluster por recurso/categoria; frequência, duração, tendência e custo operacional.

**Gate:** fixtures recorrentes agrupadas sem mistura entre tenants.

## Fase C — Recommendation Engine
Rules determinísticas primeiro. LLM apenas para síntese/explicação/hipóteses. Evidence IDs obrigatórios. Confidence calculada por sinais mensuráveis. Sem evidência: `insufficient_evidence`.

## Fase D — Capacity Forecast
Ler Prometheus; calcular tendência, threshold date, cenários e confiança. Testar com séries sintéticas conhecidas.

## Fase E — Dependency Graph & SPOF
Construir graph apenas com edges evidenciados. Detectar single-node, single-storage, single-link e single-backup-target.

## Fase F — Technical Debt Score
Pesos configuráveis, deduções explicáveis e histórico. Mesma entrada deve produzir mesmo score.

## Fase G — Cost / ROI
`CostProfile` por tenant. Sem input financeiro, não gerar valor monetário fictício.

## Fase H — Change Plan
Converter recommendation em plano com prerequisites, maintenance window, backup/rollback, Actions, approvals, risk e validation. Recommendation nunca executa mudança diretamente.

## Fase I — Validation Loop
Baseline → implementation marker → observation window → after metrics → delta → validation outcome.

## Fase J — Executive Review
Monthly/quarterly: incidents, recurrence, autonomous actions, hours avoided, technical debt, risks, recommendations, investments e validated outcomes.

## Fase K — UI
Criar `/intelligence`: Recommendations, Recurring Incidents, Capacity, Resilience/SPOF, Technical Debt, ROI, Reviews.

## Fase L — Marketing telemetry
Métricas reais: `recurring_incidents_detected`, `recommendations_created`, `recommendations_implemented`, `recommendations_validated`, `technician_hours_estimated_saved`, `incident_recurrence_reduction`, `capacity_risks_forecasted`.

## Definition of Done
backend, persistence, tests, UI, RBAC, tenant isolation, audit, observability, degraded LLM behavior, security review, docs e marketing claim readiness.
