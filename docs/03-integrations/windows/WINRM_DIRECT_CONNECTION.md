# Guia de Implementação e Arquitetura: Conexão Direta WinRM (Windows Server)

> **Documento:** `docs/03-integrations/windows/WINRM_DIRECT_CONNECTION.md`  
> **Sistema:** NOC-Agent  
> **Público-alvo:** Administradores de Redes, Engenheiros de NOC e Desenvolvedores  

---

## 1. Visão Geral do Protocolo

O **WinRM (Windows Remote Management)** é a implementação oficial da Microsoft do padrão **WS-Management** (Web Services for Management), um protocolo de mensagens padronizado baseado em SOAP/XML sobre HTTP ou HTTPS.

Ele permite gerenciar remotamente servidores e estações de trabalho Windows, executar comandos do PowerShell e consultar subsistemas do **WMI (Windows Management Instrumentation)** e **CIM (Common Information Model)** sem a necessidade de instalar utilitários ou agentes proprietários de terceiros.

### Portas Padrão (IANA)
* **TCP 5985 (HTTP):** Utilizado para conexões padrão. Em redes seguras (VPNs, redes locais ou túneis dedicados), a criptografia dos dados da sessão pode ser garantida pelo próprio mecanismo de autenticação Kerberos ou NTLM (SPNEGO).
* **TCP 5986 (HTTPS):** Utilizado para conexões com criptografia TLS completa a nível de transporte, exigindo certificado digital no listener do servidor Windows.

---

## 2. Topologia de Conexão: Direta vs. Outbound

No NOC-Agent, servidores Windows podem ser gerenciados de duas formas:

```
[ MODO CONEXÃO DIRETA (WINRM) ]
+-------------------+                      +-------------------------+
|     NOC-Agent     | ── TCP 5985/5986 ──> | Servidor Windows Alvo   |
| (Inicia Conexão)  |  (Inbound / Direto)  | (Listener WinRM Ativo)  |
+-------------------+                      +-------------------------+
* Requer: IP alcançável (LAN/VPN/Público), firewall aberto, credenciais no Cofre.

[ MODO AGENTE OUTBOUND (1-CLIQUE) ]
+-------------------+                      +-------------------------+
|     NOC-Agent     | <── HTTPS (443) ───  | Servidor Windows Alvo   |
| (Aguarda Relatos) |     (Outbound/Saída) | (Tarefa Agendada 60s)   |
+-------------------+                      +-------------------------+
* Requer: Apenas acesso de saída à internet. Zero portas abertas no cliente.
```

### Matriz Comparativa

| Critério | Conexão Direta (WinRM) | Agente Outbound (1-Clique) |
| :--- | :--- | :--- |
| **Direção do Tráfego** | **Entrada:** NOC-Agent conecta ativamente no servidor | **Saída:** Servidor envia telemetria ao NOC-Agent |
| **Portas Abertas** | TCP 5985 ou 5986 no servidor Windows | Nenhuma porta aberta no servidor |
| **Endereçamento** | IP fixo, VPN Site-to-Site ou FQDN alcançável | Funciona atrás de NAT, CGNAT ou DHCP dinâmico |
| **Credenciais** | Usuário e Senha administrativa cifrados no Cofre | Token criptográfico de máquina (sem senhas de domínio) |
| **Capacidade Operacional** | Monitoramento WMI em tempo real + Ações ativas L2 | Telemetria periódica (CPU, RAM, Disco, Uptime a cada 60s) |
| **Complexidade de Setup** | Média (requer habilitar listener e liberar firewall) | Baixa (1 comando PowerShell pronto: `irm ... \| iex`) |

---

## 3. Requisitos para Conexão Direta WinRM

Para que o NOC-Agent consulte o servidor Windows via WinRM direto:

1. **Roteamento:** O servidor NOC-Agent deve conseguir alcançar o IP do Windows (ping/TCP na porta 5985/5986).
2. **Serviço WinRM Ativo:** O serviço `WinRM` (`Windows Remote Management`) deve estar rodando e configurado no Windows.
3. **Firewall Liberado:** A regra de entrada TCP 5985 (ou 5986) deve estar liberada no Windows Defender Firewall.
4. **Credencial de Acesso:** Usuário pertencente ao grupo **Administrators** ou **Remote Management Users**.

---

## 4. Passo a Passo de Configuração no Windows Server

Execute os comandos abaixo no **PowerShell como Administrador** no servidor Windows a ser monitorado:

### Passo 1: Habilitar o WinRM e criar listeners automáticos
```powershell
Enable-PSRemoting -Force -SkipNetworkProfileCheck
```

### Passo 2: Configurar Autenticação e Criptografia
Para ambientes Workgroup (fora de domínio Active Directory) acessados via VPN ou rede privada:
```powershell
# Ativa autenticação Negotiate / NTLM
Set-Item -Path WSMan:\localhost\Service\Auth\Negotiate -Value $true

# Permite conexões HTTP não cifradas a nível de transporte (para TCP 5985 em rede interna/VPN)
Set-Item -Path WSMan:\localhost\Service\AllowUnencrypted -Value $true

# (Opcional - apenas para Workgroup) Permite autenticação básica caso necessário
Set-Item -Path WSMan:\localhost\Service\Auth\Basic -Value $true
```

### Passo 3: Criar Regra no Windows Firewall
```powershell
New-NetFirewallRule -Name "NOCAgent-WinRM-In" `
    -DisplayName "NOC-Agent WinRM (TCP 5985)" `
    -Direction Inbound `
    -LocalPort 5985 `
    -Protocol TCP `
    -Action Allow
```

### Passo 4: Validar se o Listener está Ouvindo
```powershell
winrm enumerate winrm/config/listener
```
*A saída deve exibir `Port = 5985` (ou 5986) com status ativo.*

---

## 5. Como o Driver NOC-Agent Coleta Métricas via WinRM

A comunicação do driver com o endpoint `/wsman` do Windows Server ocorre via mensagens SOAP formatadas de acordo com a especificação WS-Management:

### A. Sondagem de Disponibilidade e Latência (RTT)
Antes de enviar comandos pesados, o NOC-Agent realiza um teste de socket TCP na porta cadastrada (5985) medindo a latência real de ida e volta (RTT).

### B. Coleta de Telemetria via WQL (WMI Query Language)
Quando autenticado, o driver executa queries nas seguintes classes WMI nativas:

1. **Uso e Carga de CPU:**
   ```sql
   SELECT LoadPercentage, NumberOfCores, NumberOfLogicalProcessors FROM Win32_Processor
   ```
2. **Memória RAM:**
   ```sql
   SELECT TotalVisibleMemorySize, FreePhysicalMemory FROM Win32_OperatingSystem
   ```
3. **Discos e Volumes:**
   ```sql
   SELECT DeviceID, FreeSpace, Size, FileSystem FROM Win32_LogicalDisk WHERE DriveType = 3
   ```
4. **Tempo de Atividade (Uptime):**
   ```sql
   SELECT LastBootUpTime, Caption, Version FROM Win32_OperatingSystem
   ```
5. **Serviços Críticos do Windows (Opcional L2):**
   ```sql
   SELECT Name, State, StartMode, ProcessId FROM Win32_Service WHERE Name IN ('MSSQLSERVER', 'Spooler', 'W3SVC')
   ```

---

## 6. Boas Práticas de Segurança e Hardening

1. **Acesso Restrito por IP no Firewall:**  
   No Windows Firewall, restrinja o escopo da regra WinRM exclusivamente para o endereço IP fixo do servidor NOC-Agent:
   ```powershell
   Set-NetFirewallRule -Name "NOCAgent-WinRM-In" -RemoteAddress "<IP_DO_NOCAGENT>"
   ```
2. **Conta de Serviço de Menor Privilégio:**  
   Em vez de utilizar a conta `Administrator` padrão, crie um usuário de serviço exclusivo (ex: `svc_nocagent`) adicionado ao grupo local `Remote Management Users` e configure permissões de leitura no namespace WMI (`Root\CIMv2`).
3. **Preferência por Agente Outbound em Filiais:**  
   Para servidores localizados em filiais ou clientes remotos sem VPN fechada com o datacenter NOC, priorize o modo **Agente Outbound (1-Clique)**, pois ele elimina a necessidade de abrir portas de firewall e expor o WinRM para a internet.
