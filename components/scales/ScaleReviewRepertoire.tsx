import React, { useState, useRef, useEffect } from "react";
import { PopulatedSong, Tag, ScaleSongSettingsUpdateResult, ScaleSongSettings } from "../../types";
import { ScaleSongCard } from "./ScaleSongCard";
import { moveSongId, moveSongBeforeTarget } from "../../utils/scaleSongSettings";
import { useTranslation } from "react-i18next";
import { ListMusic, SlidersHorizontal } from "lucide-react";

interface ScaleReviewRepertoireProps {
  songIds: string[];
  songs: PopulatedSong[];
  tags: Tag[];
  songSettings: Record<string, ScaleSongSettings> | undefined;
  onUpdateSongSettings: (
    songId: string,
    key: string | null,
    bpm: number | null,
    isGlobal: boolean
  ) => Promise<ScaleSongSettingsUpdateResult>;
  onSongIdsChange: (newSongIds: string[]) => void;
  goToStep: (step: 'build' | 'details' | 'team') => void;
}

export const ScaleReviewRepertoire: React.FC<ScaleReviewRepertoireProps> = ({
  songIds,
  songs,
  tags,
  songSettings,
  onUpdateSongSettings,
  onSongIdsChange,
  goToStep,
}) => {
  const { t } = useTranslation();
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const dragInfo = useRef<{
    startIndex: number | null;
    element: HTMLElement | null;
    previousBodyOverflow: string | null;
  }>({ startIndex: null, element: null, previousBodyOverflow: null });
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      cleanupTouch();
    };
  }, []);

  const cleanupTouch = () => {
    if (dragInfo.current.element) {
      dragInfo.current.element.classList.remove("opacity-50", "shadow-2xl");
    }
    if (dragInfo.current.previousBodyOverflow !== null) {
      document.body.style.overflow = dragInfo.current.previousBodyOverflow;
    }
    dragInfo.current = { startIndex: null, element: null, previousBodyOverflow: null };
    if (isMounted.current) setDropTargetId(null);
  };

  const moveSongReview = (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === songIds.length - 1)) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    onSongIdsChange(moveSongId(songIds, index, targetIndex));
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, songId: string) => {
    setDraggedSongId(songId);
    e.dataTransfer.effectAllowed = "move";
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, songId: string) => {
    e.preventDefault();
    if (draggedSongId && draggedSongId !== songId) setDropTargetId(songId);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!draggedSongId || draggedSongId === targetId) return;
    onSongIdsChange(moveSongBeforeTarget(songIds, draggedSongId, targetId));
    setDraggedSongId(null);
    setDropTargetId(null);
  };

  const handleDragEnd = () => {
    setDraggedSongId(null);
    setDropTargetId(null);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, index: number) => {
    cleanupTouch();
    dragInfo.current.startIndex = index;
    const songItem = e.currentTarget.closest<HTMLElement>("[data-song-id]");
    dragInfo.current.element = songItem;
    dragInfo.current.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (songItem) songItem.classList.add("opacity-50", "shadow-2xl");
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dragInfo.current.startIndex === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!targetElement) return;
    const songItem = targetElement.closest<HTMLElement>("[data-song-id]");
    if (!songItem) return;
    setDropTargetId(songItem.dataset.songId || null);
    const targetIndex = Number(songItem.dataset.index);
    const startIndex = dragInfo.current.startIndex;
    if (!isNaN(targetIndex) && targetIndex !== startIndex) {
      dragInfo.current.startIndex = targetIndex;
      onSongIdsChange(moveSongId(songIds, startIndex, targetIndex));
    }
  };

  const handleTouchEnd = () => cleanupTouch();
  const handleTouchCancel = () => cleanupTouch();

  return (
    <section className="ms-panel relative overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />

      <div className="mb-4 flex items-start justify-between gap-3 sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-primary/15 bg-primary/[0.07] text-primary-light">
              <ListMusic className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <span className="ms-kicker">{t('scaleModal.repertoire', 'Repertório')}</span>
              {songIds && songIds.length > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[11px] font-semibold tabular-nums text-white/48">{songIds.length}</span>
                  <span className="h-1 w-1 rounded-full bg-white/20" aria-hidden="true" />
                  <div className="flex items-center gap-1" aria-hidden="true">
                    {songIds.slice(0, 8).map((id, index) => (
                      <span
                        key={`${id}-${index}`}
                        className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${index === 0 ? 'w-5 bg-primary/75' : 'w-2.5 bg-white/14'}`}
                      />
                    ))}
                    {songIds.length > 8 && <span className="text-[9px] font-bold text-white/28">+{songIds.length - 8}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
          {songIds && songIds.length >= 2 && (
            <p className="mt-3 max-w-xl text-[12px] font-medium leading-relaxed text-white/38">
              {t('scaleModal.reviewInstruction', 'Arraste as músicas ou use as setas para definir a ordem do culto.')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => goToStep('build')}
          className="premium-interactive inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-[12px] border border-primary/20 bg-primary/[0.08] px-3 py-2 text-[11px] font-semibold text-primary-light hover:bg-primary/[0.13]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden min-[390px]:inline">{t('scaleModal.editRepertoire', 'Editar Repertório')}</span>
        </button>
      </div>

      {songIds && songIds.length > 0 ? (
        <div className="relative space-y-2">
          {songIds.length >= 2 && (
            <div
              className="pointer-events-none absolute bottom-6 left-[60px] top-6 z-0 w-px bg-gradient-to-b from-primary/25 via-white/[0.08] to-primary/20"
              aria-hidden="true"
            />
          )}
          {songIds.map((id, index) => {
            const song = songs.find(s => s.id === id);
            if (!song) return null;
            return (
              <React.Fragment key={song.id}>
                <div
                  onDragOver={(e) => handleDragOver(e, song.id)}
                  onDrop={(e) => handleDrop(e, song.id)}
                  onDragLeave={() => setDropTargetId(null)}
                  className={`relative z-10 rounded-full transition-[height,background-color] duration-150 ${dropTargetId === song.id ? "h-5 bg-primary/50" : "h-1"}`}
                />
                <div className="relative z-10">
                  <ScaleSongCard
                    song={song}
                    isSelected={true}
                    mode="review"
                    index={index}
                    tags={tags}
                    localSettings={songSettings?.[song.id]}
                    onSettingsChange={(key, bpm, isGlobal) => onUpdateSongSettings(song.id, key, bpm, isGlobal)}
                    onToggle={() => onSongIdsChange(songIds.filter(id => id !== song.id))}
                    onMoveUp={() => moveSongReview(index, "up")}
                    onMoveDown={() => moveSongReview(index, "down")}
                    isFirst={index === 0}
                    isLast={index === songIds.length - 1}
                    isDragging={draggedSongId === song.id}
                    onDragStart={(e) => handleDragStart(e, song.id)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e: any) => handleTouchStart(e, index)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchCancel}
                  />
                </div>
              </React.Fragment>
            );
          })}
          <div
            onDragOver={(e) => handleDragOver(e, "end")}
            onDrop={(e) => handleDrop(e, "end")}
            onDragLeave={() => setDropTargetId(null)}
            className={`relative z-10 rounded-full transition-[height,background-color] duration-150 ${dropTargetId === "end" ? "h-5 bg-primary/50" : "h-1"}`}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-white/[0.1] bg-white/[0.02] p-6 text-center">
          <span className="mb-3 text-[13px] font-medium text-white/45">
            {t('scaleModal.noSongsSelected', 'Nenhuma música selecionada')}
          </span>
          <button
            type="button"
            onClick={() => goToStep('build')}
            className="ms-btn-primary min-h-[40px] px-4 text-[12px]"
          >
            {t('scaleModal.addMoreSongs', 'Adicionar músicas')}
          </button>
        </div>
      )}
    </section>
  );
};
