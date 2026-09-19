import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProviderRouteGroup } from '@musicscale-live/domain';
import type { useLiveNode } from './useLiveNode';

type Controller = ReturnType<typeof useLiveNode>;

const ROUTE_GROUPS: ProviderRouteGroup[] = [
  'presentation',
  'songs',
  'bible',
  'media',
  'stage',
  'visual',
  'audio',
  'automation'
];

function groupForCapability(capability: string): ProviderRouteGroup {
  if (capability.startsWith('presentation.') || capability === 'preview.snapshot') {
    return 'presentation';
  }
  if (capability.startsWith('songs.') || capability.startsWith('playlist.')) return 'songs';
  if (capability.startsWith('bible.')) return 'bible';
  if (capability.startsWith('media.')) return 'media';
  if (capability.startsWith('stage.')) return 'stage';
  if (capability.startsWith('visual.')) return 'visual';
  if (capability.startsWith('audio.')) return 'audio';
  return 'automation';
}

export function SystemTopologyPanel({
  controller
}: {
  controller: Controller;
}) {
  const { t } = useTranslation();
  const providers = controller.nodeState?.providers || [];
  const routing = controller.nodeState?.routing || {};

  const providerGroups = useMemo(
    () => providers.map(provider => ({
      ...provider,
      groups: [...new Set(provider.capabilities.map(groupForCapability))]
    })),
    [providers]
  );

  const routeRows = useMemo(
    () => ROUTE_GROUPS.map(group => {
      const candidates = providerGroups.filter(provider =>
        provider.groups.includes(group)
      );
      const routedId = routing[group] || null;
      const routed = routedId
        ? providerGroups.find(provider => provider.providerId === routedId) || null
        : candidates.length === 1
          ? candidates[0]
          : null;

      return {
        group,
        candidates,
        routed,
        ambiguous: candidates.length > 1 && !routedId
      };
    }).filter(row => row.candidates.length > 0),
    [providerGroups, routing]
  );

  const ambiguousCount = routeRows.filter(row => row.ambiguous).length;

  return (
    <section className="system-topology">
      <div className="system-topology-head">
        <div>
          <span className="eyebrow">{t('topology.kicker')}</span>
          <h2>{t('topology.title')}</h2>
          <p>{t('topology.description')}</p>
        </div>
        <div className={`topology-readiness ${ambiguousCount ? 'warn' : 'ok'}`}>
          <span />
          <div>
            <small>{t('topology.readiness')}</small>
            <strong>
              {ambiguousCount
                ? t('topology.needsRouting', { count: ambiguousCount })
                : t('topology.ready')}
            </strong>
          </div>
        </div>
      </div>

      <div className="topology-map">
        <article className="topology-node-card">
          <small>LOCAL ENGINE</small>
          <strong>MusicScale Live Node</strong>
          <span>{controller.health?.hostname || controller.nodeState?.nodeId || '—'}</span>
          <em>{t('topology.localControl')}</em>
        </article>

        <div className="topology-rail" aria-hidden="true"><span /></div>

        <div className="topology-providers">
          {providerGroups.map(provider => (
            <article
              key={provider.providerId}
              className={`topology-provider ${provider.health}`}
            >
              <div className="topology-provider-title">
                <span className="status-dot" />
                <div>
                  <strong>{provider.displayName || provider.providerId}</strong>
                  <small>{provider.health}</small>
                </div>
              </div>
              <div className="topology-provider-groups">
                {provider.groups.map(group => (
                  <span key={group}>{t(`topology.groups.${group}`)}</span>
                ))}
              </div>
            </article>
          ))}
          {!providerGroups.length && (
            <div className="topology-empty">{t('topology.noProviders')}</div>
          )}
        </div>
      </div>

      {!!routeRows.length && (
        <div className="topology-routes">
          <div className="topology-routes-head">
            <strong>{t('topology.routes')}</strong>
            <small>{t('topology.routesHint')}</small>
          </div>
          <div className="topology-route-grid">
            {routeRows.map(row => (
              <div
                key={row.group}
                className={`topology-route ${row.ambiguous ? 'ambiguous' : ''}`}
              >
                <span>{t(`topology.groups.${row.group}`)}</span>
                <b>→</b>
                <strong>
                  {row.routed
                    ? row.routed.displayName || row.routed.providerId
                    : t('topology.choosePrimary')}
                </strong>
                {row.candidates.length > 1 && (
                  <small>
                    {row.ambiguous
                      ? t('topology.multipleCandidates', { count: row.candidates.length })
                      : t('topology.explicitRoute')}
                  </small>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
