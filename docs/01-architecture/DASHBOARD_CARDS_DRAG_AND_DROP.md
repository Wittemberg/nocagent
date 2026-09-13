# Organização de Cards por Arraste (Drag & Drop) e Controle de Trava

> **Documentação de Arquitetura & Guia Operacional para o Manual do Usuário**  
> **Status:** Ativo e Implementado  
> **Versão:** v1.3.0  
> **Componente:** Frontend (`web/src/App.jsx`)

---

## 1. Visão Geral

No painel **Visão Geral (NOC)**, os operadores têm total liberdade para personalizar a disposição dos cards de equipamentos (servidores Windows, Linux, nós e VMs Proxmox, storages, etc.), adaptando o painel de acordo com a prioridade operacional de seu turno ou disposição física dos racks.

Para garantir segurança operacional e evitar movimentações acidentais durante a resolução de incidentes críticos, o sistema conta com um mecanismo de **Trava de Layout**.

---

## 2. Comportamento e Persistência da Trava

### 2.1 Padrão de Fábrica (Segurança em Primeiro Lugar)
Por padrão, ao acessar o sistema ou criar um novo usuário, o layout inicia **TRAVADO** (`isLayoutLocked = true`).
- **Motivo de Engenharia:** Em ambientes de NOC com múltiplos monitores, telas touch ou uso intensivo de cliques rápidos, o arraste involuntário de cards poderia desorientar o operador durante uma emergência.

### 2.2 Persistência por Usuário (Último Acionamento)
O sistema memoriza a escolha do operador:
- A cada clique no botão de alternância, o estado é gravado individualmente no navegador:
  ```
  noc_layout_locked_${currentUser.id || currentUser.email} -> "true" | "false"
  ```
- Se o operador prefere manter o modo **Arraste Livre** sempre ativo, o sistema preservará essa preferência entre sessões e recarregamentos de página (`F5`).
- Se o operador alternar para **Travado**, essa escolha será mantida indefinidamente até novo comando.
- Usuários diferentes na mesma estação de trabalho mantêm seus estados e ordenações isolados.

---

## 3. Estados do Botão e Indicadores Visuais

| Estado Visual | Ícone | Significado | Comportamento dos Cards |
| :--- | :---: | :--- | :--- |
| **Travado (Padrão)** | 🔒 `Lock` | Layout congelado contra arrastes acidentais. | Alças de arraste ocultas; cursor padrão; clique abre detalhes normalmente. |
| **Arraste Livre** | 🔓 `Unlock` | Modo de reorganização ativo. Fundo verde esmeralda. | Exibe a alça de arraste (`GripVertical`) no cabeçalho de cada card; cursor `grab/grabbing`; cards movimentam-se com feedback de sombra e linha de destino. |

---

## 4. Guia Passo a Passo para o Operador (Manual do Usuário)

### 4.1 Reorganizando os Cards na Tela
1. Acesse a aba **Visão Geral**.
2. Na barra de ferramentas superior (ao lado dos filtros e do botão "Grade / Por Unidade"), localize o botão de controle de arraste.
3. Se estiver exibindo **`Travado`**, clique uma vez sobre ele.
4. O botão mudará para **`Arraste Livre`** (destacado em verde).
5. Posicione o cursor do mouse sobre o card desejado ou utilize a alça pontilhada no cabeçalho do card.
6. Clique, segure e arraste o card até a posição desejada na grade. Uma linha indicadora ou deslocamento suave mostrará onde o card será inserido.
7. Solte o botão do mouse. A nova ordem é salva imediatamente no seu navegador.
8. Ao terminar de organizar sua tela, clique no botão **`Arraste Livre`** para voltar ao estado **`Travado`** e proteger seu painel contra cliques acidentais.

### 4.2 Restaurando a Ordem Original do Sistema com Proteção Dupla
Para prevenir perdas involuntárias de layouts personalizados por cliques acidentais:
1. **Bloqueio Automático Quando Travado:** Enquanto o layout estiver no modo **`Travado`**, o botão **`Resetar Ordem`** permanece **estritamente desabilitado** (`disabled`, opacidade reduzida e cursor bloqueado).
2. **Como Restaurar:**
   - Primeiro, clique no botão **`Travado`** para alternar para **`Arraste Livre`**.
   - O botão **`Resetar Ordem`** ficará ativo (ícone de seta circular âmbar 🔄).
   - Clique em **`Resetar Ordem`**.
   - O sistema solicitará uma confirmação de segurança na tela: *"Deseja realmente restaurar a ordenação padrão dos cards? Sua organização personalizada será redefinida."*.
   - Ao confirmar, os cards retornarão imediatamente à disposição padrão do sistema e o botão de reset será recolhido.
   - Clique em **`Arraste Livre`** para voltar ao modo **`Travado`**.

---

## 5. Layouts do Painel e Arquitetura dos Cards

### 5.1 Barra de Ferramentas Centralizada e Alinhamento Dinâmico
Para garantir harmonia visual e usabilidade ergonômica em telas de qualquer resolução (laptops, monitores ultrawide, videowalls NOC):
1. **Cabeçalho Superior Operacional:**
   - Lado Esquerdo: Identificador com ícone de pulso `Radio`, título *"Status dos Equipamentos"*, badge com contagem em tempo real de ativos filtrados e selo *"Tempo Real"*.
   - Lado Direito: Ações globais com botão `Atualizar` e o botão de segurança `Resetar Ordem` (quando há personalização ativa).
2. **Barra de Controles Centralizada com Espaçamento Dinâmico:**
   - Centraliza dinamicamente os 3 seletores de filtro (`Clientes / Grupos`, `Unidades / Lojas`, `Tipos de Ativo`).
   - Mantém os alternadores de modo (`Por Unidade / Visão por Grade`) e de trava (`Travado / Arraste Livre`) integrados no mesmo eixo com espaçamento elástico (`justify-center gap-2.5 sm:gap-3 flex-wrap`), eliminando quebras desajeitadas ou desalinhamentos em qualquer largura de tela.

### 5.2 Aproveitamento de Espaço: Visão por Grade vs. Visão por Unidade (Modo Planilha Excel)
- **Modo "Visão por Grade" (Layout Wide de 2 Colunas Internas):**
  - **Objetivo:** Aproveitamento máximo da largura horizontal da tela, transformando cada card em um widget executivo estilo dashboard NOC.
  - **Distribuição:** A grade acomoda 2 a 3 cards largos por linha (`grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4`).
  - **Estrutura Interna (2 Colunas):**
    - **Coluna Esquerda (Conectividade & KPIs):** Métricas de Latência (RTT) e Perda de Pacotes em blocos destacados lado a lado, telemetria básica do Host (CPU, RAM, Disco) e botão do script do Agente em 1-clique.
    - **Coluna Direita (Sub-ativos e Recursos):** 
      - Para **Mikrotik RouterOS:** Lista de Links WAN / Failover com indicação do link ativo principal, tráfego RX/TX formatado e badges de status (`ATIVA`, `BKP`, `DOWN`).
      - Para **Proxmox VE:** Medidores de CPU/RAM, contadores de VMs e CTs, e lista de Pools de Armazenamento com percentuais de ocupação e bytes livres.
      - Para **pfSense:** Lista de Gateways monitorados com latência e status online/offline.
- **Modo "Por Unidade" (Visão Compacta Estilo Planilha de Excel):**
  - **Objetivo:** Visão de altíssima densidade operacional para NOCs com dezenas de lojas e filiais, eliminando o desperdício de espaço vertical de cards soltos.
  - **Estrutura de Linhas e Colunas (Excel Table):**
    - `#` / Alça de Arraste (`GripVertical` quando destravado)
    - `Status`: Badge compacto (ONLINE, DEGRADADO, AUTH 401, OFFLINE) com indicador luminoso pulsante.
    - `Equipamento`: Nome do ativo, badge de conexão via Agente Outbound e tags hierárquicas.
    - `Tipo`: Tag do fabricante/SO (MIKROTIK, PROXMOX, LINUX, WINDOWS, PFSENSE).
    - `Host / IP`: Endereço de conexão ou host/porta.
    - `Latência (RTT)`: Valor numérico em ms com destaque cromático.
    - `Perda`: Percentual de perda de pacotes.
    - `Telemetria / Links WAN`: Pílulas inline com links WAN ativos/backup e tráfego RX/TX instantâneo, ou consumo de CPU/RAM e VMs ativas.
    - `Ações`: Botões rápidos de clonar equipamento, editar credenciais e script de 1-clique.
  - **Drag-and-Drop em Tabela:** As linhas da planilha de cada unidade podem ser arrastadas e reordenadas individualmente quando o layout estiver destravado (`isLayoutLocked === false`).

### 5.3 Suporte Bitemático (Dark & Light Theme)
- **Tema Escuro (Dark Mode):** Cartões com fundo `bg-slate-900/85`, caixas métricas em `bg-slate-950/60`, bordas suaves em `border-slate-800` e tipografia de alto brilho.
- **Tema Claro (Light Mode):** Cartões com fundo `bg-white`, caixas métricas em `bg-slate-50`, bordas definidas em `border-slate-200`, badges em `bg-slate-100 text-slate-700` e crachás de status com contraste WCAG AA, garantindo legibilidade perfeita e acabamento corporativo premium.

---

## 6. Arquitetura Técnica & Chaves do Armazenamento Local

- **Modo de Visualização (Grade vs. Por Unidade):**
  - Chave: `noc_view_group_by_unit_${uid}`
  - Valores: `"true"` (agrupado por unidade em tabela Excel) ou `"false"` (visão contínua por grade de cards)
  - Valor inicial caso inexistente: `false` (Visão por Grade)
  - Comportamento: Persiste a preferência individual de cada usuário entre sessões e recarregamentos.
- **Trava de Layout:**
  - Chave: `noc_layout_locked_${uid}`
  - Valores: `"true"` (travado) ou `"false"` (livre)
  - Valor inicial caso inexistente: `true` (Travado)
- **Vetor de Ordenação dos Cards:**
  - Chave: `noc_card_order_${uid}`
  - Formato: Array JSON contendo a sequência dos IDs dos equipamentos: `["eq-01", "eq-04", "eq-02", ...]`
  - Ao carregar, o frontend reordena os equipamentos aplicando prioridade ao índice gravado em `orderMap`.

