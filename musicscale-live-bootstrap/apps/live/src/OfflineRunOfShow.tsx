import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProviderLink, ServicePlan } from '@musicscale-live/domain';
import type { useLiveNode } from './useLiveNode';

type Controller = ReturnType<typeof useLiveNode>;

export function OfflineRunOfShow({
  controller,
  plan,
  providerLinks,
  actorId
}: {
  controller: Controller;
  plan: ServicePlan;
  providerLinks: ProviderLink[];
  actorId: string;
}) {
  const { t } = useTranslation();
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const linksById = useMemo(
    () => new Map(providerLinks.map(link => [link.id, link])),
    [providerLinks]
  );

  async function present(itemId: string, providerLinkId?: string) {
    if (!providerLinkId) return;
    const link = linksById.get(providerLinkId);
    if (!link) return;

    setBusyItemId(itemId);
    try {
      await controller.executeCommand({
        capability: 'songs.present',
        payload: { id: link.externalId },
        targetProviderIds: [link.providerInstanceId],
        liveSessionId: controller.nodeState?.state.activeLiveSessionId || `service-plan:${plan.id}`,
        actorId
      });
    } finally {
      setBusyItemId(null);
    }
  }

  return (
    <section className="offline-run">
      <div className="offline-run-head">
        <div>
          <span className="eyebrow">{t('offlineRun.kicker')}</span>
          <h2>{plan.title}</h2>
          <p>{t('offlineRun.description')}</p>
        </div>
        <span className="offline-badge">{t('offlineRun.cached')}</span>
      </div>

      <div className="offline-items">
        {plan.items.map((item, index) => {
          const link = item.providerLinkId ? linksById.get(item.providerLinkId) : undefined;
          return (
            <button
              key={item.id}
              disabled={item.type !== 'song' || !link || busyItemId !== null}
              onClick={() => void present(item.id, item.providerLinkId)}
            >
              <b>{String(index + 1).padStart(2, '0')}</b>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {String(item.payload?.artist || '')}
                  {item.payload?.key ? ` · ${item.payload.key}` : ''}
                </small>
              </span>
              <em>{link ? t('offlineRun.ready') : t('offlineRun.notLinked')}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}
