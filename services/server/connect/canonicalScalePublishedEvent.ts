import { createHash, createHmac } from 'node:crypto';

const CONNECT_EVENT_URL = 'https://connect.millionsnest.com/api/core/automations/events/musicscale';

export type MusicScalePublishedSnapshot = {
  organizationId: string;
  status: string;
  publishRevision: number;
  updatedAt: Date;
};
type InternalOperatorTarget = { conversationId: string; recipientUid: string };
export type ConnectScalePublisherOptions = {
  enabled: boolean;
  organizationId: string;
  musicScaleId: string;
  publishRevision: number;
  /** `scale.presence_pending` is emitted only for newly created official pending responses. */
  trigger?: 'scale.published' | 'scale.presence_pending';
  signingSecret?: string;
  targetsJson?: string;
  loadCanonicalScale: () => Promise<MusicScalePublishedSnapshot | null>;
  fetchImpl?: typeof fetch;
  now?: () => number;
};
export type ConnectScalePublishOutcome =
  | 'disabled' | 'not_configured' | 'stale_revision' | 'accepted' | 'duplicate';

/**
 * Narrow, server-only source event publisher. This does NOT notify MusicScale
 * members or invoke Meta. Connect independently verifies the destination is
 * an existing tenant-scoped Inbox conversation and a current Inbox operator.
 *
 * The MusicScale canonical publish transaction and its own member
 * notifications remain unchanged. No arbitrary browser-selected recipient is
 * trusted. Failures are reported to the caller; they must NEVER roll back
 * the already committed scale or start an unbounded network retry.
 */
export async function publishCanonicalScaleEventToConnect(
  options: ConnectScalePublisherOptions,
): Promise<ConnectScalePublishOutcome> {
  if (!options.enabled) return 'disabled';
  const safe = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0 && value.length <= 180
    && value.trim() === value && !/[\\/\u0000-\u001f\u007f]/.test(value);
  if (!safe(options.organizationId) || !safe(options.musicScaleId) ||
      !Number.isSafeInteger(options.publishRevision) || options.publishRevision < 1 ||
      options.publishRevision > 1000000000) throw new Error('CONNECT_SCALE_EVENT_INVALID_CANONICAL_INPUT');
  if (typeof options.signingSecret !== 'string' || options.signingSecret.length < 32 ||
      options.signingSecret.length > 4096) return 'not_configured';
  if (typeof options.targetsJson !== 'string' || options.targetsJson.length > 16000) return 'not_configured';

  let target: InternalOperatorTarget | undefined;
  try {
    const parsed: unknown = JSON.parse(options.targetsJson);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return 'not_configured';
    const targets = parsed as Record<string, unknown>;
    const entries = Object.entries(targets);
    if (entries.length > 100 || entries.some(([key, item]) => {
      if (!safe(key) || !item || Array.isArray(item) || typeof item !== 'object') return true;
      const record = item as Record<string, unknown>;
      return Object.keys(record).length !== 2 ||
        !Object.keys(record).every(k => ['conversationId', 'recipientUid'].includes(k)) ||
        !safe(record.conversationId) || !safe(record.recipientUid);
    })) return 'not_configured';
    target = targets[options.organizationId] as InternalOperatorTarget | undefined;
  } catch { return 'not_configured'; }
  if (!target) return 'not_configured';

  // Read AFTER MusicScale's authorized, idempotent publication transaction.
  // The persisted timestamp is immutable across replay of that revision.
  const actual = await options.loadCanonicalScale();
  if (!actual || actual.organizationId !== options.organizationId ||
      actual.status !== 'published' || actual.publishRevision !== options.publishRevision ||
      !(actual.updatedAt instanceof Date) || !Number.isFinite(+actual.updatedAt)) return 'stale_revision';

  const now = (options.now ?? Date.now)();
  if (!Number.isSafeInteger(now) || now < 0 ||
      +actual.updatedAt > now + 30000 || +actual.updatedAt < now - 7 * 86400000) return 'stale_revision';

  const trigger = options.trigger ?? 'scale.published';
  if (!['scale.published', 'scale.presence_pending'].includes(trigger)) throw new Error('CONNECT_SCALE_EVENT_TRIGGER_INVALID');
  const eventId = createHash('sha256').update(JSON.stringify([
    'musicscale', options.organizationId, options.musicScaleId, options.publishRevision,
    ...(trigger === 'scale.published' ? [] : [trigger]),
  ])).digest('hex');
  const raw = JSON.stringify({
    schemaVersion: 1,
    sourceApp: 'musicscale',
    eventId,
    organizationId: options.organizationId,
    conversationId: target.conversationId,
    occurredAt: actual.updatedAt.toISOString(),
    trigger,
    recipientUid: target.recipientUid,
  });
  const timestamp = String(now);
  const signature = createHmac('sha256', options.signingSecret)
    .update('musicscale\n' + timestamp + '\n' + raw).digest('hex');

  // Never auto-retry an ambiguous response. If the upstream atomic commit
  // succeeded before a timeout, its event idempotency key remains stable.
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(CONNECT_EVENT_URL, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
      headers: {
        'Content-Type': 'application/json',
        'x-connect-timestamp': timestamp,
        'x-connect-signature': signature,
      },
      body: raw,
    });
  } catch {
    throw new Error('CONNECT_SCALE_EVENT_TRANSPORT_UNCERTAIN');
  }
  if (response.status !== 202) throw new Error('CONNECT_SCALE_EVENT_NOT_ACCEPTED');
  let reply: unknown;
  try { reply = await response.json(); } catch { throw new Error('CONNECT_SCALE_EVENT_RESPONSE_INVALID'); }
  const value = reply as { accepted?: unknown; duplicate?: unknown } | null;
  if (!value || value.accepted !== true || typeof value.duplicate !== 'boolean') throw new Error('CONNECT_SCALE_EVENT_RESPONSE_INVALID');
  return value.duplicate ? 'duplicate' : 'accepted';
}
