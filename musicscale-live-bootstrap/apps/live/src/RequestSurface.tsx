import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RequestKind } from '@musicscale-live/domain';
import type { useLiveNode } from './useLiveNode';

type Controller = ReturnType<typeof useLiveNode>;

const PASTOR_KINDS: RequestKind[] = ['bible', 'message', 'media'];
const CONDUCTOR_KINDS: RequestKind[] = ['section', 'message'];

export function RequestSurface({
  controller,
  actorId,
  liveSessionId,
  mode
}: {
  controller: Controller;
  actorId: string;
  liveSessionId: string;
  mode: 'pastor' | 'conductor';
}) {
  const { t } = useTranslation();
  const kinds = mode === 'pastor' ? PASTOR_KINDS : CONDUCTOR_KINDS;
  const [kind, setKind] = useState<RequestKind>(kinds[0]!);
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const ownRequests = useMemo(
    () => (controller.nodeState?.state.requests || [])
      .filter(request =>
        request.liveSessionId === liveSessionId &&
        request.actorId === actorId
      )
      .slice(0, 8),
    [actorId, controller.nodeState, liveSessionId]
  );

  async function submit() {
    const text = value.trim();
    if (!text || sending) return;
    setSending(true);
    setSent(false);
    try {
      const payload =
        kind === 'bible' ? { reference: text } :
        kind === 'section' ? { section: text } :
        kind === 'media' ? { query: text } :
        { text };

      await controller.submitRequest({
        liveSessionId,
        actorId,
        kind,
        payload
      });
      setValue('');
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="request-surface">
      <div className="request-surface-head">
        <div>
          <span className="eyebrow">{t(`requestsSurface.${mode}.kicker`)}</span>
          <h2>{t(`requestsSurface.${mode}.title`)}</h2>
          <p>{t(`requestsSurface.${mode}.description`)}</p>
        </div>
        <div className="request-safe-pill">
          <span />
          <strong>{t('requestsSurface.safeFlow')}</strong>
          <small>{t('requestsSurface.safeFlowHint')}</small>
        </div>
      </div>

      <div className="request-compose">
        <div className="request-kind-tabs">
          {kinds.map(item => (
            <button
              key={item}
              className={kind === item ? 'active' : ''}
              onClick={() => setKind(item)}
            >
              {t(`requestsSurface.kinds.${item}`)}
            </button>
          ))}
        </div>
        <div className="request-input-row">
          <input
            value={value}
            onChange={event => setValue(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') void submit();
            }}
            placeholder={t(`requestsSurface.placeholders.${kind}`)}
          />
          <button
            className="primary"
            disabled={!value.trim() || sending}
            onClick={() => void submit()}
          >
            {sending ? '…' : t('requestsSurface.send')}
          </button>
        </div>
        {sent && <p className="request-sent">{t('requestsSurface.sent')}</p>}
      </div>

      <div className="request-history">
        <div className="request-history-head">
          <strong>{t('requestsSurface.myRequests')}</strong>
          <small>{t('requestsSurface.operatorDecides')}</small>
        </div>
        {ownRequests.length ? ownRequests.map(request => {
          const label =
            request.kind === 'bible' ? request.payload.reference :
            request.kind === 'section' ? request.payload.section :
            request.kind === 'media' ? request.payload.query :
            request.payload.text;
          return (
            <article key={request.id} className={`request-history-item status-${request.status}`}>
              <div>
                <small>{t(`requestsSurface.kinds.${request.kind}`)}</small>
                <strong>{String(label || '')}</strong>
              </div>
              <span>{t(`requestsSurface.status.${request.status}`)}</span>
            </article>
          );
        }) : (
          <p className="muted">{t('requestsSurface.empty')}</p>
        )}
      </div>
    </section>
  );
}
