# Execução Zero-Trust

## Garantias da Fase 06/01

- A IA só pode solicitar ações SSH registradas; o contrato não aceita comandos livres.
- Credenciais permanecem no cofre AES-256-GCM e só são abertas em memória pelo proxy.
- A primeira chave SSH fica pendente; um Tenant Master ou Superadmin deve comparar e confirmar o fingerprint antes de qualquer execução.
- Uma mudança de fingerprint confiado bloqueia a conexão e exige investigação ou reset autorizado.
- Ações mutáveis exigem aprovação persistida, expiram em cinco minutos, usam chave de idempotência e obtêm lock exclusivo por equipamento.
- Cada solicitação e resultado de execução produz um AuditLog com ator, equipamento e status.

## Fluxo operacional

1. No Cofre, o operador autorizado usa o ícone de escudo no servidor Linux.
2. O NOC-Agent descobre a chave sem autenticá-la e mostra seu fingerprint.
3. O operador confere o valor no console confiável do servidor e o confirma no painel.
4. Uma ação homologada pode ser solicitada pela API ou ferramenta MCP.
5. Leituras são executadas imediatamente; mutações ficam pendentes até aprovação.

## Endpoints

- `GET /api/execution-actions`
- `POST /api/equipments/:id/host-key/discover`
- `POST /api/equipments/:id/host-key/confirm`
- `POST /api/executions`
- `POST /api/executions/:id/approval`

Todos exigem sessão autenticada; confirmação de chave e aprovação de mutações exigem Tenant Master ou Superadmin.
