# ADR-009 — Redis/BullMQ para Jobs Centrais

## Status

Accepted

## Contexto

InfraOps AI administra infraestrutura potencialmente crítica e deve preservar segurança, isolamento, rastreabilidade e capacidade de evolução.

## Decisão

A plataforma central utilizará Redis/BullMQ para filas e processamento assíncrono na stack TypeScript.

## Consequências

Simplifica workers e retries; jobs remotos continuam idempotentes no protocolo Agent.
