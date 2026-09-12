# Stage 28 — Usability Acceptance Scenarios

These are product gates, not optional UX suggestions.

## Persona 1 — MEI working alone
Knowledge:
- Windows/Linux basics;
- router/firewall basics;
- no formal SRE/AIOps background.

Must be able to:
- add customer;
- add server;
- understand backup status;
- identify WAN problem;
- use Assistant;
- approve safe operation;
- generate report.

## Persona 2 — Small MSP owner
Must be able to:
- switch customers quickly;
- see all customers needing attention;
- assign users;
- prove work with reports;
- use Technical Mode when needed.

## Persona 3 — Customer viewer
Must be able to:
- see health;
- see backup;
- see alerts;
- see recommendations;
- not see forbidden admin functions.

## Acceptance metric targets
- primary problem identification: <10 seconds;
- customer context recognition: immediate;
- onboarding without docs: success;
- WAN approval comprehension: success without action-key knowledge;
- no user confusion between “recommendation” and “automatic action”;
- no user confusion between “alert” and “approval”.

## Failure conditions
Stage fails if users must learn:
- RBAC;
- Source of Truth;
- Action Registry;
- Workload;
- Trigger;
to perform common daily tasks.
