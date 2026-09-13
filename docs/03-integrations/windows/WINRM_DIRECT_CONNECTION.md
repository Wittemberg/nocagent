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

## 4. Script de Preparação Automatizado no Painel Web (1-Clique)

No cadastro de equipamentos do painel web do **NOC-Agent**, ao selecionar **Servidor Windows (WinRM / Agente)** e optar pelo **Modo Conexão Direta (SSH/WinRM)**, há o botão interativo:

> **`[ Copiar Comandos PowerShell ]`**

Ao clicar, o NOC-Agent gera dinamicamente e copia para a sua área de transferência um script completo do PowerShell adaptado para o domínio da sua instância (ex: `nocagent.awecloudsolution.com`) e a porta configurada (TCP 5985 ou 5986).

### Script Completo Gerado pelo Botão

```powershell
# =========================================================================
# NOC-Agent: Script de Preparação WinRM e Firewall Seguro
# Domínio Autorizado: nocagent.awecloudsolution.com | Porta TCP: 5985
# Executar no PowerShell como Administrador no Servidor Windows
# =========================================================================

$ErrorActionPreference = "Stop"
Write-Host ">>> [NOC-Agent] Configurando WinRM e Firewall Seguro..." -ForegroundColor Cyan

# 1. Habilitar serviço WinRM e inicialização automática
Write-Host "1/4 Habilitando o serviço WinRM..." -ForegroundColor Yellow
Enable-PSRemoting -Force -SkipNetworkProfileCheck
Set-Service WinRM -StartupType Automatic
Start-Service WinRM

# 2. Configurar autenticação e cotas de recursos do WS-Management
Write-Host "2/4 Configurando autenticação e cotas de recursos..." -ForegroundColor Yellow
Set-Item -Path WSMan:\localhost\Service\Auth\Negotiate -Value $true
Set-Item -Path WSMan:\localhost\Service\Auth\Basic -Value $true
Set-Item -Path WSMan:\localhost\Service\AllowUnencrypted -Value $true
Set-Item -Path WSMan:\localhost\Shell\MaxMemoryPerShellMB -Value 1024
Set-Item -Path WSMan:\localhost\Shell\MaxProcessesPerShell -Value 25

# 3. Obter os endereços IP autorizados do domínio do NOC-Agent
$nocDomain = "nocagent.awecloudsolution.com"
Write-Host "3/4 Resolvendo endereços IP do domínio NOC-Agent: $nocDomain..." -ForegroundColor Yellow

$remoteIps = @()
try {
    $dnsEntries = [System.Net.Dns]::GetHostAddresses($nocDomain) | Where-Object { $_.AddressFamily -eq 'InterNetwork' }
    foreach ($entry in $dnsEntries) {
        $remoteIps += $entry.IPAddressToString
    }
} catch {
    Write-Warning "Não foi possível resolver DNS automaticamente para $nocDomain."
}

if ($remoteIps.Count -eq 0) {
    if ($nocDomain -match '^\d{1,3}(\.\d{1,3}){3}$') {
        $remoteIps = @($nocDomain)
    } else {
        Write-Warning "Regra de firewall liberada sem restrição de IP de origem (ajuste manual recomendado)."
        $remoteIps = @("Any")
    }
}

Write-Host "    IPs de Origem Permitidos: $($remoteIps -join ', ')" -ForegroundColor Green

# 4. Criar regra de Firewall no Windows Defender exclusiva para o NOC-Agent
Write-Host "4/4 Configurando regra de Firewall (TCP 5985)..." -ForegroundColor Yellow
Remove-NetFirewallRule -Name "NOCAgent-WinRM-In" -ErrorAction SilentlyContinue

$firewallParams = @{
    Name = "NOCAgent-WinRM-In"
    DisplayName = "NOC-Agent WinRM (TCP 5985) - Exclusivo"
    Description = "Permite telemetria WinRM exclusivamente para a instancia NOC-Agent ($nocDomain)"
    Direction = "Inbound"
    LocalPort = 5985
    Protocol = "TCP"
    Action = "Allow"
    Profile = @("Domain", "Private", "Public")
}

if ($remoteIps -notcontains "Any") {
    $firewallParams["RemoteAddress"] = $remoteIps
}

New-NetFirewallRule @firewallParams | Out-Null
Write-Host ">>> Sucesso! WinRM ativo e protegido no Windows Firewall." -ForegroundColor Green
Write-Host ">>> Portas e listeners ativos:" -ForegroundColor Cyan
winrm enumerate winrm/config/listener
```

---

## 5. Detalhamento Técnico das Etapas do Script

### 1. Habilitação do Serviço e Listeners
* `Enable-PSRemoting -Force -SkipNetworkProfileCheck`: Cria o listener padrão HTTP na porta 5985 e inicializa os componentes de gerenciamento remoto, dispensando verificação de perfis de rede restritos (como redes públicas).
* `Set-Service WinRM -StartupType Automatic`: Garante que, mesmo após reinícios do Windows Server (por exemplo, após atualizações do Windows Update), o serviço volte a responder imediatamente sem intervenção humana.

### 2. Autenticação e Ajuste de Cotas de Recursos
* `WSMan:\localhost\Service\Auth\Negotiate`: Habilita autenticação segura com NTLM/Kerberos.
* `WSMan:\localhost\Service\Auth\Basic`: Permite autenticação básica para ambientes Workgroup onde contas locais são utilizadas para autenticação direta.
* `WSMan:\localhost\Service\AllowUnencrypted`: Permite sessões sobre TCP 5985 em túneis privados ou VPNs. Em tráfego pela internet aberta, recomenda-se uso de VPN ou porta 5986 HTTPS.
* `MaxMemoryPerShellMB = 1024`: Eleva o limite de memória por processo de 512 MB para 1024 MB, prevenindo erros de esgotamento de cota ao consultar grandes coleções de discos ou eventos WMI.
* `MaxProcessesPerShell = 25`: Permite execuções simultâneas de subconsultas de métricas.

### 3. Restrição Exclusiva do Firewall por Resolução de Domínio
Ao invés de deixar a porta TCP 5985 aberta para toda a internet (`0.0.0.0/0`), o script resolve em tempo de execução os IPs do domínio do seu NOC-Agent:
```powershell
$dnsEntries = [System.Net.Dns]::GetHostAddresses($nocDomain) | Where-Object { $_.AddressFamily -eq 'InterNetwork' }
```
A regra `New-NetFirewallRule` é criada com o parâmetro:
```powershell
-RemoteAddress $remoteIps
```
Isso garante que **somente o servidor do NOC-Agent conseguirá conectar e tentar autenticação na porta WinRM**, bloqueando scanners, bots e conexões não autorizadas diretamente no kernel do Windows Defender Firewall.

---

## 6. Como o Driver NOC-Agent Coleta Métricas via WinRM

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

## 7. Solução de Problemas (Troubleshooting)

### A. Erro `Access is Denied` em Servidores Fora do Domínio (Workgroup)
Em servidores que não pertencem a um Active Directory (Workgroup), o Windows aplica por padrão o UAC em conexões de rede remotas. Para permitir que contas de Administrador local autentiquem no WinRM, execute no PowerShell como Administrador:
```powershell
New-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" `
    -Name "LocalAccountTokenFilterPolicy" -Value 1 -PropertyType DWORD -Force
```

### B. Validar se a Regra do Firewall foi Aplicada com os IPs Corretos
Para inspecionar a regra de firewall criada:
```powershell
Get-NetFirewallRule -Name "NOCAgent-WinRM-In" | Get-NetFirewallAddressFilter
```
*O campo `RemoteAddress` deve exibir os endereços IP resolvidos do NOC-Agent.*

### C. Teste de Conexão a partir do Servidor NOC-Agent
Para testar a conectividade TCP a partir do servidor do NOC-Agent:
```bash
nc -zvw 3 <IP_DO_SERVIDOR_WINDOWS> 5985
# ou via curl:
curl -I http://<IP_DO_SERVIDOR_WINDOWS>:5985/wsman
```
*A resposta esperada é `401 Unauthorized` ou `405 Method Not Allowed`, confirmando que a porta está aberta e o serviço WinRM está respondendo.*

---

## 8. Boas Práticas de Segurança e Hardening

1. **Acesso Restrito por IP no Firewall:**  
   Sempre execute o script acima para restringir a porta 5985 aos IPs do NOC-Agent.
2. **Conta de Serviço com Menor Privilégio:**  
   Em vez de utilizar a conta `Administrator` padrão, crie um usuário de serviço exclusivo (ex: `svc_nocagent`) adicionado ao grupo local `Remote Management Users` com permissões de leitura no namespace WMI (`Root\CIMv2`).
3. **Preferência por Agente Outbound em Filiais:**  
   Para servidores Windows localizados atrás de NAT, CGNAT ou links residenciais/filiais sem IP fixo, priorize o modo **Agente Outbound (1-Clique)**, pois ele dispensa qualquer abertura de porta de entrada no servidor.
