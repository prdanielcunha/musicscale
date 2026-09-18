# Phase 2 — Holyrics Deep Provider Gate

## Implemented in code

### Connection and security
- Hash-authenticated Holyrics HTTP client.
- Access token never appears in request URLs.
- Signed request IDs are serialized and monotonic.
- Token/configuration stays on Live Node.
- Local/LAN Holyrics endpoints are accepted; public-internet endpoints are rejected by local configuration.
- Capability availability is derived from permissions returned by Holyrics.

### Presentation
- Read current presentation state.
- Previous / next / go-to slide.
- Clear current presentation.
- Current + next slide context for the Live operator.
- Neutral screen mode:
  - normal;
  - wallpaper;
  - blank;
  - black.
- Screen-mode implementation is isolated in the Holyrics adapter (F8/F9/F10 never leak into the domain).

### Songs and playlists
- Search songs.
- Present a song.
- Conservative MusicScale ↔ Holyrics song matching.
- Manual disambiguation for unsafe matches.
- Add to playlist.
- Exact playlist synchronization after explicit guarded confirmation.
- Cached ProviderLinks allow the prepared set to keep working without cloud.

### Bible
- Identify/search references.
- Present verses/references.
- Translation/version and quick-presentation parameters supported by the adapter command contract.

### Media
- Search Holyrics audio/video/image libraries.
- Open/play audio and video.
- Present images.
- Metadata-aware media results in the operator UI.

### Stage / communication
- Communication-panel text messages.
- Show/hide controls from the Live operator.

### Reliability
- Provider state is observed in a background loop rather than blocking Node health requests.
- Offline/degraded providers are automatically re-probed.
- Live Node health remains responsive even if Holyrics is offline.
- Command-observed state and provider-observed state are persisted for crash recovery.

## Verification still required on a real Holyrics installation

- Validate API behavior across the minimum supported Holyrics version and latest stable version.
- Verify all requested permissions in a real generated token.
- Validate playlist replacement on:
  - current playlist;
  - worship/event-specific playlist where supported.
- Validate verse quick presentation without unexpectedly ending a song presentation.
- Validate slide comments and custom slide descriptions.
- Validate media playback settings and long-running video behavior.
- Validate communication-panel behavior on confidence/stage screens.
- Validate screen modes against the church's actual display topology.
- Measure navigation latency over:
  - same PC;
  - Holyrics on another PC in the same LAN.
- Physical internet-cut test while Holyrics remains on the LAN.

## Exit gate

Phase 2 can be called production-ready only after the real-hardware matrix above passes without requiring cloud connectivity for the live control path.

After that, the next adapters are Resolume Arena and ProPresenter, reusing the same neutral capabilities, routes, outputs, ServicePlan and ProviderLink contracts.
