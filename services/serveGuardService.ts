export interface ServeGuardPreference {
  schemaVersion: 1;
  organizationId: string;
  userId: string;
  maxServicesPerWeek: number | null;
  maxServicesPerMonth: number | null;
  unavailableDates: string[];
  pausedUntil: string | null;
  updatedAtMs?: number | null;
  updatedBy?: string | null;
}

export interface ServeGuardEvaluation {
  organizationId: string;
  userId: string;
  candidateDate: string;
  advisoryOnly: true;
  requiresExplicitOverride: boolean;
  primarySignal:
    | 'preference_not_configured'
    | 'clear'
    | 'at_weekly_limit'
    | 'at_monthly_limit'
    | 'over_weekly_limit'
    | 'over_monthly_limit'
    | 'unavailable'
    | 'paused';
  signals: string[];
  scheduledLoad: {
    week: {
      current: number;
      projected: number;
      limit: number | null;
    };
    month: {
      current: number;
      projected: number;
      limit: number | null;
    };
  };
  availability: {
    unavailableOnCandidateDate: boolean;
    pausedOnCandidateDate: boolean;
    pausedUntil: string | null;
  };
}

type TokenUser = {
  getIdToken(forceRefresh?: boolean): Promise<string>;
};

const REQUEST_TIMEOUT_MS = 8000;

async function requestJson<T>(
  user: TokenUser,
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<T> {
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.success !== true) {
      const error = new Error(
        payload?.code ||
          payload?.reasonCode ||
          payload?.error ||
          'SERVEGUARD_REQUEST_FAILED',
      );
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }

    return payload as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getServeGuardPreference(
  user: TokenUser,
  organizationId: string,
  userId: string,
): Promise<ServeGuardPreference | null> {
  const payload = await requestJson<{
    success: true;
    preference: ServeGuardPreference | null;
  }>(
    user,
    `/api/v1/organizations/${encodeURIComponent(
      organizationId,
    )}/serve-guard/preferences/${encodeURIComponent(userId)}`,
  );

  return payload.preference ?? null;
}

export async function saveServeGuardPreference(
  user: TokenUser,
  organizationId: string,
  userId: string,
  preference: {
    maxServicesPerWeek: number | null;
    maxServicesPerMonth: number | null;
    unavailableDates: string[];
    pausedUntil: string | null;
  },
): Promise<ServeGuardPreference> {
  const payload = await requestJson<{
    success: true;
    preference: ServeGuardPreference;
  }>(
    user,
    `/api/v1/organizations/${encodeURIComponent(
      organizationId,
    )}/serve-guard/preferences/${encodeURIComponent(userId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(preference),
    },
  );

  return payload.preference;
}

export async function evaluateServeGuard(
  user: TokenUser,
  organizationId: string,
  input: {
    userId: string;
    candidateDate: string;
    excludeScaleId?: string | null;
  },
): Promise<ServeGuardEvaluation> {
  const payload = await requestJson<{
    success: true;
    evaluation: ServeGuardEvaluation;
  }>(
    user,
    `/api/v1/organizations/${encodeURIComponent(
      organizationId,
    )}/serve-guard/evaluate`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );

  return payload.evaluation;
}
