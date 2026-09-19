import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Capability, CommandResult } from '@musicscale-live/domain';
import type { useLiveNode } from './useLiveNode';
import { useLiveCueCoordinator } from './LiveCueCoordinator';
import { useLiveOperatorShortcuts } from './useLiveOperatorShortcuts';

type Controller = ReturnType<typeof useLiveNode>;
type ToolMode = 'song' | 'bible' | 'media' | 'stage';

interface SearchSongResult {
  id: string;
  title: string;
  artist?: string;
  key?: string;
  bpm?: number;
}

interface SearchMediaResult {
  name: string;
  isDir?: boolean;
  durationMs?: number;
  width?: number;
  height?: number;
}

interface PreparedProgramCue {
  id: string;
  kind: 'song' | 'bible' | 'media';
  title: string;
  subtitle?: string;
  capability: 'songs.present' | 'bible.present' | 'media.open';
  payload: Record<string, unknown>;
  targetProviderIds?: string[];
  serviceItemId?: string;
}

function getSongResults(results: CommandResult[]): SearchSongResult[] {
  const raw = results
    .flatMap(result => {
      const value = result.observedState?.results;
      return Array.isArray(value) ? value : [];
    })
    .filter(value => value && typeof value === 'object') as Array<Record<string, unknown>>;

  return raw
    .map(value => ({
      id: String(value.id || ''),
      title: String(value.title || ''),
      artist: value.artist ? String(value.artist) : undefined,
      key: value.key ? String(value.key) : undefined,
      bpm: typeof value.bpm === 'number' ? value.bpm : undefined
    }))
    .filter(value => value.id && value.title)
    .slice(0, 12);
}

function getPresentationFromResults(results: CommandResult[]): Record<string, unknown> | null {
  for (const result of results) {
    const value = result.observedState?.currentPresentation;
    if (value && typeof value === 'object') {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

function slidePreviewUrl(slide: Record<string, unknown> | undefined): string | null {
  const preview = slide?.preview;
  if (typeof preview !== 'string' || !preview.trim()) return null;
  const value = preview.trim();
  if (value.startsWith('data:image/')) return value;
  const mime = value.startsWith('iVBOR')
    ? 'image/png'
    : value.startsWith('/9j/')
      ? 'image/jpeg'
      : 'image/jpeg';
  return `data:${mime};base64,${value}`;
}

function samePresentationFrame(
  left: Record<string, unknown> | null,
  right: Record<string, unknown> | null
): boolean {
  if (!left || !right) return false;
  return (
    String(left.id || '') === String(right.id || '') &&
    Number(left.slide_number) === Number(right.slide_number)
  );
}

function getMediaResults(results: CommandResult[]): SearchMediaResult[] {
  return results
    .flatMap(result => {
      const value = result.observedState?.results;
      return Array.isArray(value) ? value : [];
    })
    .filter(value => value && typeof value === 'object')
    .map(value => {
      const item = value as Record<string, unknown>;
      return {
        name: String(item.name || ''),
        isDir: Boolean(item.isDir),
        durationMs: typeof item.duration_ms === 'number' ? item.duration_ms : undefined,
        width: typeof item.width === 'number' ? item.width : undefined,
        height: typeof item.height === 'number' ? item.height : undefined
      };
    })
    .filter(item => item.name)
    .slice(0, 18);
}

export function LiveControlPanel({
  controller,
  actorId,
  liveSessionId
}: {
  controller: Controller;
  actorId: string;
  liveSessionId: string;
}) {
  const { t } = useTranslation();
  const cueCoordinator = useLiveCueCoordinator();
  const [songQuery, setSongQuery] = useState('');
  const [songResults, setSongResults] = useState<SearchSongResult[]>([]);
  const [bibleReference, setBibleReference] = useState('');
  const [mediaKind, setMediaKind] = useState<'video' | 'image' | 'audio'>('video');
  const [mediaQuery, setMediaQuery] = useState('');
  const [mediaResults, setMediaResults] = useState<SearchMediaResult[]>([]);
  const [stageText, setStageText] = useState('');
  const [toolMode, setToolMode] = useState<ToolMode>('song');
  const [preparedCue, setPreparedCue] = useState<PreparedProgramCue | null>(null);
  const [previewPresentation, setPreviewPresentation] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [clearArmed, setClearArmed] = useState(false);
  const clearTimer = useRef<number | null>(null);
  const previewRequestSignature = useRef<string>('');

  const providers = controller.nodeState?.providers || [];
  const servicePlan = controller.nodeState?.state.servicePlan || null;
  const providerLinks = controller.nodeState?.state.providerLinks || [];
  const activeServiceItemId = controller.nodeState?.state.activeServiceItemId || null;
  const capabilitySet = useMemo(
    () => new Set(
      providers
        .filter(provider => provider.health === 'online' || provider.health === 'degraded')
        .flatMap(provider => provider.capabilities)
    ),
    [providers]
  );

  const serviceHorizon = useMemo(() => {
    if (!servicePlan?.items.length) {
      return {
        current: null,
        next: null,
        activeIndex: -1
      };
    }

    const activeIndex = activeServiceItemId
      ? servicePlan.items.findIndex(item => item.id === activeServiceItemId)
      : servicePlan.items.findIndex(item => item.state === 'live');

    const current = activeIndex >= 0 ? servicePlan.items[activeIndex] : null;
    const next =
      servicePlan.items[activeIndex >= 0 ? activeIndex + 1 : 0] ||
      null;

    return { current, next, activeIndex };
  }, [activeServiceItemId, servicePlan]);

  const currentPresentation = useMemo(() => {
    for (const provider of providers) {
      const candidate = provider.observed?.currentPresentation;
      if (candidate && typeof candidate === 'object') {
        return candidate as Record<string, unknown>;
      }
    }
    return null;
  }, [providers]);

  const can = (capability: Capability) => capabilitySet.has(capability);
  const canPreviewSnapshot = capabilitySet.has('preview.snapshot');
  const toolAvailability = useMemo<Record<ToolMode, boolean>>(() => ({
    song: capabilitySet.has('songs.search') || capabilitySet.has('songs.present'),
    bible: capabilitySet.has('bible.present'),
    media: capabilitySet.has('media.search') || capabilitySet.has('media.open'),
    stage: capabilitySet.has('stage.message')
  }), [capabilitySet]);

  useEffect(() => {
    if (toolAvailability[toolMode]) return;
    const fallback = (['song', 'bible', 'media', 'stage'] as ToolMode[])
      .find(mode => toolAvailability[mode]);
    if (fallback) setToolMode(fallback);
  }, [toolAvailability, toolMode]);

  useEffect(() => {
    if (!canPreviewSnapshot || !currentPresentation) return;

    const signature = `${String(currentPresentation.id || '')}:${String(currentPresentation.slide_number || '')}`;
    if (!signature || previewRequestSignature.current === signature) return;
    previewRequestSignature.current = signature;

    let cancelled = false;
    void controller.executeCommand({
      capability: 'preview.snapshot',
      payload: { previewSize: '640x360' },
      liveSessionId,
      actorId,
      safetyLevel: 'normal'
    }).then(results => {
      if (cancelled) return;
      const presentation = getPresentationFromResults(results);
      if (presentation) setPreviewPresentation(presentation);
    }).catch(() => {
      if (!cancelled) previewRequestSignature.current = '';
    });

    return () => {
      cancelled = true;
    };
  }, [
    actorId,
    canPreviewSnapshot,
    controller,
    currentPresentation,
    liveSessionId
  ]);

  // Automatically hydrate the operator deck with image previews only when the
  // presentation frame changes. Background health polling stays lightweight.
  async function run(
    key: string,
    capability: Capability,
    payload: Record<string, unknown>,
    safetyLevel: 'normal' | 'guarded' = 'normal',
    serviceItemId?: string
  ): Promise<CommandResult[]> {
    setBusy(key);
    setMessage(null);
    try {
      const results = await controller.executeCommand({
        capability,
        payload,
        liveSessionId,
        serviceItemId,
        actorId,
        safetyLevel
      });
      const rejected = results.find(result => !result.accepted);
      if (rejected) {
        setMessage(t('liveControls.commandFailed', {
          code: rejected.errorCode || 'provider_error'
        }));
      }
      return results;
    } catch (error) {
      setMessage(t('liveControls.commandFailed', {
        code: error instanceof Error ? error.message : 'unknown'
      }));
      return [];
    } finally {
      setBusy(null);
    }
  }

  async function setScreenMode(mode: 'normal' | 'wallpaper' | 'blank' | 'black') {
    if (!can('presentation.screen.mode')) return;
    await run(`screen-mode:${mode}`, 'presentation.screen.mode', { mode });
  }

  async function refreshPresentationPreview() {
    if (!can('presentation.preview')) return;
    const results = await run('presentation-preview', 'presentation.preview', {});
    setPreviewPresentation(getPresentationFromResults(results));
  }

  async function navigatePresentation(action: 'next' | 'previous') {
    if (!can('presentation.navigation')) return;

    const armedVisual = cueCoordinator?.armedVisualCue || null;
    const credential = controller.credential;

    if (action === 'next' && armedVisual && credential) {
      setBusy('next');
      setMessage(null);
      try {
        const sceneId = crypto.randomUUID();
        const result = await controller.executeScene({
          liveSessionId,
          actorId,
          scene: {
            id: sceneId,
            organizationId: credential.binding.organizationId,
            venueId: credential.binding.venueId,
            liveSystemId: credential.binding.liveSystemId,
            name: 'Linked Take',
            actions: [
              {
                id: 'presentation-next',
                capability: 'presentation.navigation',
                targetProviderIds: [],
                outputTargets: ['main'],
                payload: { action: 'next' },
                safetyLevel: 'normal'
              },
              {
                id: 'visual-take',
                capability: 'visual.clip.trigger',
                targetProviderIds: [armedVisual.providerId],
                outputTargets: ['main'],
                payload: { clipId: armedVisual.clipId },
                safetyLevel: 'normal'
              }
            ]
          }
        });

        const presentationResults = result.actions
          .find(item => item.actionId === 'presentation-next')
          ?.results || [];
        const presentation = getPresentationFromResults(presentationResults);
        if (presentation) setPreviewPresentation(presentation);

        const visualAccepted = result.actions
          .find(item => item.actionId === 'visual-take')
          ?.results.some(item => item.accepted);
        if (visualAccepted) cueCoordinator?.clearVisualCue();

        if (result.status !== 'completed') {
          setMessage(t('liveControls.linkedTakePartial'));
        }
      } catch (error) {
        setMessage(t('liveControls.commandFailed', {
          code: error instanceof Error ? error.message : 'unknown'
        }));
      } finally {
        setBusy(null);
      }
      return;
    }

    const results = await run(action, 'presentation.navigation', { action });
    const presentation = getPresentationFromResults(results);
    if (presentation) setPreviewPresentation(presentation);
  }

  function prepareServiceItem() {
    const item = serviceHorizon.next;
    if (!item || item.type !== 'song' || !item.providerLinkId) return;
    const link = providerLinks.find(candidate => candidate.id === item.providerLinkId);
    if (!link) return;

    setPreparedCue({
      id: `service-item:${item.id}`,
      kind: 'song',
      title: item.title,
      subtitle: t('liveControls.fromRunOfShow'),
      capability: 'songs.present',
      payload: { id: link.externalId },
      targetProviderIds: [link.providerInstanceId],
      serviceItemId: item.id
    });
  }

  async function searchSongs() {
    const query = songQuery.trim();
    if (!query || !can('songs.search')) return;
    const results = await run('song-search', 'songs.search', { text: query });
    setSongResults(getSongResults(results));
  }

  function prepareSong(song: SearchSongResult) {
    if (!can('songs.present')) return;
    setPreparedCue({
      id: `song:${song.id}`,
      kind: 'song',
      title: song.title,
      subtitle: [song.artist, song.key, song.bpm ? `${song.bpm} BPM` : '']
        .filter(Boolean)
        .join(' · '),
      capability: 'songs.present',
      payload: { id: song.id }
    });
  }

  function prepareBible() {
    const reference = bibleReference.trim();
    if (!reference || !can('bible.present')) return;
    setPreparedCue({
      id: `bible:${reference}`,
      kind: 'bible',
      title: reference,
      subtitle: t('liveControls.bible'),
      capability: 'bible.present',
      payload: { references: reference }
    });
  }

  async function searchMedia() {
    if (!can('media.search')) return;
    const results = await run('media-search', 'media.search', {
      kind: mediaKind,
      filter: mediaQuery.trim(),
      includeMetadata: true,
      includeThumbnail: false
    });
    setMediaResults(getMediaResults(results));
  }

  function prepareMedia(item: SearchMediaResult) {
    if (item.isDir || !can('media.open')) return;
    const detail =
      item.width && item.height
        ? `${item.width}×${item.height}`
        : item.durationMs
          ? `${Math.round(item.durationMs / 1000)}s`
          : t(`liveControls.mediaKinds.${mediaKind}`);

    setPreparedCue({
      id: `media:${mediaKind}:${item.name}`,
      kind: 'media',
      title: item.name,
      subtitle: detail,
      capability: 'media.open',
      payload: {
        kind: mediaKind,
        file: item.name
      }
    });
  }

  async function takePreparedCue() {
    if (!preparedCue) return;

    const armedVisual = cueCoordinator?.armedVisualCue || null;
    const credential = controller.credential;

    if (armedVisual && credential) {
      setBusy('prepared-take');
      setMessage(null);
      try {
        const result = await controller.executeScene({
          liveSessionId,
          serviceItemId: preparedCue.serviceItemId,
          actorId,
          scene: {
            id: crypto.randomUUID(),
            organizationId: credential.binding.organizationId,
            venueId: credential.binding.venueId,
            liveSystemId: credential.binding.liveSystemId,
            name: `Prepared Take · ${preparedCue.title}`,
            actions: [
              {
                id: 'program-take',
                capability: preparedCue.capability,
                targetProviderIds: preparedCue.targetProviderIds || [],
                outputTargets: ['main'],
                payload: preparedCue.payload,
                safetyLevel: 'normal'
              },
              {
                id: 'visual-take',
                capability: 'visual.clip.trigger',
                targetProviderIds: [armedVisual.providerId],
                outputTargets: ['main'],
                payload: { clipId: armedVisual.clipId },
                safetyLevel: 'normal'
              }
            ]
          }
        });

        const programAccepted = result.actions
          .find(action => action.actionId === 'program-take')
          ?.results.some(item => item.accepted);
        const visualAccepted = result.actions
          .find(action => action.actionId === 'visual-take')
          ?.results.some(item => item.accepted);

        if (programAccepted) setPreparedCue(null);
        if (visualAccepted) cueCoordinator?.clearVisualCue();
        if (result.status !== 'completed') {
          setMessage(t('liveControls.linkedTakePartial'));
        }
      } catch (error) {
        setMessage(t('liveControls.commandFailed', {
          code: error instanceof Error ? error.message : 'unknown'
        }));
      } finally {
        setBusy(null);
      }
      return;
    }

    const results = await run(
      'prepared-take',
      preparedCue.capability,
      preparedCue.payload,
      'normal',
      preparedCue.serviceItemId
    );
    if (results.some(result => result.accepted)) {
      setPreparedCue(null);
    }
  }

  async function takePrimaryNext() {
    if (preparedCue) {
      await takePreparedCue();
      return;
    }
    await navigatePresentation('next');
  }

  async function showStageMessage() {
    const text = stageText.trim();
    if (!text || !can('stage.message')) return;
    await run('stage-message', 'stage.message', {
      text,
      show: true,
      displayAhead: true
    });
  }

  async function hideStageMessage() {
    if (!can('stage.message')) return;
    await run('stage-message-hide', 'stage.message', {
      text: stageText.trim(),
      show: false,
      displayAhead: true
    });
  }

  function requestClear() {
    if (!clearArmed) {
      setClearArmed(true);
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
      clearTimer.current = window.setTimeout(() => setClearArmed(false), 4000);
      return;
    }
    setClearArmed(false);
    void run('clear', 'presentation.clear', {}, 'guarded');
  }

  const effectivePresentation =
    samePresentationFrame(previewPresentation, currentPresentation)
      ? previewPresentation
      : currentPresentation;
  const slideNumber = Number(effectivePresentation?.slide_number);
  const totalSlides = Number(effectivePresentation?.total_slides);
  const presentationName =
    String(effectivePresentation?.name || effectivePresentation?.title || '') ||
    t('liveControls.noPresentation');
  const slides = Array.isArray(effectivePresentation?.slides)
    ? effectivePresentation.slides as Array<Record<string, unknown>>
    : [];
  const currentSlide = Number.isFinite(slideNumber) && slideNumber > 0
    ? slides[slideNumber - 1]
    : undefined;
  const nextSlide = Number.isFinite(slideNumber) && slideNumber > 0
    ? slides[slideNumber]
    : undefined;
  const currentSlideText = currentSlide?.text ? String(currentSlide.text) : '';
  const nextSlideText = nextSlide?.text ? String(nextSlide.text) : '';
  const currentSlidePreview = slidePreviewUrl(currentSlide);
  const nextSlidePreview = slidePreviewUrl(nextSlide);
  const currentSlideDescription = currentSlide?.slide_description
    ? String(currentSlide.slide_description)
    : '';
  const nextSlideDescription = nextSlide?.slide_description
    ? String(nextSlide.slide_description)
    : '';
  const currentScreenMode = String(
    providers.find(provider => provider.observed?.screenMode)?.observed?.screenMode || 'normal'
  );

  useLiveOperatorShortcuts({
    enabled: can('presentation.navigation') && busy === null && !clearArmed,
    onPrevious: () => {
      void navigatePresentation('previous');
    },
    onNext: () => {
      void takePrimaryNext();
    }
  });

  return (
    <section className="live-control-panel">
      <div className="live-control-header">
        <div>
          <span className="eyebrow">{t('liveControls.kicker')}</span>
          <h2>{t('liveControls.title')}</h2>
        </div>
        <div className="live-control-health">
          <span className={`status ${providers.some(p => p.health === 'online') ? 'ok' : 'warn'}`} />
          <span>{providers.length} {t('providers')}</span>
        </div>
      </div>

      <div className="live-control-grid">
        <article className="operator-card program-card">
          <div className="operator-card-head">
            <div>
              <span>{t('liveControls.program')}</span>
              <small className="operator-subtitle">{presentationName}</small>
            </div>
            <div className="program-head-actions">
              {can('presentation.preview') && (
                <button
                  onClick={() => void refreshPresentationPreview()}
                  disabled={busy !== null}
                >
                  {t('liveControls.refreshPreview')}
                </button>
              )}
              {Number.isFinite(slideNumber) && Number.isFinite(totalSlides) && (
                <small>{slideNumber}/{totalSlides}</small>
              )}
            </div>
          </div>

          <div className="now-next-deck" aria-label={t('liveControls.nowNext')}>
            <section className="deck-monitor deck-monitor-live">
              <header>
                <span className="deck-live-dot" />
                <div>
                  <strong>{t('liveControls.currentSlide')}</strong>
                  <small>{t('liveControls.programLabel')}</small>
                </div>
                {currentSlideDescription && <em>{currentSlideDescription}</em>}
              </header>
              <div className="deck-frame">
                {currentSlidePreview ? (
                  <img src={currentSlidePreview} alt={t('liveControls.currentSlide')} />
                ) : (
                  <div className="deck-text-fallback">
                    <small>{String(effectivePresentation?.type || t('liveControls.waiting')).toUpperCase()}</small>
                    <p>{currentSlideText || presentationName}</p>
                  </div>
                )}
              </div>
              <footer>
                <span>{currentSlideText || t('liveControls.noSlideText')}</span>
              </footer>
            </section>

            <div className="deck-flow" aria-hidden="true">
              <span>→</span>
            </div>

            <section className="deck-monitor deck-monitor-next">
              <header>
                <div>
                  <strong>{t('liveControls.nextSlide')}</strong>
                  <small>{t('liveControls.previewLabel')}</small>
                </div>
                {cueCoordinator?.armedVisualCue ? (
                  <em className="linked-cue-badge">
                    {t('liveControls.visualLinked')} · {cueCoordinator.armedVisualCue.clipName}
                  </em>
                ) : preparedCue?.subtitle ? (
                  <em>{preparedCue.subtitle}</em>
                ) : nextSlideDescription ? (
                  <em>{nextSlideDescription}</em>
                ) : null}
              </header>
              <div className="deck-frame">
                {preparedCue ? (
                  <div className="deck-prepared-cue">
                    <small>{t(`liveControls.preparedKinds.${preparedCue.kind}`)}</small>
                    <strong>{preparedCue.title}</strong>
                    <span>{preparedCue.subtitle || t('liveControls.prepared')}</span>
                  </div>
                ) : nextSlidePreview ? (
                  <img src={nextSlidePreview} alt={t('liveControls.nextSlide')} />
                ) : (
                  <div className="deck-text-fallback">
                    <small>{t('liveControls.upNext')}</small>
                    <p>{nextSlideText || t('liveControls.endOfPresentation')}</p>
                  </div>
                )}
              </div>
              <footer>
                <span>
                  {preparedCue
                    ? t('liveControls.preparedReady')
                    : nextSlideText || t('liveControls.endOfPresentation')}
                </span>
                <button
                  className="deck-take"
                  disabled={
                    busy !== null ||
                    (!preparedCue && (!nextSlide || !can('presentation.navigation')))
                  }
                  onClick={() => void takePrimaryNext()}
                >
                  {busy === 'next' || busy === 'prepared-take'
                    ? '…'
                    : cueCoordinator?.armedVisualCue
                      ? t('liveControls.takeLinked')
                      : preparedCue
                        ? t('liveControls.takePrepared')
                        : t('liveControls.takeNext')} <kbd>→</kbd>
                </button>
              </footer>
            </section>
          </div>

          <div className="live-command-strip">
            <button
              disabled={!can('presentation.navigation') || busy !== null}
              onClick={() => void navigatePresentation('previous')}
            >
              <kbd>←</kbd> {t('liveControls.previous')}
            </button>
            {can('presentation.screen.mode') && (
              <div className="screen-mode-controls">
                {(['normal','wallpaper','blank','black'] as const).map(mode => (
                  <button
                    key={mode}
                    className={currentScreenMode === mode ? 'active' : ''}
                    disabled={busy !== null}
                    onClick={() => void setScreenMode(mode)}
                  >
                    {t(`liveControls.screenModes.${mode}`)}
                  </button>
                ))}
              </div>
            )}
            <button
              className={clearArmed ? 'danger-armed' : ''}
              disabled={!can('presentation.clear') || busy !== null}
              onClick={requestClear}
            >
              {clearArmed ? t('liveControls.confirmClear') : t('liveControls.clear')}
            </button>
          </div>
        </article>


        {servicePlan && (serviceHorizon.current || serviceHorizon.next) && (
          <div className="service-horizon">
            <div className="service-horizon-label">
              <small>{t('liveControls.serviceHorizon')}</small>
              <strong>{servicePlan.title}</strong>
            </div>
            <div className="service-horizon-item current">
              <small>{t('liveControls.currentItem')}</small>
              <strong>{serviceHorizon.current?.title || t('liveControls.waiting')}</strong>
              <span>{serviceHorizon.current?.type || '—'}</span>
            </div>
            <div className="service-horizon-arrow" aria-hidden="true">→</div>
            <div className="service-horizon-item next">
              <small>{t('liveControls.nextItem')}</small>
              <strong>{serviceHorizon.next?.title || t('liveControls.endOfService')}</strong>
              <span>{serviceHorizon.next?.type || '—'}</span>
            </div>
            <button
              className="service-horizon-take"
              disabled={
                !serviceHorizon.next ||
                serviceHorizon.next.type !== 'song' ||
                !serviceHorizon.next.providerLinkId ||
                busy !== null
              }
              onClick={prepareServiceItem}
            >
              {t('liveControls.prepareItem')} →
            </button>
          </div>
        )}

        <div className="live-tool-dock" role="tablist" aria-label={t('liveControls.tools')}>
          {(['song','bible','media','stage'] as ToolMode[]).map(mode => (
            <button
              key={mode}
              role="tab"
              aria-selected={toolMode === mode}
              className={toolMode === mode ? 'active' : ''}
              disabled={!toolAvailability[mode]}
              onClick={() => setToolMode(mode)}
            >
              <span>{t(`liveControls.toolTabs.${mode}`)}</span>
              <small>{toolAvailability[mode] ? t('liveControls.available') : t('liveControls.unavailable')}</small>
            </button>
          ))}
        </div>

        {toolMode === 'song' && toolAvailability.song && (
        <article className="operator-card live-tool-card">
          <div className="operator-card-head"><span>{t('liveControls.song')}</span></div>
          <div className="operator-inline">
            <input
              value={songQuery}
              onChange={event => setSongQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') void searchSongs();
              }}
              placeholder={t('liveControls.songPlaceholder')}
              disabled={!can('songs.search')}
            />
            <button
              className="secondary"
              disabled={!songQuery.trim() || !can('songs.search') || busy !== null}
              onClick={() => void searchSongs()}
            >
              {t('liveControls.search')}
            </button>
          </div>
          <div className="provider-search-results">
            {songResults.map(song => (
              <button
                key={song.id}
                disabled={!can('songs.present') || busy !== null}
                className={preparedCue?.id === `song:${song.id}` ? 'prepared' : ''}
                onClick={() => prepareSong(song)}
              >
                <span><strong>{song.title}</strong><small>{song.artist || ''}</small></span>
                <em>
                  {preparedCue?.id === `song:${song.id}`
                    ? t('liveControls.prepared')
                    : song.key || song.bpm
                      ? `${song.key || ''}${song.bpm ? ` · ${song.bpm} BPM` : ''}`
                      : t('liveControls.prepare')}
                </em>
              </button>
            ))}
            {songQuery && !songResults.length && busy !== 'song-search' && (
              <small className="empty-result">{t('liveControls.searchHint')}</small>
            )}
          </div>
        </article>
        )}

        {toolMode === 'bible' && toolAvailability.bible && (
        <article className="operator-card live-tool-card">
          <div className="operator-card-head"><span>{t('liveControls.bible')}</span></div>
          <div className="operator-inline">
            <input
              value={bibleReference}
              onChange={event => setBibleReference(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') prepareBible();
              }}
              placeholder={t('liveControls.biblePlaceholder')}
              disabled={!can('bible.present')}
            />
            <button
              className="secondary"
              disabled={!bibleReference.trim() || !can('bible.present') || busy !== null}
              onClick={prepareBible}
            >
              {t('liveControls.prepare')}
            </button>
          </div>
          <p className="operator-help">{t('liveControls.capabilityDriven')}</p>
        </article>
        )}

        {toolMode === 'media' && toolAvailability.media && (
          <article className="operator-card live-tool-card operator-card-wide">
            <div className="operator-card-head">
              <span>{t('liveControls.media')}</span>
              <div className="operator-segmented">
                {(['video','image','audio'] as const).map(kind => (
                  <button
                    key={kind}
                    className={mediaKind === kind ? 'active' : ''}
                    onClick={() => {
                      setMediaKind(kind);
                      setMediaResults([]);
                    }}
                  >
                    {t(`liveControls.mediaKinds.${kind}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="operator-inline">
              <input
                value={mediaQuery}
                onChange={event => setMediaQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') void searchMedia();
                }}
                placeholder={t('liveControls.mediaPlaceholder')}
              />
              <button
                className="secondary"
                disabled={busy !== null}
                onClick={() => void searchMedia()}
              >
                {t('liveControls.search')}
              </button>
            </div>
            <div className="provider-search-results media-results">
              {mediaResults.map(item => (
                <button
                  key={item.name}
                  disabled={Boolean(item.isDir) || !can('media.open') || busy !== null}
                  className={preparedCue?.id === `media:${mediaKind}:${item.name}` ? 'prepared' : ''}
                  onClick={() => prepareMedia(item)}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.isDir
                        ? t('liveControls.folder')
                        : item.width && item.height
                          ? `${item.width}×${item.height}`
                          : item.durationMs
                            ? `${Math.round(item.durationMs / 1000)}s`
                            : t('liveControls.mediaReady')}
                    </small>
                  </span>
                  <em>
                    {item.isDir
                      ? '—'
                      : preparedCue?.id === `media:${mediaKind}:${item.name}`
                        ? t('liveControls.prepared')
                        : t('liveControls.prepare')}
                  </em>
                </button>
              ))}
            </div>
          </article>
        )}

        {toolMode === 'stage' && toolAvailability.stage && (
          <article className="operator-card live-tool-card">
            <div className="operator-card-head"><span>{t('liveControls.stage')}</span></div>
            <textarea
              className="operator-textarea"
              value={stageText}
              onChange={event => setStageText(event.target.value)}
              placeholder={t('liveControls.stagePlaceholder')}
              rows={4}
            />
            <div className="operator-dual-actions">
              <button
                className="secondary"
                disabled={!stageText.trim() || busy !== null}
                onClick={() => void showStageMessage()}
              >
                {t('liveControls.showStage')}
              </button>
              <button
                className="ghost-action"
                disabled={busy !== null}
                onClick={() => void hideStageMessage()}
              >
                {t('liveControls.hideStage')}
              </button>
            </div>
          </article>
        )}

      </div>

      {message && <div className="operator-message">{message}</div>}
    </section>
  );
}
