import { useTranslation } from 'react-i18next';
import { LiveControlPanel } from './LiveControlPanel';
import { LiveNodeSetup } from './LiveNodeSetup';
import { OfflineRunOfShow } from './OfflineRunOfShow';
import { VisualControlPanel } from './VisualControlPanel';
import type { useLiveNode } from './useLiveNode';

type Controller = ReturnType<typeof useLiveNode>;

export function LocalRecoveryView({
  controller
}: {
  controller: Controller;
}) {
  const { t, i18n } = useTranslation();
  const connected = controller.state === 'connected' && Boolean(controller.credential);
  const plan = controller.nodeState?.state.servicePlan || null;
  const providerLinks = controller.nodeState?.state.providerLinks || [];
  const actorId = controller.credential
    ? `local-device:${controller.credential.binding.deviceId}`
    : 'local-device:unpaired';
  const liveSessionId =
    controller.nodeState?.state.activeLiveSessionId ||
    (plan ? `service-plan:${plan.id}` : 'local-recovery');

  return (
    <div className="local-recovery-shell">
      <header className="local-recovery-topbar">
        <div>
          <div className="brand-kicker">MUSICSCALE / LIVE</div>
          <strong>{t('localRecovery.mode')}</strong>
        </div>
        <select
          value={i18n.resolvedLanguage || 'pt'}
          onChange={event => i18n.changeLanguage(event.target.value)}
        >
          <option value="pt">PT</option>
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>
      </header>

      <main className="local-recovery-workspace">
        <section className="local-recovery-hero">
          <div>
            <span className="eyebrow">{t('localRecovery.kicker')}</span>
            <h1>{t('localRecovery.title')}</h1>
            <p>{t('localRecovery.description')}</p>
          </div>
          <div className="offline-badge">{t('localRecovery.noCloudRequired')}</div>
        </section>

        <LiveNodeSetup
          controller={controller}
          localRecovery
        />

        {connected && (
          <>
            <section className="health-grid local-health-grid">
              <article>
                <span className="status ok" />
                <div>
                  <small>{t('node')}</small>
                  <strong>{t('connected')}</strong>
                </div>
              </article>
              <article>
                <span className={`status ${(controller.health?.providersOnline ?? 0) > 0 ? 'ok' : 'warn'}`} />
                <div>
                  <small>{t('providers')}</small>
                  <strong>{controller.health ? `${controller.health.providersOnline}/${controller.health.providers}` : '0/0'}</strong>
                </div>
              </article>
              <article>
                <span className={`status ${plan ? 'ok' : 'warn'}`} />
                <div>
                  <small>{t('localRecovery.plan')}</small>
                  <strong>{plan ? t('localRecovery.cached') : t('pending')}</strong>
                </div>
              </article>
            </section>

            {plan ? (
              <OfflineRunOfShow
                controller={controller}
                plan={plan}
                providerLinks={providerLinks}
                actorId={actorId}
              />
            ) : (
              <section className="local-empty">
                <span className="eyebrow">{t('localRecovery.plan')}</span>
                <h2>{t('localRecovery.noPlanTitle')}</h2>
                <p>{t('localRecovery.noPlanDescription')}</p>
              </section>
            )}

            <LiveControlPanel
              controller={controller}
              actorId={actorId}
              liveSessionId={liveSessionId}
            />
            <VisualControlPanel
              controller={controller}
              actorId={actorId}
              liveSessionId={liveSessionId}
            />
          </>
        )}
      </main>
    </div>
  );
}
