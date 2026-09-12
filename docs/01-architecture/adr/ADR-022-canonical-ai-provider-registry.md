# ADR-022 — Canonical AI Provider Registry & Documentation Governance

## Contexto
O InfraOps AI integra inteligência generativa e contextual multi-provedor (cloud e local) para diagnósticos de infraestrutura, sumarização executiva e enriquecimento de incidentes. À medida que novos modelos, provedores de inferência (Groq, OpenAI, Anthropic, DeepSeek, Google Gemini, Ollama) e gateways compatíveis com a especificação OpenAI REST são homologados, a manutenção de listas estáticas duplicadas em diversos arquivos de documentação gera risco de divergência (*documentation drift*).

## Decisão
1. Estabelecer o **`AI Provider Registry`** do backend (`apps/api/src/server.ts` e subsistema de configurações `systemSettings.ai`) como a **Fonte Canônica da Verdade** para os provedores e protocolos de IA suportados.
2. A documentação técnica e de produto deve referenciar a arquitetura do **AI Provider Registry**, apresentando os provedores atualmente homologados como exemplos da capacidade do registry, e não como uma enumeração fechada ou rígida.
3. Manter a regra não-negociável de **exigência estrita de credenciais ativas**: o registry rejeita respostas fictícias ou dados simulados na ausência de chaves de API válidas.

## Consequências
- **Extensibilidade:** Novos provedores ou endpoints locais (vLLM, LocalAI, Azure OpenAI, Bedrock) podem ser conectados ao registry sem demandar refatoração de documentos históricos.
- **Consistência Documental:** Elimina inconsistências entre especificações de produto, roadmap e código-fonte.
- **Segurança:** O isolamento multi-tenant de chaves de API e a validação de conectividade permanecem governados centralmente pelo registry.
