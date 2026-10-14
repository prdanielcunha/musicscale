import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

type SongRow = {
  id: string; title: string; artist: string; key: string; bpm: number | null;
  lyrics: string; chords: string; organizationId: string; organizationName: string;
  addedBy: string; addedByUid: string; publicationMethod: string; addedAt: string | null;
};
type SongPage = { songs: SongRow[]; nextCursor: string | null; hasMore: boolean };

export function GlobalSongCatalog() {
  const { user, isCurationAdmin } = useAuth();
  const { t, i18n } = useTranslation();
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<SongRow | null>(null);
  const locale = (i18n.resolvedLanguage || i18n.language || 'pt').startsWith('en') ? 'en-US'
    : (i18n.resolvedLanguage || i18n.language || 'pt').startsWith('es') ? 'es-ES' : 'pt-BR';

  const request = useCallback(async (url: string, init: RequestInit = {}) => {
    const token = await user?.getIdToken();
    if (!token) throw new Error('AUTH_REQUIRED');
    const response = await fetch(url, {
      ...init,
      headers: { Authorization: 'Bearer ' + token,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers }
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'REQUEST_FAILED');
    return body;
  }, [user]);

  const loadPage = useCallback(async (more = false) => {
    if (!isCurationAdmin) return;
    setLoading(true);
    setError('');
    try {
      const last = more ? cursor : null;
      const data = await request('/api/curation/global-songs?limit=25' +
        (last ? '&after=' + encodeURIComponent(last) : '')) as SongPage;
      setSongs(previous => more ? [...previous, ...data.songs] : data.songs);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (e: any) {
      setError(e?.message || 'REQUEST_FAILED');
    } finally {
      setLoading(false);
    }
  }, [cursor, isCurationAdmin, request]);

  useEffect(() => {
    // Initial load is driven only by authentication; cursor changes must not
    // inadvertently reset an already paginated list.
    if (!isCurationAdmin || !user) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await request('/api/curation/global-songs?limit=25') as SongPage;
        if (active) {
          setSongs(data.songs);
          setCursor(data.nextCursor);
          setHasMore(data.hasMore);
        }
      } catch (e: any) {
        if (active) setError(e?.message || 'REQUEST_FAILED');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [isCurationAdmin, user, request]);

  const displayed = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return songs;
    return songs.filter(song => [song.title, song.artist, song.organizationName, song.organizationId]
      .some(value => (value || '').toLowerCase().includes(term)));
  }, [songs, query]);

  async function archiveChunk(ids: string[]) {
    const result = await request('/api/curation/global-songs/bulk-archive', {
      method: 'POST', body: JSON.stringify({ ids })
    });
    const failed = (result.results || []).filter((item: any) => item.status === 'failed');
    if (failed.length) throw new Error('ARCHIVE_PARTIAL_FAILURE');
  }
  async function archiveSelected() {
    if (!selected.length || busy) return;
    if (!window.confirm(t('curation.added.confirmSelected', { count: selected.length }))) return;
    setBusy(true);
    setError('');
    try {
      for (let i = 0; i < selected.length; i += 25) await archiveChunk(selected.slice(i, i + 25));
      setSelected([]);
      setMessage(t('curation.added.archived'));
      await loadPage(false);
    } catch (e: any) { setError(e?.message || 'REQUEST_FAILED'); }
    finally { setBusy(false); }
  }
  async function archiveAll() {
    if (busy) return;
    const required = t('curation.added.confirmWord');
    if (window.prompt(t('curation.added.confirmAll', { word: required })) !== required) return;
    setBusy(true);
    setError('');
    let after: string | null = null;
    let archived = 0;
    try {
      while (true) {
        const page: SongPage = await request('/api/curation/global-songs?limit=25' +
          (after ? '&after=' + encodeURIComponent(after) : ''));
        if (!page.songs.length) break;
        await archiveChunk(page.songs.map(song => song.id));
        archived += page.songs.length;
        setMessage(t('curation.added.progress', { count: archived }));
        after = page.nextCursor;
        if (!page.hasMore) break;
      }
      setSelected([]);
      await loadPage(false);
      setMessage(t('curation.added.finished', { count: archived }));
    } catch (e: any) {
      setError(e?.message || 'REQUEST_FAILED');
      await loadPage(false);
    } finally { setBusy(false); }
  }
  async function saveEdit() {
    if (!editing || busy) return;
    setBusy(true);
    setError('');
    try {
      await request('/api/curation/global-songs/' + encodeURIComponent(editing.id), {
        method: 'PATCH',
        body: JSON.stringify({
          title: editing.title, artist: editing.artist, key: editing.key,
          bpm: editing.bpm, lyrics: editing.lyrics, chords: editing.chords
        })
      });
      setEditing(null);
      setMessage(t('curation.added.updated'));
      await loadPage(false);
    } catch (e: any) { setError(e?.message || 'REQUEST_FAILED'); }
    finally { setBusy(false); }
  }
  if (!isCurationAdmin) return null;
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-4 sm:p-6 space-y-4" aria-label={t('curation.added.title')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('curation.added.title')}</h2>
          <p className="text-sm text-slate-500">{t('curation.added.subtitle')}</p>
        </div>
        <button type="button" onClick={() => void loadPage(false)} disabled={busy || loading}
          className="rounded-lg px-3 py-2 text-sm border border-slate-300 dark:border-white/20">
          {t('curation.added.refresh')}
        </button>
      </div>
      <input value={query} onChange={e => setQuery(e.target.value)}
        placeholder={t('curation.added.searchLoaded')} aria-label={t('curation.added.searchLoaded')}
        className="w-full rounded-xl border border-slate-300 dark:border-white/20 bg-transparent p-3 text-sm" />
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {message && <p role="status" className="text-sm text-sky-600 dark:text-sky-300">{message}</p>}
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" onClick={() => setSelected(displayed.map(song => song.id))}
          disabled={busy || !displayed.length} className="rounded-lg px-3 py-2 text-xs border border-slate-300 dark:border-white/20">
          {t('curation.added.selectLoaded')}
        </button>
        <button type="button" onClick={() => setSelected([])} disabled={busy}
          className="rounded-lg px-3 py-2 text-xs border border-slate-300 dark:border-white/20">
          {t('curation.added.clear')}
        </button>
        <button type="button" onClick={() => void archiveSelected()} disabled={busy || !selected.length}
          className="rounded-lg px-3 py-2 text-xs font-semibold bg-red-600 text-white disabled:opacity-40">
          {t('curation.added.archiveSelected', { count: selected.length })}
        </button>
        <button type="button" onClick={() => void archiveAll()} disabled={busy || loading}
          className="rounded-lg px-3 py-2 text-xs font-semibold border border-red-500 text-red-600 dark:text-red-400">
          {t('curation.added.archiveAll')}
        </button>
      </div>
      {loading && songs.length === 0 && <p role="status">{t('curation.added.loading')}</p>}
      {!loading && !songs.length && <p className="text-sm text-slate-500">{t('curation.added.empty')}</p>}
      <ul className="divide-y divide-slate-200 dark:divide-white/10">
        {displayed.map(song => (
          <li key={song.id} className="flex gap-3 py-4 items-start">
            <input type="checkbox" aria-label={t('curation.added.selectSong', { title: song.title })}
              checked={selected.includes(song.id)} disabled={busy}
              onChange={e => setSelected(previous => e.target.checked
                ? [...previous, song.id] : previous.filter(id => id !== song.id))}
              className="mt-1 h-4 w-4" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">{song.title}</p>
              <p className="text-xs text-slate-500">{song.artist} · {song.key}</p>
              <p className="mt-1 text-xs text-slate-500 break-words">
                {song.organizationName || song.organizationId || t('curation.added.unknown')}
                {' · '}{song.addedBy || song.addedByUid || t('curation.added.unknown')}
                {' · '}{song.addedAt ? new Date(song.addedAt).toLocaleString(locale) : '—'}
              </p>
            </div>
            <button type="button" disabled={busy} onClick={() => setEditing(song)}
              className="rounded-lg px-3 py-2 border border-slate-300 dark:border-white/20 text-sm">
              {t('curation.added.edit')}
            </button>
            <button type="button" disabled={busy}
              onClick={() => { setSelected([song.id]); setMessage(t('curation.added.selectedOne')); }}
              className="rounded-lg px-3 py-2 border border-red-500/40 text-red-600 dark:text-red-400 text-sm">
              {t('curation.added.selectArchive')}
            </button>
          </li>
        ))}
      </ul>
      {hasMore && <button type="button" disabled={busy || loading}
        onClick={() => void loadPage(true)} className="w-full rounded-lg px-4 py-3 border border-slate-300 dark:border-white/20 text-sm">
        {t('curation.loadMore')}
      </button>}
      {editing && (
        <div role="dialog" aria-modal="true" aria-label={t('curation.added.edit')}
          className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1D2029] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-3">
            <h3 className="font-bold text-lg">{t('curation.added.edit')}</h3>
            {(['title', 'artist', 'key'] as const).map(field => (
              <label key={field} className="block text-sm space-y-1">
                <span>{t('curation.added.' + field)}</span>
                <input value={editing[field]} onChange={e => setEditing({ ...editing, [field]: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-transparent p-2" />
              </label>
            ))}
            <label className="block text-sm space-y-1">
              <span>BPM</span>
              <input type="number" min={20} max={350} value={editing.bpm ?? ''}
                onChange={e => setEditing({ ...editing, bpm: e.target.value === '' ? null : Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-transparent p-2" />
            </label>
            {(['lyrics', 'chords'] as const).map(field => (
              <label key={field} className="block text-sm space-y-1">
                <span>{t('curation.added.' + field)}</span>
                <textarea rows={6} value={editing[field]}
                  onChange={e => setEditing({ ...editing, [field]: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-white/20 bg-transparent p-2" />
              </label>
            ))}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setEditing(null)}
                className="rounded-lg px-4 py-2 border border-slate-300 dark:border-white/20">
                {t('curation.added.cancel')}
              </button>
              <button type="button" disabled={busy} onClick={() => void saveEdit()}
                className="rounded-lg px-4 py-2 bg-indigo-600 text-white font-semibold">
                {t('curation.added.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
