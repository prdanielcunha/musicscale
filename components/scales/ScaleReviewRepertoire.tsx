import React, { useState, useRef, useEffect } from "react";
import { PopulatedSong, Tag, ScaleSongSettingsUpdateResult, ScaleSongSettings } from "../../types";
import { ScaleSongCard } from "./ScaleSongCard";
import { moveSongId, moveSongBeforeTarget } from "../../utils/scaleSongSettings";
import { useTranslation } from "react-i18next";

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
    if (isMounted.current) {
      setDropTargetId(null);
    }
  };

  // Cleanup body overflow on unmount
  

  const moveSongReview = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === songIds.length - 1)
    ) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const newIds = moveSongId(songIds, index, targetIndex);
    onSongIdsChange(newIds);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, songId: string) => {
    setDraggedSongId(songId);
    e.dataTransfer.effectAllowed = "move";
    const img = new Image();
    img.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, songId: string) => {
    e.preventDefault();
    if (draggedSongId && draggedSongId !== songId) {
      setDropTargetId(songId);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!draggedSongId || draggedSongId === targetId) return;

    const newIds = moveSongBeforeTarget(songIds, draggedSongId, targetId);
    onSongIdsChange(newIds);
    
    setDraggedSongId(null);
    setDropTargetId(null);
  };

  const handleDragEnd = () => {
    setDraggedSongId(null);
    setDropTargetId(null);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, index: number) => {
    cleanupTouch(); // garantir que um novo gesto não herde referências do gesto anterior
    dragInfo.current.startIndex = index;
    const songItem = e.currentTarget.closest<HTMLElement>("[data-song-id]");
    dragInfo.current.element = songItem;
    dragInfo.current.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (songItem) {
      songItem.classList.add("opacity-50", "shadow-2xl");
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dragInfo.current.startIndex === null) return;
    e.preventDefault();

    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(
      touch.clientX,
      touch.clientY,
    );
    if (!targetElement) return;

    const songItem = targetElement.closest<HTMLElement>("[data-song-id]");
    if (!songItem) return;

    setDropTargetId(songItem.dataset.songId || null);

    const targetIndex = Number(songItem.dataset.index);
    const startIndex = dragInfo.current.startIndex;

    if (!isNaN(targetIndex) && targetIndex !== startIndex) {
      const newIds = moveSongId(songIds, startIndex, targetIndex);

      dragInfo.current.startIndex = targetIndex;
      onSongIdsChange(newIds);
    }
  };

  const handleTouchEnd = () => {
    cleanupTouch();
  };

  const handleTouchCancel = () => {
    cleanupTouch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs uppercase font-bold tracking-widest">
          {t('scaleModal.repertoire', 'Repertório')}
        </span>
        <button
          type="button"
          onClick={() => goToStep('build')}
          className="text-xs font-bold text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
        >
          {t('scaleModal.editRepertoire', 'Editar Repertório')}
        </button>
      </div>
      {songIds && songIds.length >= 2 && (
        <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-4 font-medium leading-relaxed">
          {t('scaleModal.reviewInstruction', 'Arraste as músicas ou use as setas para definir a ordem do culto.')}
        </p>
      )}
      {songIds && songIds.length > 0 ? (
        <div className="space-y-2">
          {songIds.map((id, index) => {
            const song = songs.find(s => s.id === id);
            if (!song) return null;
            return (
              <React.Fragment key={song.id}>
                <div 
                  onDragOver={(e) => handleDragOver(e, song.id)}
                  onDrop={(e) => handleDrop(e, song.id)}
                  onDragLeave={() => setDropTargetId(null)}
                  className={`h-2 rounded-md transition-all duration-150 ${dropTargetId === song.id ? "bg-primary/50 h-8" : ""}`}
                />
                <ScaleSongCard
                  key={song.id}
                  song={song}
                  isSelected={true}
                  mode="review"
                  index={index}
                  tags={tags}
                  localSettings={songSettings?.[song.id]}
                  onSettingsChange={(key, bpm, isGlobal) => onUpdateSongSettings(song.id, key, bpm, isGlobal)}
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
              </React.Fragment>
            );
          })}
          <div // Final drop target
            onDragOver={(e) => handleDragOver(e, "end")}
            onDrop={(e) => handleDrop(e, "end")}
            onDragLeave={() => setDropTargetId(null)}
            className={`h-2 rounded-md transition-all duration-150 ${dropTargetId === "end" ? "bg-primary/50 h-8" : ""}`}
          />
        </div>
      ) : (
        <span className="text-sm text-slate-400 italic">Nenhuma música selecionada</span>
      )}
    </div>
  );
};
