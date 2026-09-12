# ADR-006 — Multi-tenancy desde a Fundação

## Status

Accepted

## Contexto

InfraOps AI administra infraestrutura potencialmente crítica e deve preservar segurança, isolamento, rastreabilidade e capacidade de evolução.

## Decisão

Entidades operacionais relevantes carregam tenant e toda autorização inclui escopo de tenant.

## Consequências

Evita reestruturação posterior e reduz risco de vazamento entre clientes.
