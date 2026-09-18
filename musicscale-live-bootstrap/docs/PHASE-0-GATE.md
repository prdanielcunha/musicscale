# Phase 0 — Gate

## Implemented in this bootstrap
- Independent repo-ready workspace.
- Neutral domain contracts.
- Capability naming and ProviderAdapter contract.
- LiveCommand / CommandResult envelopes and idempotency.
- Event Bus baseline.
- Live Node process with health/capability/command endpoints.
- Shared MillionsNest Firebase/Auth/Firestore read bridge.
- PT/EN/ES app foundation.
- Live + Studio responsive shell and design tokens.
- Feature-flag and telemetry baseline.
- Threat model.
- Transport Broker decision recorded before LAN implementation.

## Gate still required before closing Phase 0
- Move this workspace to the dedicated `musicscale-live` repository.
- Add CI in the dedicated repository.
- Add dedicated Firebase Hosting target/deploy.
- Finalize shared RBAC contract for Live roles.
- Add Firestore rules/tests for Live collections before any cloud writes.
- Run responsive/browser QA on real iPad + Android tablet + desktop.
- Version and publish the frozen domain contracts.

## Phase 1 next
PWA ↔ Node transport, pairing, discovery, local session, heartbeat, reconnect, state store and crash recovery.
