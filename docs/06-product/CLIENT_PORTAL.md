# Client Portal

## Objetivo

Permitir ao cliente acompanhar somente seu tenant com linguagem clara e IA read-only.

## Permissões esperadas

Pode:
- ver nodes/workloads;
- consultar CPU/RAM/storage;
- ver backups/alerts/SLA/histórico autorizado;
- conversar com IA sobre o próprio tenant.

Não pode, por padrão:
- executar Actions mutáveis;
- alterar policies;
- acessar secrets;
- acessar outros tenants;
- ampliar o próprio papel.

O isolamento deve ocorrer antes de dados serem enviados ao LLM.
