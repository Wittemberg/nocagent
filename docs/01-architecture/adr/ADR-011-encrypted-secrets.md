# ADR-011 — Secrets Cifrados

## Status

Accepted

## Contexto

InfraOps AI administra infraestrutura potencialmente crítica e deve preservar segurança, isolamento, rastreabilidade e capacidade de evolução.

## Decisão

Secrets nunca são armazenados em plaintext. O MVP usa authenticated encryption com master key fora do PostgreSQL.

## Consequências

Dump de banco isolado não revela credenciais. Requer gestão/rotação de chaves.
