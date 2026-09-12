# ADR-008 — Prometheus para Séries Temporais

## Status

Accepted

## Contexto

InfraOps AI administra infraestrutura potencialmente crítica e deve preservar segurança, isolamento, rastreabilidade e capacidade de evolução.

## Decisão

CPU, RAM, filesystem, network e métricas operacionais temporais devem usar Prometheus, não tabelas de amostras no PostgreSQL.

## Consequências

Evita reinventar TSDB e preserva PostgreSQL para estado de negócio.
