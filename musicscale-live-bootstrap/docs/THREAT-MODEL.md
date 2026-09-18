# Threat Model — Phase 0 baseline

## Assets
Identity, organization context, live-control authority, provider credentials, media files, local network endpoints and audit history.

## Main threats and controls

| Threat | Baseline control |
| --- | --- |
| Cross-tenant access | Every cloud entity carries organizationId; shared identity is resolved before data access. |
| Unauthorized LAN command | Node command endpoint fails closed without a paired bearer credential. |
| Replay/duplicate command | idempotencyKey + bounded idempotency cache. |
| Provider credential leak | Provider secrets remain on Node; never browser/Firestore logs. |
| UI offering unsupported action | Capability Engine gates actions from provider-declared capabilities. |
| Cloud outage | Local session + local Node path; provider remains manually operable. |
| Compromised/foreign Node | Pairing is venue-bound and revocable; mutual identity is required in Phase 1. |
| Destructive live action | safetyLevel plus guarded/critical policy before execution. |
| Malicious file | Live Drop quarantine/type/size/path validation is mandatory before Phase 4. |
| Automation runaway | explicit enablement, timeout, retry limits, dry-run and audit before Phase 7. |

## Phase 1 security work
- signed Node identity;
- pairing QR/PIN with expiring challenge;
- encrypted/authenticated transport;
- revocation;
- rate limiting;
- structured audit and redaction tests.
