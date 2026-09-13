# Instalação do Agente Outbound em Servidores Linux (1-Clique)

> **Documentação de Arquitetura & Guia Operacional para o Manual do Usuário**  
> **Status:** Ativo e Implementado  
> **Versão:** v1.3.0  
> **Componente:** Frontend (`web/src/App.jsx`), Core (`core/src/server.js`)

---

## 1. Visão Geral

O modo de conexão **Agente Outbound (1-Clique)** permite monitorar e gerenciar servidores Linux sem a necessidade de:
- Abrir portas de entrada (como SSH porta 22) em roteadores ou firewalls.
- Possuir IP público fixo ou regras de NAT/Port Forwarding.
- Trafegar ou armazenar senhas root ou chaves privadas SSH no cofre caso a política de segurança da empresa não permita.

O agente estabelece conexão de saída (*outbound*) exclusivamente via **HTTPS (porta 443)** diretamente com o domínio central do **NOC-Agent**.

---

## 2. Resolução Automática de Domínio (Sem Digitação Manual)

Ao cadastrar um equipamento no modo Agente Outbound:
1. O frontend detecta dinamicamente a URL base e o domínio da instância em uso:
   - Em produção: `https://nocagent.awecloudsolution.com`
   - Em outros ambientes: `window.location.origin`
2. O comando de 1-clique gerado substitui qualquer placeholder genérico pelo endereço completo e seguro do seu servidor NOC-Agent.
3. No backend (`core/src/server.js`), os cabeçalhos de proxy reverso (`x-forwarded-host`, `x-forwarded-proto`) são resolvidos pelo middleware `trust proxy`, assegurando que o script de instalação contenha o endpoint HTTPS canônico.

---

## 3. Guia Operacional Passo a Passo (Manual do Usuário)

### 3.1 Cadastrando o Servidor no Cofre
1. No painel superior ou na aba **Equipamentos**, clique no botão **`+ Novo Equipamento`**.
2. Preencha o **Nome do Equipamento** (ex: `srv-web-producao`).
3. No campo **Tipo de Equipamento**, selecione **`Servidor Linux (SSH / Agente)`**.
4. No seletor **Modo de Conexão com o Servidor**, selecione **`Agente Outbound (1-Clique)`**.
5. *(Opcional)* Preencha um identificador de rede ou deixe em branco.
6. Observe o quadro verde **Instalação 1-Clique com Agente Outbound**:
   - O comando de terminal é exibido já com o domínio oficial da sua instância:
     ```bash
     curl -fsSL https://nocagent.awecloudsolution.com/api/agent/install-script/:id | sudo bash
     ```
7. Clique no botão azul **`Salvar & Copiar Comando`**.

### 3.2 O que o Sistema Faz Automaticamente ao Salvar
1. O equipamento é registrado no banco de dados.
2. É gerado um **Token de Auto-Registro (Enrollment Token)** criptográfico único com validade de 1 hora.
3. O comando completo com o identificador definitivo do servidor é **copiado automaticamente para sua área de transferência (Clipboard)**.
4. É exibido um modal com o comando pronto e instruções claras, além de um botão de conferência **`Copiar Comando`**.

### 3.3 Executando no Terminal do Servidor Linux
1. Abra uma sessão de terminal no seu servidor Linux (console local, SSH interno, etc.).
2. Cole o comando da área de transferência e tecle `Enter`:
   ```bash
   curl -fsSL https://nocagent.awecloudsolution.com/api/agent/install-script/<ID_DO_EQUIPAMENTO> | sudo bash
   ```
3. O script de instalação automatizado executará as seguintes etapas:
   - Identifica o sistema operacional (Ubuntu, Debian, CentOS, AlmaLinux, Rocky Linux, etc.).
   - Envia o auto-registro inicial para o NOC-Agent.
   - Recebe um token de agente de longa duração e grava em `/etc/nocagent/token` com permissão estrita `600`.
   - Configura a rotina de heartbeat e telemetria leve (CPU, Memória, Disco e Uptime) em `/usr/local/bin/nocagent-heartbeat.sh` e agenda execução a cada minuto no `cron`/`systemd`.
4. Em menos de 60 segundos, o status do servidor mudará para **Online** no Dashboard do NOC-Agent.

---

## 4. Dúvidas Frequentes do Operador (FAQ)

- **P: Preciso instalar dependências pesadas no Linux?**  
  *R:* Não. O agente de host utiliza apenas utilitários nativos padrão presentes em qualquer distribuição Linux (`curl`, `bash`, `awk`, `free`, `df`).
- **P: E se o token de 1 hora expirar antes de eu rodar o comando?**  
  *R:* Basta abrir os detalhes do equipamento no Cofre e clicar em "Instalar Agente"; uma nova chave de autorregistro é emitida automaticamente.
- **P: O agente tem acesso root remoto?**  
  *R:* O agente opera no sentido de saída (*outbound*), enviando métricas periódicas. Ele não deixa portas abertas no servidor para invasões externas.
