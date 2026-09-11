---
type: project
created: 2026-05-25
updated: 2026-07-12
---

# Project Conventions

## Git Workflow
- Always create a new dedicated branch for major code changes.
- Branch name format should follow: `feature/[task-slug]` or `fix/[bug-slug]`.

## Supported AI platforms (AG Kit)
- AG Kit **only supports Gemini CLI and Google Antigravity**.
- Do not claim compatibility with Claude Code, Cursor, Copilot, Windsurf, or other assistants unless the user explicitly expands scope.
- Copy on the website, docs, FAQ, README, and marketing should describe AG Kit as a toolkit for Gemini CLI / Antigravity-style agent setups.
- **NOC-Agent Conventions**:
  - Idioma de interface e mensagens ao operador: **Português (PT-BR)** por padrão.
  - Mensagens de erro devem responder: O que houve, Qual o impacto, O que fazer, Quem age.
  - Mudanças de infraestrutura física/lógica sempre exigem aprovação explícita antes de execução.
