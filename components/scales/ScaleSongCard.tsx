import React, { useState } from 'react';
import { PopulatedSong, Tag, ScaleSongSettingsChangeHandler } from '../../types';
import { hasChords, hasLyrics, getEffectiveKey, getEffectiveBpm } from '../../utils/scaleSongSettings';
import { useTranslation } from 'react-i18next';
import { GripVertical, ChevronDown, Check, X, Settings2 } from 'lucide-react';
import { useCapability } from '../../hooks/useCapability';
import { XCircleIcon } from '../icons/XCircleIcon';

export interface ScaleSongCardProps {
  song: PopulatedSong;
  isSelected: boolean;
  mode: 'library' | 'setlist' | 'review';
  index?: number;
  tags: Tag[];
  localSettings?: { key?: string | null; bpm?: number | null };
  onToggle?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  onTouchCancel?: (e: React.TouchEvent) => void;
  isDragging?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onSettingsChange?: ScaleSongSettingsChangeHandler;
}

const MUSICAL_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

export const ScaleSongCard: React.FC<ScaleSongCardProps> = ({
  song,
  isSelected,
  mode,
  index,
  tags,
  localSettings,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  isDragging,
  isFirst,
  isLast,
  onSettingsChange
}) => {
  const { t } = useTranslation();
  const { hasCapability } = useCapability();
  const [isEditing, setIsEditing] = useState(false);
  const [editKey, setEditKey] = useState<string>(localSettings?.key || '');
  const [editBpm, setEditBpm] = useState<number | ''>(localSettings?.bpm || '');
  const [saveMode, setSaveMode] = useState<'local' | 'global'>('local');
  const [isSaving, setIsSaving] = useState(false);
  const [showGlobalConfirm, setShowGlobalConfirm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const confirmBtnRef = React.useRef<HTMLButtonElement>(null);
  const applyBtnRef = React.useRef<HTMLButtonElement>(null);
  const saveInFlightRef = React.useRef(false);

  // When global confirm is shown, focus the confirm button
  React.useEffect(() => {
    if (showGlobalConfirm && confirmBtnRef.current) {
      confirmBtnRef.current.focus();
    }
  }, [showGlobalConfirm]);

  // Listen for Escape key on confirmation dialog
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showGlobalConfirm && !isSaving) {
        e.preventDefault();
        handleCancelConfirm();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showGlobalConfirm, isSaving]);

  const effectiveKey = getEffectiveKey(song, localSettings);
  const effectiveBpm = getEffectiveBpm(song, localSettings);
  const hasLocalAdjustments = !!localSettings && (localSettings.key !== undefined || localSettings.bpm !== undefined);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle && onToggle();
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    onToggle && onToggle();
  };

  const openEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    // If opening from library and song is not selected, select it first
    if (mode === 'library' && !isSelected && onToggle) {
      onToggle();
    }
    setEditKey(localSettings?.key || '');
    setEditBpm(localSettings?.bpm || '');
    setSaveMode('local');
    setShowGlobalConfirm(false);
    setLocalError(null);
    setIsEditing(true);
  };

  const handleSaveSettings = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saveInFlightRef.current) return;
    if (!onSettingsChange) {
      setIsEditing(false);
      return;
    }
    
    setLocalError(null);

    if (saveMode === 'global') {
      setShowGlobalConfirm(true);
      return;
    }
    
    await executeSave();
  };

  const executeSave = async () => {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setIsSaving(true);
    setLocalError(null);

    try {
      // Pass null only if we explicitly want to save a null value.
      // But since empty string in the UI means "fallback to default", 
      // we can pass null to signal "clear this setting".
      // Wait! In the controller, null means "clear this setting".
      // In `applyLocalScaleSongSettingsUpdate`, we want null to mean "set to null" 
      // OR "remove" if we want fallback. 
      // Actually, if we pass null to `onSettingsChange`, it goes to `applyLocal...`.
      // Let's pass `editKey === '' ? null : editKey` and same for BPM.
      
      const parsedKey = editKey === '' ? null : editKey;
      const parsedBpm = editBpm === '' ? null : Number(editBpm);
      const result = await onSettingsChange?.(parsedKey, parsedBpm, saveMode === 'global');
      
      if (result && result.status === 'deduplicated') {
        // Ignored by deduplication, do not post-process
        return;
      }
      
      setIsEditing(false);
      setShowGlobalConfirm(false);
      setLocalError(null);
    } catch (error) {
      console.error(error);
      setLocalError(t('scaleModal.confirmationError', 'Erro ao atualizar música.'));
      setTimeout(() => {
        if (confirmBtnRef.current) confirmBtnRef.current.focus();
      }, 0);
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaving) return;
    setIsEditing(false);
    setShowGlobalConfirm(false);
    setLocalError(null);
  };
  
  const handleCancelConfirm = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isSaving) return;
    setShowGlobalConfirm(false);
    setLocalError(null);
    setTimeout(() => {
        if (applyBtnRef.current) applyBtnRef.current.focus();
    }, 0);
  };

  const preventProp = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div 
      data-song-id={(mode === 'setlist' || mode === 'review') ? song.id : undefined}
      data-index={(mode === 'setlist' || mode === 'review') ? index : undefined}
      className={`group relative flex flex-col p-3 rounded-xl border bg-white dark:bg-[#1C1C1E] shadow-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isDragging ? 'opacity-50 scale-[0.98]' : 'hover:border-primary/30'
      } ${
        isSelected && mode === 'library' ? 'border-primary/50 bg-primary/5 dark:bg-primary/10' : 'border-slate-200 dark:border-white/10'
      }`}
      role={mode === 'library' ? "checkbox" : undefined}
      aria-checked={mode === 'library' ? isSelected : undefined}
      tabIndex={mode === 'library' ? 0 : undefined}
      onKeyDown={mode === 'library' ? handleKeyDown : undefined}
      onClick={mode === 'library' ? handleCardClick : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        {(mode === 'setlist' || mode === 'review') && (
          <div className="flex items-center">
            <div 
              className="flex items-center justify-center min-w-[44px] min-h-[44px] -ml-2 mr-1 cursor-grab active:cursor-grabbing touch-none"
              draggable
              aria-label={t('scaleModal.reorderSong', { song: song.title })}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchCancel}
              onClick={preventProp}
            >
              <GripVertical className="w-4 h-4 text-slate-400" />
            </div>
            <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-[10px] font-bold text-slate-500 mr-3">
              {(index ?? 0) + 1}
            </span>
          </div>
        )}

        <div className="flex flex-col overflow-hidden flex-1">
          <span className={`text-[13px] font-bold truncate ${isSelected && mode === 'library' ? 'text-primary-dark dark:text-primary-light' : 'text-slate-800 dark:text-white'}`}>
            {song.title}
          </span>
          <span className="text-[11px] font-medium text-slate-500 truncate">
            {song.artist || t('scaleModal.unknownArtist', 'Artista desconhecido')}
          </span>
        </div>

        {mode === 'library' && (
          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all">
            {isSelected ? (
              <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center shadow-sm">
                <Check className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-6 h-6 border border-slate-200 dark:border-white/10 text-slate-400 rounded-full flex items-center justify-center">
                <span className="text-[16px] leading-none mb-[2px]">+</span>
              </div>
            )}
          </div>
        )}

        {mode === 'setlist' && (
          <div className="flex items-center gap-0.5 ml-2" onClick={preventProp}>
             <button type="button" onClick={onMoveUp} disabled={isFirst} className="hidden md:flex items-center justify-center min-w-[44px] min-h-[44px] text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"><ChevronDown className="w-4 h-4 rotate-180"/></button>
             <button type="button" onClick={onMoveDown} disabled={isLast} className="hidden md:flex items-center justify-center min-w-[44px] min-h-[44px] text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"><ChevronDown className="w-4 h-4"/></button>
             <button type="button" onClick={onToggle} className="flex items-center justify-center min-w-[44px] min-h-[44px] text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg ml-1"><XCircleIcon className="w-5 h-5"/></button>
          </div>
        )}

        {mode === 'review' && (
          <div className="flex items-center gap-0.5 ml-2" onClick={preventProp}>
             <button 
               type="button" 
               onClick={onMoveUp} 
               disabled={isFirst} 
               aria-label={t('scaleModal.moveSongUp', { song: song.title })} 
               className="flex items-center justify-center min-w-[44px] min-h-[44px] text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
             >
               <ChevronDown className="w-4 h-4 rotate-180"/>
             </button>
             <button 
               type="button" 
               onClick={onMoveDown} 
               disabled={isLast} 
               aria-label={t('scaleModal.moveSongDown', { song: song.title })} 
               className="flex items-center justify-center min-w-[44px] min-h-[44px] text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
             >
               <ChevronDown className="w-4 h-4"/>
             </button>
             {onToggle && (
               <button 
                 type="button" 
                 onClick={onToggle} 
                 aria-label={t('scaleModal.removeSong', { song: song.title })}
                 className="flex items-center justify-center min-w-[44px] min-h-[44px] text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg ml-1"
               >
                 <XCircleIcon className="w-5 h-5"/>
               </button>
             )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-white/5 pb-1" onClick={preventProp}>
        <div className="shrink-0 flex items-center gap-1 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded cursor-default">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
            {effectiveKey ? `${t('scaleModal.key', 'Tom')} ${effectiveKey}` : t('scaleModal.keyNotInformed', 'Tom não informado')}
          </span>
        </div>
        <div className="shrink-0 flex items-center gap-1 bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded cursor-default">
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {effectiveBpm ? `${effectiveBpm} BPM` : t('scaleModal.bpmNotInformed', 'BPM não informado')}
          </span>
        </div>

        {(hasChords(song) || hasLyrics(song)) ? (
          <div className="flex gap-1 shrink-0">
            {hasChords(song) && <span className="text-[10px] font-medium text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">{t('scaleModal.hasChords', 'Cifra')}</span>}
            {hasLyrics(song) && <span className="text-[10px] font-medium text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">{t('scaleModal.hasLyrics', 'Letra')}</span>}
          </div>
        ) : (
          <span className="shrink-0 text-[10px] font-medium text-slate-400 bg-slate-50 dark:bg-white/5 px-1.5 py-0.5 rounded">{t('scaleModal.noChordsOrLyrics', 'S/ Anexos')}</span>
        )}
        
        {mode !== 'review' && song.tagIds?.map(tagId => {
          const tObj = tags.find(tag => tag.id === tagId);
          if (!tObj) return null;
          return (
            <span key={tObj.id} className="shrink-0 text-[10px] font-medium text-primary-dark dark:text-primary-light bg-primary/10 px-1.5 py-0.5 rounded">
              {tObj.name}
            </span>
          );
        })}

        {hasLocalAdjustments && (localSettings?.key || localSettings?.bpm) && (
          <span className="shrink-0 text-[10px] font-medium text-primary-dark bg-primary/10 px-1.5 py-0.5 rounded">
            {t('scaleModal.scaleSpecificSetting', 'Ajuste desta escala')}
          </span>
        )}
      </div>

      {(mode === 'setlist' || mode === 'review') && (
        <div className="mt-1 pb-1" onClick={preventProp}>
          <button 
            type="button" 
            onClick={isEditing ? cancelEdit : openEditor} 
            className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-primary transition-colors py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1 -ml-1 min-h-[44px]"
            aria-expanded={isEditing}
            aria-controls={`edit-panel-${song.id}`}
          >
            {isEditing ? (
              <>
                <X className="w-3.5 h-3.5" />
                <span>{t('scaleModal.closeSettings', 'Fechar ajustes')}</span>
              </>
            ) : (
              <>
                <Settings2 className="w-3.5 h-3.5" />
                <span>{mode === 'review' ? t('scaleModal.editSettings', 'Editar ajustes') : t('scaleModal.editKeyAndBpm', 'Editar tom e BPM')}</span>
              </>
            )}
          </button>
        </div>
      )}      {isEditing && (
        <div id={`edit-panel-${song.id}`} className="mt-2 p-3 bg-slate-50 dark:bg-black/20 rounded-lg border border-slate-200 dark:border-white/10" onClick={preventProp}>
          {showGlobalConfirm ? (
            <div className="flex flex-col gap-3" role="dialog" aria-modal="true" aria-labelledby={`confirm-title-${song.id}`} aria-busy={isSaving}>
              <h4 id={`confirm-title-${song.id}`} className="text-[13px] font-bold text-slate-800 dark:text-white">
                {t('scaleModal.confirmationTitle', 'Confirmar Alteração Global')} - {song.title}
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {t('scaleModal.confirmationDescription', 'Tem certeza que deseja alterar o tom e/ou BPM para o repertório de toda a organização?')}
              </p>
              
              {localError && (
                <div role="alert" aria-live="polite" className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-md">
                  {localError}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={handleCancelConfirm} className="px-3 min-h-[44px] text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white" disabled={isSaving}>
                  {t('scaleModal.confirmationCancel', 'Cancelar')}
                </button>
                <button ref={confirmBtnRef} type="button" onClick={executeSave} disabled={isSaving} aria-busy={isSaving} className="px-4 min-h-[44px] text-[11px] font-bold bg-primary text-white rounded-md shadow-sm hover:bg-primary-dark disabled:opacity-50">
                  {isSaving ? '...' : t('scaleModal.confirmationConfirm', 'Confirmar')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                 <div>
                   <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('scaleModal.scaleSpecificKey', 'Tom desta escala')}</label>
                   <select 
                     value={editKey} 
                     onChange={e => setEditKey(e.target.value)}
                     className="w-full bg-white dark:bg-[#2A2A2C] border border-slate-200 dark:border-white/10 rounded-md px-2 py-1.5 text-[12px] text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                   >
                     <option value="">{t('scaleModal.useDefaultKey', 'Usar tom padrão')} ({song.selectedKey || song.key || song.originalKey || t('scaleModal.keyNotInformed', 'Não informado')})</option>
                     {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                   </select>
                   {song.originalKey && <div className="text-[9px] text-slate-400 mt-1">{t('scaleModal.originalKeyText', 'Tom original:')} {song.originalKey}</div>}
                 </div>
                 <div>
                   <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t('scaleModal.scaleSpecificBpm', 'BPM desta escala')}</label>
                   <input 
                     type="number"
                     min={20}
                     max={300}
                     value={editBpm}
                     onChange={e => setEditBpm(e.target.value ? Number(e.target.value) : '')}
                     placeholder={song.bpm ? String(song.bpm) : "Ex: 120"}
                     className="w-full bg-white dark:bg-[#2A2A2C] border border-slate-200 dark:border-white/10 rounded-md px-2 py-1.5 text-[12px] text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                   />
                   {song.bpm && <div className="text-[9px] text-slate-400 mt-1">{t('scaleModal.defaultBpm', 'BPM padrão:')} {song.bpm}</div>}
                 </div>
              </div>
              <div className="flex flex-col gap-2 mb-4">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name={`saveMode-${song.id}`} checked={saveMode === 'local'} onChange={() => setSaveMode('local')} className="mt-0.5 accent-primary" />
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{t('scaleModal.onlyThisScale', 'Somente nesta escala')}</span>
                  </div>
                </label>
                {hasCapability('MANAGE_SONGS') && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" name={`saveMode-${song.id}`} checked={saveMode === 'global'} onChange={() => setSaveMode('global')} className="mt-0.5 accent-primary" />
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{t('scaleModal.updateRepertoire', 'Salvar também como tom padrão')}</span>
                      <span className="text-[10px] text-slate-500">{t('scaleModal.permanentChangeDescription', 'A alteração será aplicada na biblioteca para todas as futuras escalas.')}</span>
                    </div>
                  </label>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={cancelEdit} className="px-3 min-h-[44px] text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white">
                  {t('scaleModal.cancel', 'Cancelar')}
                </button>
                <button 
                  ref={applyBtnRef}
                  type="button" 
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  aria-busy={isSaving}
                  className="px-4 min-h-[44px] text-[11px] font-bold bg-primary text-white rounded-md shadow-sm hover:bg-primary-dark disabled:opacity-50"
                >
                  {isSaving ? '...' : t('scaleModal.applyAdjustment', 'Aplicar')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
