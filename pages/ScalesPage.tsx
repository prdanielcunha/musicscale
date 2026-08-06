import { logger } from "../lib/logger";

import React, { useState, useMemo, useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams, useParams } from "react-router-dom";
import type { PopulatedScale, Scale, BandScale } from "../types";
import { useMusic } from "../contexts/MusicDataContext";
import { useModals } from "../contexts/ModalContext";
import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../contexts/ApiContext";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Spinner from "../components/common/Spinner";
import EmptyState from "../components/common/EmptyState";
import Modal from "../components/common/Modal";
import ConfirmationModal from "../components/common/ConfirmationModal";
import { CalendarIcon } from "../components/icons/CalendarIcon";
import { MusicNoteIcon } from "../components/icons/MusicNoteIcon";
import { UsersIcon } from "../components/icons/UsersIcon";
import { LocationMarkerIcon } from "../components/icons/LocationMarkerIcon";
import { UserIcon } from "../components/icons/UserIcon";
import { Can } from "../components/auth/Can";
import { useTranslation } from "react-i18next";
import { useToast } from "../contexts/ToastContext";
import { useSafeAction } from "../hooks/useSafeAction";
import { Copy, Trash2, X, Plus } from "lucide-react";
import { useCapability } from "../hooks/useCapability";
import AddToCalendarButton from "../components/common/AddToCalendarButton";
import { getScaleTitle as getScaleTitleHelper } from "../utils/scaleHelper";
import { normalizeScaleSongSettings } from "../utils/scaleSongSettings";

const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

const CloneScaleModal: React.FC<{
    isOpen: boolean;
    scaleToClone: PopulatedScale | null;
    onClose: () => void;
    onConfirm: (date: string) => Promise<void>;
}> = ({ isOpen, scaleToClone, onClose, onConfirm }) => {
    const [cloneDate, setCloneDate] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
             const today = new Date();
             const yyyy = today.getFullYear();
             const mm = String(today.getMonth() + 1).padStart(2, '0');
             const dd = String(today.getDate()).padStart(2, '0');
             setCloneDate(`${yyyy}-${mm}-${dd}`);
        }
    }, [isOpen]);

    if (!scaleToClone) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Clonar escala" maxWidth="max-w-md">
            <div className="p-4 sm:p-6 text-slate-800 dark:text-white/90">
                <p className="mb-6 font-medium text-[14.5px] leading-relaxed text-slate-500 dark:text-white/60 tracking-wide">
                    Use <strong className="text-slate-700 dark:text-white">&quot;{getScaleTitleHelper(scaleToClone)}&quot;</strong> como modelo para uma nova data. Repertório e local serão preservados.
                </p>
                
                <div className="mb-8">
                    <label className="block text-xs font-bold text-slate-500 dark:text-white/50 uppercase tracking-widest mb-2">
                        Data da nova escala
                    </label>
                    <input
                        type="date"
                        value={cloneDate}
                        onChange={(e) => setCloneDate(e.target.value)}
                        className="mt-1 input-base"
                    />
                </div>

                <div className="flex flex-col sm:flex-row-reverse gap-3 mt-4">
                    <Button 
                        onClick={async () => {
                            if (!cloneDate) return;
                            setIsLoading(true);
                            try {
                                await onConfirm(cloneDate);
                                onClose();
                            } finally {
                                setIsLoading(false);
                            }
                        }}
                        disabled={isLoading || !cloneDate}
                        className="h-12 w-full sm:flex-1 bg-primary hover:bg-primary/90 text-white font-bold tracking-wide rounded-xl shadow-md"
                    >
                        {isLoading ? "Clonando..." : "Criar cópia"}
                    </Button>
                    <Button 
                        variant="secondary"
                        onClick={onClose}
                        disabled={isLoading}
                        className="h-12 w-full sm:flex-1 font-bold tracking-wide rounded-xl bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                        Cancelar
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

const ScaleCard: React.FC<{
  scale: PopulatedScale;
  onView: (scale: PopulatedScale) => void;
  onClone?: (scale: PopulatedScale) => void;
  onEdit?: (scale: PopulatedScale) => void;
  onDelete?: (scale: PopulatedScale) => void;
  isSelected?: boolean;
  onToggleSelect?: (scaleId: string, isSelected: boolean) => void;
}> = ({ scale, onView, onClone, onEdit, onDelete, isSelected, onToggleSelect }) => {
  const { organization } = useAuth();
  const { executeSafeAction } = useSafeAction();
  const { songs: librarySongs, refreshData } = useMusic();
  const api = useApi();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { hasCapability } = useCapability();

  const [showAddPopover, setShowAddPopover] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState("");

  const canManage = hasCapability("musicscale.scales.manage");

  const filteredLibrarySongs = useMemo(() => {
    if (!librarySongs) return [];
    return librarySongs.filter(s => 
      s.title.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
      (s.artist && s.artist.toLowerCase().includes(songSearchQuery.toLowerCase()))
    ).slice(0, 10);
  }, [librarySongs, songSearchQuery]);

  const handleQuickRemove = async (songId: string) => {
    if (!api) return;
    
    const currentSongIds = scale.songIds || [];
    if (currentSongIds.length <= 1) {
      toast({ 
        type: 'error', 
        message: t('scaleModal.minimumOneSong', 'Não é permitido criar ou atualizar uma escala de músicas sem nenhuma música selecionada.') 
      });
      return;
    }
    
    const newSongIds = currentSongIds.filter(id => id !== songId);
    
    // Create new scale data keeping order and configuration intact
    const updatedScaleSettings = { ...(scale.songSettings || {}) };
    delete updatedScaleSettings[songId];
    
    const updatedScale = {
      ...scale,
      songIds: newSongIds,
      songSettings: updatedScaleSettings,
    };
    
    try {
      // Cast populated properties out to avoid breaking the payload
      const { songs, location, eventType, eventName, bandScale, ...cleanScaleData } = updatedScale as any;
      
      await api.scales.update(scale.id, cleanScaleData);
      toast({ 
        type: 'success', 
        message: t('scaleModal.songRemovedSuccess', 'Música removida da escala com sucesso!') 
      });
      await refreshData();
    } catch (error) {
      logger.error("Failed to quickly remove song from scale", error);
      toast({ 
        type: 'error', 
        message: t('scaleModal.quickRemoveError', 'Erro ao remover música da escala.') 
      });
    }
  };

  const handleQuickAdd = async (songId: string) => {
    if (!api) return;
    
    const currentSongIds = scale.songIds || [];
    if (currentSongIds.includes(songId)) return;
    
    const newSongIds = [...currentSongIds, songId];
    
    const updatedScale = {
      ...scale,
      songIds: newSongIds,
    };
    
    try {
      // Cast populated properties out to avoid breaking the payload
      const { songs, location, eventType, eventName, bandScale, ...cleanScaleData } = updatedScale as any;
      
      await api.scales.update(scale.id, cleanScaleData);
      toast({ 
        type: 'success', 
        message: t('scaleModal.songAddedSuccess', 'Música adicionada à escala com sucesso!') 
      });
      setShowAddPopover(false);
      setSongSearchQuery("");
      await refreshData();
    } catch (error) {
      logger.error("Failed to quickly add song to scale", error);
      toast({ 
        type: 'error', 
        message: t('scaleModal.quickAddError', 'Erro ao adicionar música à escala.') 
      });
    }
  };

  const getScaleTitle = (s: PopulatedScale) => getScaleTitleHelper(s);
  const dateObj = new Date(scale.date + "T00:00:00");
  const month = dateObj.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
  const day = dateObj.getDate().toString().padStart(2, "0");
  const weekday = dateObj.toLocaleDateString("pt-BR", { weekday: "long" });

  const getLocalYYYYMMDD = () => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
  };
  const isPast = scale.date < getLocalYYYYMMDD();

  const handleView = (e: React.MouseEvent) => {
     // Don't view if clicking on checkbox or its container
     if ((e.target as HTMLElement).closest('.selection-trigger')) return;
     executeSafeAction(() => onView(scale), { key: `view-scale-${scale.id}` });
  };

  return (
    <Card 
      data-testid={`scale-card-${scale.id}`}
      onClick={handleView} 
      padding="none"
      className={`group relative outline-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] border rounded-[24px] sm:rounded-[32px] cursor-pointer block overflow-hidden min-h-[120px] ${
          isSelected ? 'ring-2 ring-primary border-transparent bg-primary/5 dark:bg-primary/10' : ''
      } ${
          isPast 
          ? 'bg-white/50 dark:bg-[#0A0A0C]/50 border-black/[0.03] dark:border-white/[0.04] shadow-none' 
          : 'bg-white/90 dark:bg-[#1A1A1C]/60 backdrop-blur-2xl border-black/[0.04] dark:border-white/[0.06] hover:border-black/[0.1] dark:hover:border-white/[0.1] hover:bg-white dark:hover:bg-[#1A1A1C]/80 shadow-sm hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-2xl dark:hover:shadow-black/40 hover:-translate-y-[2px]'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center p-5 sm:p-6 md:p-8 gap-4 sm:gap-6 md:gap-8 min-h-[140px]">
        
        {/* Selection Checkbox */}
        {onToggleSelect && (
           <div 
             className="selection-trigger absolute top-4 left-4 z-20"
             onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(scale.id, !isSelected);
             }}
           >
              <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-black/50 hover:border-primary/50'}`}>
                 {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
           </div>
        )}

        {/* Desktop Date Block */}
        <div className="hidden sm:flex shrink-0 flex-col items-center justify-center w-16 md:w-20 pl-2">
           <span className={`text-[11px] md:text-[12px] font-bold tracking-[0.2em] uppercase mb-1 md:mb-1.5 ${isPast ? 'text-slate-400 dark:text-white/40' : 'text-primary dark:text-primary'}`}>{month}</span>
           <span className={`text-3xl md:text-5xl font-black leading-none tracking-tighter ${isPast ? 'text-slate-400 dark:text-white/40' : 'text-slate-900 dark:text-white drop-shadow-sm dark:drop-shadow-none'}`}>{day}</span>
        </div>

        {/* Separator on desktop */}
        <div className="hidden sm:block w-[1px] h-16 md:h-20 bg-black/[0.04] dark:bg-white/[0.06] shrink-0 mx-2" />

        {/* Content Block */}
        <div className="flex-1 w-full min-w-0">
           {/* Mobile Top Info: Date + Badge */}
           <div className={`flex items-center justify-between gap-2 mb-3 sm:mb-2 ${onToggleSelect ? 'pl-8 sm:pl-0' : ''}`}>
               <div className="flex flex-wrap items-center gap-2">
                 <div className={`sm:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-md ${isPast ? 'bg-slate-200/50 dark:bg-white/5' : 'bg-primary/10'}`}>
                     <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${isPast ? 'text-slate-500 dark:text-white/40' : 'text-primary'}`}>{month}</span>
                     <span className={`text-[13px] font-black ${isPast ? 'text-slate-500 dark:text-white/40' : 'text-slate-900 dark:text-white'}`}>{day}</span>
                 </div>
                 
                 {isPast && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-white/[0.04] bg-slate-100 dark:bg-white/5 shadow-sm">
                       <span className="text-[10px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-[0.2em] leading-none mt-px">Passada</span>
                    </div>
                 )}
                 <span className="text-[12px] md:text-[13px] font-semibold text-slate-500 dark:text-white/60 capitalize tracking-wide">{weekday}{scale.time ? ` • ${scale.time}` : ''}</span>
               </div>
           </div>
           
           <h3 className={`font-bold text-[19px] sm:text-[22px] tracking-tight truncate drop-shadow-sm dark:drop-shadow-none mb-1.5 transition-colors ${isPast ? 'text-slate-700 dark:text-white/60' : 'text-slate-900 dark:text-white group-hover:text-primary transition-colors'}`}>
             {getScaleTitle(scale)}
           </h3>
           <div className={canManage ? "mb-4" : `text-[13px] font-medium leading-relaxed max-w-full line-clamp-2 md:line-clamp-1 mb-4 ${isPast ? 'text-slate-400 dark:text-white/40' : 'text-slate-500 dark:text-white/60'}`}>
              {scale.songs.length > 0 
                ? (canManage ? (
                  <span className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {scale.songs.map((song) => (
                      <span 
                        key={song.id} 
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white/80 border border-slate-200/55 dark:border-white/5 hover:bg-slate-200/60 dark:hover:bg-white/10 transition-all"
                      >
                        <span className="truncate max-w-[120px]">{song.title}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleQuickRemove(song.id); }}
                          className="text-slate-400 hover:text-red-500 transition-colors p-0.5 rounded-full"
                          title={t('scaleModal.removeSong', { song: song.title })}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowAddPopover(true); }}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:text-primary-light dark:hover:bg-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
                      title={t('scaleModal.addSong', 'Adicionar música')}
                    >
                      <Plus className="w-3.5 h-3.5 font-bold" />
                    </button>
                  </span>
                ) : scale.songs.map(s => s.title).join(' • '))
                : (canManage ? (
                  <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[13px] text-slate-400 italic font-medium mr-1">
                      {t('scaleModal.noSongsSelected', 'Nenhuma música')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowAddPopover(true); }}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:text-primary-light dark:hover:bg-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
                      title={t('scaleModal.addSong', 'Adicionar música')}
                    >
                      <Plus className="w-3.5 h-3.5 font-bold" />
                    </button>
                  </span>
                ) : 'Nenhuma música')}
           </div>

           {/* Chips */}
           <div className="flex flex-wrap items-center gap-2 mt-auto">
             <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border shadow-sm ${isPast ? 'text-slate-500 dark:text-white/40 border-black/5 dark:border-white/5 bg-transparent' : 'text-slate-600 dark:text-white/80 bg-slate-50 dark:bg-white/5 border-slate-200/60 dark:border-white/[0.04]'}`}>
                <LocationMarkerIcon className="w-3.5 h-3.5 opacity-60" />
                <span className="truncate max-w-[140px] tracking-wide">{scale.location.name}</span>
             </div>
             {scale.bandScale && (
               <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border shadow-sm ${isPast ? 'text-slate-500 dark:text-white/40 border-black/5 dark:border-white/5 bg-transparent' : 'text-slate-600 dark:text-white/80 bg-slate-50 dark:bg-white/5 border-slate-200/60 dark:border-white/[0.04]'}`}>
                  <UsersIcon className="w-3.5 h-3.5 opacity-60" />
                  <span className="tracking-wide">{scale.bandScale.assignments.length} escalados</span>
               </div>
             )}
           </div>
        </div>

        {/* Actions / Meta Block */}
        <div className="shrink-0 w-full sm:w-auto sm:min-w-[140px] flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-4 sm:pt-0 border-t border-black/[0.04] dark:border-white/[0.06] sm:border-0 mt-2 sm:mt-0 relative z-20">
           
           <div className="flex flex-col items-start sm:items-end">
              {organization && (
                  <span className="text-[10px] md:text-[9px] font-bold tracking-[0.2em] text-slate-400 dark:text-white/40 uppercase mb-1">{organization.name}</span>
              )}
              {scale.createdBy?.displayName && (
                  <div className="flex items-center gap-1.5 text-[11px] md:text-[12px] font-medium text-slate-500 dark:text-white/60">
                      <UserIcon className="w-3.5 h-3.5 opacity-50" />
                      <AddToCalendarButton scale={scale} iconOnly />
                      <span className="truncate max-w-[100px]">{scale.createdBy.displayName.split(' ')[0]}</span>
                  </div>
              )}
           </div>

           <Can I="musicscale.scales.manage">
               <div className="flex items-center gap-1 mt-1">
                   {onEdit && (
                       <button
                           onClick={(e) => { e.stopPropagation(); onEdit(scale); }}
                           className="w-8 h-8 rounded-full bg-white/50 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-white/60 dark:hover:text-white border border-transparent dark:border-white/5 hover:border-black/5 dark:hover:border-white/10 transition-all shadow-sm"
                           data-testid={`edit-music-scale-${scale.id}`} title="Editar Escala"
                       >
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                       </button>
                   )}
                   {onDelete && (
                       <button
                           onClick={(e) => { e.stopPropagation(); onDelete(scale); }}
                           className="w-8 h-8 rounded-full bg-white/50 dark:bg-white/5 hover:bg-red-500/10 flex items-center justify-center text-slate-500 hover:text-red-500 dark:text-white/60 dark:hover:text-red-400 border border-transparent dark:border-white/5 hover:border-red-500/20 transition-all shadow-sm"
                           title="Excluir Escala"
                       >
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                       </button>
                   )}
                   {isPast && onClone && (
                       <div className="ml-1" onClick={(e) => { e.stopPropagation(); onClone(scale); }}>
                          <Button
                             variant="secondary"
                             className="h-8 px-3 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-[0.1em] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80 hover:bg-white dark:hover:bg-white/10 bg-white/50 dark:bg-transparent transition-all shadow-sm active:scale-95 uppercase"
                          >
                             <Copy className="w-3 h-3" />
                             CLONAR
                          </Button>
                       </div>
                   )}
               </div>
           </Can>

        </div>
      </div>
      {showAddPopover && (
        <div 
          className="absolute inset-0 bg-white/95 dark:bg-[#151517]/95 backdrop-blur-md z-30 p-5 sm:p-6 flex flex-col transition-all duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-4 mb-3">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              {t('scaleModal.addSongToScale', 'Adicionar música à escala')}
            </h4>
            <button
              type="button"
              onClick={() => { setShowAddPopover(false); setSongSearchQuery(""); }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <input
            type="text"
            autoFocus
            value={songSearchQuery}
            onChange={(e) => setSongSearchQuery(e.target.value)}
            placeholder={t('scaleModal.searchSongsPlaceholder', 'Buscar música por título ou artista...')}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-white mb-3"
          />
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1.5 max-h-[160px]">
            {filteredLibrarySongs.length > 0 ? (
              filteredLibrarySongs.map(song => {
                const isAlreadyInScale = scale.songIds?.includes(song.id);
                return (
                  <div 
                    key={song.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-sm font-medium transition-all ${
                      isAlreadyInScale 
                        ? 'bg-zinc-50 dark:bg-zinc-800/40 opacity-50 cursor-not-allowed' 
                        : 'hover:bg-primary/5 dark:hover:bg-primary/15 cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!isAlreadyInScale) {
                        handleQuickAdd(song.id);
                      }
                    }}
                  >
                    <div className="flex flex-col overflow-hidden flex-1 min-w-0 pr-3">
                      <span className="font-bold text-slate-800 dark:text-zinc-200 truncate">{song.title}</span>
                      <span className="text-xs text-slate-500 truncate">{song.artist || t('scaleModal.unknownArtist')}</span>
                    </div>
                    <button
                      type="button"
                      disabled={isAlreadyInScale}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all shrink-0 ${
                        isAlreadyInScale
                          ? 'text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60'
                          : 'text-primary bg-primary/10 hover:bg-primary/20'
                      }`}
                    >
                      {isAlreadyInScale ? t('scaleModal.added', 'Adicionado') : t('scaleModal.add', 'Adicionar')}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-sm text-slate-400">
                {t('scaleModal.noSongsFound', 'Nenhuma música encontrada')}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

import { useFeatureFlag } from "../hooks/useFeatureFlag";

const ScalesPage: React.FC = () => {
    const { populatedScales, refreshData } = useMusic();
    const { openScaleForm, openScaleDetail } = useModals();
    const { t } = useTranslation();
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { scaleId } = useParams<{ scaleId: string }>();
    const hasHandledDeepLink = React.useRef(false);
    const api = useApi();
    const isCommandApiV1Enabled = useFeatureFlag('musicscale.bandScaleCommandApiV1');

    useEffect(() => {
        hasHandledDeepLink.current = false;
    }, [scaleId]);

    useEffect(() => {
        if (scaleId && populatedScales.length > 0 && !hasHandledDeepLink.current) {
            const scale = populatedScales.find(s => s.id === scaleId);
            if (scale) {
                openScaleDetail(scale);
                hasHandledDeepLink.current = true;
            } else {
                logger.warn(`Music Scale with ID ${scaleId} not found, redirecting.`);
                navigate("/scales", { replace: true });
            }
        }
    }, [scaleId, populatedScales, openScaleDetail, navigate]);
    
    const initialTab = searchParams.get("tab") === "past" ? "past" : "upcoming";
    const [activeTab, setActiveTab] = useState<"upcoming" | "past">(initialTab);
    
    // Cloning state
    const [cloneModalOpen, setCloneModalOpen] = useState(false);
    const [scaleToClone, setScaleToClone] = useState<PopulatedScale | null>(null);

    // Bulk selection state
    const [selectedScaleIds, setSelectedScaleIds] = useState<string[]>([]);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [renderLimit, setRenderLimit] = useState(15);
    const loaderRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setRenderLimit((prev) => prev + 15);
                }
            },
            { rootMargin: "200px" }
        );
        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        setRenderLimit(15);
    }, [activeTab]);

    useEffect(() => {
        // Only update params if needed
        if (searchParams.get("tab") !== activeTab) {
             setSearchParams({ tab: activeTab }, { replace: true });
        }
        setSelectedScaleIds([]); // Clear selection on tab change
    }, [activeTab, searchParams, setSearchParams]);

    useEffect(() => {
        if (location.state && (location.state as any).preselectedSongIds) {
            const preselectedSongIds = (location.state as any).preselectedSongIds;
            navigate(location.pathname, { replace: true, state: {} });
            setTimeout(() => {
                openScaleForm(undefined, preselectedSongIds);
            }, 100);
        }
    }, [location.state, navigate, location.pathname, openScaleForm]);

    const getLocalYYYYMMDD = () => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const localToday = getLocalYYYYMMDD();

    const upcomingScales = useMemo(() => {
        return populatedScales
            .filter(s => s.date >= localToday)
            .sort((a, b) => {
                const dateA = a.date || "";
                const dateB = b.date || "";
                const timeA = a.time || "00:00";
                const timeB = b.time || "00:00";
                return `${dateA}T${timeA}`.localeCompare(`${dateB}T${timeB}`);
            });
    }, [populatedScales, localToday]);

    const pastScales = useMemo(() => {
        return populatedScales
            .filter(s => s.date < localToday)
            .sort((a, b) => {
                const dateA = a.date || "";
                const dateB = b.date || "";
                const timeA = a.time || "00:00";
                const timeB = b.time || "00:00";
                return `${dateB}T${timeB}`.localeCompare(`${dateA}T${timeA}`);
            });
    }, [populatedScales, localToday]);

    const handleCloneConfig = (scale: PopulatedScale) => {
        setScaleToClone(scale);
        setCloneModalOpen(true);
    };

    const executeClone = async (newDate: string) => {
        if (!scaleToClone) return;

        try {
            // Create Music Scale securely in current tenant
            const cloneSongIds = scaleToClone.songs.map((s: any) => s.id);
            const scalePayload: Partial<Scale> = {
                date: newDate,
                time: scaleToClone.time || "",
                observations: scaleToClone.observations || "",
                songIds: cloneSongIds,
                songSettings: normalizeScaleSongSettings(cloneSongIds, scaleToClone.songSettings || {}),
                eventTypeId: scaleToClone.eventTypeId,
                locationId: scaleToClone.locationId,
                eventNameId: scaleToClone.eventNameId || null,
            };
            
            const newMusicScaleId = await api.scales.create(scalePayload as any);

            // Clone Band Scale if exists
            if (scaleToClone.bandScale) {
                const bandScalePayload: Partial<BandScale> = {
                    date: newDate,
                    time: scaleToClone.bandScale.time || "",
                    observations: scaleToClone.bandScale.observations || "",
                    assignments: scaleToClone.bandScale.assignments || [],
                    eventTypeId: scaleToClone.bandScale.eventTypeId || scaleToClone.eventTypeId,
                    locationId: scaleToClone.bandScale.locationId || scaleToClone.locationId,
                    eventNameId: scaleToClone.bandScale.eventNameId || scaleToClone.eventNameId || null,
                    musicScaleId: newMusicScaleId
                };
                
                let newBandScaleId: string;
                
                console.info('[BandScale Save Path] => ' + JSON.stringify({
                    organizationId: api?.bandScales['orgId'] || 'unknown',
                    featureFlagEnabled: isCommandApiV1Enabled,
                    selectedWriter: isCommandApiV1Enabled ? 'command_api' : 'legacy_repository'
                }));

                if (isCommandApiV1Enabled && api) {
                    const idempotencyKey = crypto.randomUUID();
                    const result = await api.bandScaleCommands.create(bandScalePayload, idempotencyKey);
                    newBandScaleId = result.scaleId;
                } else if (api) {
                    newBandScaleId = await api.bandScales.create(bandScalePayload as any);
                } else {
                    throw new Error("API not available");
                }
                
                await api.scales.update(newMusicScaleId, { bandScaleId: newBandScaleId });
            }

            setCloneModalOpen(false);
            setScaleToClone(null);
            
            await refreshData();
            
            if (newDate >= localToday) {
                setActiveTab("upcoming");
            } else {
                setActiveTab("past");
            }
            toast({ title: t('scaleModal.cloneSuccess', 'Escala clonada com sucesso.') });
        } catch(error: any) {
            logger.error("Failed to clone scale", error);
            toast({ title: t('common.errorCloning', 'Erro ao clonar'), description: error?.message || t('common.unknownError', 'Ocorreu um erro'), variant: "destructive" });
        }
    };

    const handleToggleSelect = (scaleId: string, isSelected: boolean) => {
        setSelectedScaleIds(prev => 
            isSelected ? [...prev, scaleId] : prev.filter(id => id !== scaleId)
        );
    };

    const handleSelectAll = (scales: PopulatedScale[]) => {
        setSelectedScaleIds(scales.map(s => s.id));
    };

    const handleDeleteSelected = () => {
        if (!api || selectedScaleIds.length === 0) return;
        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteSelected = async () => {
        if (!api || selectedScaleIds.length === 0) return;
        setIsDeleting(true);

        try {
            await api.scales.deleteMany(selectedScaleIds);
            setSelectedScaleIds([]);
            await refreshData();
            toast({ title: t('common.deleted', 'Excluído'), description: `${selectedScaleIds.length} ${t('common.scalesDeletedSuccess', 'escala(s) excluída(s) com sucesso.')}` });
        } catch (error) {
            logger.error("Falha ao excluir escalas.", error);
            toast({ title: t('common.errorDeleting', 'Erro ao excluir'), description: t('common.errorDeletingScales', 'Ocorreu um erro ao excluir as escalas.'), variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setIsDeleteConfirmOpen(false);
        }
    };

    const currentScales = activeTab === "upcoming" ? upcomingScales : pastScales;

    return (
        <div className="w-full max-w-5xl mx-auto py-8 lg:py-12 px-4 sm:px-6 lg:px-8 pb-32">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-none">Escalas Musicais</h1>
                    <p className="text-slate-500 dark:text-white/60 mt-2 text-[15px] max-w-xl leading-relaxed tracking-wide">Gerencie e organize as escalas da sua equipe com clareza e precisão.</p>
                </div>
                
                <Can I="musicscale.scales.manage">
                    <Button 
                        onClick={() => openScaleForm()} 
                        className="bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all duration-300 rounded-2xl h-12 lg:h-14 px-6 lg:px-8 font-bold tracking-wide text-[14px] w-full sm:w-auto"
                    >
                        Nova Escala
                        <PlusIcon className="w-5 h-5 ml-2 opacity-80" />
                    </Button>
                </Can>
            </div>

            {/* Segmented Control Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div role="tablist" className="flex items-center p-1 bg-slate-100 dark:bg-[#1A1A1C]/80 rounded-xl border border-slate-200/50 dark:border-white/5 w-full md:w-auto shadow-sm">
                    <button
                        role="tab"
                        aria-selected={activeTab === "upcoming"}
                        onClick={() => setActiveTab("upcoming")}
                        className={`relative flex-1 md:flex-none flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-lg font-semibold text-[13px] tracking-wide transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            activeTab === "upcoming" 
                            ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm dark:shadow-black/50"
                            : "text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
                        }`}
                    >
                        Próximas
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "upcoming" ? "bg-primary/10 text-primary" : "bg-black/5 dark:bg-white/5 text-slate-500 dark:text-white/40"}`}>
                            {upcomingScales.length}
                        </span>
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === "past"}
                        onClick={() => setActiveTab("past")}
                        className={`relative flex-1 md:flex-none flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-lg font-semibold text-[13px] tracking-wide transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            activeTab === "past" 
                            ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm dark:shadow-black/50"
                            : "text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
                        }`}
                    >
                        Passadas
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "past" ? "bg-primary/10 text-primary" : "bg-black/5 dark:bg-white/5 text-slate-500 dark:text-white/40"}`}>
                            {pastScales.length}
                        </span>
                    </button>
                </div>

                <Can I="musicscale.scales.manage">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        {currentScales.length > 0 && selectedScaleIds.length === 0 && (
                            <button 
                                onClick={() => handleSelectAll(currentScales)}
                                className="text-[13px] font-semibold tracking-wide text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border border-transparent dark:border-white/5 w-full md:w-auto text-center shadow-sm"
                            >
                                Selecionar Todas
                            </button>
                        )}
                        {selectedScaleIds.length > 0 && (
                            <div className="flex items-center gap-2 bg-slate-900 dark:bg-[#1A1A1C]/95 dark:backdrop-blur-3xl border border-slate-800 dark:border-white/[0.08] rounded-xl p-1.5 shadow-lg w-full md:w-auto overflow-x-auto">
                                <div className="flex items-center justify-center bg-white/10 text-white rounded-lg px-3 py-1.5 text-[12px] font-bold shrink-0">
                                    {selectedScaleIds.length} selecionadas
                                </div>
                                <button 
                                    onClick={() => setSelectedScaleIds([])}
                                    className="text-[12px] font-bold text-white/70 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                                >
                                    Nenhum
                                </button>
                                <button 
                                    onClick={handleDeleteSelected}
                                    className="flex items-center gap-1.5 text-[12px] font-bold text-red-500 hover:text-white px-3 py-1.5 rounded-lg hover:bg-red-500 transition-colors shrink-0"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Excluir
                                </button>
                            </div>
                        )}
                    </div>
                </Can>
            </div>

            {currentScales.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 dark:bg-[#1A1A1C]/50 border border-slate-200/50 dark:border-white/[0.05] rounded-[32px] mt-6 shadow-sm">
                    <CalendarIcon className="mx-auto h-12 w-12 text-slate-300 dark:text-white/20 mb-4" />
                    <h3 className="text-[18px] font-bold text-slate-800 dark:text-white mb-2">
                        {activeTab === "upcoming" ? "Nenhuma escala próxima" : "Nenhuma escala passada"}
                    </h3>
                    <p className="text-[14px] text-slate-500 dark:text-white/50 max-w-sm mx-auto leading-relaxed mb-6">
                        {activeTab === "upcoming" 
                            ? "Crie uma nova escala para organizar o próximo culto e definir a equipe."
                            : "Quando uma escala passar da data, ela aparecerá aqui para consulta e clonagem."
                        }
                    </p>
                    {activeTab === "upcoming" && (
                        <Can I="musicscale.scales.manage">
                            <Button 
                                onClick={() => openScaleForm()}
                                className="bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 hover:-translate-y-1 hover:scale-105 active:scale-95 transition-all duration-300 rounded-full h-[44px] px-8 font-bold tracking-wide text-[13px]"
                            >
                                <PlusIcon className="w-4 h-4 mr-2 opacity-80" />
                                Começar Escala
                            </Button>
                        </Can>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {currentScales.slice(0, renderLimit).map((scale) => (
                        <ScaleCard 
                            key={scale.id} 
                            scale={scale} 
                            onView={openScaleDetail} 
                            onClone={activeTab === "past" ? handleCloneConfig : undefined}
                            onEdit={openScaleForm}
                            onDelete={(s) => openScaleDetail(s, 'delete')}
                            isSelected={selectedScaleIds.includes(scale.id)}
                            onToggleSelect={handleToggleSelect}
                        />
                    ))}
                    {renderLimit < currentScales.length && (
                        <div ref={loaderRef} className="h-20 w-full flex items-center justify-center">
                            <Spinner size="md" />
                        </div>
                    )}
                </div>
            )}

            <CloneScaleModal 
                isOpen={cloneModalOpen}
                scaleToClone={scaleToClone}
                onClose={() => {
                    setCloneModalOpen(false);
                    setScaleToClone(null);
                }}
                onConfirm={executeClone}
            />

            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => !isDeleting && setIsDeleteConfirmOpen(false)}
                onConfirm={confirmDeleteSelected}
                title="Excluir Escalas"
                message={`Tem certeza que deseja excluir ${selectedScaleIds.length} escala(s)? Essa ação não pode ser desfeita.`}
                confirmText="Excluir"
                cancelText="Cancelar"
                isLoading={isDeleting}
            />
        </div>
    );
};

export default ScalesPage;

