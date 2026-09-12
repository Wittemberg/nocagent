# ADR-005 — Policy Engine Independente da IA

## Status

Accepted

## Contexto

InfraOps AI administra infraestrutura potencialmente crítica e deve preservar segurança, isolamento, rastreabilidade e capacidade de evolução.

## Decisão

Autorização e decisão de risco ficam em componente determinístico independente do LLM.

## Consequências

Falhas/alucinações da IA não ampliam privilégios.
