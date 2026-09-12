# Modelo de Ameaças (Threat Model) — InfraOps AI

## 1. Visão Geral

Este documento descreve as vetores de ataque identificados na arquitetura do **InfraOps AI**, as superfícies de exposição e as contramedidas rígidas implementadas no sistema.

---

## 2. Matriz de Ameaças e Mitigações

| ID | Ameaça / Vetor de Ataque | Severidade | Impacto Potencial | Mitigação Arquitetural Implementada |
| :--- | :--- | :--- | :--- | :--- |
| **TM-01** | **Comprometimento da Central** | Crítica | Acesso a múltiplos hosts e instâncias | - Desconexão de SSH inbound nos agentes (outbound polling apenas).<br>- Agentes executam apenas Actions pré-registradas.<br>- Não existem endpoints genéricos de shell. |
| **TM-02** | **Comprometimento de Agente de Nó** | Alta | Acesso ao host individual | - Arquivos de identidade (`0600`) em `/var/lib/infraops-agent` (`0700`).<br>- Proibição estrita de `sudo NOPASSWD: ALL`.<br>- Validação de precheck e postcheck em todas as Actions. |
| **TM-03** | **Roubo de Token de Enrollment** | Alta | Registro não autorizado de nós | - Tokens de enrollment são de uso único (Single-Use TTL 15 min).<br>- Rejeição automática de reutilização de token. |
| **TM-04** | **Acesso Cross-Tenant por Usuário Malicioso** | Alta | Leitura/modificação de dados de outros clientes | - Multi-tenancy obrigatório com `tenant_id` em todas as tabelas.<br>- Auth Guards validam `ctx.tenantId === targetTenantId`. |
| **TM-05** | **Ataque por Prompt Injection (LLM)** | Alta | Execução não autorizada por IA | - Dados coletados de hosts (logs, hostnames) são marcados como não confiáveis (`<untrusted_data>`).<br>- Respostas da IA passam pela interseção RBAC (`user INTERSECT ai`) e pela Policy Engine.<br>- A IA só pode disparar `actionKey` registrada (sem shell). |
| **TM-06** | **Ataque por Replay de Job ou Aprovação** | Média | Duplicação não autorizada de ações | - Diário local de jobs no agente (`jobs_journal.json`).<br>- Revalidação TOCTOU pré-execução.<br>- Validação de status de transição de estado. |
| **TM-07** | **Injeção de Comandos Shell** | Crítica | Execução de código arbitrário | - Ações utilizam chamada direta de binário em `argv` (`exec.Command`).<br>- Proibição total do uso de `sh -c` ou concatenações de strings com entradas de usuário. |
| **TM-08** | **Vazamento de Segredos em Logs** | Média | Exposição de credenciais | - Módulo `redactSecrets` filtra senhas, URIs, tokens e chaves API de logs, exceções e rastros. |
