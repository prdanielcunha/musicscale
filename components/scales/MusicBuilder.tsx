import React, { useState, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { PopulatedSong, Tag, ScaleSongSettingsUpdateResult } from "../../types";
import { hasChords, hasLyrics, getEffectiveKey, getEffectiveBpm, moveSongId, moveSongBeforeTarget } from "../../utils/scaleSongSettings";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";
import { XCircleIcon } from "../icons/XCircleIcon";
import { PlusCircleIcon } from "../icons/PlusCircleIcon";
import { ArrowUp, ArrowDown, GripVertical, Settings2 } from "lucide-react";
import { ScaleSongCard } from "./ScaleSongCard";
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
  onUpdateSongSettings: (songId: string, key: string | null, bpm: number | null, isGlobal: boolean) => Promise<ScaleSongSettingsUpdateResult>;
}

const MusicBuilder = forwardRef<any, MusicBuilderProps>(({
  formData,
  setFormData,
  songs,
  tags,
  onUpdateSongSettings,
}, ref) => {
  const { t } = useTranslation();
  const [songSearch, setSongSearch] = useState("");
  const [songStatusFilter, setSongStatusFilter] = useState<"all" | "active" | "new">("all");
  const [songTagFilterIds, setSongTagFilterIds] = useState<string[]>([]);
  const [mobileTab, setMobileTab] = useState<"library" | "setlist">("library");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focusSearchInput: async (): Promise<boolean> => {
       if (!searchInputRef.current) return false;
       
       if (searchInputRef.current.offsetParent === null) {
          setMobileTab('library');
          await new Promise(resolve => requestAnimationFrame(resolve));
          await new Promise(resolve => requestAnimationFrame(resolve));
       }
       
       if (searchInputRef.current) {
          searchInputRef.current.focus();
          if (searchInputRef.current.scrollIntoView) {
             const rect = searchInputRef.current.getBoundingClientRect();
             const isVisible = (
                 rect.top >= 0 &&
                 rect.left >= 0 &&
                 rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                 rect.right <= (window.innerWidth || document.documentElement.clientWidth)
             );
             if (!isVisible) {
               searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
             }
          }
          return true;
       }
       return false;
    }
  }));

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
        // Remove from list and also remove local settings to keep it clean
        const newSettings = { ...(prev.songSettings || {}) };
        delete newSettings[songId];
        return {
          ...prev,
          songIds: currentIds.filter((id: string) => id !== songId),
          songSettings: newSettings,
        };
      } else {
        return {
          ...prev,
          songIds: [...currentIds, songId],
        };
      }
    });
  };

  const handleSettingsChange = async (songId: string, key: string | null, bpm: number | null, isGlobal: boolean) => {
    return onUpdateSongSettings(songId, key, bpm, isGlobal);
  };

  const moveSong = (index: number, direction: "up" | "down") => {
    const currentIds = formData.songIds || [];
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === currentIds.length - 1)
    ) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const newIds = moveSongId(currentIds, index, targetIndex);
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
    const newIds = moveSongBeforeTarget(currentIds, draggedSongId, targetId);
    
    setFormData((prev: any) => ({ ...prev, songIds: newIds }));
    
    setDraggedSongId(null);
    setDropTargetId(null);
  };

  const handleDragEnd = () => {
    setDraggedSongId(null);
    setDropTargetId(null);
  };

  useEffect(() => {
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

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
      const newIds = moveSongId(currentIds, startIndex, targetIndex);

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

  const handleTouchCancel = () => {
    handleTouchEnd();
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
          {t('scaleModal.repertoireTab', 'Repertório')} 
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${mobileTab === 'setlist' ? (selectedSongsList.length > 0 ? 'bg-primary text-white' : 'bg-primary/20 text-primary dark:text-primary-light') : (selectedSongsList.length > 0 ? 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300' : 'bg-transparent text-slate-400')}`}>{selectedSongsList.length}</span>
        </button>
      </div>

      {/* Mobile Summary Banner (hoisted) */}
      <div className={`md:hidden mb-4 rounded-xl border p-3 flex flex-col gap-2 transition-all ${selectedSongsList.length > 0 ? 'bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30' : 'bg-slate-50 border-slate-200 dark:bg-white/5 dark:border-white/10'}`}>
        {selectedSongsList.length === 0 ? (
          <div className="flex flex-col">
            <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200" aria-live="polite">{t('scaleModal.noSongsSelected', 'Nenhuma música selecionada')}</span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('scaleModal.noSongsSelectedDescription', 'Escolha músicas da biblioteca para montar o repertório.')}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col overflow-hidden">
              <span className="text-[13px] font-bold text-primary-dark dark:text-primary-light" aria-live="polite">
                {selectedSongsList.length === 1 
                  ? t('scaleModal.selectedSongsCount_one', '1 música selecionada') 
                  : t('scaleModal.selectedSongsCount', '{{count}} músicas selecionadas', { count: selectedSongsList.length })}
              </span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate">
                {selectedSongsList.length <= 2 
                  ? selectedSongsList.map(s => s.title).join(', ')
                  : t('scaleModal.selectedSongsPreviewMore', '{{songs}} +{{more}}', { 
                      songs: selectedSongsList.slice(0, 2).map(s => s.title).join(', '), 
                      more: selectedSongsList.length - 2 
                    })}
              </span>
            </div>
            {mobileTab === 'library' ? (
              <button 
                type="button"
                onClick={() => setMobileTab('setlist')}
                className="shrink-0 bg-white dark:bg-[#2A2A2C] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                {t('scaleModal.viewSetlist', 'Ver repertório')}
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => setMobileTab('library')}
                className="shrink-0 bg-white dark:bg-[#2A2A2C] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                {t('scaleModal.addMoreSongs', 'Adicionar mais músicas')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Library Column */}
        <div className={`flex-col w-full lg:w-1/2 h-full overflow-hidden ${mobileTab === 'library' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex flex-col space-y-3 flex-shrink-0 mb-4">
             <div className="relative">
               <input 
                 ref={searchInputRef}
                 type="text" 
                 id="repertoire-selector-input"
                 value={songSearch} 
                 onChange={e => setSongSearch(e.target.value)} 
                 placeholder={t('scaleModal.searchSongs', 'Buscar músicas...')}
                 className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-white placeholder:text-slate-400"
               />
             </div>
             
             {/* Status Filters */}
             <div className="flex space-x-2">
               {['all', 'active', 'new'].map((status) => (
                 <button
                   key={status}
                   type="button"
                   onClick={() => setSongStatusFilter(status as any)}
                   className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                     songStatusFilter === status
                       ? "bg-primary text-white shadow-sm"
                       : "bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10"
                   }`}
                 >
                   {t(`scaleModal.filter_${status}`, status === 'all' ? 'Todas' : status === 'active' ? 'Ativas' : 'Novas')}
                 </button>
               ))}
             </div>

             {/* Tag Filters */}
             <div className="flex flex-wrap gap-2 items-center">
                {selectedFilterTags.map(tag => (
                  <span key={tag.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-primary/10 text-primary-dark dark:text-primary-light">
                    {tag.name}
                    <button type="button" onClick={() => setSongTagFilterIds(prev => prev.filter(id => id !== tag.id))} className="hover:text-primary"><XCircleIcon className="w-3.5 h-3.5"/></button>
                  </span>
                ))}
                {availableFilterTags.length > 0 && (
                  <select 
                    className="bg-transparent text-[11px] font-medium text-slate-500 dark:text-slate-400 outline-none cursor-pointer"
                    onChange={(e) => {
                      if (e.target.value) {
                        setSongTagFilterIds(prev => [...prev, e.target.value]);
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">+ {t('scaleModal.filterTag', 'Tag')}</option>
                    {availableFilterTags.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
             </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 pb-20 md:pb-4">
            {filteredSongs.length > 0 ? (
              filteredSongs.map(song => {
                const isSelected = selectedSongsList.some(s => s.id === song.id);
                return (
                  <ScaleSongCard
                    key={song.id}
                    song={song}
                    isSelected={isSelected}
                    mode="library"
                    tags={tags}
                    localSettings={formData.songSettings?.[song.id]}
                    onToggle={() => handleSongToggle(song.id)}
                    onSettingsChange={(key, bpm, isGlobal) => handleSettingsChange(song.id, key, bpm, isGlobal)}
                  />
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t('scaleModal.noSongsFoundTitle', 'Nenhuma música')}</span>
                <span className="text-[11px] text-slate-500 max-w-[200px]">{t('scaleModal.noSongsFoundDesc', 'Tente buscar com outros termos')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Setlist Column */}
        <div className={`flex-col w-full lg:w-1/2 h-full overflow-hidden ${mobileTab === 'setlist' ? 'flex' : 'hidden md:flex'}`}>
          <div className="hidden md:flex items-center justify-between mb-4 flex-shrink-0">
             <h3 className="text-[14px] font-bold text-slate-800 dark:text-white flex items-center gap-2">
               {t('scaleModal.repertoireTitle', 'Repertório')} 
               <span className="bg-primary/10 text-primary dark:text-primary-light px-2 py-0.5 rounded-full text-[11px]">{selectedSongsList.length}</span>
             </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20 md:pb-4">
             {selectedSongsList.length > 0 ? (
                <div className="space-y-2">
                  <div className="mb-3 px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-lg flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Settings2 className="w-4 h-4 shrink-0" />
                    <span className="text-[11px] leading-tight font-medium">
                      {t('scaleModal.customizeKeyBpmHelp', 'Personalize o tom e o BPM de cada música para esta escala.')}
                    </span>
                  </div>
                  {selectedSongsList.map((song, index) => {
                  return (
                    <React.Fragment key={song.id}>
                      <div 
                        onDragOver={(e) => handleDragOver(e, song.id)}
                        onDrop={(e) => handleDrop(e, song.id)}
                        onDragLeave={() => setDropTargetId(null)}
                        className={`h-2 rounded-md transition-all duration-150 ${dropTargetId === song.id ? "bg-primary/50 h-8" : ""}`}
                      />
                      <ScaleSongCard
                        song={song}
                        isSelected={true}
                        mode="setlist"
                        index={index}
                        tags={tags}
                        localSettings={formData.songSettings?.[song.id]}
                        onToggle={() => handleSongToggle(song.id)}
                        onMoveUp={() => moveSong(index, "up")}
                        onMoveDown={() => moveSong(index, "down")}
                        isFirst={index === 0}
                        isLast={index === selectedSongsList.length - 1}
                        isDragging={draggedSongId === song.id}
                        onDragStart={(e) => handleDragStart(e, song.id)}
                        onDragEnd={handleDragEnd}
                        onTouchStart={(e: any) => handleTouchStart(e, index)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={handleTouchCancel}
                        onSettingsChange={(key, bpm, isGlobal) => handleSettingsChange(song.id, key, bpm, isGlobal)}
                      />
                    </React.Fragment>
                  )
                })}
                </div>
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
  );
});

export default MusicBuilder;
