import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, HardDriveDownload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicDataContext';
import type { PopulatedScale } from '../../types';
import {
  downloadLibraryPack,
  downloadScalePack,
  getOfflineSongRevision,
  getOfflineStorageEstimate,
  listOfflineResourcePacks,
  type OfflinePackWriteResult,
} from '../../services/offline/resourcePackManager';
import type { OfflineResourcePack } from '../../services/offline/database';
import { getStageToolsV2Copy } from '../../services/stageToolsV2Copy';

function parseScaleDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatScaleLabel(scale: PopulatedScale, locale: string) {
  const date = parseScaleDate(scale.date);
  const title = scale.eventName?.name || scale.eventType?.name || 'Escala';
  const formatted = date
    ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
    : scale.date;
  return `${title} · ${formatted}`;
}

function packMatchesSongs(pack: OfflineResourcePack | undefined, songIds: string[], revisions: Record<string, string>) {
  if (!pack) return false;
  if (pack.songIds.length !== songIds.length) return false;
  return songIds.every((id) => pack.songRevisions?.[id] === revisions[id]);
}

const OfflineResourcesPanel: React.FC = () => {
  const { i18n } = useTranslation();
  const copy = getStageToolsV2Copy(i18n.resolvedLanguage || i18n.language);
  const locale = (i18n.resolvedLanguage || i18n.language || 'pt-BR').replace('_', '-');
  const { user, effectiveOrganizationId } = useAuth();
  const { songs, populatedScales } = useMusic();
  const userId = user?.uid || '';
  const organizationId = effectiveOrganizationId || '';
  const [packs, setPacks] = useState<OfflineResourcePack[]>([]);
  const [selectedScaleId, setSelectedScaleId] = useState('');
  const [busy, setBusy] = useState<'library' | 'next' | 'selected' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState(0);

  const scopedSongs = useMemo(
    () => songs.filter((song) => song.organizationId === organizationId),
    [organizationId, songs],
  );
  const scopedScales = useMemo(
    () => populatedScales
      .filter((scale) => (scale as PopulatedScale & { organizationId?: string }).organizationId === organizationId)
      .slice()
      .sort((a, b) => (parseScaleDate(a.date)?.getTime() || 0) - (parseScaleDate(b.date)?.getTime() || 0)),
    [organizationId, populatedScales],
  );
  const nextScale = useMemo(() => {
    const now = Date.now();
    return scopedScales.find((scale) => (parseScaleDate(scale.date)?.getTime() || 0) >= now) || null;
  }, [scopedScales]);
  const selectedScale = scopedScales.find((scale) => scale.id === selectedScaleId) || null;

  const refreshState = async () => {
    if (!userId || !organizationId) return;
    const [nextPacks, estimate] = await Promise.all([
      listOfflineResourcePacks(userId, organizationId),
      getOfflineStorageEstimate(),
    ]);
    setPacks(nextPacks);
    setStorageUsage(estimate.usage);
  };

  useEffect(() => {
    void refreshState();
  }, [userId, organizationId]);

  const libraryPack = packs.find((pack) => pack.kind === 'library');
  const libraryRevisions = useMemo(
    () => Object.fromEntries(scopedSongs.map((song) => [song.id, getOfflineSongRevision(song)])),
    [scopedSongs],
  );
  const libraryCurrent = packMatchesSongs(
    libraryPack,
    scopedSongs.map((song) => song.id),
    libraryRevisions,
  );

  const scaleIsCurrent = (scale: PopulatedScale | null) => {
    if (!scale) return false;
    const pack = packs.find((item) => item.kind === 'scale' && item.targetId === scale.id);
    const revisions = Object.fromEntries(scale.songs.map((song) => [song.id, getOfflineSongRevision(song)]));
    return packMatchesSongs(pack, scale.songs.map((song) => song.id), revisions);
  };

  const describeResult = (result: OfflinePackWriteResult) => {
    const parts = [`${result.downloadedSongs} ${copy.offline.downloaded}`];
    if (result.reusedSongs > 0) parts.push(`${result.reusedSongs} ${copy.offline.reused}`);
    return parts.join(' · ');
  };

  const saveLibrary = async () => {
    if (!userId || !organizationId) return;
    setBusy('library');
    setFeedback(null);
    try {
      const result = await downloadLibraryPack({ userId, organizationId, songs: scopedSongs });
      setFeedback(describeResult(result));
      await refreshState();
    } finally {
      setBusy(null);
    }
  };

  const saveScale = async (scale: PopulatedScale | null, source: 'next' | 'selected') => {
    if (!scale || !userId || !organizationId) return;
    setBusy(source);
    setFeedback(null);
    try {
      const result = await downloadScalePack({ userId, organizationId, scale });
      setFeedback(describeResult(result));
      await refreshState();
    } finally {
      setBusy(null);
    }
  };

  const storageLabel = storageUsage > 0 ? `${(storageUsage / (1024 * 1024)).toFixed(storageUsage > 10 * 1024 * 1024 ? 0 : 1)} MB` : '—';

  return (
    <section className="min-w-0 overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#0d0d11]/92 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.26)] sm:p-6 lg:col-span-2">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.055] text-emerald-200">
          <HardDriveDownload className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-200/55">{copy.offline.eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-white">{copy.offline.title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/38">{copy.offline.description}</p>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-3 lg:grid-cols-3">
        <div className="min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-3.5">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-white/82">{copy.offline.nextScale}</p>
              <p className="mt-1 break-words text-[10px] leading-relaxed text-white/38">
                {nextScale ? formatScaleLabel(nextScale, locale) : copy.offline.noUpcomingScale}
              </p>
            </div>
            {scaleIsCurrent(nextScale) && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300/75" aria-label={copy.offline.available} />}
          </div>
          <button
            type="button"
            disabled={!nextScale || busy !== null}
            onClick={() => void saveScale(nextScale, 'next')}
            className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-[10px] font-bold text-white/72 transition-colors active:bg-white/[0.07] disabled:opacity-35"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {busy === 'next' ? copy.offline.preparing : scaleIsCurrent(nextScale) ? copy.offline.updateScale : copy.offline.downloadScale}
          </button>
        </div>

        <div className="min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-3.5">
          <p className="text-[11px] font-semibold text-white/82">{copy.offline.chooseScale}</p>
          <select
            value={selectedScaleId}
            onChange={(event) => setSelectedScaleId(event.target.value)}
            className="mt-2 h-10 w-full min-w-0 rounded-xl border border-white/[0.08] bg-black/30 px-3 text-[10px] text-white/72 outline-none focus:border-violet-200/35"
          >
            <option value="">{copy.offline.selectScale}</option>
            {scopedScales.map((scale) => (
              <option key={scale.id} value={scale.id}>{formatScaleLabel(scale, locale)}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedScale || busy !== null}
            onClick={() => void saveScale(selectedScale, 'selected')}
            className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-[10px] font-bold text-white/72 transition-colors active:bg-white/[0.07] disabled:opacity-35"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {busy === 'selected' ? copy.offline.preparing : scaleIsCurrent(selectedScale) ? copy.offline.updateScale : copy.offline.downloadScale}
          </button>
        </div>

        <div className="min-w-0 rounded-2xl border border-violet-300/10 bg-violet-300/[0.025] p-3.5">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-white/82">{copy.offline.library}</p>
              <p className="mt-1 break-words text-[10px] leading-relaxed text-white/38">{copy.offline.libraryDescription}</p>
              <p className="mt-2 text-[9px] font-semibold text-white/30">{scopedSongs.length} {copy.offline.songs}</p>
            </div>
            {libraryCurrent && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300/75" aria-label={copy.offline.available} />}
          </div>
          <button
            type="button"
            disabled={busy !== null || scopedSongs.length === 0}
            onClick={() => void saveLibrary()}
            className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-200/20 bg-violet-300/[0.08] px-3 text-[10px] font-bold text-violet-100/85 transition-colors active:bg-violet-300/[0.14] disabled:opacity-35"
          >
            <HardDriveDownload className="h-3.5 w-3.5" aria-hidden="true" />
            {busy === 'library' ? copy.offline.preparing : libraryCurrent ? copy.offline.updateLibrary : copy.offline.downloadLibrary}
          </button>
        </div>
      </div>

      {feedback && <p role="status" className="mt-3 text-[10px] font-medium text-emerald-200/65">{feedback}</p>}
      <div className="mt-4 flex min-w-0 flex-col gap-1 text-[9px] leading-relaxed text-white/27 sm:flex-row sm:items-center sm:justify-between">
        <span>{copy.offline.safetyNote}</span>
        <span className="shrink-0">{storageLabel} {copy.offline.storage}</span>
      </div>
    </section>
  );
};

export default OfflineResourcesPanel;
