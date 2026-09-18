# Phase 0 — Gate

## Implemented
- Independent repo-ready workspace.
- Neutral domain contracts and ProviderAdapter boundary.
- Capability naming; LiveCommand / CommandResult; idempotency; Event Bus.
- Shared MillionsNest Firebase/Auth/Firestore read bridge.
- PT/EN/ES responsive Live + Studio shell.
- Feature flags, telemetry and threat model.
- Transport Broker with direct-lan / local-console / future cloud-relay.
- CI covering install, typecheck, tests and build.

## External/repository gate still open
- Move workspace to dedicated `musicscale-live` repository.
- Dedicated Firebase Hosting target/deploy.
- Final shared RBAC contract for Live cloud roles.
- Firestore rules + emulator tests before enabling any Live cloud writes.
- Real-device responsive/browser QA.
- Freeze/version public domain contracts.

Phase 0 engineering foundation is otherwise complete. Phase 1 is tracked separately in `PHASE-1-GATE.md`.
