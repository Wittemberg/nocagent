# ADR-001 — Agent Outbound

## Status

Accepted

## Contexto

InfraOps AI administra infraestrutura potencialmente crítica e deve preservar segurança, isolamento, rastreabilidade e capacidade de evolução.

## Decisão

O Agent inicia a comunicação com a central por HTTPS. A operação normal não depende de SSH inbound nem de porta HTTP aberta no node.

## Consequências

Simplifica firewall/NAT e reduz superfície de exposição. Exige protocolo confiável de polling/stream, identidade forte e replay protection.
