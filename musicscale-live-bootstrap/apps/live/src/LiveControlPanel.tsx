import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Capability, CommandResult } from '@musicscale-live/domain';
import type { useLiveNode } from './useLiveNode';

type Controller = ReturnType<typeof useLiveNode>;

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
  const [songQuery, setSongQuery] = useState('');
  const [songResults, setSongResults] = useState<SearchSongResult[]>([]);
  const [bibleReference, setBibleReference] = useState('');
  const [mediaKind, setMediaKind] = useState<'video' | 'image' | 'audio'>('video');
  const [mediaQuery, setMediaQuery] = useState('');
  const [mediaResults, setMediaResults] = useState<SearchMediaResult[]>([]);
  const [stageText, setStageText] = useState('');
  const [previewPresentation, setPreviewPresentation] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [clearArmed, setClearArmed] = useState(false);
  const clearTimer = useRef<number | null>(null);

  const providers = controller.nodeState?.providers || [];
  const capabilitySet = useMemo(
    () => new Set(
      providers
        .filter(provider => provider.health === 'online' || provider.health === 'degraded')
        .flatMap(provider => provider.capabilities)
    ),
    [providers]
  );

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

  async function run(
    key: string,
    capability: Capability,
    payload: Record<string, unknown>,
    safetyLevel: 'normal' | 'guarded' = 'normal'
  ): Promise<CommandResult[]> {
    setBusy(key);
    setMessage(null);
    try {
      const results = await controller.executeCommand({
        capability,
        payload,
        liveSessionId,
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
    const results = await run(action, 'presentation.navigation', { action });
    const presentation = getPresentationFromResults(results);
    if (presentation) setPreviewPresentation(presentation);
  }

  async function searchSongs() {
    const query = songQuery.trim();
    if (!query || !can('songs.search')) return;
    const results = await run('song-search', 'songs.search', { text: query });
    setSongResults(getSongResults(results));
  }

  async function presentSong(song: SearchSongResult) {
    if (!can('songs.present')) return;
    await run(`song:${song.id}`, 'songs.present', { id: song.id });
  }

  async function presentBible() {
    const reference = bibleReference.trim();
    if (!reference || !can('bible.present')) return;
    await run('bible', 'bible.present', { references: reference });
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

  async function openMedia(item: SearchMediaResult) {
    if (item.isDir || !can('media.open')) return;
    await run(`media:${item.name}`, 'media.open', {
      kind: mediaKind,
      file: item.name
    });
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

  const effectivePresentation = previewPresentation || currentPresentation;
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
  const currentScreenMode = String(
    providers.find(provider => provider.observed?.screenMode)?.observed?.screenMode || 'normal'
  );

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
            <span>{t('liveControls.program')}</span>
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
          <div className="program-state">
            <small>{String(currentPresentation?.type || t('liveControls.waiting')).toUpperCase()}</small>
            <strong>{presentationName}</strong>
            <span>{t('liveControls.observedState')}</span>
          </div>
          {(currentSlideText || nextSlideText) && (
            <div className="slide-context-grid">
              <div>
                <small>{t('liveControls.currentSlide')}</small>
                <p>{currentSlideText || '—'}</p>
              </div>
              <div>
                <small>{t('liveControls.nextSlide')}</small>
                <p>{nextSlideText || '—'}</p>
              </div>
            </div>
          )}
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
          <div className="transport-controls">
            <button
              disabled={!can('presentation.navigation') || busy !== null}
              onClick={() => void navigatePresentation('previous')}
            >
              ← {t('liveControls.previous')}
            </button>
            <button
              className="take-button"
              disabled={!can('presentation.navigation') || busy !== null}
              onClick={() => void navigatePresentation('next')}
            >
              {busy === 'next' ? '…' : t('liveControls.next')} →
            </button>
            <button
              className={clearArmed ? 'danger-armed' : ''}
              disabled={!can('presentation.clear') || busy !== null}
              onClick={requestClear}
            >
              {clearArmed ? t('liveControls.confirmClear') : t('liveControls.clear')}
            </button>
          </div>
        </article>

        <article className="operator-card">
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
                onClick={() => void presentSong(song)}
              >
                <span><strong>{song.title}</strong><small>{song.artist || ''}</small></span>
                <em>{song.key || ''}{song.bpm ? ` · ${song.bpm} BPM` : ''}</em>
              </button>
            ))}
            {songQuery && !songResults.length && busy !== 'song-search' && (
              <small className="empty-result">{t('liveControls.searchHint')}</small>
            )}
          </div>
        </article>

        <article className="operator-card">
          <div className="operator-card-head"><span>{t('liveControls.bible')}</span></div>
          <div className="operator-inline">
            <input
              value={bibleReference}
              onChange={event => setBibleReference(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') void presentBible();
              }}
              placeholder={t('liveControls.biblePlaceholder')}
              disabled={!can('bible.present')}
            />
            <button
              className="secondary"
              disabled={!bibleReference.trim() || !can('bible.present') || busy !== null}
              onClick={() => void presentBible()}
            >
              {t('liveControls.present')}
            </button>
          </div>
          <p className="operator-help">{t('liveControls.capabilityDriven')}</p>
        </article>

        {can('media.search') && (
          <article className="operator-card operator-card-wide">
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
                  onClick={() => void openMedia(item)}
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
                  <em>{item.isDir ? '—' : t('liveControls.open')}</em>
                </button>
              ))}
            </div>
          </article>
        )}

        {can('stage.message') && (
          <article className="operator-card">
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
