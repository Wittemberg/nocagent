# Stage 27 — Implementation Guide

## Architectural rule
Implement as domain modules. Do not add the feature as a large block inside `server.ts`.

Suggested:
- `apps/api/src/network-devices/`
- `apps/api/src/network-devices/drivers/`
- `apps/api/src/network-devices/telemetry/`
- `apps/api/src/network-devices/actions/`
- `apps/api/src/network-devices/health/`

## Phase A — Contracts

### A1. Driver interface
Define:
- `testConnection()`
- `detectCapabilities()`
- `getIdentity()`
- `getSystemHealth()`
- `listInterfaces()`
- `listWanLinks()`
- `getRoutingState()`
- `getVpnServiceHealth()` optional
- `snapshotWanConfig()`
- `setPrimaryWan()`
- `setWanFailover()`
- `setWanBalance()`
- `enableWan()`
- `disableWan()`
- `validatePostChange()`
- `rollbackWanChange()`

### A2. Capability flags
Examples:
`SYSTEM_HEALTH`, `INTERFACES`, `WAN_HEALTH`, `ROUTING`, `WAN_PRIMARY_CHANGE`, `WAN_BALANCE`, `VPN_HEALTH`.

Unsupported capability returns a typed error.

### A3. Persistence
Add:
- NetworkDeviceProfile
- NetworkDeviceCapability
- WanLink
- NetworkTelemetrySample or Prometheus labels
- NetworkChangeSnapshot
- NetworkActionRun

All tenant-scoped.

**Gate A:** fake driver passes contract tests without vendor-specific code leaking upward.

## Phase B — Collection path

Prefer the existing InfraOps Agent as an outbound collector when the device is only reachable inside customer LAN.

Flow:
`API → queued collection request → Agent → device → normalized result → API/Prometheus`.

Never expose customer firewall management ports to the Internet as a requirement.

Support direct server-side connection only when explicitly configured and safe.

**Gate B:** device behind LAN can be monitored through Agent with tenant/device authorization.

## Phase C — MikroTik driver

### C1. Monitoring
Implement official/supported RouterOS interfaces available for the target versions, with SNMP as a telemetry fallback where appropriate.

Normalize:
identity, RouterOS version, board/model, serial, uptime, CPU, RAM, storage, temperature, interfaces, WAN, default routes, gateway status.

### C2. WAN mapping
Require user confirmation of which interfaces/routes represent named providers.

### C3. Action
`network.set_primary_wan`:
1. fetch current route state;
2. resolve mapped WAN;
3. verify target gateway/link health;
4. snapshot relevant state;
5. change preference;
6. verify active/default egress;
7. connectivity probes;
8. persist before/after;
9. rollback if validation fails.

**Gate C:** switching primary WAN in lab is deterministic and rollback-tested.

## Phase D — pfSense driver

### D1. Monitoring
Collect system/interface/gateway information using stable supported mechanisms for the deployed pfSense versions. Avoid making a third-party plugin mandatory.

### D2. Gateway Groups
Normalize:
gateway, interface, tier, weight, monitor IP, status, loss, delay.

### D3. Actions
Primary change:
- manipulate known gateway-group preference safely.

Balance:
- change relative weight/tier only when the detected configuration supports it.

Never promise exact throughput percentages.

**Gate D:** lab can switch preferred gateway and restore previous state.

## Phase E — Action Registry

Register:
- `network.set_primary_wan`
- `network.set_wan_failover`
- `network.set_wan_balance`
- `network.enable_wan`
- `network.disable_wan`

Schemas must be vendor-neutral.

Example:
```json
{
  "deviceId": "dev-123",
  "targetWanId": "wan-claro",
  "reason": "manual_ai_request"
}
```

Driver selection happens after policy approval.

## Phase F — Safety

### Precheck
- device reachable;
- target WAN exists;
- interface UP;
- gateway reachable;
- loss/latency within policy;
- no unresolved config ambiguity;
- recent snapshot available/created.

### Postcheck
- intended route/gateway active;
- external reachability;
- DNS probe;
- optional tenant-defined critical endpoint;
- device management still reachable.

### Rollback
Rollback must use the captured snapshot, not a newly generated AI instruction.

### Anti-lockout
If the management path itself depends on the WAN being changed, require stronger validation/approval.

## Phase G — AI tools

Read:
- `networkDevice.getHealth`
- `networkDevice.listWanLinks`
- `networkDevice.getPrimaryWan`
- `networkDevice.getEvents`

Mutating AI intents map only to registered Actions.

AI output must show:
- current state;
- proposed state;
- health of target WAN;
- risk;
- approval requirement.

## Phase H — Trigger/Self-Healing integration

Create presets:
- `WAN_DOWN_FAILOVER`
- `WAN_HIGH_LOSS_FAILOVER`
- `WAN_HIGH_LATENCY_FAILOVER`
- `WAN_RECOVERY_RETURN_PRIMARY`

Required:
debounce, minimum duration, cooldown, hysteresis, circuit breaker, max changes/hour.

## Phase I — UI

Infrastructure → Network Devices.

Device page:
Overview/WAN/Interfaces/Events/Actions.

WAN action:
`Make Primary` opens preview:
Before → After, health, risk, rollback policy.

Automation wizard:
“If WAN X is degraded for N minutes and WAN Y is healthy → make Y primary.”

## Phase J — Observability
Metrics:
- network_device_up
- network_wan_up
- network_wan_latency_ms
- network_wan_packet_loss_percent
- network_wan_rx_bps
- network_wan_tx_bps
- network_action_total
- network_action_failed_total
- network_action_rollback_total
- network_failover_total
- network_flap_prevented_total

## Phase K — Security tests
- tenant isolation;
- secret redaction;
- unauthorized Action;
- stale capability;
- ambiguous WAN mapping;
- target WAN down;
- target WAN degraded;
- device unreachable mid-change;
- postcheck failure;
- rollback failure escalation;
- repeated trigger/flapping;
- prompt injection from device descriptions;
- AI cannot invoke arbitrary CLI.

## Definition of Done
Both MikroTik and pfSense pass lab fixtures/integration tests; telemetry is visible; primary WAN can be changed through governed Action; rollback is proven; AI can propose/execute only within policy; automated failover is anti-flapping; audit shows before/after evidence.
