import type { PerformanceRecoveryState } from '../services/offline/database';

export interface PerformanceRecoveryContext {
  organizationId: string;
  songId: string;
  scaleId?: string;
}

function normalizeOptionalId(value?: string): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Recovery data is local device state, but it still has to obey tenant and
 * performance-context boundaries. Legacy records without organizationId are
 * intentionally treated as non-restorable instead of being attributed to the
 * currently selected tenant.
 */
export function isPerformanceRecoveryStateForContext(
  state: PerformanceRecoveryState | null | undefined,
  context: PerformanceRecoveryContext,
): state is PerformanceRecoveryState {
  if (!state || !context.organizationId || !context.songId) return false;

  return (
    state.organizationId === context.organizationId &&
    state.songId === context.songId &&
    normalizeOptionalId(state.scaleId) === normalizeOptionalId(context.scaleId)
  );
}

export function getSafeRecoveryScrollPosition(
  state: PerformanceRecoveryState | null | undefined,
  context: PerformanceRecoveryContext,
): number {
  if (!isPerformanceRecoveryStateForContext(state, context)) return 0;

  const position = state.scrollPosition;
  return typeof position === 'number' && Number.isFinite(position) && position > 0
    ? position
    : 0;
}
