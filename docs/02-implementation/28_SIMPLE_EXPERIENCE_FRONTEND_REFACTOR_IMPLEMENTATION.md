# Stage 28 — Detailed Implementation Guide

## 0. Mandatory pre-read for the implementing AI

Before changing code:
1. `AGENTS.md`
2. `README.md`
3. `docs/02-implementation/00_README_MASTER.md`
4. `docs/01-architecture/ARCHITECTURE_DECISIONS.md`
5. `docs/06-product/STAGE_28_SIMPLE_EXPERIENCE_AND_GUIDED_OPERATIONS.md`
6. ADR-023 and ADR-024 from this package
7. current `apps/web/src/App.jsx`
8. all views affected by each substage

Follow `AGENTS.md`: list files, implement only current scope, tests, lint/typecheck/build, gate green before next substage.

---

# 1. Current frontend findings

Observed current structure:
- `App.jsx` ~32 KB;
- `InfrastructureSourceOfTruthView.jsx` ~92 KB;
- `AutomationsSchedulerView.jsx` ~71 KB;
- `InfrastructureIntelligenceView.jsx` ~66 KB;
- `AlertChannelsView.jsx` ~49 KB;
- navigation, routing-like state, API sync, localStorage fallback and demo/default records are partially concentrated in `App.jsx`.

This stage must reduce coupling without a rewrite.

---

# 2. Target frontend architecture

Suggested:

```text
apps/web/src/
  app/
    AppShell.jsx
    routes.jsx
    navigation.js
    permissions.js

  features/
    home/
    customers/
    infrastructure/
    backups/
    alerts/
    assistant/
    automations/
    recommendations/
    reports/
    history/
    settings/

  components/
    common/
    feedback/
    forms/
    layout/

  services/
    apiClient.js
    tenantService.js
    inventoryService.js
    automationService.js
    reportService.js

  state/
    authStore.js
    tenantContext.js
    uiPreferences.js

  fixtures/
    demoData.js

  utils/
    labels.js
    statusPresentation.js
```

Do not require a new state-management library unless clearly justified.

---

# 3. Stage 28A — Information Architecture & Language

## 3.1 Create canonical UI dictionary
Create:
`apps/web/src/app/uiLanguage.js`

Contains:
- nav labels;
- page titles;
- status labels;
- tooltips;
- technical term explanations;
- role-friendly names.

Do not scatter terminology strings across components.

## 3.2 Replace top-level navigation
Implement task-based groups.

Suggested desktop:
```text
Início
Clientes
Infraestrutura
Backups
Alertas
Assistente IA
Automações
Recomendações
Relatórios
Histórico
Configurações
```

Use role filters.

## 3.3 Preserve routes/current state compatibility
If currentNav values are used deeply, introduce a mapping layer first. Do not rename internal keys in the same commit as UI labels unless covered by tests.

## 3.4 Page titles
Remove:
- RBAC
- PVE/Virt abbreviations as primary labels
- Source of Truth
- Workloads
- Advisor
- Schedules

Keep technical subtitle when useful.

### Gate 28A
- no primary nav label requires glossary knowledge;
- all old pages remain reachable;
- permissions unchanged;
- no broken deep links/state transitions.

---

# 4. Stage 28B — Frontend Foundation Refactor

## 4.1 Split App.jsx
App must retain only:
- authentication bootstrap;
- tenant context bootstrap;
- shell;
- route/view selection;
- global modals only if truly global.

Move:
- API requests to services;
- localStorage adapters to state/services;
- demo fixtures to fixtures;
- navigation config to app/navigation.js.

## 4.2 Remove production demo injection
Current hard-coded default tenants/users/nodes/workloads/integrations must not silently populate production users.

Define explicit modes:
- production: Zero-State;
- demo/dev: fixtures behind environment flag.

Suggested:
`VITE_ENABLE_DEMO_DATA=false` default.

## 4.3 Break oversized views by domain
For Infrastructure:
```text
features/infrastructure/
  InfrastructurePage.jsx
  OverviewTab.jsx
  SitesTab.jsx
  AssetsTab.jsx
  RacksTab.jsx
  NetworkTab.jsx
  IpamTab.jsx
  DiscoveryTab.jsx
```

For Automations:
```text
features/automations/
  AutomationsPage.jsx
  SchedulesTab.jsx
  RulesTab.jsx
  SelfHealingTab.jsx
  GoalsTab.jsx
```

For Recommendations:
```text
features/recommendations/
  RecommendationsPage.jsx
  RecommendationsTab.jsx
  CapacityTab.jsx
  SpofTab.jsx
  TechnicalDebtTab.jsx
  ReviewsTab.jsx
```

## 4.4 No behavior changes while splitting
First refactor, then change UX.

### Gate 28B
- behavior parity tests;
- build green;
- no lost functionality;
- demo data disabled in production;
- App.jsx substantially reduced;
- feature modules own their API/state logic.

---

# 5. Stage 28C — Home / Daily Operations Center

Create `features/home/HomePage.jsx`.

## Data contract
Prefer one aggregation endpoint if backend supports/accepts new read-only endpoint:
`GET /api/v1/dashboard/daily-summary?tenantId=...`

If backend change is undesirable initially, compose existing APIs in a service.

Response concept:
```json
{
  "healthScore": 92,
  "customers": {
    "total": 18,
    "healthy": 12,
    "warning": 4,
    "critical": 2
  },
  "priorities": [],
  "backup": {},
  "wan": {},
  "assets": {},
  "automations": {},
  "recommendations": {}
}
```

## Priority sorting
1. critical incident;
2. failed/late backup;
3. WAN outage/degradation;
4. offline critical asset;
5. pending high-risk approval;
6. lifecycle/warranty;
7. recommendation.

## Empty state
> “Tudo em ordem por aqui. Nenhum problema importante precisa da sua atenção agora.”

### Gate 28C
User can identify the most important issue in <10 seconds.

---

# 6. Stage 28D — Customer-Centered Experience

## 6.1 Customer selector
Make active customer visually persistent.

## 6.2 Customer page
Create:
`features/customers/CustomerOverviewPage.jsx`

## 6.3 Customer card
Show:
- health;
- backups;
- WAN;
- critical alerts;
- asset count;
- last activity.

## 6.4 Tenant user
If user belongs to one tenant only, do not expose a tenant switcher.

### Gate 28D
An MSP can open one customer and operate most tasks without repeatedly navigating across global modules.

---

# 7. Stage 28E — Simple Mode / Technical Mode

## State
`uiPreferences.experienceMode = "simple" | "technical"`

Persist per user, ideally backend preference; localStorage acceptable as first step if documented.

## Simple mode behavior
- hide raw IDs;
- hide internal action keys;
- collapse advanced configuration;
- use explanations;
- show recommended settings.

## Technical mode behavior
- expose raw values;
- advanced tabs;
- policy/action details;
- metric identifiers.

## Important
Do not hide:
- risk;
- destructive consequence;
- approval requirement;
- rollback availability;
- audit fact.

### Gate 28E
Mode switch changes presentation only, never authorization or execution semantics.

---

# 8. Stage 28F — Guided Onboarding

Create a resumable wizard.

## State machine
`NOT_STARTED → IN_PROGRESS → MONITORED → DOCUMENTED → COMPLETE`

Do not use “complete” to imply all optional integrations are mandatory.

## Steps
1. Customer
2. Locations
3. Server/virtualization
4. Firewall/router
5. Network
6. Backups
7. Agent
8. Alerts
9. Health test
10. Finish

## Requirements
- Skip allowed where relevant;
- resume later;
- contextual help;
- validation per step;
- save after every step;
- no hidden destructive action.

### Gate 28F
A new user can onboard a small customer without opening documentation.

---

# 9. Stage 28G — Humanized Alerts, Actions & Approvals

## Presentation adapter
Create:
`utils/operationPresentation.js`

Maps:
- action key → title;
- technical reason → plain-language summary;
- risk enum → user label;
- state → label/icon.

## Example
Internal:
`network.set_primary_wan`

Simple:
`Trocar link principal`

Technical details:
show action key in expandable area.

## Approval card
Must show:
- what changes;
- why;
- before;
- after;
- risk;
- rollback;
- who requested;
- when.

### Gate 28G
A user can approve/reject safely without understanding action keys.

---

# 10. Stage 28H — AI Assistant as Primary Entry Point

## Rename
Console IA → Assistente IA

## Placement
- top-level nav;
- input on Home;
- customer-aware context;
- suggestions.

## AI response layout
Structure responses when possible:
1. Resumo
2. Evidências
3. Recomendação
4. Próxima ação

## Mutating intents
Always show action preview before governed execution if policy requires approval.

## Empty/error provider state
Never fake an answer.
Show:
> “O Assistente IA está indisponível porque nenhum provedor válido está ativo.”

Link:
`Configurar IA`

### Gate 28H
AI becomes discoverable without weakening provider/Policy requirements.

---

# 11. Stage 28I — Reports & Customer Value

Create a Reports area.

## Initial reports
- monthly customer report;
- technical visit;
- infrastructure health;
- backup report;
- asset inventory;
- recommendations;
- service history.

## Plain-language executive summary
Reports must separate:
- measured facts;
- AI interpretation;
- recommendations;
- actions completed.

## Branding
Reuse White-Label MSP settings.

### Gate 28I
MSP can generate a customer-facing document that demonstrates preventive work.

---

# 12. Stage 28J — Accessibility, Responsiveness & Validation

## Requirements
- desktop;
- tablet;
- mobile for operational read/approve tasks;
- keyboard navigation;
- visible focus;
- contrast;
- labels not color-only;
- minimum touch targets;
- Portuguese error messages.

## Usability scenarios

### Scenario A — New customer
User:
1. creates customer;
2. adds location;
3. connects Proxmox or agent;
4. configures backup;
5. activates alerts.

Target: no documentation required.

### Scenario B — Incident
User sees:
- customer;
- problem;
- impact;
- suggested action.

Target: understands in <30 seconds.

### Scenario C — WAN failover
User:
- sees degraded provider;
- sees backup healthy;
- authorizes switch;
- sees result.

Target: no need to know action key.

### Scenario D — Visit preparation
User asks AI:
> “O que devo verificar amanhã no Cliente X?”

Target: actionable checklist.

### Scenario E — Customer report
User generates monthly report.

Target: understandable by non-technical customer.

---

# 13. Migration strategy

Do not perform all UX changes in one giant commit.

Recommended commits:
1. `refactor(web): extract navigation and ui language`
2. `refactor(web): separate api services and demo fixtures`
3. `refactor(web): split infrastructure feature modules`
4. `refactor(web): split automation and intelligence modules`
5. `feat(web): add simple and technical experience modes`
6. `feat(web): add daily operations home`
7. `feat(web): add customer-centered overview`
8. `feat(web): add guided customer onboarding`
9. `feat(web): humanize actions alerts and approvals`
10. `feat(web): reposition ai assistant`
11. `feat(web): add reports hub`
12. `test(web): add stage28 usability and regression coverage`

---

# 14. Non-negotiable regressions to prevent

- tenant leakage;
- role permission changes;
- missing approval gates;
- hidden critical risk;
- removal of audit access;
- action key mutation;
- incorrect active tenant;
- data loss due to localStorage merge;
- demo fixtures appearing in production;
- AI fake fallback;
- loss of Stage 26/27 functionality;
- mobile approval without adequate confirmation.

---

# 15. Test strategy

## Unit
- terminology map;
- status presentation;
- nav visibility by role;
- experience mode;
- recommended settings;
- customer summary aggregation.

## Integration
- active tenant propagation;
- action preview;
- approval flow;
- onboarding persistence;
- reports data;
- AI provider unavailable state.

## E2E
- login;
- customer selection;
- daily home;
- onboarding;
- Proxmox view;
- infrastructure view;
- WAN action;
- approval;
- report;
- role restrictions.

## Visual regression
Core pages in:
- Simple light;
- Simple dark;
- Technical light;
- Technical dark;
- desktop;
- mobile.

---

# 16. Definition of Done

Stage 28 can only close when:
- new IA navigation is live;
- terminology review complete;
- Simple Mode is default;
- Technical Mode is available;
- Home/Daily Operations live;
- Customer Summary live;
- onboarding live;
- action/approval humanization live;
- Assistant IA repositioned;
- Reports hub live;
- production has zero silent demo fixtures;
- oversized frontend views are materially decomposed;
- tests and build green;
- product docs/marketing updated;
- usability scenarios pass.
