# Sistema de Temas Claro e Escuro (Light & Dark Mode)

> **Documentação de Arquitetura & Guia Operacional para o Manual do Usuário**  
> **Status:** Ativo e Implementado  
> **Versão:** v1.3.0  
> **Componente:** Frontend (`web/src/App.jsx`, `web/src/index.css`, `web/tailwind.config.js`)

---

## 1. Visão Geral

O **NOC-Agent** dispõe de um sistema nativo de alternância dinâmica entre **Tema Escuro (Dark Cyber-NOC)** e **Tema Claro (Daylight Enterprise)**, desenvolvido para atender a dois cenários operacionais distintos:

1. **Tema Escuro (Dark Mode - Padrão NOC):** Ideal para salas de monitoramento 24/7, videowalls e turnos noturnos, minimizando a fadiga ocular do operador e destacando visualmente alertas críticos em verde, amarelo, vermelho e ciano.
2. **Tema Claro (Light Mode - Daylight):** Ideal para operadores em ambientes com iluminação solar ou luz fluorescente intensa, oferecendo alto contraste em preto/cinza-ardósia sobre superfícies brancas com sombras suaves.

---

## 2. Arquitetura Técnica

### 2.1 Estratégia de Implementação e Tokens CSS

O sistema utiliza a estratégia de classe raiz `darkMode: 'class'` do Tailwind CSS associada a classes de alto contraste no elemento raiz `<html>`:

- Quando o tema ativo é **Dark**: o elemento raiz `<html>` mantém `data-theme="dark"` e utiliza a paleta padrão do NOC.
- Quando o tema ativo é **Light**: o elemento raiz recebe a classe `.theme-light` e o atributo `data-theme="light"`.

### 2.2 Tabela de Tokens e Cores de Superfície

| Elemento / Componente | Tema Escuro (Dark NOC) | Tema Claro (Daylight) |
| :--- | :--- | :--- |
| **Canvas / Background Principal** | `#090d16` (Deep Midnight) | `#f8fafc` (Slate 50) |
| **Header Superior (Navbar)** | `#0d1322` / `#090d16` com borda escura | `#ffffff` (Pure White) com borda `#e2e8f0` e texto `#0f172a` |
| **Cards & Modais** | `#0f172a` (Slate 900) com borda `#1e293b` | `#ffffff` (Pure White) com sombra suave e borda `#e2e8f0` |
| **Tabelas (Cofre, Storages, etc.)** | Fundo escuro com `thead` ardósia | Fundo `#ffffff`, `thead` `#f8fafc` com texto `#475569` e linhas com texto `#0f172a` |
| **Terminal IA (Chat Container)** | Fundo `#0f172a/60` | Fundo `#ffffff` com sombra suave e borda `#cbd5e1` |
| **Balão de Mensagem da IA** | Fundo escuro `#1e293b/90` | Fundo `#ffffff` com borda `#cbd5e1`, sombra e texto preto de alto contraste (`#0f172a`) |
| **Balão de Mensagem do Usuário** | `#0284c7` (Sky Blue) | `#0284c7` (Sky Blue) com texto branco `#ffffff` |
| **Bordas e Divisores** | `#334155` / `#1e293b` | `#e2e8f0` (Slate 200) / `#cbd5e1` |
| **Texto Primário (Títulos/Labels)** | `#ffffff` / `#f1f5f9` | `#0f172a` (Slate 900) |
| **Texto Secundário (Metadados)** | `#94a3b8` (Slate 400) | `#475569` (Slate 600) |
| **Campos de Entrada (Input/Select)** | Fundo `#020617`, texto branco | Fundo `#ffffff`, texto `#0f172a`, borda `#cbd5e1` |
| **Scrollbars** | Trilho `#090d16`, polegar `#334155` | Trilho `#f1f5f9`, polegar `#cbd5e1` |

### 2.3 Preservação dos Alertas e Badges de Status

No tema claro, os status operacionais mantêm o código semântico de cores com contraste adaptado para leitura diurna:

- **Online / Operacional:** Fundo `#ecfdf5` com texto e borda `#065f46` (Verde Esmeralda).
- **Crítico / Offline:** Fundo `#fef2f2` com texto e borda `#991b1b` (Vermelho Escarlate).
- **Alerta / Warning:** Fundo `#fffbeb` com texto e borda `#92400e` (Âmbar Ouro).
- **Links WAN (Ativo / Standby / Down):** Fundo pastel semântico (`#ecfdf5`, `#fffbeb`, `#fef2f2`) com texto profundo de alto contraste para interfaces e tráfego.
- **Proxmox / Hypervisor:** Fundo `#fff7ed` com texto e borda `#c2410c` (Laranja Proxmox).
- **Linux:** Fundo `#eff6ff` com texto e borda `#1d4ed8` (Azul Safira).
- **Windows:** Fundo `#f0f9ff` com texto e borda `#0369a1` (Ciano Windows).

---

## 3. Persistência de Preferência por Usuário

A configuração de tema não é global nem compartilhada entre operadores da mesma máquina; **cada usuário tem sua preferência individual salva de forma isolada**:

1. **Chave de Armazenamento:**
   ```
   noc_theme_${currentUser.id || currentUser.email}
   ```
2. **Sessão Pré-Login (Visitante / Tela de Login):**
   - Utiliza a chave `noc_theme_guest`.
   - Permite que o operador escolha seu tema antes mesmo de autenticar suas credenciais ou código 2FA.
3. **Ao Realizar Login:**
   - O `useEffect` do React detecta a transição de `currentUser`.
   - Carrega instantaneamente a chave associada ao ID do usuário autenticado.
   - Aplica as classes e atributos no documento sem piscar a tela (*no layout shift*).
4. **Ao Realizar Logout:**
   - As preferências salvas do usuário continuam preservadas em seu navegador para o próximo acesso.

---

## 4. Guia Operacional (Base para o Manual do Usuário)

### 4.1 Onde localizar o alternador de tema
O botão de alternância de tema fica localizado no **canto superior direito da barra de navegação principal (Top Navbar)**:
- **Quando logado:** Posicionado imediatamente ao lado do bloco de perfil do operador e do botão de *Logout* (Encerrar Sessão).
- **Na tela de login:** Posicionado no cabeçalho superior direito.

### 4.2 Ícones e Estados

| Ícone Visível | Tema Ativo | Ação ao Clicar |
| :---: | :---: | :--- |
| ☀️ **Sol Dourado** | **Tema Escuro** (Dark NOC) | Muda para o **Tema Claro (Daylight)** |
| 🌙 **Lua Azul** | **Tema Claro** (Daylight) | Muda para o **Tema Escuro (Dark NOC)** |

### 4.3 Dúvidas Frequentes do Usuário (FAQ)

- **P: Se eu mudar de computador, meu tema é preservado?**  
  *R:* A preferência atual é salva localmente no navegador por usuário. Ao acessar em outro navegador ou computador pela primeira vez, o sistema adota o Tema Escuro padrão, bastando um único clique no botão de tema para memorizar sua preferência naquele equipamento.
- **P: A alteração de tema afeta os dados ou configurações do NOC?**  
  *R:* Não. Trata-se de uma preferência exclusivamente visual da interface de usuário que não altera cadastros, alertas, automações ou cofre de senhas.
- **P: Todas as telas respeitam o tema selecionado?**  
  *R:* Sim. O Visão Geral (Dashboard), Cofragem de Equipamentos, Cofre de Storages, Auditoria de Backups, Terminal IA, Gestão de Usuários, Gestão de Tenants e telas de Governança & APM adaptam-se imediatamente à paleta selecionada.
