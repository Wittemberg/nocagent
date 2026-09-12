# ADR-002 — Agent em Go

## Status

Accepted

## Contexto

InfraOps AI administra infraestrutura potencialmente crítica e deve preservar segurança, isolamento, rastreabilidade e capacidade de evolução.

## Decisão

O Agent Linux será implementado em Go e instalado como serviço nativo do sistema.

## Consequências

Distribuição por binário único, baixo overhead e ausência de runtime externo.
