import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { matchExternalSong, type SongIdentity } from '@musicscale-live/domain';
import type { SharedScale } from './musicScaleBridge';
import { buildServicePlan } from './servicePlanBuilder';
import type { useLiveNode } from './useLiveNode';

type Controller = ReturnType<typeof useLiveNode>;

interface ExternalSong extends SongIdentity {
  key?: string;
  bpm?: number;
}

type RowStatus = 'idle' | 'checking' | 'matched' | 'ambiguous' | 'missing' | 'error';

interface PreflightRow {
  source: SharedScale['songs'][number];
  status: RowStatus;
  matched?: ExternalSong;
  candidates: ExternalSong[];
  error?: string;
}

function extractExternalSongs(results: Awaited<ReturnType<Controller['executeCommand']>>): ExternalSong[] {
  return results
    .flatMap(result => {
      const value = result.observedState?.results;
      return Array.isArray(value) ? value : [];
    })
    .filter(value => value && typeof value === 'object')
    .map(value => {
      const item = value as Record<string, unknown>;
      return {
        id: String(item.id || ''),
        title: String(item.title || ''),
        artist: item.artist ? String(item.artist) : undefined,
        key: item.key ? String(item.key) : undefined,
        bpm: typeof item.bpm === 'number' ? item.bpm : undefined
      };
    })
    .filter(item => item.id && item.title);
}

export function ScalePreflight({
  controller,
  scale,
  actorId
}: {
  controller: Controller;
  scale: SharedScale;
  actorId: string;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<PreflightRow[]>(
    scale.songs.map(source => ({ source, status: 'idle', candidates: [] }))
  );
  const [running, setRunning] = useState(false);
  const [syncArmed, setSyncArmed] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [offlinePrepared, setOfflinePrepared] = useState(false);
  const syncTimer = useRef<number | null>(null);
  const cachedSignature = useRef<string | null>(null);

  const capabilities = useMemo(
    () => new Set(
      (controller.nodeState?.providers || [])
        .filter(provider => provider.health === 'online' || provider.health === 'degraded')
        .flatMap(provider => provider.capabilities)
    ),
    [controller.nodeState]
  );

  const provider = useMemo(
    () => (controller.nodeState?.providers || []).find(candidate =>
      (candidate.health === 'online' || candidate.health === 'degraded') &&
      candidate.capabilities.includes('songs.search')
    ) || null,
    [controller.nodeState]
  );

  const readyCount = rows.filter(row => row.status === 'matched' && row.matched).length;
  const unresolvedCount = rows.length - readyCount;
  const canSearch = Boolean(provider) && capabilities.has('songs.search');
  const canSync = Boolean(provider) && provider?.capabilities.includes('playlist.sync') === true;

  useEffect(() => {
    if (
      running ||
      !provider ||
      !controller.credential ||
      rows.length === 0 ||
      unresolvedCount > 0
    ) {
      if (unresolvedCount > 0) setOfflinePrepared(false);
      return;
    }

    const prepared = rows
      .filter(row => row.matched)
      .map(row => ({
        musicScaleSongId: row.source.id,
        providerInstanceId: provider.providerId,
        externalId: row.matched!.id,
        fingerprint: `${row.matched!.title}|${row.matched!.artist || ''}`
      }));

    const signature = prepared
      .map(link => `${link.musicScaleSongId}:${link.externalId}`)
      .join('|');

    if (!signature || cachedSignature.current === signature) return;
    cachedSignature.current = signature;

    const { plan, providerLinks } = buildServicePlan(
      scale,
      {
        venueId: controller.credential.binding.venueId,
        liveSystemId: controller.credential.binding.liveSystemId
      },
      prepared
    );

    controller.cacheServicePlan(plan, providerLinks)
      .then(() => setOfflinePrepared(true))
      .catch(() => {
        cachedSignature.current = null;
        setOfflinePrepared(false);
      });
  }, [
    controller,
    provider,
    rows,
    running,
    scale,
    unresolvedCount
  ]);

  async function runPreflight() {
    if (!canSearch || running) return;
    setRunning(true);
    setSyncMessage(null);

    const nextRows: PreflightRow[] = [];
    for (const source of scale.songs) {
      setRows(current => current.map(row =>
        row.source.id === source.id ? { ...row, status: 'checking', error: undefined } : row
      ));

      try {
        const results = await controller.executeCommand({
          capability: 'songs.search',
          payload: {
            text: source.title,
            title: true,
            artist: true,
            fields: 'id,title,artist,key,bpm'
          },
          liveSessionId: `preflight:${scale.id}`,
          actorId,
          targetProviderIds: provider ? [provider.providerId] : []
        });

        const externalSongs = extractExternalSongs(results);
        const decision = matchExternalSong(
          { title: source.title, artist: source.artist },
          externalSongs
        );

        if (decision.status === 'matched') {
          nextRows.push({
            source,
            status: 'matched',
            matched: decision.candidate,
            candidates: externalSongs
          });
        } else if (decision.status === 'ambiguous') {
          nextRows.push({
            source,
            status: 'ambiguous',
            candidates: decision.candidates
          });
        } else {
          nextRows.push({
            source,
            status: 'missing',
            candidates: externalSongs
          });
        }
      } catch (error) {
        nextRows.push({
          source,
          status: 'error',
          candidates: [],
          error: error instanceof Error ? error.message : 'preflight_failed'
        });
      }

      setRows(current => {
        const completed = nextRows[nextRows.length - 1]!;
        return current.map(row => row.source.id === completed.source.id ? completed : row);
      });
    }

    setRunning(false);
  }

  function chooseCandidate(sourceId: string, externalId: string) {
    setRows(current => current.map(row => {
      if (row.source.id !== sourceId) return row;
      const matched = row.candidates.find(candidate => candidate.id === externalId);
      return matched
        ? { ...row, status: 'matched', matched }
        : { ...row, status: 'ambiguous', matched: undefined };
    }));
  }

  async function syncPlaylist() {
    if (!canSync || unresolvedCount > 0 || running) return;

    if (!syncArmed) {
      setSyncArmed(true);
      setSyncMessage(t('preflight.replaceWarning'));
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
      syncTimer.current = window.setTimeout(() => {
        setSyncArmed(false);
        setSyncMessage(null);
      }, 5000);
      return;
    }

    setSyncArmed(false);
    setRunning(true);
    setSyncMessage(null);
    try {
      const ids = rows.map(row => row.matched?.id).filter((id): id is string => Boolean(id));
      const result = await controller.executeCommand({
        capability: 'playlist.sync',
        payload: { ids },
        liveSessionId: `music-scale:${scale.id}`,
        actorId,
        targetProviderIds: provider ? [provider.providerId] : [],
        safetyLevel: 'guarded'
      });
      const failed = result.find(item => !item.accepted);

      if (failed) {
        setSyncMessage(t('preflight.syncFailed', {
          code: failed.errorCode || 'provider_error'
        }));
      } else if (controller.credential && provider) {
        const prepared = rows
          .filter(row => row.matched)
          .map(row => ({
            musicScaleSongId: row.source.id,
            providerInstanceId: provider.providerId,
            externalId: row.matched!.id,
            fingerprint: `${row.matched!.title}|${row.matched!.artist || ''}`
          }));

        const { plan, providerLinks } = buildServicePlan(
          scale,
          {
            venueId: controller.credential.binding.venueId,
            liveSystemId: controller.credential.binding.liveSystemId
          },
          prepared
        );
        await controller.cacheServicePlan(plan, providerLinks);
        setOfflinePrepared(true);
        setSyncMessage(t('preflight.syncDoneOffline'));
      } else {
        setSyncMessage(t('preflight.syncDone'));
      }
    } catch (error) {
      setSyncMessage(t('preflight.syncFailed', {
        code: error instanceof Error ? error.message : 'unknown'
      }));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="preflight-panel">
      <div className="preflight-header">
        <div>
          <span className="eyebrow">{t('preflight.kicker')}</span>
          <h2>{t('preflight.title')}</h2>
          <p>{scale.eventName || t('nextService')} · {scale.date}{scale.time ? ` · ${scale.time}` : ''}</p>
        </div>
        <div className="preflight-score">
          <strong>{readyCount}/{rows.length}</strong>
          <small>{t('preflight.ready')}</small>
          {offlinePrepared && <em>{t('preflight.offlineReady')}</em>}
        </div>
      </div>

      <div className="preflight-actions">
        <button
          className="secondary"
          disabled={!canSearch || running || !rows.length}
          onClick={() => void runPreflight()}
        >
          {running ? t('preflight.checking') : t('preflight.check')}
        </button>
        <button
          className={syncArmed ? 'primary danger-confirm' : 'primary'}
          disabled={!canSync || unresolvedCount > 0 || running || !rows.length}
          onClick={() => void syncPlaylist()}
        >
          {syncArmed ? t('preflight.confirmReplace') : t('preflight.sync')}
        </button>
      </div>

      <div className="preflight-list">
        {rows.map((row, index) => (
          <div className="preflight-row" key={row.source.id}>
            <b>{String(index + 1).padStart(2, '0')}</b>
            <div className="preflight-song">
              <strong>{row.source.title}</strong>
              <small>{row.source.artist || ''}</small>
            </div>
            <div className={`preflight-state state-${row.status}`}>
              {row.status === 'idle' && t('preflight.idle')}
              {row.status === 'checking' && t('preflight.checking')}
              {row.status === 'matched' && row.matched && (
                <span title={row.matched.id}>
                  {t('preflight.matched')} · {row.matched.title}
                </span>
              )}
              {row.status === 'missing' && t('preflight.missing')}
              {row.status === 'error' && t('preflight.error')}
              {row.status === 'ambiguous' && (
                <select
                  value=""
                  onChange={event => chooseCandidate(row.source.id, event.target.value)}
                  aria-label={t('preflight.choose')}
                >
                  <option value="">{t('preflight.choose')}</option>
                  {row.candidates.map(candidate => (
                    <option value={candidate.id} key={candidate.id}>
                      {candidate.title}{candidate.artist ? ` — ${candidate.artist}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>

      {!canSearch && <p className="preflight-note">{t('preflight.searchUnavailable')}</p>}
      {canSearch && !canSync && <p className="preflight-note">{t('preflight.syncUnavailable')}</p>}
      {syncMessage && <p className="preflight-message">{syncMessage}</p>}
    </section>
  );
}
