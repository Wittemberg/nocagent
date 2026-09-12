# 🌐 NOC-Agent — Plano Diretor de Arquitetura & Estratégia
> **Projeto Oficial:** NOC-Agent  
> **Domínio de Produção:** `https://nocagent.awecloudsolution.com`  
> **Repositório:** `https://github.com/Wittemberg/nocagent` (Público inicial → Privado)  
> **Data de Formalização:** 10/09/2026  

---

## 1. VISÃO GERAL & OBJETIVO

O **NOC-Agent** é um agente autônomo inteligente e copiloto operacional de infraestrutura para redes, Provedores de Internet (ISPs) e Data Centers.
Ele monitora incidentes de rede, gerencia ativos de virtualização e roteamento (Proxmox, Mikrotik RouterOS, pfSense, Linux), interage com operadores humanos via WhatsApp e Chatwoot, executa diagnósticos automatizados e aplica ações de remediação seguras sob supervisão humana (*Human-in-the-Loop*).

---

## 2. OS 6 PILARES ARQUITETURAIS CONSOLIDADOS

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            NOC-AGENT CORE SYSTEM                             │
├──────────────────────────┬───────────────────────────────────────────────────┤
│ 1. witteberg-standards   │ UI/UX em PT-BR, zoom 100%, sem overflow-mask,     │
│                          │ Security Baseline (Zero Secrets no Frontend)      │
├──────────────────────────┼───────────────────────────────────────────────────┤
│ 2. infraops-ai           │ 14 ADRs, 10 Invariantes Éticas de IA,             │
│                          │ Drivers de Rede (Proxmox REST, Mikrotik API)      │
├──────────────────────────┼───────────────────────────────────────────────────┤
│ 3. afonsoft/skills       │ Padrões de Servidores MCP com Zod, AST Analysis,  │
│                          │ Diagramação Draw.io de topologias                 │
├──────────────────────────┼───────────────────────────────────────────────────┤
│ 4. vudovn/ag-kit         │ Workspace Antigravity, 20 Agents, Workflows       │
│                          │ (/coordinate, /verify), Safety Hook nativo OS     │
├──────────────────────────┼───────────────────────────────────────────────────┤
│ 5. NousResearch/Hermes   │ Cérebro de Execução, Approvals Human-in-the-Loop, │
│                          │ Cron Natural Language, Subagentes e Gateway       │
├──────────────────────────┼───────────────────────────────────────────────────┤
│ 6. Chatwoot Integration  │ Integração nativa com Chatwoot: Account API       │
│                          │ (admin/bot) + Public API (inbox/mensageria)       │
└──────────────────────────┴───────────────────────────────────────────────────┘
```

---

## 3. ARQUITETURA DE COMPONENTES & TOPOLOGIA

```
                              ┌───────────────────────────────────┐
                              │  Operador WhatsApp / Webhook      │
                              │  Chatwoot Inbox (Public API)      │
                              └─────────────────┬─────────────────┘
                                                │
                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                      NOC-AGENT GATEWAY & RUNTIME (Hermes Agent Core)                             │
│                                                                                                  │
│  - Gateway Multicanal (WhatsApp Cloud / Webhooks / Chatwoot Connector)                           │
│  - Chatwoot Bridge (Account API para despacho / Public API para conversas de Inbox)              │
│  - AI Conversation Engine (Claude 3.5 Sonnet / Haiku / GPT-4o / Hermes 3)                        │
│  - Guardrails & 10 Invariantes de Infraestrutura                                                 │
│  - Engine de Aprovação Human-in-the-Loop (Pausa antes de ações destrutivas)                      │
│  - Agendador Cron Inteligente (Auditorias de rotina, checagens periódicas Zabbix)                │
│  - Memória Contínua (SQLite FTS5 + Aprendizado de topologia e incidentes)                         │
└───────────────────────────────────────┬──────────────────────────────────────────────────────────┘
                                        │ (Chamadas MCP via stdio / SSE / HTTP)
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             NOC-AGENT MCP SERVERS & DRIVERS                                      │
│                                                                                                  │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌──────────────────────────────────┐  │
│  │   Proxmox MCP Server    │  │   Mikrotik/pfSense MCP  │  │        Zabbix MCP Server         │  │
│  │   (REST API oficial)    │  │   (RouterOS API / SSH)  │  │   (Triggers, Alertas, Histórico) │  │
│  │   - Listar/reiniciar VM │  │   - BGP status, ping    │  │   - Consultar alertas ativos │  │
│  │   - Snapshot / Backups  │  │   - Queue / Queues pool │  │   - Reconhecer eventos       │  │
│  └─────────────────────────┘  └─────────────────────────┘  └──────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ NetAgent Remote Daemons (Binário Go leve rodando nos clientes/filiais sem porta aberta)     │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                 DASHBOARD WEB (React + Vite, Witteberg Standards)                                │
│  - Roteado via Traefik em https://nocagent.awecloudsolution.com                                  │
│  - Monitoramento de incidentes em tempo real, aprovações pendentes, topologia e auditoria        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. INTEGRAÇÃO COM CHATWOOT (DUAL-API STRATEGY)

Para permitir atendimento unificado entre a equipe humana de NOC e o agente IA:

1. **Account API (Privilegiada)**:
   - Utilizada para configurações administrativas pelo bot.
   - Permite listar e gerenciar Inboxes, agentes humanos, equipes e roteamento de conversas.
   - Habilita o NOC-Agent a transferir a conversa para um operador humano quando o problema for escalado para L3.
2. **Public API (Mensageria do Inbox)**:
   - Envio e recebimento direto de mensagens nas caixas de entrada (Inboxes).
   - O NOC-Agent escuta os webhooks do Chatwoot (`message_created`), processa o contexto pelo Hermes Agent e responde no mesmo ticket/conversa.
   - Respeita o status da conversa: se estiver atribuída a um humano, o NOC-Agent entra em modo "copiloto" (sugere ações em notas privadas) sem responder diretamente ao cliente.

---

## 5. REUTILIZAÇÃO DA INFRAESTRUTURA EXISTENTE

| Recurso Existente | Papel no NOC-Agent | Configuração |
|---|---|---|
| **Portainer** | Orquestração da Stack Docker | Stack dedicada `noc-agent` |
| **Traefik** | Roteamento HTTPS & TLS Reverse Proxy | Host: `nocagent.awecloudsolution.com` |
| **PostgreSQL** | Persistência de Dados Relacionais | Novo banco `nocagent` + usuário dedicado |
| **Redis** | Filas de Tarefas, Lock de Comandos & Cache | Prefixo de chave isolado `nocagent:` |
| **Storage S3** | Armazenamento de Backups, Snapshots e Logs | Novo bucket `nocagent` |
| **Zabbix** | Servidor de Telemetria e Alertas | A ser provisionado / conectado via API Token |

---

## 6. SEGURANÇA, GOVERNANÇA E 10 INVARIANTES

1. **Zero Shell Arbitrário**: A IA nunca tem acesso a terminal `bash/sh` livre. Apenas ferramentas catalogadas (MCP) com validação de esquema de entrada (Zod).
2. **Aprovação Obrigatória para Ações Críticas**: Ações que interrompam tráfego (ex: reiniciar roteador de borda, desligar VM de produção) disparam fluxo de aprovação no WhatsApp/Chatwoot via `approval.py` do Hermes Agent.
3. **Credenciais Cifradas**: Tokens e senhas armazenados com criptografia AES-256 no banco de dados.
4. **Audit Log Criptográfico**: Toda ação solicitada por operador e executada pela IA é registrada com timestamp, identificador do operador e resultado telemetry.
5. **Zero Dados Fictícios (Integridade Operacional)**: É estritamente proibido exibir dados fictícios, mocks, placeholders ou simulações em qualquer tela ou resposta do NOC-Agent. Toda informação deve vir de consultas reais às APIs oficiais, PostgreSQL, Storage S3 ou equipamentos de rede. Se não houver dados cadastrados, exibe-se empty state explícito.

---

## 7. GOVERNANÇA ENTERPRISE, FEATURE FLAGS & APM (FASE 5)

Para suportar operações críticas de Data Center e escalabilidade multi-tenant (MSPs):

1. **Níveis de Autonomia da IA (L1 / L2 / L3):**
   - **L1 (Leitura Passiva):** Coleta contínua de status, métricas RTT, inventário de VMs e alertas Zabbix sem necessidade de aprovação.
   - **L2 (Remediação Supervisionada):** Limpeza de rotas ARP, reatribuição de DHCP e reinício de serviços locais sob notificação.
   - **L3 (Intervenção de Alto Risco):** Desligamento/reboot de hipervisores Proxmox, failover de roteadores Mikrotik e alteração de regras pfSense. Exige autorização humana explícita em 2 etapas.
2. **Emergency Kill-Switch Imediato:**
   - Disjuntor global com persistência em Redis e PostgreSQL.
   - Interrompe instantaneamente qualquer comando em trânsito e reverte o motor conversacional para modo passivo.
3. **Pulse APM de Baixa Latência:**
   - Instrumentação das rotas e ferramentas MCP para registrar latência RTT em milissegundos agrupada por driver (Proxmox, pfSense, Mikrotik, Zabbix e modelos de IA).
   - Detecção proativa de degradação antes de quedas de serviço.
4. **Telescope Inspector:**
   - Gravação de traces detalhados com endpoints, status code HTTP, duração e diagnósticos técnicos para auditoria operacional.

