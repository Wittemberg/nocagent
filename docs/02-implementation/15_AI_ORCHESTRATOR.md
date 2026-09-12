# Etapa 15 — AI Orchestrator

## Objetivo

Adicionar interação natural sem entregar controle irrestrito ao modelo.

## Arquitetura

```text
Chat
↓
Context Builder
↓
LLM
↓
Structured Tool Call
↓
Authorization
↓
Policy Engine
↓
Action/Query
↓
Result
↓
LLM explanation
```

## Ferramentas disponíveis para a IA

Separar:

### Read tools
- `getNode`
- `queryMetrics`
- `getBackups`
- `getAlerts`
- `getWorkloads`
- `searchLogs`
- `getJob`
- `getPolicies`

### Action tools
Uma tool genérica segura:
`requestAction(actionKey, target, parameters)`

A tool NÃO aceita shell.

## System instructions

Incluir regras invariáveis:

1. Não inventar dados de infraestrutura.
2. Consultar ferramentas antes de afirmar estado atual.
3. Não gerar shell para execução automática.
4. Usar somente actionKey disponível.
5. Explicar risco.
6. Não contornar policy.
7. Respeitar tenant scope.
8. Pedir aprovação quando Policy Engine exigir.
9. Não declarar sucesso sem resultado do job.
10. Diferenciar recomendação de ação executada.

## Context

Não despejar toda infraestrutura no prompt.

Context Builder busca somente:
- tenant atual;
- nodes mencionados;
- alerts relevantes;
- policy relevante;
- histórico recente limitado.

## Structured output

Interpretação:

```json
{
  "intent": "request_action",
  "target": {
    "type": "node",
    "id": "..."
  },
  "actionKey": "system.apt_upgrade",
  "parameters": {},
  "explanation": "..."
}
```

Validar schema no backend.

## Fluxo de exemplo

Usuário:
"faça apt update e upgrade no node X"

IA:
1. resolve Node X;
2. consulta health;
3. solicita plan/dry-run;
4. policy decide approval;
5. IA apresenta plano;
6. usuário aprova;
7. job executa;
8. IA consulta resultado;
9. explica resultado.

## "Resolva isso"

Não autorizar ação aberta.

IA deve:
- diagnosticar;
- criar plano;
- escolher ações permitidas;
- respeitar nível de autonomia.

## Autonomy policy

Por tenant/node:

```text
read: auto
diagnostic: auto
low-risk changes: configurable
medium: approval
high: approval
critical: deny/dual approval
```

## Prompt injection

Logs, hostname, VM names e arquivos são dados não confiáveis.

Nunca tratar conteúdo coletado do host como instrução de sistema.

## Auditoria IA

Guardar:
- user request;
- model/provider;
- tool calls;
- action selected;
- policy decision;
- final job link.

Evitar armazenar conteúdo sensível desnecessário.

## Critérios de aceite

- [ ] IA responde consultas com dados reais.
- [ ] IA não consegue chamar shell.
- [ ] Tool schema rejeita action inexistente.
- [ ] Mudança medium exige policy/approval.
- [ ] Prompt injection em log não altera regras.
- [ ] IA não diz "concluído" antes do job finalizar.
