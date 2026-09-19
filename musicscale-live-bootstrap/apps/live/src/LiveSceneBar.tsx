import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Scene } from '@musicscale-live/domain';
import type { useLiveNode } from './useLiveNode';

type Controller = ReturnType<typeof useLiveNode>;

export function LiveSceneBar({
  controller,
  actorId,
  liveSessionId
}: {
  controller: Controller;
  actorId: string;
  liveSessionId: string;
}) {
  const { t } = useTranslation();
  const scenes = controller.nodeState?.state.scenes || [];
  const [armed, setArmed] = useState<Scene | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!scenes.length || !controller.credential) return null;

  async function take() {
    if (!armed || busy) return;
    const guarded = armed.actions.some(
      action => action.safetyLevel === 'guarded' || action.safetyLevel === 'critical'
    );

    setBusy(true);
    setMessage(null);
    try {
      const result = await controller.executeScene({
        scene: armed,
        liveSessionId,
        actorId,
        confirmed: guarded
      });

      if (result.status === 'completed') {
        setMessage(t('liveScenes.completed', { name: armed.name }));
        setArmed(null);
      } else if (result.status === 'partial') {
        setMessage(t('liveScenes.partial', { name: armed.name }));
      } else {
        setMessage(t('liveScenes.failed', { name: armed.name }));
      }
    } catch (error) {
      setMessage(t('liveScenes.failedCode', {
        code: error instanceof Error ? error.message : 'unknown'
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="live-scenes">
      <div className="live-scenes-head">
        <div>
          <span className="eyebrow">{t('liveScenes.kicker')}</span>
          <strong>{t('liveScenes.title')}</strong>
        </div>
        {armed && (
          <button className="scene-take" disabled={busy} onClick={() => void take()}>
            {busy ? '…' : `${t('liveScenes.take')} · ${armed.name}`}
          </button>
        )}
      </div>

      <div className="live-scenes-row">
        {scenes.map(scene => (
          <button
            key={scene.id}
            className={armed?.id === scene.id ? 'armed' : ''}
            onClick={() => {
              setArmed(current => current?.id === scene.id ? null : scene);
              setMessage(null);
            }}
          >
            <strong>{scene.name}</strong>
            <small>{scene.actions.length} {t('liveScenes.actions')}</small>
          </button>
        ))}
      </div>
      {message && <p className="live-scenes-message">{message}</p>}
    </section>
  );
}
