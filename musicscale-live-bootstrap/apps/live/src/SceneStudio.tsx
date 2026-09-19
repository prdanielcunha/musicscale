import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Capability, Scene, SceneAction } from '@musicscale-live/domain';
import type { useLiveNode } from './useLiveNode';
import { liveFeatureFlags } from './featureFlags';
import {
  listScenes,
  removeScene,
  saveScene as saveCloudScene
} from './liveCloudRepository';

type Controller = ReturnType<typeof useLiveNode>;
type ScreenMode = 'none' | 'normal' | 'wallpaper' | 'blank' | 'black';

interface VisualClipOption {
  providerId: string;
  layerId: string;
  layerName: string;
  clipId: string;
  clipName: string;
}

function parameterValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>).value;
  }
  return value;
}

function visualClips(controller: Controller): VisualClipOption[] {
  const result: VisualClipOption[] = [];

  for (const provider of controller.nodeState?.providers || []) {
    if (!provider.capabilities.includes('visual.clip.trigger')) continue;
    const raw = provider.observed?.composition;
    if (!raw || typeof raw !== 'object') continue;
    const layers = Array.isArray((raw as Record<string, unknown>).layers)
      ? (raw as Record<string, unknown>).layers as unknown[]
      : [];

    for (const layerValue of layers) {
      if (!layerValue || typeof layerValue !== 'object') continue;
      const layer = layerValue as Record<string, unknown>;
      const layerId = String(layer.id || '');
      const layerName = String(parameterValue(layer.name) || 'Layer');
      const clips = Array.isArray(layer.clips) ? layer.clips : [];
      for (const clipValue of clips) {
        if (!clipValue || typeof clipValue !== 'object') continue;
        const clip = clipValue as Record<string, unknown>;
        const clipId = String(clip.id || '');
        if (!clipId) continue;
        result.push({
          providerId: provider.providerId,
          layerId,
          layerName,
          clipId,
          clipName: String(parameterValue(clip.name) || 'Clip')
        });
      }
    }
  }

  return result;
}

export function SceneStudio({
  controller,
  actorId
}: {
  controller: Controller;
  actorId: string;
}) {
  const { t } = useTranslation();
  const credential = controller.credential;
  const [name, setName] = useState('');
  const [screenMode, setScreenMode] = useState<ScreenMode>('none');
  const [visualKey, setVisualKey] = useState('');
  const [stageText, setStageText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const scenes = controller.nodeState?.state.scenes || [];
  const clips = useMemo(() => visualClips(controller), [controller.nodeState]);
  const capabilities = useMemo(
    () => new Set(
      (controller.nodeState?.providers || [])
        .filter(provider => provider.health === 'online' || provider.health === 'degraded')
        .flatMap(provider => provider.capabilities)
    ),
    [controller.nodeState]
  );

  useEffect(() => {
    if (!credential || !liveFeatureFlags.servicePlanWrites) return;
    let cancelled = false;

    void listScenes(
      credential.binding.organizationId,
      credential.binding.venueId,
      credential.binding.liveSystemId
    ).then(async cloudScenes => {
      if (cancelled || !cloudScenes.length) return;
      const local = controller.nodeState?.state.scenes || [];
      const merged = new Map(local.map(scene => [scene.id, scene]));
      for (const scene of cloudScenes) merged.set(scene.id, scene);
      await controller.cacheScenes([...merged.values()]);
    }).catch(() => {
      // Cloud enrichment is optional; the local Node remains authoritative live.
    });

    return () => {
      cancelled = true;
    };
  }, [
    controller.cacheScenes,
    controller.nodeState?.state.scenes,
    credential
  ]);

  if (!credential) return null;

  const canScreenMode = capabilities.has('presentation.screen.mode');
  const canStage = capabilities.has('stage.message');
  const selectedClip = clips.find(
    clip => `${clip.providerId}:${clip.clipId}` === visualKey
  );

  async function persist(nextScenes: Scene[], scene?: Scene) {
    await controller.cacheScenes(nextScenes);
    if (scene && liveFeatureFlags.servicePlanWrites) {
      try {
        await saveCloudScene(scene, actorId);
      } catch {
        setMessage(t('sceneStudio.cloudPending'));
      }
    }
  }

  async function save() {
    const cleanName = name.trim();
    if (!cleanName || busy) return;

    const actions: SceneAction[] = [];
    if (screenMode !== 'none' && canScreenMode) {
      actions.push({
        id: 'presentation-mode',
        capability: 'presentation.screen.mode',
        targetProviderIds: [],
        outputTargets: ['main'],
        payload: { mode: screenMode },
        safetyLevel: 'normal'
      });
    }
    if (selectedClip) {
      actions.push({
        id: 'visual-clip',
        capability: 'visual.clip.trigger',
        targetProviderIds: [selectedClip.providerId],
        outputTargets: ['main'],
        payload: { clipId: selectedClip.clipId },
        safetyLevel: 'normal'
      });
    }
    if (stageText.trim() && canStage) {
      actions.push({
        id: 'stage-message',
        capability: 'stage.message',
        targetProviderIds: [],
        outputTargets: ['stage'],
        payload: { text: stageText.trim(), show: true },
        safetyLevel: 'normal'
      });
    }

    if (!actions.length) {
      setMessage(t('sceneStudio.actionRequired'));
      return;
    }

    const activeCredential = controller.credential;
    if (!activeCredential) return;

    const scene: Scene = {
      id: crypto.randomUUID(),
      organizationId: activeCredential.binding.organizationId,
      venueId: activeCredential.binding.venueId,
      liveSystemId: activeCredential.binding.liveSystemId,
      name: cleanName,
      actions
    };

    setBusy(true);
    setMessage(null);
    try {
      await persist([...scenes, scene], scene);
      setName('');
      setScreenMode('none');
      setVisualKey('');
      setStageText('');
      setMessage(t('sceneStudio.saved'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(scene: Scene) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await controller.cacheScenes(scenes.filter(item => item.id !== scene.id));
      if (liveFeatureFlags.servicePlanWrites) {
        await removeScene(scene.id).catch(() => {
          setMessage(t('sceneStudio.cloudPending'));
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="scene-studio">
      <div className="scene-studio-head">
        <div>
          <span className="eyebrow">{t('sceneStudio.kicker')}</span>
          <h2>{t('sceneStudio.title')}</h2>
          <p>{t('sceneStudio.description')}</p>
        </div>
        <div className="scene-studio-offline">
          <span />
          <strong>{t('sceneStudio.offline')}</strong>
          <small>{scenes.length} {t('sceneStudio.cached')}</small>
        </div>
      </div>

      <div className="scene-composer">
        <label>
          <span>{t('sceneStudio.name')}</span>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={t('sceneStudio.namePlaceholder')}
          />
        </label>

        {canScreenMode && (
          <label>
            <span>{t('sceneStudio.screen')}</span>
            <select
              value={screenMode}
              onChange={event => setScreenMode(event.target.value as ScreenMode)}
            >
              <option value="none">{t('sceneStudio.noChange')}</option>
              <option value="normal">{t('liveControls.screenModes.normal')}</option>
              <option value="wallpaper">{t('liveControls.screenModes.wallpaper')}</option>
              <option value="blank">{t('liveControls.screenModes.blank')}</option>
              <option value="black">{t('liveControls.screenModes.black')}</option>
            </select>
          </label>
        )}

        {!!clips.length && (
          <label>
            <span>{t('sceneStudio.visual')}</span>
            <select value={visualKey} onChange={event => setVisualKey(event.target.value)}>
              <option value="">{t('sceneStudio.noChange')}</option>
              {clips.map(clip => (
                <option
                  key={`${clip.providerId}:${clip.clipId}`}
                  value={`${clip.providerId}:${clip.clipId}`}
                >
                  {clip.layerName} · {clip.clipName}
                </option>
              ))}
            </select>
          </label>
        )}

        {canStage && (
          <label className="scene-stage-message">
            <span>{t('sceneStudio.stage')}</span>
            <input
              value={stageText}
              onChange={event => setStageText(event.target.value)}
              placeholder={t('sceneStudio.stagePlaceholder')}
            />
          </label>
        )}

        <button className="primary" disabled={busy || !name.trim()} onClick={() => void save()}>
          {busy ? '…' : t('sceneStudio.save')}
        </button>
      </div>

      {message && <p className="scene-studio-message">{message}</p>}

      <div className="scene-library">
        {scenes.length ? scenes.map(scene => (
          <article key={scene.id}>
            <div>
              <strong>{scene.name}</strong>
              <small>
                {scene.actions.map(action =>
                  t(`sceneStudio.capabilities.${action.capability}`, {
                    defaultValue: action.capability
                  })
                ).join(' · ')}
              </small>
            </div>
            <button className="ghost" disabled={busy} onClick={() => void remove(scene)}>
              {t('sceneStudio.remove')}
            </button>
          </article>
        )) : (
          <div className="scene-empty">
            <strong>{t('sceneStudio.emptyTitle')}</strong>
            <span>{t('sceneStudio.emptyDescription')}</span>
          </div>
        )}
      </div>
    </section>
  );
}
