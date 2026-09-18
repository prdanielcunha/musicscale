import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { useLiveNode } from './useLiveNode';

type LiveNodeController = ReturnType<typeof useLiveNode>;

export function LiveNodeSetup({
  controller,
  organizationId
}: {
  controller: LiveNodeController;
  organizationId: string;
}) {
  const { t } = useTranslation();
  const [nodeUrl, setNodeUrl] = useState(
    controller.credential?.baseUrl ||
    (window.location.port === '4317' ? window.location.origin : 'http://127.0.0.1:4317')
  );
  const [pin, setPin] = useState('');

  const scope = useMemo(() => ({
    organizationId,
    venueId: `bootstrap-venue:${organizationId}`,
    liveSystemId: `bootstrap-system:${organizationId}`
  }), [organizationId]);

  const connected = controller.state === 'connected';

  return (
    <section className="node-setup">
      <div className="node-setup-copy">
        <span className="eyebrow">{t('nodeSetup.kicker')}</span>
        <h2>{t('nodeSetup.title')}</h2>
        <p>{t('nodeSetup.description')}</p>
      </div>

      <div className="node-setup-card">
        {connected && controller.credential ? (
          <>
            <div className="node-connected-row">
              <span className="status ok" />
              <div>
                <strong>{controller.health?.hostname || t('nodeSetup.connected')}</strong>
                <small>{controller.health?.nodeId} · v{controller.health?.version}</small>
              </div>
              <button className="secondary" onClick={controller.disconnect}>
                {t('nodeSetup.disconnect')}
              </button>
            </div>
            <div className="node-meta-grid">
              <div><small>{t('nodeSetup.address')}</small><strong>{controller.credential.baseUrl}</strong></div>
              <div><small>{t('nodeSetup.providers')}</small><strong>{controller.health ? `${controller.health.providersOnline}/${controller.health.providers}` : '0/0'}</strong></div>
              <div><small>{t('nodeSetup.transport')}</small><strong>{controller.credential.transportKind === 'local-console' ? 'Local Console' : 'Direct LAN'}</strong></div>
            </div>
          </>
        ) : controller.pending ? (
          <>
            <div className="pairing-head">
              <div>
                <small>{t('nodeSetup.pairing')}</small>
                <strong>{t('nodeSetup.enterPin')}</strong>
              </div>
              <code>{controller.pending.baseUrl}</code>
            </div>
            <p className="node-hint">{t('nodeSetup.pinHint')}</p>
            <div className="pairing-form">
              <input
                className="pin-input"
                value={pin}
                onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                aria-label={t('nodeSetup.pin')}
              />
              <button
                className="primary"
                disabled={pin.length !== 6}
                onClick={() => controller.finishPairing(pin)}
              >
                {t('nodeSetup.confirm')}
              </button>
            </div>
            {controller.errorCode && <p className="node-error">{t(`nodeErrors.${controller.errorCode}`, { defaultValue: controller.errorCode })}</p>}
          </>
        ) : (
          <>
            <label className="node-field">
              <span>{t('nodeSetup.nodeAddress')}</span>
              <input
                value={nodeUrl}
                onChange={event => setNodeUrl(event.target.value)}
                placeholder="http://192.168.1.20:4317"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>
            <p className="node-hint">{t('nodeSetup.addressHint')}</p>
            <div className="node-actions">
              <button
                className="primary"
                disabled={!organizationId || controller.state === 'probing'}
                onClick={() => controller.beginPairing(nodeUrl, scope)}
              >
                {controller.state === 'probing' ? t('nodeSetup.probing') : t('nodeSetup.pair')}
              </button>
              <span>{t('nodeSetup.noCloudSecret')}</span>
            </div>
            {controller.errorCode && <p className="node-error">{t(`nodeErrors.${controller.errorCode}`, controller.errorCode)}</p>}
          </>
        )}
      </div>
    </section>
  );
}
