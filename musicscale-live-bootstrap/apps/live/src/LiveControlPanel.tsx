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

  const slideNumber = Number(currentPresentation?.slide_number);
  const totalSlides = Number(currentPresentation?.total_slides);
  const presentationName =
    String(currentPresentation?.name || currentPresentation?.title || '') ||
    t('liveControls.noPresentation');

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
            {Number.isFinite(slideNumber) && Number.isFinite(totalSlides) && (
              <small>{slideNumber}/{totalSlides}</small>
            )}
          </div>
          <div className="program-state">
            <small>{String(currentPresentation?.type || t('liveControls.waiting')).toUpperCase()}</small>
            <strong>{presentationName}</strong>
            <span>{t('liveControls.observedState')}</span>
          </div>
          <div className="transport-controls">
            <button
              disabled={!can('presentation.navigation') || busy !== null}
              onClick={() => void run('previous', 'presentation.navigation', { action: 'previous' })}
            >
              ← {t('liveControls.previous')}
            </button>
            <button
              className="take-button"
              disabled={!can('presentation.navigation') || busy !== null}
              onClick={() => void run('next', 'presentation.navigation', { action: 'next' })}
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
      </div>

      {message && <div className="operator-message">{message}</div>}
    </section>
  );
}
