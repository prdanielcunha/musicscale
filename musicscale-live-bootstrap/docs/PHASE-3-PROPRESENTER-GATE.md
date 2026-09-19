# Phase 3 — ProPresenter Provider Gate

## Implemented in code

### Provider boundary
- Dedicated `@musicscale-live/adapter-propresenter`.
- Local/private-network HTTP endpoint only.
- The setup requires the exact Network API address shown by ProPresenter; MusicScale Live does not guess a port.
- ProPresenter endpoint names and response shapes remain inside the adapter.
- The Live UI continues to speak only in neutral capabilities.

### Verified API contract used by the adapter
- `GET /version` for probe/product/API information.
- `GET /v1/status/slide` for lightweight current/next slide state.
- `GET /v1/presentation/slide_index` for the actual active cue index and presentation identity.
- `GET /v1/presentation/current` only for richer explicit previews.
- `GET /v1/trigger/next` and `GET /v1/trigger/previous`.
- `GET /v1/trigger/cue/{index}` for deterministic cue selection.
- `GET /v1/clear/layer/slide`.
- `PUT /v1/stage/message` and `DELETE /v1/stage/message`.
- `GET /v1/macro/{id}/trigger` for neutral automation triggers.

### Live UX integration
No ProPresenter-specific operator screen was added.

When ProPresenter is the routed presentation provider, the same invariant applies:

`NOW (left) → NEXT (right) → TAKE`

The adapter normalizes ProPresenter state into the same presentation model used by Holyrics. This is intentional proof that provider differences belong in adapters, not in the operator workflow.

### Multiple presentation providers
If Holyrics and ProPresenter are both connected:
- the Node does not broadcast a presentation command to both;
- a single compatible provider is auto-routed;
- two or more compatible providers require an explicit primary route;
- the local Node console exposes **Who controls what**;
- the Live UI warns before TAKE when presentation routing is ambiguous.

## Real-hardware verification still required

- ProPresenter with Network enabled on current supported Windows release.
- ProPresenter with Network enabled on current supported macOS release.
- Node and ProPresenter on the same computer.
- Node and ProPresenter on separate computers on the same LAN.
- Current/next text accuracy across song, Bible/text and mixed playlists.
- Cue index accuracy when skipping/reordering cues.
- Preview image behavior on large presentations.
- Clear-slide behavior with media/props/messages on other layers.
- Stage message show/hide.
- Macro trigger behavior.
- Internet-cut test while the LAN remains available.
- Latency measurement for previous/next/TAKE and recovery after ProPresenter restarts.

## Exit gate

Phase 3 is production-ready only after the hardware matrix above passes without changing the provider-neutral Live operator model.
