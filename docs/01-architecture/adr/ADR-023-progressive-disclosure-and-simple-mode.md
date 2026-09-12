# ADR-023 — Progressive Disclosure and Simple Mode

## Status
Proposed for Stage 28

## Context
InfraOps AI exposes increasingly sophisticated concepts: SLOs, Actions, policies, schedules, triggers, infrastructure topology, AI recommendations and network failover. The primary target market includes small IT providers with limited operational staff.

Presenting all technical complexity at the same level creates cognitive overhead and increases configuration errors.

## Decision
Adopt **progressive disclosure** with two presentation modes:
- Simple Mode — default;
- Technical Mode — optional.

Mode affects terminology, density and advanced fields, but never:
- RBAC;
- Policy Engine;
- approval requirements;
- Action behavior;
- audit;
- risk classification;
- tenant isolation.

## Alternatives considered
1. Remove advanced functionality — rejected.
2. Keep only technical UI — rejected due target market.
3. Separate “Lite” product — rejected initially due duplication of product logic.

## Security impact
Positive if risk remains visible. Dangerous if simplification hides operational consequences, therefore critical risk/approval/rollback information is mandatory in both modes.

## Migration
Introduce a presentation layer before changing domain identifiers.

## Consequences
InfraOps AI can serve beginners and advanced operators without splitting the backend or security model.
