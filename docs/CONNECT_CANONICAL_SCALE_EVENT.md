# MusicScale → MillionsNest Connect: official scale publish event

## Scope, authority, and defaults

Source: server.ts POST /api/v1/music-scales/:musicScaleId/publish after the authorized MusicScaleCommandService.publishMusicScale transaction has succeeded. MusicScale's own participant/member notifications, RBAC, receipts, and published status are untouched. The producer sends only a scoped, opaque operator-event reference, not a member-facing or commercial message.

Configuration required (server-managed, OFF by default):
- MUSICSCALE_CONNECT_SCALE_PUBLISHED_EVENTS_ENABLED=true
- MUSICSCALE_CONNECT_SOURCE_EVENT_SECRET: separate source-specific HMAC key (at least 32 characters), equal to Connect CONNECT_AUTOMATION_SOURCE_KEYS_JSON.musicscale, distinct from worker and other app keys
- MUSICSCALE_CONNECT_OPERATOR_TARGETS_JSON: approved JSON dictionary keyed by actual MusicScale organization ID, each value exactly {conversationId,recipientUid} for an existing canonical Connect thread and currently authorized Inbox operator. Never derive from request headers, user phone, arbitrary web input or musicians' identities.
- Connect internal alert queue storage/TTL/security proofs remain required. Do not turn on broad automation or Web Push.

## Protocol

The publisher rereads the persisted scale. It checks organizationId, published status, exact committed publishRevision and persisted Firestore updatedAt in the seven-day acceptance window. It never uses an unverified scale or stale revision. The opaque event ID is SHA256 of app, organization, scale ID and revision; the event timestamp is the stable persisted updatedAt so replay is idempotent.

Send exact sourceApp=musicscale, trigger=scale.published, eventId, organizationId, conversationId, occurredAt, recipientUid and schemaVersion=1 to pinned https://connect.millionsnest.com/api/core/automations/events/musicscale. Sign source + newline + millisecond timestamp + newline + exact raw body with HMAC-SHA256. Refuse redirects, timeout after 2.5 seconds; only HTTP 202 with accepted:true and boolean duplicate confirms enqueue. No retries on ambiguous outcome; no Meta send, private member content, phone, or billing mutations.

## Not finished

The source key/target mapping and positive real-account signed end-to-end acceptance are not configured or proven. A post-commit network outage can still lose a domain event: a MusicScale-side durable transactional outbox or official change-feed/worker is needed for guaranteed replay. The Connect WhatsApp inbound outbox does NOT recover MusicScale domain events. Existing MusicScale member notifications are authoritative and must not be duplicated.

This is a permitted Connect Inbox operator review event, not member reminders/presence fanout, Meta templates or an unattended three-app agent. For those features the official Tool Gateway must prove authenticated member/organization, opt-in, opt-out, window, recipient authority and billing approval; do not infer these from a phone.

## Tests

Run npm run test:connect-scale-events (flag-off, config failure, canonical tenant/revision, stable HMAC/idempotency, minimal payload, no transport retries). Included in npm run test:scale-release. CI is not evidence of real Meta/iPhone delivery. Keep flag OFF until signed real acceptance and permissions are proven.

## Official pending-presence operator trigger

When the canonical publish transaction creates at least one new response (`createdResponseCount > 0`), the same server-only guarded producer emits an additional event `scale.presence_pending` with a separate stable SHA-256 eventId. The published event ID and behavior remain unchanged. This is **one internal review alert** tied to the organization/revision, not per-member notifications, not a reminder, not a new member response, and never a WhatsApp send. A later presence change with no canonical new-response publisher is NOT covered by this trigger; direct follow-up/reminder events still need their own source mutation and consent/window/Tool Gateway contract. HMAC mapping and event flag remain OFF without explicit verified config. Both events are post-commit best effort and remain subject to a future durable domain outbox.
