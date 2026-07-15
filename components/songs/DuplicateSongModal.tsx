import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, FileMusic, Edit2, PlusCircle, ExternalLink, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';

export interface DuplicateMatch {
  song: any;
  score: number;
  matchType: 'exact' | 'probable' | 'possible';
  location: 'repertoire' | 'global_library';
}

interface DuplicateSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateSong: any;
  matches: DuplicateMatch[];
  onSaveAnyway: () => void;
  onEditExisting?: (song: any) => void;
  onReplaceExisting?: (song: any) => void;
  isLoading?: boolean;
}

export const DuplicateSongModal: React.FC<DuplicateSongModalProps> = ({
  isOpen,
  onClose,
  candidateSong,
  matches,
  onSaveAnyway,
  onEditExisting,
  onReplaceExisting,
  isLoading
}) => {
  const { t } = useTranslation();

  if (!candidateSong) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('modals.similar_songs_found', 'Músicas parecidas encontradas')}
      maxWidth="max-w-2xl"
    >
      <div className="p-1 mb-2">
        <p className="text-zinc-400 text-sm mb-4">
          {t('modals.similar_songs_desc', 'Encontramos músicas que parecem já existir. Escolha o que deseja fazer antes de continuar.')}
        </p>

        <div className="bg-zinc-800/50 rounded-xl p-4 mb-6 border border-zinc-700/50">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-2">
            {t('modals.you_are_adding', 'Você está tentando adicionar:')}
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-zinc-100">{candidateSong.title}</p>
              <p className="text-sm text-zinc-400">{candidateSong.artist || t('general.unknown_artist', 'Artista Desconhecido')}</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">
          {t('modals.existing_similar', 'Músicas similares já existentes:')}
        </p>

        <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-1">
          {matches.map((match, idx) => (
            <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                  <FileMusic className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-zinc-100">{match.song.title}</p>
                  <p className="text-sm text-zinc-400 mb-1">{match.song.artist || t('general.unknown_artist', 'Artista Desconhecido')}</p>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
                      {match.song.key || '-'}
                    </span>
                    {match.matchType === 'exact' && (
                      <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] uppercase font-bold tracking-wider">
                        {t('modals.exact_duplicate', 'Duplicata Exata')}
                      </span>
                    )}
                    {match.matchType === 'probable' && (
                      <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 text-[10px] uppercase font-bold tracking-wider">
                        {t('modals.probable_duplicate', 'Provável')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 shrink-0">
                {onEditExisting && match.location === 'repertoire' && (
                  <Button 
                    variant="outline" 
                    onClick={() => onEditExisting(match.song)}
                    className="h-9 px-3 text-xs"
                    disabled={isLoading}
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                    {t('modals.edit_existing', 'Editar')}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-800">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            {t('modals.cancel_import', 'Cancelar')}
          </Button>
          <Button
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
            onClick={onSaveAnyway}
            isLoading={isLoading}
          >
            {t('modals.save_anyway', 'Salvar nova mesmo assim')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
