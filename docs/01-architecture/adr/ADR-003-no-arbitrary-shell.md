# ADR-003 — Proibição de Shell Arbitrário

## Status

Accepted

## Contexto

InfraOps AI administra infraestrutura potencialmente crítica e deve preservar segurança, isolamento, rastreabilidade e capacidade de evolução.

## Decisão

InfraOps AI não terá Action ou endpoint genérico de shell. Toda operação será uma Action registrada e versionada com parâmetros tipados.

## Consequências

Aumenta segurança e auditabilidade; novas operações exigem implementação explícita.
