import { useEffect, useMemo, useState } from 'react';
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

interface VisualOutput {
  id: string;
  name: string;
}

interface ArmedVisualCue {
  clipId: string;
  clipName: string;
  layerId: string;
  layerName: string;
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

function outputsFromResults(results: CommandResult[]): VisualOutput[] {
  const raw = results
    .flatMap(result => {
      const outputs = result.observedState?.outputs;
      return Array.isArray(outputs) ? outputs : [];
    })
    .filter(output => output && typeof output === 'object') as Array<Record<string, unknown>>;

  return raw
    .map(output => ({
      id: String(output.id || output.monitor_id || ''),
      name: String(parameterValue(output.name) || output.display_name || output.id || 'Output')
    }))
    .filter(output => output.id);
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
  const [outputs, setOutputs] = useState<VisualOutput[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState('');
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [armedClip, setArmedClip] = useState<ArmedVisualCue | null>(null);
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
  const activeClips = useMemo(
    () => layers.flatMap(layer =>
      layer.clips
        .filter(clip => clip.connected)
        .map(clip => ({
          clipId: clip.id,
          clipName: clip.name,
          layerId: layer.id,
          layerName: layer.name
        }))
    ),
    [layers]
  );

  useEffect(() => {
    return () => {
      if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    };
  }, [snapshotUrl]);

  if (!provider) return null;
  const activeProvider = provider;

  async function execute(
    key: string,
    capability:
      | 'visual.composition.read'
      | 'visual.clip.trigger'
      | 'visual.layer.clear'
      | 'visual.composition.clear'
      | 'visual.outputs.read',
    payload: Record<string, unknown> = {},
    guarded = false
  ) {
    setBusy(key);
    try {
      const results = await controller.executeCommand({
        capability,
        payload,
        targetProviderIds: [activeProvider.providerId],
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
    const results = await execute(`clip:${clipId}`, 'visual.clip.trigger', { clipId });
    window.setTimeout(() => void refresh(), 120);
    if (selectedOutputId) {
      window.setTimeout(() => void refreshSnapshot(), 320);
    }
    return results;
  }

  async function takeArmedClip() {
    if (!armedClip) return;
    const results = await triggerClip(armedClip.clipId);
    if (results?.some(result => result.accepted)) {
      setArmedClip(null);
    }
  }

  async function clearLayer(layerId: string) {
    await execute(`layer:${layerId}`, 'visual.layer.clear', { layerId });
    window.setTimeout(() => void refresh(), 120);
  }

  async function loadOutputs() {
    if (!activeProvider.capabilities.includes('visual.outputs.read')) return;
    const results = await execute('outputs', 'visual.outputs.read');
    const next = outputsFromResults(results || []);
    setOutputs(next);
    if (!selectedOutputId && next[0]) setSelectedOutputId(next[0].id);
  }

  async function refreshSnapshot() {
    const targetId = selectedOutputId || outputs[0]?.id;
    if (!targetId || !activeProvider.capabilities.includes('visual.output.snapshot')) return;
    setBusy('snapshot');
    try {
      const blob = await controller.fetchOutputSnapshot(
        activeProvider.providerId,
        targetId,
        'jpeg'
      );
      const nextUrl = URL.createObjectURL(blob);
      setSnapshotUrl(current => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
    } finally {
      setBusy(null);
    }
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



      <div className="visual-now-next" aria-label={t('visualControls.nowNext')}>
        <section className="visual-cue visual-cue-live">
          <header>
            <span className="deck-live-dot" />
            <div>
              <strong>{t('visualControls.current')}</strong>
              <small>{t('visualControls.program')}</small>
            </div>
          </header>
          <div className="visual-cue-body">
            {snapshotUrl ? (
              <img src={snapshotUrl} alt={t('visualControls.outputSnapshotAlt')} />
            ) : activeClips.length ? (
              <div className="visual-current-list">
                {activeClips.slice(0, 4).map(clip => (
                  <div key={clip.clipId}>
                    <small>{clip.layerName}</small>
                    <strong>{clip.clipName}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="visual-cue-empty">
                <span>{t('visualControls.nothingLive')}</span>
              </div>
            )}
          </div>
        </section>

        <div className="deck-flow" aria-hidden="true"><span>→</span></div>

        <section className="visual-cue visual-cue-next">
          <header>
            <div>
              <strong>{t('visualControls.next')}</strong>
              <small>{t('visualControls.preview')}</small>
            </div>
          </header>
          <div className="visual-cue-body">
            {armedClip ? (
              <div className="visual-armed-cue">
                <small>{armedClip.layerName}</small>
                <strong>{armedClip.clipName}</strong>
                <span>{t('visualControls.armed')}</span>
              </div>
            ) : (
              <div className="visual-cue-empty">
                <span>{t('visualControls.chooseClip')}</span>
              </div>
            )}
          </div>
          <footer>
            <button
              className="deck-take"
              disabled={!armedClip || busy !== null}
              onClick={() => void takeArmedClip()}
            >
              {busy?.startsWith('clip:') ? '…' : t('visualControls.take')} →
            </button>
          </footer>
        </section>
      </div>

      {activeProvider.capabilities.includes('visual.outputs.read') && (
        <div className="visual-output-strip">
          <div className="visual-output-copy">
            <small>{t('visualControls.outputPreview')}</small>
            <strong>{t('visualControls.outputPreviewDescription')}</strong>
          </div>
          <div className="visual-output-actions">
            <select
              value={selectedOutputId}
              onChange={event => setSelectedOutputId(event.target.value)}
              aria-label={t('visualControls.output')}
            >
              <option value="">{t('visualControls.chooseOutput')}</option>
              {outputs.map(output => (
                <option key={output.id} value={output.id}>{output.name}</option>
              ))}
            </select>
            <button
              className="secondary"
              disabled={busy !== null}
              onClick={() => void loadOutputs()}
            >
              {t('visualControls.outputs')}
            </button>
            <button
              className="primary"
              disabled={
                busy !== null ||
                !selectedOutputId ||
                !activeProvider.capabilities.includes('visual.output.snapshot')
              }
              onClick={() => void refreshSnapshot()}
            >
              {busy === 'snapshot' ? '…' : t('visualControls.snapshot')}
            </button>
          </div>
          {snapshotUrl && (
            <div className="visual-output-preview">
              <img src={snapshotUrl} alt={t('visualControls.outputSnapshotAlt')} />
            </div>
          )}
        </div>
      )}

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
                    className={[
                      clip.connected ? 'active' : '',
                      armedClip?.clipId === clip.id ? 'armed' : ''
                    ].filter(Boolean).join(' ')}
                    disabled={busy !== null}
                    onClick={() => setArmedClip({
                      clipId: clip.id,
                      clipName: clip.name,
                      layerId: layer.id,
                      layerName: layer.name
                    })}
                    title={clip.id}
                  >
                    <span>{clip.name}</span>
                    <small>
                      {armedClip?.clipId === clip.id
                        ? t('visualControls.next')
                        : clip.connected
                          ? t('visualControls.live')
                          : t('visualControls.ready')}
                    </small>
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
