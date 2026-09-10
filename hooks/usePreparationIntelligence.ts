import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { HomeEventSummary } from '../utils/homeExperience';
import {
  buildPreparationView,
  createPreparationSnapshot,
  getPersonalPreparationEvents,
  type EventPreparationView,
  type StoredPreparationState,
} from '../utils/preparationIntelligence';
import {
  acknowledgePreparationChanges,
  ensurePreparationBaseline,
  listPreparationStates,
  markPreparationReady,
} from '../services/preparationStateService';
import { logger } from '../lib/logger';

interface PreparationIntelligenceResult {
  views: EventPreparationView[];
  viewsByEventId: Map<string, EventPreparationView>;
  isLoading: boolean;
  busyScaleId: string | null;
  acknowledgeChanges: (event: HomeEventSummary) => Promise<void>;
  markPrepared: (event: HomeEventSummary) => Promise<void>;
}

export function usePreparationIntelligence(
  events: HomeEventSummary[]
): PreparationIntelligenceResult {
  const { user, effectiveOrganizationId } = useAuth();
  const userId = user?.uid;
  const organizationId = effectiveOrganizationId;

  const personalEvents = useMemo(
    () => getPersonalPreparationEvents(events, Date.now()),
    [events]
  );

  const eventScopeKey = useMemo(
    () => personalEvents
      .map(event => createPreparationSnapshot(event).fingerprint)
      .join('|'),
    [personalEvents]
  );

  const [states, setStates] = useState<Map<string, StoredPreparationState>>(
    () => new Map()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [busyScaleId, setBusyScaleId] = useState<string | null>(null);
  const requestGeneration = useRef(0);

  useEffect(() => {
    const generation = ++requestGeneration.current;

    if (!userId || !organizationId || personalEvents.length === 0) {
      setStates(new Map());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    void listPreparationStates(userId, organizationId)
      .then(async loadedStates => {
        if (requestGeneration.current !== generation) return;

        const next = new Map(
          loadedStates.map(state => [state.scaleId, state])
        );

        const missingBaselines = personalEvents
          .filter(event => !next.has(event.id))
          .map(event => {
            const snapshot = createPreparationSnapshot(event);
            const optimistic: StoredPreparationState = {
              organizationId,
              scaleId: event.id,
              acknowledgedFingerprint: snapshot.fingerprint,
              acknowledgedSnapshot: snapshot,
              preparedFingerprint: null,
              acknowledgedAtMs: Date.now(),
              preparedAtMs: null,
            };
            next.set(event.id, optimistic);
            return { event, snapshot };
          });

        if (requestGeneration.current !== generation) return;
        setStates(new Map(next));

        await Promise.allSettled(
          missingBaselines.map(({ snapshot }) =>
            ensurePreparationBaseline(userId, organizationId, snapshot)
          )
        );
      })
      .catch(error => {
        if (requestGeneration.current !== generation) return;
        logger.warn('[PreparationIntelligence] Failed to load preparation state.', error);
        setStates(new Map());
      })
      .finally(() => {
        if (requestGeneration.current === generation) {
          setIsLoading(false);
        }
      });

    return () => {
      if (requestGeneration.current === generation) {
        requestGeneration.current += 1;
      }
    };
  }, [userId, organizationId, eventScopeKey]);

  const views = useMemo(
    () => personalEvents.map(event =>
      buildPreparationView(event, states.get(event.id))
    ),
    [personalEvents, states]
  );

  const viewsByEventId = useMemo(
    () => new Map(views.map(view => [view.event.id, view])),
    [views]
  );

  const acknowledgeChanges = useCallback(async (event: HomeEventSummary) => {
    if (!userId || !organizationId || busyScaleId) return;

    const snapshot = createPreparationSnapshot(event);
    const previous = states.get(event.id);

    setBusyScaleId(event.id);
    try {
      await acknowledgePreparationChanges(
        userId,
        organizationId,
        snapshot
      );

      setStates(current => {
        const next = new Map(current);
        next.set(event.id, {
          organizationId,
          scaleId: event.id,
          acknowledgedFingerprint: snapshot.fingerprint,
          acknowledgedSnapshot: snapshot,
          preparedFingerprint: previous?.preparedFingerprint ?? null,
          acknowledgedAtMs: Date.now(),
          preparedAtMs: previous?.preparedAtMs ?? null,
        });
        return next;
      });
    } finally {
      setBusyScaleId(null);
    }
  }, [userId, organizationId, busyScaleId, states]);

  const markPrepared = useCallback(async (event: HomeEventSummary) => {
    if (!userId || !organizationId || busyScaleId) return;

    const snapshot = createPreparationSnapshot(event);

    setBusyScaleId(event.id);
    try {
      await markPreparationReady(
        userId,
        organizationId,
        snapshot
      );

      setStates(current => {
        const next = new Map(current);
        next.set(event.id, {
          organizationId,
          scaleId: event.id,
          acknowledgedFingerprint: snapshot.fingerprint,
          acknowledgedSnapshot: snapshot,
          preparedFingerprint: snapshot.fingerprint,
          acknowledgedAtMs: Date.now(),
          preparedAtMs: Date.now(),
        });
        return next;
      });
    } finally {
      setBusyScaleId(null);
    }
  }, [userId, organizationId, busyScaleId]);

  return {
    views,
    viewsByEventId,
    isLoading,
    busyScaleId,
    acknowledgeChanges,
    markPrepared,
  };
}
