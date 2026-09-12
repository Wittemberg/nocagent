# ADR-013 — Idempotência e Resource Locks

## Status

Accepted

## Contexto

InfraOps AI administra infraestrutura potencialmente crítica e deve preservar segurança, isolamento, rastreabilidade e capacidade de evolução.

## Decisão

Todo Job possui idempotency key; operações conflitantes usam locks compartilhados/exclusivos.

## Consequências

Evita replay e concorrência destrutiva.
