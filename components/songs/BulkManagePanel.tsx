import React, { useState, useMemo } from "react";
import type { FreshnessStatus, Tag } from "../../types";
import { Check, X, Layers, Plus, Minus, Search } from "lucide-react";

interface BulkManagePanelProps {
  selectedCount: number;
  availableTags: Tag[];
  onApply: (changes: PendingBulkChanges) => void;
  onCancel: () => void;
  onDelete: () => void;
}

export interface PendingBulkChanges {
  freshnessStatus?: FreshnessStatus | 'no_change';
  language?: 'pt' | 'en' | 'es' | 'other' | 'unknown' | 'no_change';
  tagsToAdd?: string[];
  tagsToRemove?: string[];
}

export const BulkManagePanel: React.FC<BulkManagePanelProps> = ({
  selectedCount,
  availableTags,
  onApply,
  onCancel,
  onDelete
}) => {
  const [changes, setChanges] = useState<PendingBulkChanges>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Convert internal states back to valid types for the parent, removing 'no_change'
  const finalChanges = useMemo(() => {
    const fn: Partial<PendingBulkChanges> = { ...changes };
    if (fn.freshnessStatus === 'no_change') delete fn.freshnessStatus;
    if (fn.language === 'no_change') delete fn.language;
    return fn;
  }, [changes]);

  const hasChanges = Object.keys(finalChanges).length > 0 && (
    !!finalChanges.freshnessStatus || 
    !!finalChanges.language || 
    (finalChanges.tagsToAdd && finalChanges.tagsToAdd.length > 0) || 
    (finalChanges.tagsToRemove && finalChanges.tagsToRemove.length > 0)
  );
  
  const totalAddedTags = (changes.tagsToAdd || []).length;
  const totalRemovedTags = (changes.tagsToRemove || []).length;
  const totalChanges = (finalChanges.freshnessStatus ? 1 : 0) + (finalChanges.language ? 1 : 0) + totalAddedTags + totalRemovedTags;

  const handleStatusChange = (status: FreshnessStatus | 'no_change') => {
    setChanges(prev => ({ ...prev, freshnessStatus: status }));
  };

  const handleLanguageChange = (language: 'pt' | 'en' | 'es' | 'other' | 'unknown' | 'no_change') => {
    setChanges(prev => ({ ...prev, language }));
  };

  const handleTagToggle = (tagId: string) => {
    setChanges(prev => {
      const tagsToAdd = prev.tagsToAdd || [];
      const tagsToRemove = prev.tagsToRemove || [];
      
      // State machine logic: neutral -> add -> remove -> neutral
      const isAdding = tagsToAdd.includes(tagId);
      const isRemoving = tagsToRemove.includes(tagId);
      
      if (isAdding) {
        // Transition: add -> remove
        return { 
          ...prev, 
          tagsToAdd: tagsToAdd.filter(id => id !== tagId),
          tagsToRemove: [...tagsToRemove, tagId]
        };
      } else if (isRemoving) {
        // Transition: remove -> neutral
        return { 
          ...prev, 
          tagsToAdd: tagsToAdd.filter(id => id !== tagId),
          tagsToRemove: tagsToRemove.filter(id => id !== tagId)
        };
      } else {
        // Transition: neutral -> add
        return { 
          ...prev, 
          tagsToAdd: [...tagsToAdd, tagId],
          tagsToRemove: tagsToRemove.filter(id => id !== tagId)
        };
      }
    });
  };

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return availableTags;
    const lowerQ = searchQuery.toLowerCase();
    return availableTags.filter(t => t.name.toLowerCase().includes(lowerQ));
  }, [availableTags, searchQuery]);

  const activeStatus = changes.freshnessStatus || 'no_change';
  const activeLang = changes.language || 'no_change';

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0A0A0B] w-full max-h-[92vh] sm:max-h-[80vh] selection:bg-indigo-500/30 relative">
      
      {/* 1. Cabeçalho Premium */}
      <div className="px-6 py-5 border-b border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between sticky top-0 bg-white/80 dark:bg-[#0A0A0B]/80 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 dark:border-indigo-400/20 shadow-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white tracking-tight leading-tight">
              Gerenciar selecionadas
            </h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium">
              {selectedCount} música{selectedCount !== 1 ? 's' : ''} {selectedCount !== 1 ? 'serão afetadas' : 'será afetada'}
            </p>
          </div>
        </div>
        <button 
          onClick={onCancel}
          aria-label="Fechar gerenciamento"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="px-6 py-6 space-y-8 overflow-y-auto custom-scrollbar flex-1 pb-28">
        
        {/* 2. Resumo das Alterações Pendentes */}
        <div className={`transition-all duration-300 ease-in-out border rounded-2xl overflow-hidden ${
          hasChanges 
            ? 'bg-gradient-to-br from-white to-slate-50 dark:from-[#111113] dark:to-[#161618] border-indigo-200/50 dark:border-indigo-500/20 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.08)]' 
            : 'bg-white dark:bg-[#111113] border-slate-200/50 dark:border-white/5 opacity-80'
        }`}>
          <div className="px-5 py-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
              Alterações Pendentes
            </h3>
            
            {!hasChanges ? (
              <p className="text-[13px] text-slate-500 dark:text-slate-400">Nenhuma alteração selecionada.</p>
            ) : (
              <div className="space-y-2">
                {finalChanges.freshnessStatus && (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-slate-500 dark:text-slate-400 w-16">Status</span>
                    <span className="px-2.5 py-1 text-[12px] font-semibold rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                      {finalChanges.freshnessStatus === 'default' ? 'Sem status' : finalChanges.freshnessStatus === 'new' ? 'Nova' : 'Antiga'}
                    </span>
                  </div>
                )}
                
                {finalChanges.language && (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-slate-500 dark:text-slate-400 w-16">Idioma</span>
                    <span className="px-2.5 py-1 text-[12px] font-semibold rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
                      {finalChanges.language === 'pt' ? 'Português' : finalChanges.language === 'en' ? 'Inglês' : finalChanges.language === 'es' ? 'Espanhol' : finalChanges.language === 'other' ? 'Outro' : 'Desconhecido'}
                    </span>
                  </div>
                )}

                {(totalAddedTags > 0 || totalRemovedTags > 0) && (
                  <div className="flex items-start gap-2 pt-1.5">
                    <span className="text-[13px] text-slate-500 dark:text-slate-400 w-16 pt-0.5">Tags</span>
                    <div className="flex flex-wrap gap-1.5">
                      {finalChanges.tagsToAdd?.map(tid => {
                        const t = availableTags.find(x => x.id === tid);
                        if (!t) return null;
                        return (
                          <div key={'add-'+tid} className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded text-[11px] font-bold">
                            <Plus className="w-3 h-3" /> {t.name}
                          </div>
                        );
                      })}
                      {finalChanges.tagsToRemove?.map(tid => {
                        const t = availableTags.find(x => x.id === tid);
                        if (!t) return null;
                        return (
                          <div key={'rm-'+tid} className="flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 rounded text-[11px] font-bold decoration-rose-500/40 line-through">
                            <Minus className="w-3 h-3" /> {t.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. Status Segmented Control Premium */}
        <div className="space-y-3">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Status de Novidade
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'no_change', label: 'Não alterar' },
              { id: 'default', label: 'Sem status' },
              { id: 'new', label: 'Nova' },
              { id: 'old', label: 'Antiga' }
            ].map(opt => {
              const isSelected = activeStatus === opt.id;
              
              let colors = "bg-white dark:bg-[#111113] border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5";
              if (isSelected) {
                if (opt.id === 'no_change') colors = "bg-slate-100 dark:bg-white/10 border-slate-300 dark:border-white/20 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10";
                else if (opt.id === 'new') colors = "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-500/30";
                else if (opt.id === 'old') colors = "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 shadow-sm ring-1 ring-amber-200 dark:ring-amber-500/30";
                else colors = "bg-slate-800 dark:bg-white/20 border-slate-900 dark:border-white/30 text-white shadow-sm ring-1 ring-slate-900 dark:ring-white/30"; // default
              }

              return (
                <button
                  key={opt.id}
                  onClick={() => handleStatusChange(opt.id as any)}
                  className={`flex items-center justify-center gap-2 h-10 px-4 rounded-xl border text-[13px] font-bold transition-all duration-200 ${colors}`}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-slate-200/50 dark:bg-white/5 w-full" />

        {/* 4. Idioma Premium */}
        <div className="space-y-3">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Idioma
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { id: 'no_change', label: 'Não alterar', icon: '⎯' },
              { id: 'pt', label: 'Português', icon: '🇧🇷' },
              { id: 'en', label: 'Inglês', icon: '🇺🇸' },
              { id: 'es', label: 'Espanhol', icon: '🇪🇸' },
              { id: 'other', label: 'Outro', icon: '🌐' },
              { id: 'unknown', label: 'Desconhecido', icon: '❔' }
            ].map(opt => {
              const isSelected = activeLang === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleLanguageChange(opt.id as any)}
                  className={`flex items-center justify-between h-11 px-3.5 rounded-xl border transition-all duration-200 ${
                    isSelected 
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-500/30'
                      : 'bg-white dark:bg-[#111113] border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{opt.icon}</span>
                    <span className="text-[13px] font-semibold">{opt.label}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-slate-200/50 dark:bg-white/5 w-full" />

        {/* 5. Tags Redesign */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Tags
            </label>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
              Toque nos chips para adicionar ou remover
            </p>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar tags..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-white dark:bg-[#111113] border border-slate-200/60 dark:border-white/5 text-[13px] text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
            />
          </div>

          <div className="p-4 bg-white dark:bg-[#111113] border border-slate-200/60 dark:border-white/5 rounded-2xl min-h-[120px]">
            {filteredTags.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Nenhuma tag encontrada.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {filteredTags.map(tag => {
                  const isAdding = (changes.tagsToAdd || []).includes(tag.id);
                  const isRemoving = (changes.tagsToRemove || []).includes(tag.id);
                  
                  let stateClasses = "bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-transparent dark:border-transparent opacity-80 hover:opacity-100";
                  let Icon = null;

                  if (isAdding) {
                    stateClasses = "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-500/30 shadow-sm";
                    Icon = Plus;
                  } else if (isRemoving) {
                    stateClasses = "bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 ring-1 ring-rose-200 dark:ring-rose-500/30 opacity-90 line-through decoration-rose-500/40 shadow-sm";
                    Icon = Minus;
                  }

                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleTagToggle(tag.id)}
                      aria-pressed={isAdding || isRemoving}
                      aria-label={`${isAdding ? 'Adicionando' : isRemoving ? 'Removendo' : 'Neutro para'} tag ${tag.name}`}
                      className={`h-9 px-3.5 rounded-[10px] border transition-all duration-200 flex items-center gap-2 text-[13px] font-bold select-none active:scale-95 ${stateClasses}`}
                    >
                      {!isAdding && !isRemoving && tag.color && (
                        <span className="w-2.5 h-2.5 rounded-full shadow-inner opacity-70" style={{ backgroundColor: tag.color }} />
                      )}
                      {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={3} />}
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 sm:hidden">
            Toque nos chips: <strong>Neutro</strong> → <strong className="text-indigo-500">Adicionar</strong> → <strong className="text-rose-500">Remover</strong>
          </p>
        </div>
      </div>

      {/* 6. Rodapé Fixo Premium */}
      <div className="px-5 py-4 border-t border-black/[0.04] dark:border-white/[0.04] bg-white/80 dark:bg-[#0A0A0B]/80 backdrop-blur-xl absolute bottom-0 left-0 right-0 z-20 pb-[calc(1rem+env(safe-area-inset-bottom))] drop-shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex-1 flex justify-between sm:justify-start items-center w-full sm:w-auto">
             <div className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
               {totalChanges === 0 ? "Nenhuma alteração" : 
                totalChanges === 1 ? "1 alteração pendente" : 
                `${totalChanges} alterações pendentes`}
             </div>

             {/* Zona de Exclusão (Mobile) */}
             <button 
               onClick={onDelete}
               className="sm:hidden text-[12px] font-bold text-red-500 opacity-80 px-2 py-1"
             >
               Excluir
             </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={onDelete}
              className="hidden sm:flex text-[13px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-4 h-10 rounded-xl items-center justify-center transition-colors mr-2"
            >
              Excluir selecionadas
            </button>
            <button 
              onClick={onCancel}
              className="flex-1 sm:flex-none h-11 px-5 rounded-xl font-bold text-[13px] text-slate-700 dark:text-slate-200 bg-slate-200/50 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
            >
              Cancelar
            </button>
            <button 
              disabled={!hasChanges}
              onClick={() => onApply(finalChanges)}
              className={`flex-1 sm:flex-none h-11 px-6 rounded-xl font-bold text-[13px] text-white transition-all duration-300 shadow-md ${
                hasChanges 
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-500/25 active:scale-[0.98]' 
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-500 shadow-none cursor-not-allowed'
              }`}
            >
              Aplicar alterações
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
