# Development Control Center — Arquivos Canônicos de Governança

Este diretório armazena a **Fonte Canônica da Verdade** sobre o roadmap, módulos, capabilities, componentes congelados, checkpoints de código e homologação humana do **InfraOps AI**.

## Arquivos Estruturais

1. **`project.json`**: Identidade do produto, versão do roadmap, ambiente ativo e fase em desenvolvimento.
2. **`roadmap.json`**: Lista declarativa de fases, módulos, capacidades (`capabilities`) e componentes protegidos (`frozenComponents`).
3. **`checkpoints.json`**: Registro auditável de commits e releases relevantes.
4. **`homologation.json`**: Registro auditável de sessões de testes e aceites humanos com mapeamento por ID de homologação (`LOGIN-*`, `AUD-*`, `PFS-*`, etc.).

## Princípio de Operação

- Os dados aqui contidos alimentam o motor matemático backend (`developmentControlService`).
- O motor executa **16 Invariantes Matemáticas Estritas (A a P)** para garantir a consistência de pesos e percentuais.
- Nenhuma métrica é alterada manualmente em porcentagens; todas são calculadas dinamicamente:
  - `percent = (pesoConcluido / pesoTotal) * 100`
- Nenhuma alteração deve ser feita em produção comercial sem aprovação prévia.
