import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { useLiveNode } from './useLiveNode';

type Controller = ReturnType<typeof useLiveNode>;

export function LiveRequestInbox({
  controller,
  actorId,
  liveSessionId
}: {
  controller: Controller;
  actorId: string;
  liveSessionId: string;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await controller.refreshState().catch(() => null);
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [controller.refreshState]);

  const requests = useMemo(
    () => (controller.nodeState?.state.requests || [])
      .filter(request =>
        request.liveSessionId === liveSessionId &&
        (request.status === 'pending' || request.status === 'accepted')
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [controller.nodeState, liveSessionId]
  );

  async function setStatus(
    requestId: string,
    status: 'accepted' | 'rejected' | 'completed'
  ) {
    setBusy(requestId);
    try {
      await controller.updateRequestStatus(requestId, status, actorId);
    } finally {
      setBusy(null);
    }
  }

  if (!requests.length) return null;

  return (
    <section className="live-request-inbox">
      <div className="live-request-inbox-head">
        <div>
          <span className="eyebrow">{t('requestInbox.kicker')}</span>
          <h2>{t('requestInbox.title')}</h2>
        </div>
        <span className="request-count">{requests.length}</span>
      </div>
      <div className="live-request-list">
        {requests.map(request => {
          const label =
            request.kind === 'bible' ? request.payload.reference :
            request.kind === 'section' ? request.payload.section :
            request.kind === 'media' ? request.payload.query :
            request.payload.text;
          return (
            <article key={request.id} className={`live-request status-${request.status}`}>
              <div className="live-request-copy">
                <small>{t(`requestsSurface.kinds.${request.kind}`)}</small>
                <strong>{String(label || '')}</strong>
                <span>{request.status === 'accepted'
                  ? t('requestInbox.acceptedHint')
                  : t('requestInbox.pendingHint')}</span>
              </div>
              <div className="live-request-actions">
                {request.status === 'pending' ? (
                  <>
                    <button
                      className="secondary"
                      disabled={busy === request.id}
                      onClick={() => void setStatus(request.id, 'rejected')}
                    >
                      {t('requestInbox.reject')}
                    </button>
                    <button
                      className="primary"
                      disabled={busy === request.id}
                      onClick={() => void setStatus(request.id, 'accepted')}
                    >
                      {busy === request.id ? '…' : t('requestInbox.accept')}
                    </button>
                  </>
                ) : (
                  <button
                    className="primary"
                    disabled={busy === request.id}
                    onClick={() => void setStatus(request.id, 'completed')}
                  >
                    {busy === request.id ? '…' : t('requestInbox.complete')}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
