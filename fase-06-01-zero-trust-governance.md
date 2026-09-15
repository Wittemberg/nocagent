# Fase 06/01 — Governança Zero-Trust de Execução

## Goal

Substituir comandos SSH livres por ações registradas, rastreáveis e aprováveis, sem expor segredos nem aceitar automaticamente a primeira chave SSH.

## Tasks

- [x] Definir catálogo versionado de ações SSH, permissões e risco → Verificar: comandos livres não fazem parte do contrato MCP.
- [x] Persistir fingerprint pendente e execuções/aprovações com vínculo de tenant → Verificar: migração Prisma gera cliente válido.
- [x] Transformar o proxy SSH para descoberta/confirmação de chave e execução exclusiva de ação → Verificar: primeira chave não é confiada automaticamente.
- [x] Aplicar contexto de ator, tenant, policy, lock e audit log no executor MCP → Verificar: operações mutáveis não aprovadas são bloqueadas.
- [x] Proteger e expor endpoints REST para descoberta, confirmação e execução → Verificar: autenticação, RBAC e isolamento de tenant retornam os códigos corretos.
- [x] Adicionar testes unitários do catálogo e da policy → Verificar: leituras passam e mutações exigem aprovação.
- [x] Executar validação, testes e build → Verificar: carregamento do core, testes e build web sem erros.

## Done When

- [x] A IA não consegue enviar shell arbitrário.
- [x] Um host novo fica pendente até confirmação por operador autorizado.
- [x] Mutações possuem policy, aprovação única, lock e registro de auditoria.
