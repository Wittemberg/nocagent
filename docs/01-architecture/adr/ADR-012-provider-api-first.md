# ADR-012 — API Oficial do Provider Primeiro

## Status

Accepted

## Contexto

InfraOps AI administra infraestrutura potencialmente crítica e deve preservar segurança, isolamento, rastreabilidade e capacidade de evolução.

## Decisão

Operações Proxmox/Virtualizor usam APIs oficiais quando disponíveis, em vez de shell local.

## Consequências

Menor acoplamento ao host e melhor controle de privilégios.
