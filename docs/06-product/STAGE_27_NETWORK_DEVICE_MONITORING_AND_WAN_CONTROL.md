# Stage 27 — Network Device Monitoring & Governed WAN Control

## 1. Product goal
Give small MSPs/MEIs a practical way to monitor MikroTik/pfSense and safely operate Internet failover from InfraOps AI.

The feature must feel as simple as monitoring a VM, while preserving the fact that routers/firewalls are different resource types.

## 2. Product model
A MikroTik/pfSense is an `Asset`/`NetworkDevice`, linked to a driver and monitoring profile.

```text
Asset
  ↓
Network Device
  ↓
Driver
  ↓
Telemetry / Health
  ↓
AI / Trigger / Scheduler
  ↓
Governed Action
```

## 3. Device onboarding
Wizard:
1. select existing Asset or create one;
2. choose `MikroTik RouterOS` or `pfSense`;
3. management IP/hostname;
4. credential Secret reference;
5. select collection path;
6. Test Connection;
7. Detect Capabilities;
8. Save & Start Monitoring.

Never display stored password/token after save.

## 4. Normalized WAN model

`WanLink`
- id
- tenantId
- deviceId
- interfaceId
- name/alias
- provider
- gateway
- publicIp when known
- bandwidthDown/Up optional
- role: PRIMARY/SECONDARY/BALANCED
- state: UP/DEGRADED/DOWN/UNKNOWN
- latencyMs
- packetLossPercent
- jitterMs optional
- currentPreference
- healthScore
- lastCheckedAt

## 5. MikroTik semantics
Primary-link switching should prefer safe manipulation of known default-route preference/distance or equivalent supported configuration discovered on the device.

The driver must:
- identify candidate default routes;
- preserve existing route identifiers/comments when possible;
- refuse ambiguous topology unless user maps WAN links;
- snapshot relevant routing state;
- change only the intended preference;
- verify selected egress after execution;
- rollback on failed postcheck.

## 6. pfSense semantics
Support two user intents distinctly:
- **Primary/secondary failover:** gateway group Tier preference.
- **Weighted balancing:** relative gateway weight within supported configuration.

UI/AI must explain that 70/30 represents approximate distribution of new connections, not guaranteed bandwidth split.

## 7. Device dashboard
Header:
- Online/Offline
- vendor/model/version
- CPU/RAM/uptime
- current primary WAN
- WAN health

WAN cards:
- provider
- interface
- gateway
- state
- latency
- loss
- throughput
- role
- last change

Tabs:
Overview | WAN | Interfaces | VPN/Services | Events | Actions | Inventory

## 8. AI behavior
Read examples:
- “Qual link está principal?”
- “Como estão Vivo e Claro?”
- “Qual link teve mais perda hoje?”

Mutating examples:
- “Coloque Claro como principal.”
- “Volte para Vivo.”
- “Configure failover Vivo → Claro.”
- “Use Claro como Tier 1.”

The assistant converts natural language to a typed Action proposal. It does not emit arbitrary commands to the execution layer.

## 9. Risk
Suggested:
- read telemetry: LOW
- set primary WAN: MEDIUM
- change WAN balance: MEDIUM
- enable WAN: MEDIUM
- disable WAN: HIGH
- firewall policy/rules: OUT OF SCOPE for Stage 27

## 10. Autonomous failover
Example:
- Vivo packet loss >20% for 5m;
- Claro healthy;
- Action: set Claro primary;
- postcheck;
- cooldown 15m;
- recovery requires Vivo loss <3% for 15m;
- optional automatic return.

This must reuse Trigger/Self-Healing primitives, not create a parallel automation engine.

## 11. UX principle
Small-business first:
- defaults;
- presets;
- provider aliases;
- simple health labels;
- advanced fields collapsed;
- safe “Make Primary” button;
- human-readable change preview.

## 12. Out of scope
- arbitrary firewall-rule editing;
- generic CLI terminal through AI;
- BGP/OSPF automation;
- full configuration manager;
- mass firmware upgrade;
- VPN provisioning;
- SD-WAN replacement.
