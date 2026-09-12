# ADR-020 — Vendor-neutral Network Device Driver

## Status
Accepted — Stage 27 plan

## Decision
AI, Policy Engine and Action Registry operate on vendor-neutral network intents. Vendor details are isolated behind drivers.

Example:
`network.set_primary_wan` → MikroTikDriver or PfSenseDriver.

## Why
- keeps AI prompts independent of vendor syntax;
- reduces arbitrary command risk;
- allows future drivers;
- simplifies tests;
- preserves Action governance.

## Consequence
Drivers must expose explicit capabilities and typed unsupported errors.
