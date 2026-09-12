# ADR-018 — Source of Truth nativo e independente

## Status
Accepted — planejamento Stage 26

## Decisão
O InfraOps AI terá Source of Truth nativo para inventário físico/lógico básico e não dependerá de NetBox, Device42, Auvik ou outra plataforma externa para funcionar.

## Motivos
- foco em pequenas/médias redes;
- implantação simples;
- menor custo operacional;
- experiência integrada;
- controle de tenant/RBAC/auditoria;
- contexto direto para IA e Advisor.

## Limite
Não replicar suites enterprise inteiras. Implementar apenas recursos que entreguem valor claro ao público-alvo.

## Integrações futuras
Conectores externos podem existir futuramente como opcionais, nunca como requisito.
