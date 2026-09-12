# ADR-024 — Frontend Feature Modularization and Zero-State UI

## Status
Proposed for Stage 28

## Context
Several frontend views have grown large and App.jsx includes navigation, API synchronization, local state and default/demo operational objects.

This increases regression risk and conflicts with the product's Zero-State onboarding principle.

## Decision
1. Split frontend by feature/domain.
2. Move API calls to services.
3. Move user/tenant context to dedicated state/context.
4. Move demo fixtures to explicit dev/demo mode.
5. Production UI starts with real API state only.
6. App shell owns routing/layout/auth, not domain datasets.

## Alternatives
- Full frontend rewrite: rejected.
- Keep current monolith: rejected due future maintenance cost.

## Security impact
Reduces accidental cross-tenant state mixing and demo data confusion.

## Migration
Behavior-preserving extraction first, UX changes second.

## Consequences
More files, but clearer ownership and easier code-agent maintenance.
