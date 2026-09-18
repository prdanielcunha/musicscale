# Phase 1 — LAN / Offline Gate

## Implemented

- Live Node HTTP runtime with health and capability discovery.
- Pairing challenge with expiring PIN.
- Persistent token hashing; revocation; rate limiting; environment/venue/system binding.
- Recovery devices can inherit an already-bound Node scope without cloud auth.
- Heartbeat, reconnect/backoff and observed provider state.
- Transport Broker:
  - direct LAN;
  - same-origin Local Console fallback;
  - cloud relay remains disabled.
- Local Network Access request support where the browser exposes it.
- Same-origin PWA served by the Live Node.
- Local Recovery shell that bypasses Firebase auth when operating from the Node.
- Crash-recovery runtime state with monotonic revision.
- Cached ServicePlan and ProviderLinks.
- Active service item persisted as commands run.
- QR handoff from production PC to tablet/cellphone.
- Local-only provider setup surface.
- Redacted local diagnostic export.
- Single-executable SEA build pipeline.
- Windows alpha installer with user autostart + private-network firewall onboarding.
- macOS alpha installer with LaunchAgent autostart.
- Cross-platform release workflow prepared for Windows/macOS artifacts.
- Linux SEA executable is built and smoke-tested on every foundation CI run.
- Automated tests for pairing scope, persistence, crash recovery, network policy, diagnostics and provider config.

## Offline operating path now implemented

`MusicScale scale → provider preflight → ProviderLinks → cached ServicePlan → Local Recovery → provider command`

The cloud is no longer a hard runtime dependency after the plan has been prepared locally.

## Gate still required before declaring Phase 1 production-ready

- Execute and validate the prepared Windows/macOS release matrix on native hosted runners; the workflow exists but has not yet been manually dispatched from this branch.
- Add signed, verified auto-update only after the dedicated repository + signing identities exist.
- Replace private-file provider token fallback with OS credential vault on supported platforms.
- Real LAN test on:
  - Windows production PC + iPad;
  - Windows production PC + Android tablet;
  - macOS production machine + iPad.
- Physical internet-cut test during an active session.
- Firewall onboarding and diagnostics.
- Decide/validate mDNS or equivalent zero-typing discovery; QR handoff is the current reliable path.
- Measure command latency and reconnect thresholds on real worship setups.

## Next engineering slice

Finish packaging/diagnostics, then continue Phase 2 Holyrics deep integration against real Holyrics instances before widening to Resolume and ProPresenter.
