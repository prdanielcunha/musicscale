import React, { useState, useEffect } from 'react';
import Modal from "../common/Modal";
import { useAuth } from '../../contexts/AuthContext';
import { useEcosystem } from '../../contexts/EcosystemContext';
import { useMusic } from '../../contexts/MusicDataContext';
import { Music, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { GlobalSong } from '../../types';
import { useTranslation } from 'react-i18next';

interface StarterRepertoireModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function StarterRepertoireModal({ isOpen, onClose, onSuccess }: StarterRepertoireModalProps) {
  const { organization, user } = useAuth();
  const { t } = useTranslation();
  const { refreshData, songs } = useMusic();
  const { publishEvent } = useEcosystem();
  
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starterSongs, setStarterSongs] = useState<GlobalSong[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && organization && user) {
      fetchStarterPack();
      publishEvent({ type: 'telemetry', payload: { action: 'musicscale_starter_pack_viewed' }, timestamp: Date.now() });
    }
  }, [isOpen, organization, user]);

  const fetchStarterPack = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/v1/onboarding/starter-pack', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-organization-id': organization?.id || ''
        }
      });
      if (!response.ok) throw new Error('Failed to fetch starter pack');
      const data = await response.json();
      setStarterSongs(data.starterPack || []);
      
      const ids = new Set(data.starterPack?.map((s: GlobalSong) => s.id));
      setSelectedIds(ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching starter pack');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (!organization || !user || selectedIds.size === 0) return;
    
    setImporting(true);
    setError(null);
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
      onSuccess();
    } catch (err: any) {
      const isLimitExceeded = err.message === "LIMIT_EXCEEDED" || err.message === "starter_pack_limit_exceeded";
      const errorCode = isLimitExceeded ? "LIMIT_EXCEEDED" : "ONBOARDING_IMPORT_FAILED";

      setError(
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
    <Modal isOpen={isOpen} onClose={onClose} title={t('onboarding.starter_modal_title', 'Repertório Inicial')}>
      <div className="p-4 md:p-6 flex flex-col h-full max-h-[80vh]">
        <div className="mb-6">
          <p className="text-zinc-400">
            {t('onboarding.starter_modal_desc', 'Selecionamos {{count}} músicas para você começar. Elas estão prontas para usar na sua primeira escala.', { count: starterSongs.length })}
          </p>
        </div>

        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <p className="text-red-400 mb-4">{error}</p>
            <button 
              onClick={fetchStarterPack}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors text-white"
            >
              <RefreshCw className="w-4 h-4" /> {t('onboarding.try_again', 'Tentar novamente')}
            </button>
          </div>
        ) : loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
            <p className="text-zinc-500">{t('onboarding.fetching_repertoire', 'Buscando o melhor repertório...')}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {starterSongs.map(song => {
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
            onClick={onClose}
            className="px-5 py-2.5 text-zinc-400 hover:text-white transition-colors font-medium"
          >
            {t('onboarding.cancel', 'Cancelar')}
          </button>
          <button 
            onClick={handleImport}
            disabled={importing || selectedIds.size === 0 || loading || error !== null}
            className="px-6 py-2.5 bg-white text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {importing ? t('onboarding.adding', 'Adicionando...') : (selectedIds.size === 1 ? t('onboarding.add_songs_btn_one', 'Adicionar {{count}} música', { count: selectedIds.size }) : t('onboarding.add_songs_btn_other', 'Adicionar {{count}} músicas', { count: selectedIds.size }))}
          </button>
        </div>
      </div>
    </Modal>
  );
}
