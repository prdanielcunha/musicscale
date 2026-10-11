import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

interface PublishedSongRow {
  id: string;
  title: string;
  artist: string;
  addedAt: string | null;
  addedBy: string;
  addedByUid: string;
  organizationId: string;
  organizationName: string;
  publicationMethod: string;
}

/** Audit view of actual additions, not a list of queued candidates. */
export function RecentlyAddedSongs() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [songs, setSongs] = useState<PublishedSongRow[]>([]);
  const locale = (i18n.resolvedLanguage || i18n.language || 'pt').startsWith('en')
    ? 'en-US' : (i18n.resolvedLanguage || i18n.language || 'pt').startsWith('es') ? 'es-ES' : 'pt-BR';

  useEffect(() => {
    if (!expanded || !user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const token = await user.getIdToken();
        const result = await fetch('/api/curation/recently-added', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!result.ok) throw new Error('RECENTLY_ADDED_UNAVAILABLE');
        const data = await result.json();
        if (!cancelled) setSongs(Array.isArray(data.songs) ? data.songs : []);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [expanded, user]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#1A1A1A] overflow-hidden">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-white/5">
        <span className="font-semibold text-slate-900 dark:text-white">
          {t('curation.added.title', 'Adicionadas à Biblioteca Viva')}
        </span>
        <span className="text-xs text-slate-500">
          {expanded ? t('curation.added.hide', 'Ocultar') : t('curation.added.view', 'Ver histórico')}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-slate-200 dark:border-white/10">
          <p className="px-4 py-3 text-xs text-slate-500">
            {t('curation.added.description', 'Últimas 50 publicações globais, com origem e responsável.')}
          </p>
          {loading ? (
            <p className="px-4 pb-4 text-sm text-slate-500" role="status">{t('curation.added.loading', 'Carregando publicações...')}</p>
          ) : error ? (
            <p className="px-4 pb-4 text-sm text-red-500" role="alert">{t('curation.added.error', 'Não foi possível carregar o histórico. Feche e abra novamente para tentar.')}</p>
          ) : songs.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-slate-500">{t('curation.added.empty', 'Nenhuma publicação encontrada.')}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {songs.map(song => (
                <li key={song.id} className="px-4 py-3 flex flex-col gap-1 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-slate-900 dark:text-white break-words">{song.title}</p>
                    <p className="text-xs text-slate-500">{song.artist}</p>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">{t('curation.added.by', 'Por')}:</span>{' '}
                    {song.addedBy || song.addedByUid || t('curation.added.unknown', 'Não informado')}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">{t('curation.added.organization', 'Organização')}:</span>{' '}
                    {song.organizationName || song.organizationId || t('curation.added.unknown', 'Não informado')}
                  </div>
                  <time dateTime={song.addedAt || undefined} className="text-xs text-slate-500 tabular-nums">
                    {song.addedAt ? new Date(song.addedAt).toLocaleString(locale) : t('curation.added.unknown', 'Não informado')}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
