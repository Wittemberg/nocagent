# Stage 25 — Infrastructure Intelligence & Continuous Improvement

## Propósito
Usar histórico operacional de cada tenant para identificar recorrências, distinguir sintoma de causa estrutural e recomendar melhorias técnicas e economicamente justificáveis.

> **Self-Healing resolve o incidente. Infrastructure Intelligence tenta impedir que ele volte a existir.**

## Fontes de dados
- incidents, alerts, triggerEvents e selfHealingRuns;
- scheduleRuns, jobs, Actions e audit events;
- Prometheus/telemetria;
- Backup Engine e RPO/RTO;
- inventário Proxmox/Virtualizor/node/workload/storage;
- mudanças/manutenções;
- Goals/SLO drift quando a Etapa 24 existir.

## Pipeline
```text
Operational History
  ↓
Recurring Pattern Detection
  ↓
Root Cause Hypotheses
  ↓
Evidence & Confidence Scoring
  ↓
Infrastructure Recommendation
  ↓
Risk / Cost / Benefit Model
  ↓
Human Review
  ↓
Change Plan
  ↓
Implementation
  ↓
Before/After Validation
```

## Submódulos

### 25.1 Recurring Incident Analysis
Agrupar incidentes semanticamente semelhantes, calcular frequência, duração, recursos afetados, ações repetidas e tendência. Repetidos self-healings bem-sucedidos devem poder sinalizar dívida estrutural.

### 25.2 Root Cause Pattern Mining
Correlacionar métricas, logs, eventos, mudanças, dependências e ações anteriores. Diferenciar causa provável de simples correlação e sempre anexar evidências.

### 25.3 Infrastructure Recommendations
Categorias:
- Capacity: disco, RAM, CPU, storage e rede;
- Resilience: HA, Ceph, replicação, node adicional, link redundante;
- Backup: storage dedicado, offsite, RPO/RTO, retenção, restore tests;
- Architecture: redistribuição de workloads e eliminação de SPOF;
- Lifecycle: SO, hypervisor, kernel, firmware e EOL/EOS;
- Optimization: rightsizing, snapshots, retenção e recursos ociosos.

Cada recomendação deve ter: problema, evidências, causa provável, mudança proposta, prioridade, confiança, risco, esforço, impacto esperado, custo quando configurado e ROI/payback quando calculável.

### 25.4 Capacity Forecasting
Prever saturação em 7/30/90/180/365 dias, com cenários conservador/base/agressivo, headroom recomendado e baixa confiança explícita quando a série for insuficiente.

### 25.5 Single Point of Failure Detection
Construir grafo evidenciado: `serviço → workload → node → storage → rede → backup`. Detectar node único, storage local sem réplica, único destino de backup, único link e outras dependências críticas.

### 25.6 Technical Debt Score
Score explicável 0–100 por tenant e domínio: Capacity, Resilience, Backup, Lifecycle/Security, Stability e Automation Readiness. Pesos configuráveis.

### 25.7 Cost / ROI Analysis
Inputs por tenant: custo/hora técnico, custo/hora de downtime, custo de storage/compute, estimativas de hardware e moeda. Outputs: custo recorrente, investimento, economia potencial, payback e benefício anualizado. **Nunca inventar preço.**

### 25.8 Lifecycle & Upgrade Advisor
Detectar versões defasadas/EOL, patches críticos, firmware/kernel e recomendar plano de atualização com dependências, risco e janela sugerida.

### 25.9 Recommendation Validation Loop
`Recommendation → Change → Observation Window → Before/After → Validation`.
Resultado: validated, partially_validated, ineffective ou inconclusive.

### 25.10 Executive Infrastructure Review
Review mensal/trimestral com incidentes, recorrências, ações autônomas, horas evitadas, riscos, technical debt, capacidade, recomendações, investimentos e benefícios medidos.

## Boundary de segurança
Recommendation é advisory. Mudança estrutural exige `Change Plan → RBAC → Policy Engine → Approval → Action Registry → Precheck → Execute → Postcheck → Audit`.

## API proposta
```text
GET  /api/v1/intelligence/recommendations
POST /api/v1/intelligence/recommendations/analyze
GET  /api/v1/intelligence/recommendations/:id
POST /api/v1/intelligence/recommendations/:id/review
POST /api/v1/intelligence/recommendations/:id/change-plan
GET  /api/v1/intelligence/capacity/forecasts
GET  /api/v1/intelligence/spof
GET  /api/v1/intelligence/technical-debt
GET  /api/v1/intelligence/executive-review
POST /api/v1/intelligence/recommendations/:id/validate
```

## UX
Nova área **Intelligence / Advisor** com abas: Recommendations, Recurring Incidents, Capacity, Resilience & SPOF, Technical Debt, ROI e Reviews.

## Gate
- isolamento multi-tenant comprovado;
- toda recomendação rastreável a evidências;
- confidence score não inventado pelo LLM;
- sem execução estrutural direta por recomendação;
- custos distinguem fato/configuração/estimativa;
- before/after mede benefício;
- degraded LLM mode mantém findings determinísticos;
- prompt injection testado sobre logs e tickets.
