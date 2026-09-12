# Etapa 26 — Plano de Implementação

## Regra de arquitetura
Criar módulos de domínio; não continuar concentrando a implementação em `apps/api/src/server.ts`.

Sugestão:
- `apps/api/src/inventory/`
- `apps/api/src/network/`
- `apps/api/src/topology/`
- `apps/api/src/discovery/`

## 26A — Customer Infrastructure Book

### A1. Contratos e persistência
Criar:
`Site`, `Location`, `Rack`, `Asset`, `AssetDocument`, `AssetTimelineEvent`, `AssetResourceLink`.

Todos contêm `tenantId`.

### A2. API
CRUD tenant-scoped para sites, locations, racks e assets.
Busca por nome, patrimônio, serial, IP, MAC, categoria e status.

### A3. UI
Menu `Infrastructure`.
Telas: Overview, Sites, Racks, Assets.
Cadastro rápido + detalhes avançados.

### A4. Vínculo lógico
Vincular Asset com Node/Proxmox/Virtualizor/Agent existente.

### A5. QR
Endpoint seguro de identificação e ficha mobile.

**Gate 26A:** tenant cadastra infraestrutura básica, encontra ativos rapidamente e vincula nodes existentes sem duplicação.

## 26B — Rack & Connectivity

Criar `AssetInterface`, `Connection`, `RackPosition`.

Switch wizard:
- quantidade de portas;
- prefixo/padrão;
- gerar portas em lote.

Topologia inicial derivada exclusivamente de Connections confirmadas.

**Gate 26B:** técnico consegue responder qual ativo está em qual U e qual equipamento está ligado a determinada porta.

## 26C — Network Source of Truth

Criar `Vlan`, `Subnet`, `IpAddress`, `WanCircuit`.

IPAM básico:
USED, RESERVED, DHCP, AVAILABLE, CONFLICT, UNKNOWN.

**Gate 26C:** tenant documenta redes e consulta IPs sem ferramenta externa.

## 26D — Discovery

### Primeira entrega
Descoberta de hosts autorizada pelo Agent em CIDR definido.

### Enriquecimento
SNMP para identity/interfaces/status.
LLDP para vizinhança.

### Reconciliation
Matching por serial > MAC > management IP > hostname/model.
Nunca mesclar automaticamente caso confiança não atinja threshold configurado.

**Gate 26D:** descoberta cria candidatos, não lixo automático no inventário.

## 26E — Operational Tools

### Health Score
Score simples e explicável usando sinais já existentes + inventário.

### Visit Checklist
Checklist por tenant/site; sugestões automáticas; conclusão e relatório.

### Monthly Client Report
Backups, incidentes, ações, riscos, garantias, recomendações e trabalho preventivo.

### Lifecycle
Warranty, EOL/EOS quando informado/conhecido, maintenance history.

**Gate 26E:** prestador consegue usar InfraOps AI na rotina e demonstrar valor ao cliente.

## 26F — AI & Advisor

Registrar tools read-only.
Adicionar contexto físico ao Advisor.
Perguntas naturais sobre asset, rack, porta, IP, garantia, histórico e visita.

**Gate 26F:** IA responde somente com dados tenant-scoped e diferencia MANUAL/DISCOVERED/VERIFIED.

## Testes obrigatórios
- tenant isolation;
- RBAC;
- rack overlap;
- unique serial/assetTag conforme política;
- MAC normalization;
- CIDR/IP validation;
- connection endpoint validation;
- deletion protection quando há vínculos;
- reconciliation conflicts;
- discovery rate limits;
- prompt injection em descriptions/logs;
- no cross-tenant AI retrieval.

## Observabilidade
Métricas:
assets_total, assets_verified, assets_discovered, unmapped_interfaces, connections_total, warranty_expiring, discovery_runs, reconciliation_pending.

## Definition of Done
Código, migration, API, UI, testes, audit, docs, métricas, segurança, responsividade e degraded behavior.
