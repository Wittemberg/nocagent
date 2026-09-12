# ADR-007 — PostgreSQL para Estado de Negócio

## Status

Accepted

## Contexto

InfraOps AI administra infraestrutura potencialmente crítica e deve preservar segurança, isolamento, rastreabilidade e capacidade de evolução.

## Decisão

PostgreSQL armazena estado de domínio, policies, jobs, auditoria, backups e relacionamentos.

## Consequências

Transações e modelo relacional confiável para o core.
