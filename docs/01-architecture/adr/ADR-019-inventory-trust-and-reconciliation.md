# ADR-019 — Proveniência, confiança e reconciliação do inventário

## Status
Accepted — planejamento Stage 26

## Decisão
Dados de inventário carregam origem e estado de verificação: MANUAL, DISCOVERED e VERIFIED.

Descoberta automática cria/atualiza candidatos de reconciliação. Não sobrescreve silenciosamente dados verificados.

## Matching
Prioridade sugerida:
1. serial;
2. MAC;
3. management IP;
4. hostname + manufacturer/model.

## IA
A IA deve informar quando uma conclusão depende de dado descoberto e ainda não verificado.

## Auditoria
Merge, unlink, verify e override são auditáveis.
