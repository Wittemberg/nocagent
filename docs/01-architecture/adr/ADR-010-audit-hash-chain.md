# ADR-010 — Auditoria com Hash Chain

## Status

Accepted

## Contexto

InfraOps AI administra infraestrutura potencialmente crítica e deve preservar segurança, isolamento, rastreabilidade e capacidade de evolução.

## Decisão

Eventos de auditoria possuem encadeamento de hashes para detectar adulteração.

## Consequências

Não impede alteração física do banco, mas permite detectar quebra de integridade do histórico.
