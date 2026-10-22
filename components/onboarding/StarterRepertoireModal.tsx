import React, { useState, useEffect } from 'react';
import Modal from "../common/Modal";
import { useAuth } from '../../contexts/AuthContext';
import { useEcosystem } from '../../contexts/EcosystemContext';
import { useMusic } from '../../contexts/MusicDataContext';
import { CheckCircle2, Loader2, RefreshCw, Search } from 'lucide-react';
import { GlobalSong } from '../../types';
import { useTranslation } from 'react-i18next';
import { useStarterPackAllowance } from '../../hooks/useStarterPackAllowance';

interface StarterRepertoireModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onCompleted: (result?: any) => void;
  returnToJourney?: boolean;
}

export function StarterRepertoireModal({ isOpen, onCancel, onCompleted, returnToJourney = false }: StarterRepertoireModalProps) {
  const { organization, user } = useAuth();
  const { t } = useTranslation();
  const { refreshData, songs } = useMusic();
  const { publishEvent } = useEcosystem();
  const { starterPack: hookStarterPack, suggestionPool, allowance, refreshAllowance, error: hookError, loading: hookLoading } = useStarterPackAllowance();
  const availableCandidates = suggestionPool?.length ? suggestionPool : hookStarterPack;
  const [choiceMode, setChoiceMode] = useState<'suggestions' | 'manual'>('suggestions');
  const [suggestionBatch, setSuggestionBatch] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const suggestionCount = Math.min(10, availableCandidates.length);
  const visibleSuggestions = Array.from({ length: suggestionCount }, (_, i) =>
    availableCandidates[(suggestionBatch * 10 + i) % availableCandidates.length]
  );
  const normalizedSearch = searchTerm.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const listSongs = choiceMode === 'manual'
    ? availableCandidates.filter(song =>
        `${song.title || ''} ${song.artist || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalizedSearch))
    : visibleSuggestions;
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set());
      setImportError(null);
      setChoiceMode('suggestions');
      setSuggestionBatch(0);
      setSearchTerm('');
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIds(new Set());
    setImportError(null);
    setChoiceMode('suggestions');
    setSuggestionBatch(0);
    setSearchTerm('');
  }, [organization?.id]);

  useEffect(() => {
    if (isOpen && hookStarterPack.length > 0 && allowance) {
      const importedIds = new Set<string>();
      songs.forEach(s => {
        if (((s as any).onboardingStarter || (s as any).onboardingStarterPack) && s.originGlobalSongId) {
          importedIds.add(s.originGlobalSongId);
        }
      });

      const initialSelection = new Set<string>();
      const maxSelectable = allowance.remaining;
      let count = 0;
      if (allowance.completed || allowance.remaining === 0) return;

      
      for (const song of hookStarterPack) {
        if (count >= maxSelectable) break;
        if (!importedIds.has(song.id)) {
          initialSelection.add(song.id);
          count++;
        }
      }
      setSelectedIds(initialSelection);
    }
  }, [isOpen, hookStarterPack, allowance?.remaining]);

  
  
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && organization && user) {
      publishEvent({ type: 'telemetry', payload: { action: 'musicscale_starter_pack_viewed' }, timestamp: Date.now() });
    }
  }, [isOpen, organization, user]);



  
  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const isImported = songs.some(s => ((s as any).onboardingStarter || (s as any).onboardingStarterPack) && s.originGlobalSongId === id);
      if (isImported) return prev; // Cannot toggle imported songs
      
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (allowance && next.size >= allowance.remaining) {
          return prev; // Max reached
        }
        next.add(id);
      }
      return next;
    });
  };

  const handleNextSuggestions = () => {
    if (choiceMode === 'manual') {
      setChoiceMode('suggestions');
      return;
    }
    if (availableCandidates.length <= 10) return;
    const nextBatch = (suggestionBatch + 1) % Math.ceil(availableCandidates.length / 10);
    const nextSongs = Array.from({ length: suggestionCount }, (_, i) =>
      availableCandidates[(nextBatch * 10 + i) % availableCandidates.length]
    );
    const importedIds = new Set(songs.map(song => song.originGlobalSongId).filter(Boolean));
    setSelectedIds(new Set(nextSongs.filter(song => !importedIds.has(song.id)).slice(0, allowance?.remaining ?? 0).map(song => song.id)));
    setSuggestionBatch(nextBatch);
  };

  const handleChooseManually = () => {
    if (choiceMode === 'manual') return;
    setChoiceMode('manual');
    setSelectedIds(new Set());
    setSearchTerm('');
  };

  const handleImport = async () => {
    if (!organization || !user || selectedIds.size === 0) return;
    
    setImporting(true);
    setImportError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/v1/onboarding/starter-pack/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-organization-id': organization.id
        },
        body: JSON.stringify({
          selectedSongIds: Array.from(selectedIds)
        })
      });
      
      if (!response.ok) {
        let errorMsg = 'Failed to import songs';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (e) {}
        throw new Error(errorMsg);
      }
      
      await refreshData();
      await refreshAllowance();
      publishEvent({
        type: 'telemetry',
        payload: {
          action: 'musicscale_starter_pack_imported',
          organizationId: organization.id,
          source: 'starter_pack_import',
          count: selectedIds.size,
          path: '/api/v1/onboarding/starter-pack/import',
          timestamp: new Date().toISOString()
        },
        timestamp: Date.now()
      });
      onCompleted();
    } catch (err: any) {
      const isLimitExceeded = err.message === "LIMIT_EXCEEDED" || err.message === "starter_pack_limit_exceeded";
      const errorCode = isLimitExceeded ? "LIMIT_EXCEEDED" : "ONBOARDING_IMPORT_FAILED";

      setImportError(
        isLimitExceeded 
          ? t('onboarding.limit_exceeded', 'Limite de 10 músicas do pacote inicial excedido para esta organização.')
          : t('onboarding.import_failed_msg', 'Erro ao importar as músicas. Por favor, tente novamente.')
      );

      publishEvent({
        type: 'telemetry',
        payload: {
          action: 'musicscale_starter_pack_failed',
          errorCode,
          organizationId: organization.id,
          source: 'starter_pack_import',
          count: selectedIds.size,
          path: '/api/v1/onboarding/starter-pack/import',
          timestamp: new Date().toISOString()
        },
        timestamp: Date.now()
      });
    } finally {
      setImporting(false);
    }
  };

  const alreadyImportedIds = new Set(songs?.filter(s => s.originGlobalSongId).map(s => s.originGlobalSongId));

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={t('firstValueJourney.starterModalTitle', 'Escolha seu repertório inicial')}>
      <div className="p-4 md:p-6 flex flex-col h-full max-h-[80vh]">
        <div className="mb-6">
          <div className="space-y-2">
            <p className="text-sm text-zinc-400 leading-relaxed">
              {t('firstValueJourney.starterModalDescription', 'Estas músicas foram selecionadas da Biblioteca Viva para acelerar seu primeiro culto. Revise a lista e escolha quais deseja adicionar. Nada será importado até você confirmar, e tudo poderá ser editado depois.')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3" role="group" aria-label={t('firstValueJourney.choiceMethod', 'Como deseja escolher?')}>
              <button
                type="button"
                onClick={handleNextSuggestions}
                disabled={hookLoading || availableCandidates.length === 0 || (choiceMode === 'suggestions' && availableCandidates.length <= 10)}
                className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-3 text-left text-sm font-semibold text-indigo-200 hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-40"
              >
                <RefreshCw className="w-4 h-4 inline-block mr-2" />
                {choiceMode === 'manual' ? t('firstValueJourney.backToSuggestions', 'Voltar às sugestões') : t('firstValueJourney.moreSuggestions', 'Ver outras sugestões')}
              </button>
              <button
                type="button"
                onClick={handleChooseManually}
                disabled={hookLoading || availableCandidates.length === 0}
                aria-pressed={choiceMode === 'manual'}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-40 ${choiceMode === 'manual' ? 'border-white/60 bg-white/10 text-white' : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'}`}
              >
                <Search className="w-4 h-4 inline-block mr-2" />
                {t('firstValueJourney.chooseSongsByName', 'Escolher músicas pelo nome')}
              </button>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {choiceMode === 'manual'
                ? t('firstValueJourney.manualChoiceExplanation', 'Pesquise as músicas disponíveis neste pacote e marque uma por uma. A seleção sugerida foi limpa.')
                : t('firstValueJourney.suggestionChoiceExplanation', 'Ver outras sugestões troca a lista e a seleção atual. Nada será importado até você confirmar.')}
            </p>
            {choiceMode === 'manual' && (
              <label className="block pt-1">
                <span className="sr-only">{t('firstValueJourney.searchSongs', 'Buscar músicas pelo nome ou artista')}</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder={t('firstValueJourney.searchSongs', 'Buscar músicas pelo nome ou artista')}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </label>
            )}
            {choiceMode === 'suggestions' && availableCandidates.length <= 10 && availableCandidates.length > 0 && (
              <p className="text-xs text-zinc-500">{t('firstValueJourney.noMoreSuggestions', 'Estas são as sugestões disponíveis agora. Você também pode escolher pelo nome.')}</p>
            )}
            {allowance?.completed ? (
               <p className="text-xs font-bold text-red-400 uppercase tracking-widest pt-2">
                 {t('starterPackAllowance.completedModalMessage', 'O pacote inicial desta organização já foi utilizado.')}
               </p>
            ) : (
               <>
                 <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest pt-2">
                   {t('starterPackAllowance.selectedCount', '{{selected}} selecionadas', { selected: selectedIds.size })}
                 </p>
                 <p className="text-xs text-zinc-500">
                   {t('starterPackAllowance.remainingBeforeImport', '{{remaining}} importações iniciais disponíveis antes desta confirmação', { remaining: allowance?.remaining })}
                 </p>
               </>
            )}
            
            {allowance && selectedIds.size >= allowance.remaining && !allowance.completed && (
              <p className="text-xs text-amber-500 mt-1">
                {t('starterPackAllowance.selectionLimitReached', 'Você selecionou o máximo de músicas disponíveis no pacote inicial.')}
              </p>
            )}
          </div>
        </div>

        {(hookError || importError) ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <p className="text-red-400 mb-4">{hookError?.message || importError}</p>
            <button 
              onClick={refreshAllowance}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-white"
            >
              <RefreshCw className="w-4 h-4" /> {t('onboarding.try_again', 'Tentar novamente')}
            </button>
          </div>
        ) : hookLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
            <p className="text-zinc-500">{t('onboarding.fetching_repertoire', 'Buscando o melhor repertório...')}</p>
          </div>
        ) : availableCandidates.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <p className="text-zinc-400 mb-2">Seu pacote inicial está vazio no momento.</p>
            <p className="text-sm text-zinc-500">Volte mais tarde quando houver novas músicas disponíveis.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {listSongs.length === 0 && (
              <p className="p-5 text-center text-sm text-zinc-400">{t('firstValueJourney.noSearchResults', 'Nenhuma música encontrada. Tente outro nome ou artista.')}</p>
            )}
            {listSongs.map(song => {
              const isAlreadyImported = alreadyImportedIds.has(song.id);
              const isSelected = selectedIds.has(song.id);
              
              return (
                <button 
                  type="button"
                  key={song.id}
                  disabled={isAlreadyImported}
                  onClick={() => handleToggle(song.id)}
                  aria-pressed={isSelected}
                  className={`w-full text-left flex items-center p-4 rounded-xl border transition-all ${isAlreadyImported ? 'opacity-50 cursor-not-allowed bg-zinc-900/50 border-zinc-800' : isSelected ? 'bg-indigo-500/10 border-indigo-500/50 hover:bg-indigo-500/20' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
                >
                  <input
                    type="checkbox"
                    id={`checkbox-${song.id}`}
                    checked={isSelected}
                    disabled={isAlreadyImported}
                    readOnly
                    className="sr-only"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium truncate">{song.title}</h4>
                    <p className="text-zinc-400 text-sm truncate">{song.artist}</p>
                    <div className="flex gap-2 mt-1 text-xs text-zinc-500">
                      {song.key && <span>{t('onboarding.key_label', 'Tom: {{key}}', { key: song.key })}</span>}
                      {song.bpm && <span>{song.bpm} BPM</span>}
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    {isAlreadyImported ? (
                      <span className="text-xs text-zinc-500 font-medium px-2 py-1 bg-zinc-800 rounded">{t('onboarding.already_in_repertoire', 'Já no repertório')}</span>
                    ) : (
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center border transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-600'}`}>
                        {isSelected && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-zinc-800/50 flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-5 py-2.5 text-zinc-400 hover:text-white transition-colors font-medium"
          >
            {returnToJourney ? t('firstValueJourney.backToFirstSteps', 'Voltar aos primeiros passos') : t('onboarding.cancel', 'Cancelar')}
          </button>
          <button 
            onClick={handleImport}
            disabled={importing || selectedIds.size === 0 || hookLoading || (hookError !== null || importError !== null)}
            className="px-6 py-2.5 bg-white text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {importing ? t('onboarding.adding', 'Adicionando...') : t('firstValueJourney.starterModalConfirm', 'Adicionar {{count}} ao repertório', { count: selectedIds.size })}
          </button>
        </div>
      </div>
    </Modal>
  );
}
