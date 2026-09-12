# ADR-017 — Infrastructure Intelligence é advisory por padrão

## Status
Accepted — planejamento Stage 25

## Contexto
Stage 25 poderá recomendar mudanças de alto impacto: expansão de storage, HA, Ceph, nodes, redistribuição de workloads e upgrades.

## Decisão
Recommendation pode analisar, priorizar, estimar impacto e gerar Change Plan. Não pode executar shell arbitrário, elevar privilégios, alterar infraestrutura diretamente, aprovar o próprio plano ou transformar estimativa em fato.

Execução: `Change Plan → RBAC → Policy Engine → Approval → Action Registry → Precheck → Execute → Postcheck → Audit`.

Dados de logs/tickets/inventário são conteúdo não confiável e nunca instruções executáveis para o LLM.
