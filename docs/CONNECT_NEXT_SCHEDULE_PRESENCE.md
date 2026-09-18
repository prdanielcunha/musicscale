# Connect → MusicScale: Next Schedule Presence Read

`GET /api/v1/connect/next-schedule/presence` is a read-only, own-data boundary.

MusicScale independently revalidates the Firebase bearer and organization, requires `scales.read` plus the member's own-response capability, resolves the next schedule actually assigned to that user, and then queries only response records whose `userId` is the authenticated user.

The response status is one of:

- `pending`
- `accepted`
- `maybe`
- `declined`
- `mixed` when legacy/inconsistent assignment responses disagree

No other member's response is returned. Missing responses are represented as `pending` instead of being inferred as accepted/declined. The endpoint is PII-minimal, returns a downstream audit id, and includes the canonical scale deep link.
