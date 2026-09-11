# 🔧 Guia de Instalação e Configuração — pfSense REST API
> **Pacote:** `pfrest/pfSense-pkg-RESTAPI`  
> **Aplicável a:** pfSense CE 2.7.x (Community Edition)  
> **Finalidade:** Integração com o NOC-Agent via MCP Server (pfSense MCP)  
> **Atualizado em:** 10/09/2026  

---

## ⚠️ Avisos Importantes

- Este é um pacote **comunitário**, não suportado oficialmente pela Netgate.
- O pacote **NÃO aparece** no Gerenciador de Pacotes padrão do pfSense — a instalação é manual via SSH.
- O nome do arquivo inclui a versão **completa** do pfSense (ex: `2.7.2`, não `2.7`).
- O repositório correto é **`pfrest/pfSense-pkg-RESTAPI`** (o antigo `jaredhendrickson13/pfsense-api` foi descontinuado).

---

## 📋 PRÉ-REQUISITOS

- Acesso SSH habilitado no pfSense (`Sistema → Avançado → Admin Access → SSH`)
- Acesso à internet a partir de **outra máquina** (o pfSense pode não ter acesso direto ao GitHub)
- Cliente SCP disponível na máquina de trabalho (`scp`, WinSCP, ou similar)

---

## 🚀 PASSO 1 — Identificar a Versão do pfSense

No WebGUI do pfSense, acesse **Sistema → Informações Gerais** e anote a versão exata.

Exemplos:
- `2.7.2-RELEASE` → usar arquivo `pfSense-2.7.2-pkg-RESTAPI.pkg`
- `2.7.1-RELEASE` → usar arquivo `pfSense-2.7.1-pkg-RESTAPI.pkg`

---

## 🚀 PASSO 2 — Baixar o Pacote na Máquina de Trabalho

> Acesse a lista de releases para encontrar o arquivo correto para sua versão:  
> 🔗 https://github.com/pfrest/pfSense-pkg-RESTAPI/releases

```bash
# Substituir 2.7.2 pela versão exata do seu pfSense
PFSENSE_VERSION="2.7.2"
PKG_FILE="pfSense-${PFSENSE_VERSION}-pkg-RESTAPI.pkg"

curl -L -o "$PKG_FILE" \
  "https://github.com/pfrest/pfSense-pkg-RESTAPI/releases/latest/download/${PKG_FILE}"

# Verificar tamanho — deve ser maior que 500KB
ls -lh "$PKG_FILE"
```

> ❌ **Erro comum:** Se o arquivo tiver poucos KB (ex: 2KB), é uma página HTML de redirect — o download falhou. Tente com `wget` ou baixe manualmente pelo browser.

---

## 🚀 PASSO 3 — Copiar para o pfSense via SCP

```bash
# Substituir 192.168.1.81 pelo IP LAN do pfSense alvo
PFSENSE_IP="192.168.1.81"

scp "$PKG_FILE" root@${PFSENSE_IP}:/root/
```

---

## 🚀 PASSO 4 — Instalar no pfSense (via SSH ou Console)

Conecte via SSH:
```bash
ssh root@192.168.1.81
# No menu, escolha opção 8 (Shell)
```

No shell do pfSense:
```bash
# Instalar o pacote
pkg add /root/pfSense-2.7.2-pkg-RESTAPI.pkg

# Reiniciar o webConfigurator para ativar o menu
/etc/rc.restart_webgui
```

**Saída esperada de sucesso:**
```
Installing pfSense-2.7.2-pkg-RESTAPI...
Extracting pfSense-2.7.2-pkg-RESTAPI: .......... done
```

---

## 🚀 PASSO 5 — Configurar a REST API no WebGUI

Acesse **Sistema → REST API → Configurações**

### Aba: Settings

#### Seção Geral
| Campo | Valor recomendado |
|---|---|
| **Ativado** | ✅ Habilitado |
| **Keep Backup** | ✅ Habilitado |
| **Represent Interfaces As** | `Real interface` (Retorna nome real da interface, ex: `vtnet0`, `vtnet1` — mais previsível para o MCP) |

#### Seção Security
| Campo | Valor recomendado | Motivo |
|---|---|---|
| **Allowed Interfaces** | Apenas **LAN** e **Localhost** | ⚠️ NUNCA deixar WAN habilitado |
| **Read Only** | ❌ Desmarcado | NOC-Agent precisa executar ações |
| **Authentication Methods** | **Chave** (API Key) apenas | Ideal para server-to-server, sem expiração |
| **Login Protection** | ✅ Habilitado | Bloqueia tentativas de brute-force |
| **Log Successful Authentication** | ❌ Opcional | Habilitar apenas para debug |

#### Seção Configurações Avançadas
| Campo | Valor |
|---|---|
| **Enable HATEOAS** | ❌ Desmarcado |
| **Allow Pre-releases** | ❌ Desmarcado |
| **HA Sync** | ❌ Desmarcado (habilitar só em cluster HA) |

**Clique em Salvar.**

---

## 🚀 PASSO 6 — Gerar a API Key

Acesse **Sistema → REST API → Keys → Add API Key**

| Campo | Valor |
|---|---|
| **Username** | `admin` ou usuário dedicado `nocagent` |
| **Description** | `NOC-Agent MCP Server` |

> ⚠️ A chave gerada aparece **apenas uma vez**. Copie imediatamente e salve em local seguro (Bitwarden, 1Password, ou `.env` do NOC-Agent).

A chave terá o formato: `EXAMPLE-abc123...xyz`

---

## 🚀 PASSO 7 — Validar a API

> ⚠️ O endpoint `/api/v2/ping` pode retornar 404 dependendo do proxy/roteador à frente do pfSense — isso é normal. Use os endpoints abaixo para validar.

```bash
PFSENSE_URL="https://<URL-OU-IP-DO-PFSENSE>:<PORTA>"
API_KEY="SUA_API_KEY_AQUI"

# ✅ Endpoint de validação principal — lista gateways com status
curl -sk -H "X-API-Key: ${API_KEY}" \
  "${PFSENSE_URL}/api/v2/status/gateways"

# Resposta esperada (exemplo real de produção pfSense 2.7.2):
# {"code":200,"status":"ok","data":[
#   {"name":"GW_VIVO","status":"online","loss":0,"delay":16.35},
#   {"name":"WANGW","status":"down","loss":100,"substatus":"highloss"}
# ]}
```

**✅ API OK** se retornar JSON com `"code": 200` (mesmo que seja um `400` com mensagem JSON — significa que a API recebeu, autenticou e processou a requisição).

**❌ API com problema** se retornar HTML (`<html>...404...nginx...`).

### Regra de Nomenclatura da API (pfrest v2)

> **Plural** (`/gateways`, `/interfaces`) = lista **todos** os registros  
> **Singular** (`/gateway`, `/interface`) = opera em **um** registro específico (requer `?id=`)

### Endpoints validados para o NOC-Agent

#### 🔴 STATUS — Monitoramento em tempo real
| Endpoint | Método | Uso no NOC-Agent |
|---|---|---|
| `/api/v2/status/gateways` | GET | Status online/offline de todos os gateways |
| `/api/v2/status/interfaces` | GET | Status de todas as interfaces de rede |
| `/api/v2/status/system` | GET | CPU, memória, uptime do pfSense |
| `/api/v2/status/services` | GET | Listar serviços e se estão rodando |
| `/api/v2/status/dhcp_server/leases` | GET | Clientes DHCP conectados |
| `/api/v2/status/logs/firewall` | GET | Últimas entradas do log de firewall |
| `/api/v2/status/logs/system` | GET | Log de sistema |
| `/api/v2/status/carp` | GET | Status HA/CARP (cluster) |

#### 🟡 ROUTING — Roteamento
| Endpoint | Método | Uso no NOC-Agent |
|---|---|---|
| `/api/v2/routing/gateways` | GET | Listar todos os gateways configurados |
| `/api/v2/routing/gateway?id=<id>` | GET/PATCH | Ler/editar gateway específico |
| `/api/v2/routing/static_routes` | GET | Listar rotas estáticas |

#### 🟡 INTERFACE — Interfaces
| Endpoint | Método | Uso no NOC-Agent |
|---|---|---|
| `/api/v2/interfaces` | GET | Listar todas as interfaces configuradas |
| `/api/v2/interface?id=<id>` | GET | Detalhes de interface específica |
| `/api/v2/interface/available_interfaces` | GET | Interfaces físicas disponíveis |

#### 🟡 FIREWALL — Regras e estado
| Endpoint | Método | Uso no NOC-Agent |
|---|---|---|
| `/api/v2/firewall/rules` | GET | Listar todas as regras |
| `/api/v2/firewall/aliases` | GET | Listar aliases (groups de IPs/portas) |
| `/api/v2/firewall/states` | GET | Conexões ativas no firewall |

#### 🟢 VPN — Tunnels (Fase 2+)
| Endpoint | Método | Uso no NOC-Agent |
|---|---|---|
| `/api/v2/vpn/ipsec/phase1s` | GET | Listar tunnels IPsec |
| `/api/v2/vpn/openvpn/servers` | GET | Listar servidores OpenVPN |
| `/api/v2/vpn/wireguard/tunnels` | GET | Listar tunnels WireGuard |

#### ⚠️ DIAGNOSTICS — Ações (requerem aprovação Human-in-the-Loop)
| Endpoint | Método | Uso no NOC-Agent |
|---|---|---|
| `/api/v2/diagnostics/arp_table` | GET | Tabela ARP (ver IPs/MACs na rede) |
| `/api/v2/diagnostics/reboot` | POST | ⚠️ Reiniciar pfSense — exige aprovação L2 |
| `/api/v2/status/service` | POST | ⚠️ Start/stop de serviço — exige aprovação |

---

## 📦 VARIÁVEIS DE AMBIENTE para o NOC-Agent

Adicione ao `.env` do NOC-Agent:

```env
# pfSense MCP — Instância principal
# PFSENSE_BASE_URL pode ser IP LAN direto ou URL externa com porta
PFSENSE_BASE_URL=https://192.168.1.81        # acesso LAN direto
# ou
PFSENSE_BASE_URL=https://meu-pfsense.exemplo.com:8181  # acesso via URL externa

PFSENSE_API_KEY=SUA_API_KEY_AQUI
PFSENSE_VERIFY_SSL=false  # false para certificados auto-assinados

# Para múltiplas instâncias (filiais), usar prefixo numerado:
# PFSENSE_1_BASE_URL=https://192.168.2.81
# PFSENSE_1_API_KEY=...
# PFSENSE_2_BASE_URL=https://10.0.1.1
# PFSENSE_2_API_KEY=...
```

---

## 🔒 RECOMENDAÇÕES DE SEGURANÇA

1. **Nunca exponha a API pela WAN.** O NOC-Agent deve acessar o pfSense via rede interna (LAN) ou VPN.
2. **Crie um usuário dedicado** `nocagent` no pfSense com permissões mínimas necessárias (evite usar `admin`).
3. **Rotacione a API Key** periodicamente via **REST API → Keys**.
4. **Ative Log Successful Authentication** temporariamente se precisar auditar acessos.
5. **Para filiais sem acesso direto:** Use o **NetAgent Daemon** (previsto na arquitetura do NOC-Agent) — um binário leve que faz reverse tunnel seguro sem abrir portas.

---

## 🩺 TROUBLESHOOTING

### Erro: `pkg: Unrecognized archive format`
→ O arquivo baixado é HTML (redirect não seguido). Verifique o tamanho com `ls -lh`. Use `wget` ou baixe manualmente pelo browser.

### Erro: `pkg: An error occured while fetching package`
→ O pfSense não tem rota para o GitHub. Use a **Solução B** (baixar na máquina de trabalho + SCP).

### API retorna 404 após instalação
→ O webConfigurator ainda não foi reiniciado. Execute: `/etc/rc.restart_webgui`

### API retorna 401 Unauthorized
→ Verifique se o método de autenticação `Chave` está selecionado nas Settings e se o header `X-API-Key` está correto.

### API não responde ao tentar pelo IP externo/WAN
→ Correto e esperado — `Allowed Interfaces` deve ter apenas LAN e Localhost. Acesse sempre pelo IP LAN.

---

## 📋 CHECKLIST DE INSTALAÇÃO (para cada novo pfSense)

- `[ ]` Verificar versão exata do pfSense (**Sistema → Informações Gerais**)
- `[ ]` Baixar o `.pkg` correto na máquina de trabalho (`curl -L` ou browser)
- `[ ]` Verificar tamanho do arquivo (`ls -lh`) — deve ser > 500KB (se for ~2KB = HTML = falhou)
- `[ ]` Copiar via SCP para `/root/` do pfSense
- `[ ]` Instalar: `pkg add /root/pfSense-2.7.X-pkg-RESTAPI.pkg`
- `[ ]` Reiniciar webConfigurator: `/etc/rc.restart_webgui`
- `[ ]` Configurar (**Sistema → REST API → Settings**): `Real interface`, LAN only, Auth=Chave, Login Protection
- `[ ]` Gerar API Key (**aba Keys**) e salvar imediatamente (aparece só uma vez)
- `[ ]` Validar: `curl -sk -H "X-API-Key: <KEY>" https://<URL>/api/v2/status/gateways` → deve retornar JSON com `"code":200`
- `[ ]` Adicionar `PFSENSE_BASE_URL` e `PFSENSE_API_KEY` ao `.env` do NOC-Agent
