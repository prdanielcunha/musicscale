import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommandResult } from '@musicscale-live/domain';
import type { useLiveNode } from './useLiveNode';

type Controller = ReturnType<typeof useLiveNode>;

interface VisualClip {
  id: string;
  name: string;
  connected: boolean;
}

interface VisualLayer {
  id: string;
  name: string;
  clips: VisualClip[];
}

function parameterValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>).value;
  }
  return value;
}

function normalizeComposition(value: unknown): VisualLayer[] {
  if (!value || typeof value !== 'object') return [];
  const composition = value as Record<string, unknown>;
  const layers = Array.isArray(composition.layers) ? composition.layers : [];

  return layers
    .filter(layer => layer && typeof layer === 'object')
    .map(layerValue => {
      const layer = layerValue as Record<string, unknown>;
      const clips = Array.isArray(layer.clips) ? layer.clips : [];
      return {
        id: String(layer.id || ''),
        name: String(parameterValue(layer.name) || layer.name || 'Layer'),
        clips: clips
          .filter(clip => clip && typeof clip === 'object')
          .map(clipValue => {
            const clip = clipValue as Record<string, unknown>;
            return {
              id: String(clip.id || ''),
              name: String(parameterValue(clip.name) || clip.name || 'Clip'),
              connected: Boolean(parameterValue(clip.connected))
            };
          })
          .filter(clip => clip.id)
      };
    })
    .filter(layer => layer.id);
}

function compositionFromResults(results: CommandResult[]): unknown {
  for (const result of results) {
    const composition = result.observedState?.composition;
    if (composition && typeof composition === 'object') return composition;
  }
  return null;
}

export function VisualControlPanel({
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
  const [localComposition, setLocalComposition] = useState<unknown>(null);
  const [clearAllArmed, setClearAllArmed] = useState(false);

  const provider = useMemo(
    () => (controller.nodeState?.providers || []).find(candidate =>
      (candidate.health === 'online' || candidate.health === 'degraded') &&
      candidate.capabilities.includes('visual.composition.read')
    ) || null,
    [controller.nodeState]
  );

  const observedComposition =
    provider?.observed?.composition && typeof provider.observed.composition === 'object'
      ? provider.observed.composition
      : null;
  const layers = normalizeComposition(localComposition || observedComposition);

  if (!provider) return null;

  async function execute(
    key: string,
    capability: 'visual.composition.read' | 'visual.clip.trigger' | 'visual.layer.clear' | 'visual.composition.clear',
    payload: Record<string, unknown> = {},
    guarded = false
  ) {
    setBusy(key);
    try {
      const results = await controller.executeCommand({
        capability,
        payload,
        targetProviderIds: [provider.providerId],
        liveSessionId,
        actorId,
        safetyLevel: guarded ? 'guarded' : 'normal'
      });
      const composition = compositionFromResults(results);
      if (composition) setLocalComposition(composition);
      return results;
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    await execute('refresh', 'visual.composition.read');
  }

  async function triggerClip(clipId: string) {
    await execute(`clip:${clipId}`, 'visual.clip.trigger', { clipId });
    window.setTimeout(() => void refresh(), 120);
  }

  async function clearLayer(layerId: string) {
    await execute(`layer:${layerId}`, 'visual.layer.clear', { layerId });
    window.setTimeout(() => void refresh(), 120);
  }

  async function clearAll() {
    if (!clearAllArmed) {
      setClearAllArmed(true);
      window.setTimeout(() => setClearAllArmed(false), 4000);
      return;
    }
    setClearAllArmed(false);
    await execute('clear-all', 'visual.composition.clear', {}, true);
    window.setTimeout(() => void refresh(), 120);
  }

  return (
    <section className="visual-control-panel">
      <div className="visual-control-head">
        <div>
          <span className="eyebrow">{t('visualControls.kicker')}</span>
          <h2>{t('visualControls.title')}</h2>
          <p>{t('visualControls.description')}</p>
        </div>
        <div className="visual-control-actions">
          <button
            className="secondary"
            disabled={busy !== null}
            onClick={() => void refresh()}
          >
            {busy === 'refresh' ? '…' : t('visualControls.refresh')}
          </button>
          <button
            className={clearAllArmed ? 'danger-armed' : 'secondary'}
            disabled={busy !== null}
            onClick={() => void clearAll()}
          >
            {clearAllArmed ? t('visualControls.confirmClearAll') : t('visualControls.clearAll')}
          </button>
        </div>
      </div>

      {layers.length ? (
        <div className="visual-layer-list">
          {layers.map(layer => (
            <article key={layer.id} className="visual-layer">
              <header>
                <strong>{layer.name}</strong>
                <button
                  disabled={busy !== null}
                  onClick={() => void clearLayer(layer.id)}
                >
                  {t('visualControls.clearLayer')}
                </button>
              </header>
              <div className="visual-clip-grid">
                {layer.clips.map(clip => (
                  <button
                    key={clip.id}
                    className={clip.connected ? 'active' : ''}
                    disabled={busy !== null}
                    onClick={() => void triggerClip(clip.id)}
                    title={clip.id}
                  >
                    <span>{clip.name}</span>
                    <small>{clip.connected ? t('visualControls.live') : t('visualControls.ready')}</small>
                  </button>
                ))}
                {!layer.clips.length && (
                  <small className="visual-empty">{t('visualControls.noClips')}</small>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="visual-empty-state">
          <p>{t('visualControls.loadHint')}</p>
          <button className="primary" disabled={busy !== null} onClick={() => void refresh()}>
            {t('visualControls.loadComposition')}
          </button>
        </div>
      )}
    </section>
  );
}
