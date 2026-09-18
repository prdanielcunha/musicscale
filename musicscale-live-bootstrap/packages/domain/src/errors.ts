export const LIVE_ERROR_CODES = [
  'invalid_command',
  'invalid_capability',
  'invalid_targets',
  'invalid_origin',
  'invalid_safety_level',
  'unauthorized',
  'forbidden',
  'node_not_paired',
  'provider_offline',
  'provider_timeout',
  'provider_permission_denied',
  'capability_not_supported',
  'no_provider_for_capability',
  'state_diverged',
  'route_unavailable',
  'output_unavailable',
  'content_missing',
  'network_unavailable',
  'cloud_unavailable',
  'idempotency_conflict',
  'guarded_action_confirmation_required',
  'critical_action_blocked',
  'internal_error'
] as const;

export type LiveErrorCode = (typeof LIVE_ERROR_CODES)[number];

export interface LiveError {
  code: LiveErrorCode;
  message: string;
  recoverable: boolean;
  providerInstanceId?: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}

export function isLiveErrorCode(value: unknown): value is LiveErrorCode {
  return typeof value === 'string' &&
    (LIVE_ERROR_CODES as readonly string[]).includes(value);
}
