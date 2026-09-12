# ADR-014 — IA como Actor com Permissões Próprias

## Status

Accepted

## Contexto

InfraOps AI administra infraestrutura potencialmente crítica e deve preservar segurança, isolamento, rastreabilidade e capacidade de evolução.

## Decisão

A IA possui identidade e permissões próprias. Permissão efetiva é interseção entre usuário, IA, tenant, node e action policies.

## Consequências

Cliente read-only pode usar IA sem ganhar execução.
