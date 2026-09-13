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

## 5. Arquitetura Técnica & Chaves do Armazenamento Local

- **Trava de Layout:**
  - Chave: `noc_layout_locked_${uid}`
  - Valores: `"true"` (travado) ou `"false"` (livre)
  - Valor inicial caso inexistente: `true` (Travado)
- **Vetor de Ordenação dos Cards:**
  - Chave: `noc_card_order_${uid}`
  - Formato: Array JSON contendo a sequência dos IDs dos equipamentos: `["eq-01", "eq-04", "eq-02", ...]`
  - Ao carregar, o frontend reordena os equipamentos aplicando prioridade ao índice gravado em `orderMap`.
