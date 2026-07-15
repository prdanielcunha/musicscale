import React, { useState, useMemo, useRef } from "react";
import { PopulatedSong, Tag } from "../../types";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";
import { XCircleIcon } from "../icons/XCircleIcon";
import { PlusCircleIcon } from "../icons/PlusCircleIcon";
import { ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { AiContextualSuggestions } from "./AiContextualSuggestions";
import { useTranslation } from "react-i18next";

const formLabelClass =
  "block text-[11px] font-black tracking-widest text-slate-400 uppercase dark:text-slate-500 mb-2 ml-1";
const formInputClass = "mt-1 input-base";

interface MusicBuilderProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  songs: PopulatedSong[];
  tags: Tag[];
}

const MusicBuilder: React.FC<MusicBuilderProps> = ({
  formData,
  setFormData,
  songs,
  tags,
}) => {
  const { t } = useTranslation();
  const [songSearch, setSongSearch] = useState("");
  const [songStatusFilter, setSongStatusFilter] = useState<"all" | "active" | "new">("all");
  const [songTagFilterIds, setSongTagFilterIds] = useState<string[]>([]);
  const [mobileTab, setMobileTab] = useState<"library" | "setlist">("library");

  // Filtering songs
  const filteredSongs = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return songs
      .filter((song) => {
        const searchMatch =
          songSearch === "" ||
          song.title.toLowerCase().includes(songSearch.toLowerCase()) ||
          song.artist.toLowerCase().includes(songSearch.toLowerCase());

        let statusMatch = true;
        if (songStatusFilter === "active") {
          statusMatch = song.isActive;
        } else if (songStatusFilter === "new") {
          const createdAt = song.createdAt ? new Date(song.createdAt) : new Date(0);
          statusMatch = createdAt > sevenDaysAgo;
        }

        const tagMatch =
          songTagFilterIds.length === 0 ||
          songTagFilterIds.every((tagId) => song.tagIds?.includes(tagId));

        return searchMatch && statusMatch && tagMatch;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [songs, songSearch, songStatusFilter, songTagFilterIds]);

  const selectedFilterTags = tags.filter((t) => songTagFilterIds.includes(t.id));
  const availableFilterTags = tags
    .filter((t) => !songTagFilterIds.includes(t.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedSongsList = useMemo(() => {
    if (!formData.songIds) return [];
    return formData.songIds
      .map((id: string) => songs.find((s) => s.id === id))
      .filter(Boolean) as PopulatedSong[];
  }, [formData.songIds, songs]);

  const handleSongToggle = (songId: string) => {
    setFormData((prev: any) => {
      const currentIds = prev.songIds || [];
      if (currentIds.includes(songId)) {
        return {
          ...prev,
          songIds: currentIds.filter((id: string) => id !== songId),
        };
      } else {
        return {
          ...prev,
          songIds: [...currentIds, songId],
        };
      }
    });
  };

  const moveSong = (index: number, direction: "up" | "down") => {
    const currentIds = formData.songIds || [];
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === currentIds.length - 1)
    ) return;

    const newIds = [...currentIds];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newIds[index], newIds[swapIndex]] = [newIds[swapIndex], newIds[index]];
    setFormData((prev: any) => ({ ...prev, songIds: newIds }));
  };

  // Drag and Drop
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const dragInfo = React.useRef<{
    startIndex: number | null;
    element: HTMLElement | null;
  }>({ startIndex: null, element: null });

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

    const currentIds = formData.songIds || [];
    const sourceIndex = currentIds.indexOf(draggedSongId);
    let targetIndex = currentIds.indexOf(targetId);
    
    if (targetId === "end") {
      targetIndex = currentIds.length;
    }
    
    if (sourceIndex === -1 || targetIndex === -1) return;
    
    const newIds = [...currentIds];
    const [removed] = newIds.splice(sourceIndex, 1);
    
    // If we're dropping at a specific index, we need to adjust if we removed an item before it
    if (targetId !== "end" && sourceIndex < targetIndex) {
       targetIndex -= 1;
    }
    
    newIds.splice(targetIndex, 0, removed);
    
    setFormData((prev: any) => ({ ...prev, songIds: newIds }));
    
    setDraggedSongId(null);
    setDropTargetId(null);
  };

  const handleDragEnd = () => {
    setDraggedSongId(null);
    setDropTargetId(null);
  };

  // Touch Drag Handlers
  const handleTouchStart = (
    e: React.TouchEvent<HTMLDivElement>,
    index: number,
  ) => {
    dragInfo.current.startIndex = index;
    const songItem = e.currentTarget.closest<HTMLElement>("[data-song-id]");
    dragInfo.current.element = songItem;
    if (songItem) {
      songItem.classList.add("opacity-50", "shadow-2xl");
    }
    document.body.style.overflow = "hidden"; // Prevent page scroll
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dragInfo.current.startIndex === null) return;

    // Prevent page scrolling during drag
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
      const currentIds = formData.songIds || [];
      const newIds = [...currentIds];
      const [movedItem] = newIds.splice(startIndex, 1);
      newIds.splice(targetIndex, 0, movedItem);

      dragInfo.current.startIndex = targetIndex;
      setFormData((prev: any) => ({ ...prev, songIds: newIds }));
    }
  };

  const handleTouchEnd = () => {
    if (dragInfo.current.element) {
      dragInfo.current.element.classList.remove("opacity-50", "shadow-2xl");
    }
    dragInfo.current = { startIndex: null, element: null };
    setDropTargetId(null);
    document.body.style.overflow = "auto"; // Re-enable scroll
  };

  return (
    <div className="flex flex-col -mx-4 px-4 sm:mx-0 sm:px-0">
      {/* Mobile Tabs */}
      <div className="md:hidden flex rounded-xl bg-slate-100 dark:bg-white/5 p-1 mb-4 flex-shrink-0">
        <button 
          type="button" 
          onClick={() => setMobileTab("library")} 
          className={`flex-1 py-2 text-[13px] font-bold tracking-wide rounded-lg transition-all ${mobileTab === 'library' ? 'bg-white dark:bg-[#2A2A2C] shadow-sm text-slate-800 dark:text-white' : 'text-slate-500'}`}
        >
          {t('scaleModal.library', 'Biblioteca')}
        </button>
        <button 
          type="button" 
          onClick={() => setMobileTab("setlist")} 
          className={`flex-1 py-2 text-[13px] font-bold tracking-wide rounded-lg transition-all flex items-center justify-center gap-1.5 ${mobileTab === 'setlist' ? 'bg-white dark:bg-[#2A2A2C] shadow-sm text-slate-800 dark:text-white' : 'text-slate-500'}`}
        >
          {t('scaleModal.myRepertoire', 'Meu Repertório')} {selectedSongsList.length > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${mobileTab === 'setlist' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'}`}>{selectedSongsList.length}</span>}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Library Column */}
        <div className={`flex-col w-full md:w-1/2 ${mobileTab === 'library' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex flex-col space-y-3 flex-shrink-0">
            <label className={formLabelClass}>{t('scaleModal.availableSongs')}</label>
            <input
              type="search"
              placeholder={t('scaleModal.searchSongs')}
              value={songSearch}
              onChange={(e) => setSongSearch(e.target.value)}
              className={formInputClass}
            />

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 p-1">
          <div className="sm:col-span-3 inline-flex rounded-xl shadow-sm bg-slate-100 dark:bg-black/40 border border-slate-200/60 dark:border-white/5 p-1 w-full">
            <button
              type="button"
              onClick={() => setSongStatusFilter("all")}
              className={`w-1/3 px-2 py-1.5 text-xs font-bold tracking-wide rounded-lg transition-all ${songStatusFilter === "all" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"}`}
            >
              {t('scaleModal.allFilter')}
            </button>
            <button
              type="button"
              onClick={() => setSongStatusFilter("active")}
              className={`w-1/3 px-2 py-1.5 text-xs font-bold tracking-wide rounded-lg transition-all ${songStatusFilter === "active" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"}`}
            >
              {t('scaleModal.activeFilter')}
            </button>
            <button
              type="button"
              onClick={() => setSongStatusFilter("new")}
              className={`w-1/3 px-2 py-1.5 text-xs font-bold tracking-wide rounded-lg transition-all ${songStatusFilter === "new" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"}`}
            >
              {t('scaleModal.newFilter')}
            </button>
          </div>
          <div className="sm:col-span-2">
            <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-50 dark:bg-black/20 border border-slate-200/80 dark:border-white/10 rounded-xl min-h-[44px] h-full transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30">
              {selectedFilterTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-1 bg-primary/10 text-primary-dark dark:text-primary-light text-[11px] font-bold tracking-wide px-2 py-1 rounded-md"
                >
                  <span>{tag.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSongTagFilterIds((prev) =>
                        prev.filter((id) => id !== tag.id),
                      )
                    }
                    className="hover:bg-primary/20 rounded-full"
                    aria-label={`Remover tag ${tag.name}`}
                  >
                    <XCircleIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="relative flex-grow min-w-[120px]">
                <select
                  id="tag-filter-add"
                  value=""
                  onChange={(e) => {
                    const newId = e.target.value;
                    if (newId && !songTagFilterIds.includes(newId)) {
                      setSongTagFilterIds((prev) => [...prev, newId]);
                    }
                  }}
                  className="w-full h-full appearance-none bg-transparent border-none focus:ring-0 text-sm text-slate-500 dark:text-gray-400 p-1 cursor-pointer"
                  disabled={availableFilterTags.length === 0}
                >
                  <option value="" disabled>
                    {availableFilterTags.length > 0
                      ? t('scaleModal.addTag')
                      : t('scaleModal.noTag')}
                  </option>
                  {availableFilterTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        </div>

        <div className="space-y-2 pr-2 rounded-2xl p-1">
          {filteredSongs.map((song) => {
            const isSelected = formData.songIds?.includes(song.id);
            const hasChords = !!song.content;
            const hasLyrics = !!song.lyrics;
            const bpmBadge = song.bpm ? ` · BPM: ${song.bpm}` : " · BPM não detectado";
            const keyBadge = song.key ? `Tom: ${song.key}` : "";

            return (
              <button
                type="button"
                key={song.id}
                onClick={() => handleSongToggle(song.id)}
                className={`w-full text-left p-3 rounded-xl flex justify-between items-center transition-all duration-300 border ${isSelected ? "bg-primary/5 border-primary/30 shadow-sm dark:bg-primary/10 dark:border-primary/30" : "bg-white dark:bg-[#1C1C1E] border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 hover:shadow-sm"}`}
              >
                <div className="flex-1 min-w-0 pr-3">
                  <p className={`font-semibold text-sm truncate transition-colors ${isSelected ? "text-primary-dark dark:text-primary-light" : "text-slate-800 dark:text-slate-200"}`}>
                    {song.title}
                  </p>
                  <p className={`text-[11px] truncate transition-colors font-medium mt-0.5 ${isSelected ? "text-primary/70 dark:text-primary-light/70" : "text-slate-500 dark:text-slate-400"}`}>
                    {song.artist} {keyBadge ? ` · ${keyBadge}` : ""}{bpmBadge}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                     {hasChords && <span className="text-[9px] px-1.5 py-0.5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 rounded bg-slate-50 dark:bg-white/5 uppercase font-bold tracking-widest">{t('scaleModal.chords')}</span>}
                     {hasLyrics && <span className="text-[9px] px-1.5 py-0.5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 rounded bg-slate-50 dark:bg-white/5 uppercase font-bold tracking-widest">{t('scaleModal.lyrics')}</span>}
                     {!hasChords && !hasLyrics && <span className="text-[9px] px-1.5 py-0.5 border border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 rounded bg-slate-50 dark:bg-white/5 uppercase font-bold tracking-widest opacity-60">{t('scaleModal.noChords')}</span>}
                     {song.tagIds?.map(tagId => {
                         const tag = tags.find(t => t.id === tagId);
                         return tag ? <span key={tag.id} className="text-[9px] px-1.5 py-0.5 border border-primary/20 text-primary-dark dark:text-primary-light rounded bg-primary/5 uppercase font-bold tracking-widest">{tag.name}</span> : null;
                     })}
                  </div>
                </div>
                <div onClick={(e) => { e.stopPropagation(); handleSongToggle(song.id); }} className={`flex-shrink-0 flex items-center justify-center transition-all ${isSelected ? "text-primary dark:text-primary-light bg-primary/10 px-2.5 py-1.5 rounded-lg border border-primary/20 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-900/30" : "w-8 h-8 rounded-full bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-600 dark:hover:text-white"}`}>
                  {isSelected ? (
                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center">
                      {t('scaleModal.added')} <XCircleIcon className="w-3.5 h-3.5 ml-1.5 opacity-60" />
                    </span>
                  ) : (
                    <PlusCircleIcon className="w-5 h-5" />
                  )}
                </div>
              </button>
            );
          })}
          {filteredSongs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
               <MusicNoteIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
               <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('scaleModal.noSongsFound')}</p>
               <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('scaleModal.adjustSearch')}</p>
            </div>
          )}
          </div>
        </div>

        {/* Setlist Column */}
        <div className={`flex-col bg-slate-50/50 dark:bg-[#1C1C1E]/50 rounded-2xl md:bg-transparent w-full md:w-1/2 ${mobileTab === 'setlist' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex flex-col space-y-3 p-4 md:p-0">
            <label className={formLabelClass}>
              {t('scaleModal.scaleRepertoire')} ({formData.songIds?.length || 0})
            </label>
            <div
              className="space-y-2 pr-2"
            >
          {selectedSongsList.length > 0 ? (
            selectedSongsList.map((song, index) => {
              const hasChords = !!song.content;
              const hasLyrics = !!song.lyrics;
              const bpmBadge = song.bpm ? ` · BPM: ${song.bpm}` : " · BPM não detectado";
              const keyBadge = song.key ? `Tom: ${song.key}` : "";

              return (
              <React.Fragment key={song.id}>
                <div
                  onDragOver={(e) => handleDragOver(e, song.id)}
                  onDrop={(e) => handleDrop(e, song.id)}
                  onDragLeave={() => setDropTargetId(null)}
                  className={`transition-all duration-150 rounded-xl ${dropTargetId === song.id ? "bg-primary/30 h-10 my-2" : "h-1 my-0.5"}`}
                />
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, song.id)}
                  onDragEnd={handleDragEnd}
                  data-song-id={song.id}
                  data-index={index}
                  className={`group flex items-center p-3 rounded-xl bg-white dark:bg-[#1C1C1E] border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all ${draggedSongId === song.id ? "opacity-30 scale-95" : "opacity-100 hover:border-slate-300 dark:hover:border-white/10"}`}
                >
                  <div
                    onTouchStart={(e) => handleTouchStart(e, index)}
                    className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 touch-none transition-colors"
                  >
                    <GripVertical className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0 px-2 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                       <div className="text-[10px] font-black bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 px-1.5 py-0.5 rounded-md min-w-[20px] text-center">{String(index + 1).padStart(2, '0')}</div>
                       <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                         {song.title}
                       </p>
                    </div>
                    <div className="flex flex-col ml-8 mt-0.5">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                        {song.artist} {keyBadge ? ` · ${keyBadge}` : ""}{bpmBadge}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                         {hasChords && <span className="text-[9px] px-1.5 py-0.5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 rounded bg-white dark:bg-black/20 uppercase font-bold tracking-widest">{t('scaleModal.chords')}</span>}
                         {hasLyrics && <span className="text-[9px] px-1.5 py-0.5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 rounded bg-white dark:bg-black/20 uppercase font-bold tracking-widest">{t('scaleModal.lyrics')}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center flex-shrink-0 gap-1 transition-opacity">
                    <div className="flex flex-col bg-slate-50 dark:bg-white/5 rounded-lg overflow-hidden border border-slate-100 dark:border-white/5 mr-1">
                      <button
                        type="button"
                        onClick={() => moveSong(index, "up")}
                        disabled={index === 0}
                        className="p-0.5 text-slate-400 enabled:hover:bg-slate-200 dark:enabled:hover:bg-white/10 enabled:hover:text-slate-700 dark:enabled:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Mover para cima"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSong(index, "down")}
                        disabled={index === selectedSongsList.length - 1}
                        className="p-0.5 text-slate-400 enabled:hover:bg-slate-200 dark:enabled:hover:bg-white/10 enabled:hover:text-slate-700 dark:enabled:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Mover para baixo"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSongToggle(song.id)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-red-500 rounded-lg transition-colors border border-transparent hover:border-red-600"
                      title="Remover"
                    >
                      <XCircleIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </React.Fragment>
            )})
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
              <div className="w-16 h-16 bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 flex items-center justify-center mb-4">
                 <MusicNoteIcon className="w-8 h-8 text-primary/50" />
              </div>
              <h4 className="text-[14px] font-bold text-slate-700 dark:text-gray-200 mb-1">
                {t('scaleModal.emptyScaleTitle')}
              </h4>
              <p className="text-[12px] text-slate-500 max-w-xs mx-auto mb-2">
                {t('scaleModal.emptyScaleDesc')}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[200px] border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 px-2 py-1.5 rounded-lg flex items-center justify-center gap-1.5 mx-auto">
                 <span>{t('scaleModal.emptyScaleTip').split('+')[0]} <PlusCircleIcon className="w-3 h-3 inline"/> {t('scaleModal.emptyScaleTip').split('+')[1]}</span>
              </p>
            </div>
          )}
          <div // Final drop target
            onDragOver={(e) => handleDragOver(e, "end")}
            onDrop={(e) => handleDrop(e, "end")}
            onDragLeave={() => setDropTargetId(null)}
            className={`h-2 rounded-md transition-all duration-150 ${dropTargetId === "end" ? "bg-primary/50 h-8" : ""}`}
          />
          
          {selectedSongsList.length > 0 && (
              <AiContextualSuggestions
                  currentSongs={selectedSongsList}
                  librarySongs={songs}
                  compact={true}
                  onAddSuggestion={(suggestion) => {
                      if (suggestion.id) {
                          handleSongToggle(suggestion.id);
                      } else {
                          setSongSearch(suggestion.title);
                      }
                  }}
              />
          )}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default MusicBuilder;
