# Stage 28 — Rollout & Regression Plan

## Goal
Deploy the UX overhaul without disrupting production operational behavior.

## Rollout phases
1. feature flags;
2. internal admin users;
3. selected test tenant;
4. small MSP pilot;
5. default new-user experience;
6. full rollout.

## Suggested flags
- `ui_simple_mode`
- `ui_new_navigation`
- `ui_daily_home`
- `ui_customer_overview`
- `ui_guided_onboarding`
- `ui_reports_hub`

## Backward compatibility
During transition:
- keep old view routing available internally;
- do not delete domain pages until equivalent new navigation is validated;
- keep Technical Mode escape hatch.

## Monitoring
Track:
- navigation errors;
- failed API requests;
- approval abandonment;
- onboarding completion;
- page load errors;
- support requests by screen;
- mode switching frequency.

## Rollback
A UI flag rollback must not roll back:
- backend data migrations;
- audit history;
- Actions;
- Policy Engine state.

## Pilot checklist
- superadmin;
- admin;
- operator;
- auditor;
- viewer;
- tenant with Proxmox;
- tenant with MikroTik/pfSense;
- tenant with Stage 26 inventory;
- zero-state tenant.

## Exit criteria
No blocker regression in:
- login;
- tenant isolation;
- nodes/workloads;
- backup status;
- inventory;
- WAN monitoring/actions;
- approvals;
- automations;
- AI;
- reports.
