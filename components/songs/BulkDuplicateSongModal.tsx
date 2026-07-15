import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { DuplicateMatch } from './DuplicateSongModal';

interface BulkDuplicateSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: { candidate: any, matches: DuplicateMatch[] }[];
  onIgnoreAll: () => void;
  onSaveAllAnyway: () => void;
  isLoading?: boolean;
}

export const BulkDuplicateSongModal: React.FC<BulkDuplicateSongModalProps> = ({
  isOpen,
  onClose,
  duplicates,
  onIgnoreAll,
  onSaveAllAnyway,
  isLoading
}) => {
  const { t } = useTranslation();

  if (!isOpen || duplicates.length === 0) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('modals.bulk_similar_songs_found', 'Músicas parecidas encontradas em massa')}
      maxWidth="max-w-2xl"
    >
      <div className="p-1 mb-2">
        <p className="text-zinc-400 text-sm mb-4">
          Algumas músicas da sua seleção já parecem existir no repertório.
        </p>

        <div className="space-y-4 mb-6 max-h-[50vh] overflow-y-auto pr-1">
          {duplicates.map((dup, idx) => (
            <div key={idx} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
               <p className="font-bold text-zinc-100">{dup.candidate.title} <span className="text-sm font-normal text-zinc-400">- {dup.candidate.artist}</span></p>
               <div className="mt-2 pl-4 border-l-2 border-indigo-500/50 space-y-2">
                 {dup.matches.map((m, midx) => (
                   <p key={midx} className="text-xs text-zinc-300">
                     Já existe como: <span className="font-bold">{m.song.title}</span> ({m.song.artist})
                     <span className="ml-2 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[9px] uppercase">
                       {m.matchType === 'exact' ? 'Exata' : 'Possível'}
                     </span>
                   </p>
                 ))}
               </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-800">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
            Cancelar Importação
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onIgnoreAll} disabled={isLoading}>
            Importar Apenas Novas
          </Button>
          <Button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white" onClick={onSaveAllAnyway} isLoading={isLoading}>
            Importar Todas
          </Button>
        </div>
      </div>
    </Modal>
  );
};
