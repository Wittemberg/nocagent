# ADR-021 — WAN changes require snapshot, postcheck and rollback

## Status
Accepted — Stage 27 plan

## Context
Changing default WAN can disconnect the customer and may also cut the management path used by InfraOps AI.

## Decision
Every mutating WAN change must:
1. capture relevant before-state;
2. validate target WAN;
3. execute a typed Action;
4. validate egress and management;
5. rollback deterministically on failed postcheck when possible;
6. escalate when rollback cannot be confirmed.

LLM-generated rollback commands are prohibited.

## Additional guard
Management-path risk raises approval/risk requirements.
