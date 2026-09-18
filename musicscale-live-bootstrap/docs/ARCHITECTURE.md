# Architecture — Foundation

## Product boundary

MusicScale Live is a sibling product of MusicScale. It shares identity, organization, scales, repertoire, permissions and subscription data, but owns a separate deploy, bundle and runtime.

## Runtime planes

### Cloud / shared data
- Firebase Auth: same MillionsNest identity.
- Firestore: same canonical users, organizations, scales and songs.
- Live-specific entities are namespaced by organization and venue and will be protected by dedicated rules.
- Cloud is for sync, remote access, configuration and analytics; it is not a hard dependency during a live service.

### Live Engine
Neutral domain objects:
- Venue
- LiveSystem
- LiveNode
- ProviderInstance
- CapabilitySet
- OutputTarget
- Route
- LiveProfile
- ServicePlan / ServiceItem
- LiveSession / LiveEvent
- ProviderLink
- Scene / AutomationRule
- Request / MediaAsset

### Live Node
One local service per production computer. It owns:
- provider adapters;
- local discovery;
- device access;
- cache;
- health;
- authenticated local transport;
- idempotency and reconnect state.

## Transport broker

A cloud-hosted HTTPS PWA cannot assume that every browser may freely call an insecure private-LAN HTTP endpoint. Therefore the transport is abstracted from day one:

1. **direct-lan**: browser-to-Node when the browser/platform grants Local Network Access and policy allows it;
2. **local-console**: Node serves the same operational shell locally as a same-origin fallback, keeping operation alive without cloud;
3. **cloud-relay**: remote-control path, disabled by default and policy-gated.

No UI component is allowed to bind directly to a raw IP/port. UI asks the Transport Broker for a session.

## Provider contract

Brand-specific behavior remains behind adapters. The domain only sees capabilities and observed state. No `if provider === "holyrics"` is permitted outside an adapter package.

## Data compatibility

The initial MusicScale bridge is deliberately read-only:
- `users/{uid}`
- `organizations/{organizationId}`
- `scales` filtered by `organizationId`
- `songs` filtered by `organizationId`

The Live domain gets its own IDs. External provider IDs only live inside ProviderLink records.

## Security baseline

- browser never receives provider secrets;
- command endpoint fails closed until Node pairing/auth is configured;
- command envelope contains actor, origin, capability, targets, idempotency key and safety level;
- Node logs use correlation IDs and must redact secrets;
- remote control is off by default.
