import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronDown, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { PopulatedSong } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../contexts/ApiContext';
import { useToast } from '../../contexts/ToastContext';
import { transposeChordDocument, normalizeKey, isValidKey } from '../../utils/chordEngine';
import Button from '../common/Button';

export type ChordKeyRepairMode = 'draft' | 'persisted';

interface ChordKeyRepairSheetProps {
  isOpen: boolean;
  song: PopulatedSong;
  onClose: () => void;
  onSuccess?: (updatedSong: PopulatedSong) => void;
  mode?: ChordKeyRepairMode;
}

const MAJOR_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
const MINOR_KEYS = MAJOR_KEYS.map(k => `${k}m`);
const ALL_KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];

export const ChordKeyRepairSheet: React.FC<ChordKeyRepairSheetProps> = ({
  isOpen,
  song,
  onClose,
  onSuccess,
  mode = 'persisted'
}) => {
  const { t } = useTranslation();
  const api = useApi();
  const { toast } = useToast();
  const { effectiveOrganizationId, permissions, userProfile } = useAuth();

  const [sourceChordKey, setSourceChordKey] = useState<string>('');
  const [targetChordKey, setTargetChordKey] = useState<string>('C');
  const [showFullPreview, setShowFullPreview] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const initialOrgIdRef = useRef(effectiveOrganizationId);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Auto-close on organization change
  useEffect(() => {
    if (effectiveOrganizationId !== initialOrgIdRef.current) {
      onClose();
    }
  }, [effectiveOrganizationId, onClose]);

  // Trap focus & keyboard escape close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Set initial focus
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Focus trap Tab behavior
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
        
        if (e.shiftKey) { // Shift + Tab
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else { // Tab
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };
    window.addEventListener('keydown', handleFocusTrap);
    return () => window.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen]);

  // Setup keys from song without guessing
  useEffect(() => {
    if (song) {
      const tKey = song.key || 'C';
      setTargetChordKey(tKey);
      
      const contentKey = song.metadata?.chordContentKey || song.metadata?.shapeKey || '';
      setSourceChordKey(contentKey);
    }
  }, [song]);

  if (!isOpen || !song) return null;

  const hasEditCapability = mode === 'draft' || !!(
    permissions?.['musicscale.songs.edit'] ||
    permissions?.manageSongs ||
    permissions?.['musicScale.manageSongs']
  );

  // Compute preview in real-time
  let transposedChords = '';
  let semitones = 0;
  let changedChordCount = 0;
  let previewError = null;

  try {
    if (sourceChordKey && targetChordKey && sourceChordKey !== targetChordKey) {
      const result = transposeChordDocument(song.chords || '', sourceChordKey, targetChordKey);
      transposedChords = result.chords;
      semitones = result.semitones;
      changedChordCount = result.changedChordCount;
    } else {
      transposedChords = song.chords || '';
    }
  } catch (err: any) {
    previewError = err.message || 'Erro ao gerar prévia';
  }

  const beforeLines = (song.chords || '').split('\n');
  const afterLines = transposedChords.split('\n');
  const visibleBefore = showFullPreview ? beforeLines : beforeLines.slice(0, 8);
  const visibleAfter = showFullPreview ? afterLines : afterLines.slice(0, 8);

  const semitonesLabel = semitones > 0 ? `+${semitones}` : `${semitones}`;

  const handleApply = async () => {
    if (loading) return;
    setError(null);

    // Double check capability (only in persisted mode)
    if (mode === 'persisted' && !hasEditCapability) {
      setError(t('chordKeyRepair.unauthorized', 'Permissão negada: Usuário não possui a capability necessária para esta operação.'));
      return;
    }

    if (!sourceChordKey) {
      setError(t('chordKeyRepair.selectSourceKey', 'Selecione o tom de origem.'));
      return;
    }

    if (sourceChordKey === targetChordKey) {
      setError(t('chordKeyRepair.sameKeysError', 'O tom de origem não pode ser igual ao de destino.'));
      return;
    }

    if (song.metadata?.chordContentKey === targetChordKey) {
      setError(t('chordKeyRepair.alreadyInKey', 'A cifra já está neste tom.'));
      return;
    }

    setLoading(true);

    try {
      const updatedMetadata = {
        ...(song.metadata || {}),
        chordContentKey: targetChordKey,
        normalizedToConcertKey: true,
        declaredKey: targetChordKey,
        shapeKey: targetChordKey,
        capo: 0,
        transpositionSemitones: 0,
        chordKeyCorrection: {
          version: 1,
          previousContentKey: sourceChordKey,
          correctedContentKey: targetChordKey,
          semitones,
          method: 'manual',
          correctedAt: new Date().toISOString(),
          correctedBy: userProfile?.uid || 'unknown'
        }
      };

      const updatedSong: PopulatedSong = {
        ...song,
        chords: transposedChords,
        metadata: updatedMetadata,
        chordsLastModifiedAt: new Date().toISOString()
      };

      if (mode === 'persisted') {
        if (!api) {
          throw new Error('Serviço de API indisponível no momento.');
        }

        await api.repairOrganizationSongChordKey({
          songId: song.id,
          organizationId: effectiveOrganizationId || '',
          sourceChordKey,
          targetChordKey,
          expectedUpdatedAt: song.lastModifiedAt || song.chordsLastModifiedAt || (song as any).updatedAt || null
        });

        // Show toast
        toast({
          title: t('chordKeyRepair.successTitle', 'Cifra corrigida'),
          description: t('chordKeyRepair.successMessage', 'Os acordes foram ajustados de {{from}} para {{to}}.', {
            from: sourceChordKey,
            to: targetChordKey
          }),
          type: 'success'
        });
      }

      // Trigger success callback
      if (onSuccess) {
        onSuccess(updatedSong);
      }

      onClose();
    } catch (err: any) {
      console.error('[ChordKeyRepair] Repair failed:', err);
      setError(err.message || 'Erro inesperado ao corrigir a cifra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] overflow-hidden flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Background Overlay */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Main Container: Bottom Sheet on Mobile, Centered Dialog on Desktop */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full md:max-w-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 md:border md:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] md:max-h-[85vh] transition-all rounded-t-3xl overflow-hidden"
      >
        {/* Mobile Drag Handle */}
        <div className="md:hidden flex justify-center py-3">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pb-4 md:pt-6 flex justify-between items-start border-b border-slate-100 dark:border-slate-800/60 shrink-0">
          <div>
            <h2 id="modal-title" className="text-xl font-bold text-slate-900 dark:text-white">
              {t('chordKeyRepair.title', 'Ajustar tom da cifra')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              {t('chordKeyRepair.description', 'Use esta ferramenta quando os acordes estiverem escritos em um tom diferente do tom real da música.')}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm flex gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Written in Key */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {t('chordKeyRepair.writtenIn', 'A cifra está escrita em:')}
              </label>
              <div className="relative">
                <select
                  value={sourceChordKey}
                  onChange={(e) => setSourceChordKey(e.target.value)}
                  disabled={loading}
                  className="w-full min-h-[44px] px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl font-medium focus:ring-2 focus:ring-primary/20 appearance-none outline-none disabled:opacity-50"
                >
                  <option value="" disabled>
                    {t('chordKeyRepair.selectSourceKey', 'Selecione o tom de origem')}
                  </option>
                  {ALL_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Target key */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {t('chordKeyRepair.convertTo', 'Converter os acordes para:')}
              </label>
              <div className="relative">
                <select
                  value={targetChordKey}
                  onChange={(e) => setTargetChordKey(e.target.value)}
                  disabled={loading}
                  className="w-full min-h-[44px] px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl font-medium focus:ring-2 focus:ring-primary/20 appearance-none outline-none disabled:opacity-50"
                >
                  {ALL_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Real-time Summary Badge Row */}
          {sourceChordKey && targetChordKey && sourceChordKey !== targetChordKey && !previewError && (
            <div className="flex flex-wrap gap-4 items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/40 text-xs text-slate-600 dark:text-slate-400">
              <div>
                <span className="font-bold">{t('chordKeyRepair.difference', 'Diferença')}:</span>{' '}
                <span className="font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10">
                  {semitonesLabel} semitons
                </span>
              </div>
              {changedChordCount > 0 && (
                <div>
                  <span className="font-bold">{t('chordKeyRepair.alteredChords', 'Quantidade de acordes alterados')}:</span>{' '}
                  <span className="font-bold text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded bg-blue-500/10">
                    {changedChordCount}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Previews Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {t('chordKeyRepair.preview', 'Prévia')}
            </h3>

            {previewError ? (
              <p className="text-xs text-red-500">{previewError}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BEFORE PREVIEW */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col bg-slate-50/50 dark:bg-slate-950/30">
                  <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    {t('chordKeyRepair.before', 'ANTES')}
                  </div>
                  <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed max-h-60">
                    {visibleBefore.join('\n')}
                  </pre>
                </div>

                {/* AFTER PREVIEW */}
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-950 overflow-hidden flex flex-col bg-emerald-500/[0.01] dark:bg-emerald-500/[0.02]">
                  <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-950/40 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                    {t('chordKeyRepair.after', 'DEPOIS')}
                  </div>
                  <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed max-h-60">
                    {visibleAfter.join('\n')}
                  </pre>
                </div>
              </div>
            )}

            {/* Toggle Full Preview */}
            {!previewError && (beforeLines.length > 8 || afterLines.length > 8) && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowFullPreview(!showFullPreview)}
                  className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline py-1.5 focus:outline-none"
                >
                  {showFullPreview 
                    ? t('chordKeyRepair.hideFullPreview', 'Ocultar prévia')
                    : t('chordKeyRepair.viewFullPreview', 'Ver prévia completa')}
                </button>
              </div>
            )}
          </div>

          {/* Action Warnings */}
          <div className="p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/10 text-xs text-amber-700 dark:text-amber-500 leading-relaxed flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
            <span>{t('chordKeyRepair.warning', 'Esta ação corrige permanentemente a cifra salva no repertório da organização. Para mudar somente uma escala, use o ajuste de tom do evento.')}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-end gap-3 shrink-0">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto font-bold"
          >
            {t('chordKeyRepair.cancel', 'Cancelar')}
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            disabled={loading || !sourceChordKey || sourceChordKey === targetChordKey}
            leftIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            className="w-full sm:w-auto font-bold"
          >
            {loading ? t('nav.loading', 'Carregando...') : t('chordKeyRepair.apply', 'Aplicar correção')}
          </Button>
        </div>
      </div>
    </div>
  );
};
