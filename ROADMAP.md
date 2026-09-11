# 🗺️ Roadmap de Implementação — NOC-Agent
> **Estratégia:** Do Zero à Produção em 5 Fases  
> **Host de Produção:** Portainer + Traefik (`nocagent.awecloudsolution.com`)  
> **Repositório:** `https://github.com/Wittemberg/nocagent`  

---

## 📅 VISÃO GERAL DAS FASES

```
FASE 0: Fundação do Repositório & Docker Stack Spec
                 ↓
FASE 1: Runtime Hermes Agent + Chatwoot Dual-API Bridge
                 ↓
FASE 2: Servidores MCP de Rede (Proxmox, Mikrotik, pfSense, Zabbix)
                 ↓
FASE 3: Dashboard Web (React + Vite, Witteberg Standards)
                 ↓
FASE 4: Validação em Staging, Pre-Flight & Produção
```

---

## 📌 FASE 0: FUNDAÇÃO DO REPOSITÓRIO & INFRAESTRUTURA
- [ ] Criar estrutura base do monorepo / módulos limpos em `Wittemberg/nocagent`.
- [ ] Configurar `.env.example` com todas as chaves (OpenAI/Anthropic, Chatwoot, Traefik, PostgreSQL, Redis, S3).
- [ ] Elaborar `docker-compose.yml` da stack com labels completas do Traefik para `nocagent.awecloudsolution.com`.
- [ ] Criar banco de dados `nocagent` no PostgreSQL existente e bucket `nocagent` no Storage S3 existente.
- [ ] Criar schema inicial Prisma/SQL para persistência de operadores, equipamentos e logs de auditoria.

---

## 📌 FASE 1: RUNTIME HERMES AGENT & CHATWOOT BRIDGE
- [ ] Configurar container do Hermes Agent adaptado como serviço central de IA.
- [ ] Implementar a **Chatwoot Bridge**:
  - Webhook listener para eventos `message_created` do Chatwoot (Public API).
  - Client REST para a Account API do Chatwoot (gerenciamento de conversas, envio de mensagens e escalonamento para humano).
- [ ] Injetar o **System Prompt do NOC-Agent** com as 10 Invariantes Éticas de IA (sem alucinação, sem shell livre).
- [ ] Configurar canal WhatsApp via Hermes / Chatwoot.
- [ ] Habilitar o sistema de aprovações Human-in-the-Loop (`approval.py`) para pausar comandos críticos.

---

## 📌 FASE 2: SERVIDORES MCP & DRIVERS DE REDE
- [ ] **Proxmox MCP Server**:
  - `proxmox_list_vms`: listar status de VMs/CTs, CPU, memória.
  - `proxmox_get_vm_status`: obter métricas detalhadas.
  - `proxmox_restart_vm`: reiniciar VM (requer aprovação de severidade L2).
  - `proxmox_snapshot_vm`: tirar snapshot antes de manutenção.
- [ ] **Mikrotik RouterOS MCP Server**:
  - `mikrotik_ping`: teste de latência e perda de pacotes.
  - `mikrotik_bgp_status`: checagem de sessões BGP e peerings.
  - `mikrotik_interface_traffic`: leitura de tráfego por interface.
  - `mikrotik_dhcp_leases`: consulta de clientes e concessões.
- [ ] **pfSense MCP Server**:
  - Leitura de status de gateways, VPNs IPsec/OpenVPN e regras de firewall.
- [ ] **Zabbix MCP Server**:
  - `zabbix_get_active_triggers`: consulta de alertas críticos ativos.
  - `zabbix_acknowledge_event`: reconhecimento de alarmes pelo operador.

---

## 📌 FASE 3: DASHBOARD WEB (WITTEBERG DEVELOPMENT STANDARDS)
- [ ] Setup do projeto frontend com Vite + React + TypeScript + Vanilla CSS.
- [ ] Implementação estrita do Design System:
  - 100% responsivo em 1920px (4 cols), 1366px (3 cols), 1280px (3 cols), Tablet (2 cols), Mobile (1 col).
  - `min-width: 0` em grids e flexbox, proibido `overflow:hidden` para mascarar quebras.
  - Ações em cards padronizadas (`grid-template-columns: repeat(2, minmax(0, 1fr))`).
  - Interface e rótulos 100% em Português (PT-BR).
- [ ] Telas do Dashboard:
  - **Overview**: Mapa de status da rede, incidentes ativos e carga.
  - **Aprovações**: Fila de ações pendentes aguardando aprovação humana.
  - **Equipamentos**: Inventário de nós Proxmox, Mikrotik e servidores monitorados.
  - **Auditoria**: Log imutável de todas as ações executadas pela IA e operadores.

---

## 📌 FASE 4: INTEGRAÇÃO COM ZABBIX & VALIDAÇÃO OPERACIONAL
- [ ] Subir/conectar o servidor Zabbix à rede interna.
- [ ] Configurar webhook no Zabbix para notificar o NOC-Agent em caso de trigger `High` ou `Disaster`.
- [ ] Teste de ponta a ponta:
  - Zabbix detecta queda de link → dispara webhook → Hermes analisa topologia via Mikrotik MCP → envia diagnóstico para Chatwoot/WhatsApp → operador autoriza rota de contingência → ação executada e confirmada.
- [ ] Validação de segurança (Zero secrets no frontend, RBAC por número).
- [ ] Deploy final da Stack no Portainer.
