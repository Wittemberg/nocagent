# Prompt Inicial para a IA Especialista em Programação

Use este texto como instrução inicial ao iniciar a implementação.

---

Você é a IA responsável por implementar o **InfraOps AI**.

Antes de escrever código, leia integralmente todos os documentos deste pacote na ordem definida em `00_README_MASTER.md`.

## Regras não negociáveis

1. Não implemente shell remoto arbitrário.
2. Não crie endpoints `execute command`.
3. Toda operação em host deve ser uma Action registrada e versionada.
4. A IA nunca ignora o Policy Engine.
5. Mudanças operacionais geram Job.
6. Todo Job deve ser idempotente.
7. Toda Action mutável deve ter precheck e postcheck.
8. Toda operação relevante deve ser auditada.
9. Multi-tenancy deve existir desde o banco e autorização.
10. Agent inicia conexões outbound; a central não depende de SSH inbound.
11. Segredos não podem ser persistidos em plaintext ou aparecer em logs.
12. Não conceda `sudo NOPASSWD: ALL` ao agent.
13. Prefira APIs oficiais Proxmox/Virtualizor às chamadas shell quando possível.
14. Métricas temporais ficam no Prometheus, não no PostgreSQL.
15. A plataforma deve funcionar sem o provedor de IA disponível.

## Método de trabalho

Para cada etapa:

1. leia o documento da etapa;
2. liste arquivos que serão criados/alterados;
3. implemente apenas o escopo daquela etapa;
4. crie testes;
5. execute lint/typecheck/test/build;
6. apresente migrations;
7. atualize documentação;
8. valide cada critério de aceite;
9. somente então prossiga.

## Antes de mudanças arquiteturais

Se uma decisão contradisser os documentos:
- não altere silenciosamente;
- crie um ADR;
- explique motivo, tradeoffs, impacto de segurança e migração;
- preserve as invariantes de segurança.

## Qualidade

- TypeScript strict.
- Go idiomático.
- Sem `any` desnecessário.
- Sem secrets hardcoded.
- Sem TODOs críticos escondidos.
- Erros tipados.
- Logs estruturados.
- Correlation IDs.
- Testes de tenant isolation.
- Testes de injection.
- Testes de replay/idempotência.

## Primeira tarefa

Comece exclusivamente pela **Etapa 01 e Etapa 02**.

Entregue:
- estrutura de diretórios;
- ADRs fundamentais;
- bootstrap do monorepo;
- Docker Compose de desenvolvimento com PostgreSQL/Redis;
- `/health`;
- CI básico;
- README de desenvolvimento.

Não implemente Proxmox, Virtualizor, IA ou ações privilegiadas antes do foundation gate estar verde.
