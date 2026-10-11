import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PopulatedSong } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { generateLyricsFromChords } from '../../utils/generateLyricsFromChords';
import { saveGeneratedSongLyrics } from '../../services/saveGeneratedSongLyrics';
import Modal from '../common/Modal';

type Props = {
  song: PopulatedSong | null;
  onClose: () => void;
  onSaved: (songId: string, lyrics: string) => void | Promise<void>;
};

export default function GenerateLyricsDialog({ song, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const { user, effectiveOrganizationId, permissions } = useAuth();
  const canEdit = !!(permissions?.manageSongs || permissions?.['musicScale.manageSongs'] || permissions?.['musicscale.songs.edit']);
  const [preview, setPreview] = useState('');
  const [hasSungContent, setHasSungContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const result = generateLyricsFromChords(song?.chords || '');
    setPreview(result.lyrics);
    setHasSungContent(result.hasSungContent);
    setError('');
  }, [song?.id, song?.chords]);

  const save = async () => {
    if (!song || !user?.uid || !effectiveOrganizationId || song.organizationId !== effectiveOrganizationId ||
        !canEdit || !!song.lyrics?.trim() || !hasSungContent || !preview.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await saveGeneratedSongLyrics({
        songId: song.id, organizationId: effectiveOrganizationId,
        userId: user.uid, expectedChords: song.chords || '', lyrics: preview,
      });
      // A committed write must not appear to have failed because the subsequent
      // local repertoire refresh encountered a transient network error.
      try { await onSaved(song.id, preview.trim()); } catch { /* saved successfully */ }
      onClose();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '';
      const key = ({
        SONG_LYRICS_ALREADY_EXIST: 'alreadyHasLyrics',
        SONG_CHORDS_CHANGED: 'chordsChanged',
        SONG_ORGANIZATION_CHANGED: 'organizationChanged',
        USER_CHANGED: 'organizationChanged',
      } as Record<string, string>)[code];
      setError(t('lyricsGeneration.' + (key || 'saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const available = song && !!song.chords?.trim() && !song.lyrics?.trim() &&
    canEdit && song.organizationId === effectiveOrganizationId;
  return <Modal
    isOpen={!!song}
    onClose={() => { if (!saving) onClose(); }}
    title={t('lyricsGeneration.title')}
    maxWidth="max-w-2xl"
    footer={<>
      <button type="button" onClick={onClose} disabled={saving}
        className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10">
        {t('lyricsGeneration.cancel')}
      </button>
      <button type="button" onClick={() => void save()}
        disabled={!available || !hasSungContent || !preview.trim() || saving}
        className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
        {saving ? t('lyricsGeneration.saving') : t('lyricsGeneration.save')}
      </button>
    </>}>
    <div className="space-y-4">
      <p className="text-sm text-slate-300">{song?.title}</p>
      <p className="text-xs text-slate-400">{t('lyricsGeneration.hint')}</p>
      {!hasSungContent && <p role="status" className="rounded-xl border border-amber-400/20 p-3 text-sm text-amber-200">{t('lyricsGeneration.noLyricsFound')}</p>}
      {!available && <p role="status" className="rounded-xl border border-amber-400/20 p-3 text-sm text-amber-200">{t('lyricsGeneration.unavailable')}</p>}
      <label className="block text-xs font-semibold text-slate-300" htmlFor="generated-lyrics-preview">
        {t('lyricsGeneration.preview')}
      </label>
      <textarea id="generated-lyrics-preview" value={preview} onChange={event => setPreview(event.target.value)}
        rows={13} disabled={!available || saving}
        className="min-h-44 w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    </div>
  </Modal>;
}
