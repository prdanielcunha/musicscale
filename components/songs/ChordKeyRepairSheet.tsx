import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronDown, Check, AlertTriangle, Loader2 } from 'lucide-react';
import type { PopulatedSong, ChordSourceConfirmation, ChordKeyRepairDraftSong } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../contexts/ApiContext';
import { useToast } from '../../contexts/ToastContext';
import { 
  transposeChordDocument, 
  normalizeKey, 
  isValidKey, 
  getSignedSemitones,
  analyzeChordDocumentKeyCandidates,
  validateTransposedPreview,
  areKeysEnharmonicallyEquivalent,
  resolveChordContentSourceKey,
  buildChordKeyCorrectionMetadata,
  ChordDocumentAnalysisResult
} from '../../utils/chordEngine';
import Button from '../common/Button';

export type ChordKeyRepairMode = 'draft' | 'persisted';

export type ChordKeyRepairSheetProps =
  | {
      isOpen: boolean;
      mode: 'draft';
      song: ChordKeyRepairDraftSong;
      onClose: () => void;
      onSuccess?: (updatedSong: ChordKeyRepairDraftSong) => void;
    }
  | {
      isOpen: boolean;
      mode?: 'persisted';
      song: PopulatedSong;
      onClose: () => void;
      onSuccess?: (updatedSong: PopulatedSong) => void;
    };

const MAJOR_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
const MINOR_KEYS = MAJOR_KEYS.map(k => `${k}m`);
const ALL_KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];

export const ChordKeyRepairSheet: React.FC<ChordKeyRepairSheetProps> = (props) => {
  const {
    isOpen,
    onClose,
    mode = 'persisted'
  } = props;
  const song = props.song;

  const { t } = useTranslation();
  const api = useApi();
  const { toast } = useToast();
  const { effectiveOrganizationId, permissions, userProfile } = useAuth();

  const [sourceChordKey, setSourceChordKey] = useState<string>('');
  const [targetChordKey, setTargetChordKey] = useState<string>('');
  const [sourceConfirmation, setSourceConfirmation] = useState<ChordSourceConfirmation | null>(null);
  const [showFullPreview, setShowFullPreview] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const initialOrgIdRef = useRef(effectiveOrganizationId);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const sourceSelectRef = useRef<HTMLSelectElement>(null);
  const targetSelectRef = useRef<HTMLSelectElement>(null);
  const confirmActionRef = useRef<any>(null);
  const applyBtnRef = useRef<any>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  const [isInitialStateResolved, setIsInitialStateResolved] = useState(false);
  const hasFocusedRef = useRef(false);

  // Auto-close on organization change
  useEffect(() => {
    if (effectiveOrganizationId !== initialOrgIdRef.current) {
      onClose();
    }
  }, [effectiveOrganizationId, onClose]);

  // Trap focus & keyboard escape close (disabled during loading)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (loading) return; // Do not close during loading
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, loading]);

  // Set initial focus & restore focus on cleanup
  useEffect(() => {
    if (!isOpen) return;

    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      triggerElementRef.current = document.activeElement;
    }

    return () => {
      const prevElem = triggerElementRef.current;
      if (prevElem && typeof prevElem.focus === 'function' && document.body.contains(prevElem)) {
        prevElem.focus();
      }
    };
  }, [isOpen]);

  // Handle focus when initial state is resolved
  useEffect(() => {
    if (!isOpen) {
      hasFocusedRef.current = false;
      return;
    }
    if (!isInitialStateResolved || hasFocusedRef.current) return;

    const animId = requestAnimationFrame(() => {
      hasFocusedRef.current = true;
      if (!sourceChordKey || (!sourceConfirmation && !targetChordKey)) {
        sourceSelectRef.current?.focus();
      } else if (sourceConfirmation && !targetChordKey) {
        targetSelectRef.current?.focus();
      } else if (!sourceConfirmation && sourceChordKey && targetChordKey) {
        if (confirmActionRef.current && typeof confirmActionRef.current.focus === 'function') {
          confirmActionRef.current.focus();
        } else {
          sourceSelectRef.current?.focus();
        }
      } else if (sourceConfirmation && targetChordKey) {
        if (applyBtnRef.current && typeof applyBtnRef.current.focus === 'function' && !applyBtnRef.current.disabled) {
          applyBtnRef.current.focus();
        } else {
          sourceSelectRef.current?.focus();
        }
      } else {
        sourceSelectRef.current?.focus();
      }
    });

    return () => cancelAnimationFrame(animId);
  }, [isOpen, isInitialStateResolved, sourceChordKey, targetChordKey, sourceConfirmation]);

  // Focus trap Tab behavior
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;

      const rawElements = Array.from(
        modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ) as HTMLElement[];

      const focusableElements = rawElements.filter(el => {
        if (el.hasAttribute('disabled') || (el as HTMLButtonElement).disabled) return false;
        if (el.getAttribute('tabindex') === '-1') return false;
        if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) return false;
        const style = typeof window !== 'undefined' ? window.getComputedStyle(el) : null;
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
        return true;
      });

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement;

      const isInside = modalRef.current.contains(activeElement);

      if (!isInside) {
        e.preventDefault();
        if (e.shiftKey) {
          lastElement.focus();
        } else {
          firstElement.focus();
        }
        return;
      }

      if (focusableElements.length === 1) {
        e.preventDefault();
        firstElement.focus();
        return;
      }

      if (e.shiftKey) {
        if (activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener('keydown', handleFocusTrap);
    return () => window.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen]);

  // Analyze chord document analysis result
  const [analysisResult, setAnalysisResult] = useState<ChordDocumentAnalysisResult>({ candidates: [] });

  // Setup keys from song without guessing default C
  useEffect(() => {
    if (song) {
      // Priority for target key: originalKey -> selectedKey -> key -> ''
      let initialTarget = '';
      if (song.originalKey && isValidKey(song.originalKey)) {
        initialTarget = song.originalKey;
      } else if (song.selectedKey && isValidKey(song.selectedKey)) {
        initialTarget = song.selectedKey;
      } else if (song.key && isValidKey(song.key)) {
        initialTarget = song.key;
      } else {
        initialTarget = '';
      }
      setTargetChordKey(initialTarget);

      const sourceRes = resolveChordContentSourceKey(song.metadata);
      const analysis = analyzeChordDocumentKeyCandidates(song.chords || '');
      setAnalysisResult(analysis);

      const topCandidate = analysis.candidates[0];

      if (sourceRes && sourceRes.canAutoConfirm) {
        setSourceChordKey(sourceRes.key);
        if (topCandidate && (topCandidate.confidence === 'high' || topCandidate.confidence === 'medium') && !areKeysEnharmonicallyEquivalent(sourceRes.key, topCandidate.key)) {
          // Conflict between metadata and analysis! Unconfirmed
          setSourceConfirmation(null);
        } else {
          setSourceConfirmation({ type: 'metadata', metadataKey: sourceRes.key });
        }
      } else if (sourceRes && !sourceRes.canAutoConfirm) {
        // shapeKey: suggested in selector, BUT cannot auto-confirm! User must confirm explicitly
        setSourceChordKey(sourceRes.key);
        setSourceConfirmation(null);
      } else if (topCandidate && (topCandidate.confidence === 'high' || topCandidate.confidence === 'medium')) {
        setSourceChordKey(topCandidate.key);
        setSourceConfirmation(null); // Must explicitly confirm detected candidate
      } else {
        setSourceChordKey('');
        setSourceConfirmation(null);
      }

      setIsInitialStateResolved(true);
    } else {
      setIsInitialStateResolved(false);
      setSourceConfirmation(null);
      setSourceChordKey('');
      setTargetChordKey('');
    }
  }, [song, isOpen]);

  if (!isOpen || !song) return null;

  const hasEditCapability = mode === 'draft' || !!(
    permissions?.['musicscale.songs.edit'] ||
    permissions?.manageSongs ||
    permissions?.['musicScale.manageSongs']
  );

  const topCandidate = analysisResult.candidates[0];
  const sourceRes = resolveChordContentSourceKey(song.metadata);
  const metadataKey = sourceRes?.canAutoConfirm ? sourceRes.key : '';

  // Determine if there is a conflict between metadataKey and detected chords
  const hasMetadataContentConflict = !!(
    metadataKey &&
    topCandidate &&
    (topCandidate.confidence === 'high' || topCandidate.confidence === 'medium') &&
    !areKeysEnharmonicallyEquivalent(metadataKey, topCandidate.key)
  );

  // Is source selection divergent from high-confidence / medium-confidence detected key?
  const isSourceDivergentFromDetected = !!(
    sourceChordKey &&
    topCandidate &&
    (topCandidate.confidence === 'high' || topCandidate.confidence === 'medium') &&
    !areKeysEnharmonicallyEquivalent(sourceChordKey, topCandidate.key)
  );

  const isSameKey = !!(
    sourceChordKey &&
    targetChordKey &&
    areKeysEnharmonicallyEquivalent(sourceChordKey, targetChordKey)
  );

  const isAlreadyInTargetKey = !!(
    song.metadata?.chordContentKey &&
    targetChordKey &&
    areKeysEnharmonicallyEquivalent(song.metadata.chordContentKey, targetChordKey)
  );

  // Compute preview in real-time
  let transposedChords = '';
  let semitones = 0;
  let changedChordCount = 0;
  let previewError: string | null = null;

  const { signedSemitones, normalizedSemitones } = getSignedSemitones(sourceChordKey, targetChordKey);

  try {
    if (sourceChordKey && targetChordKey && !isSameKey) {
      const result = transposeChordDocument(song.chords || '', sourceChordKey, targetChordKey);
      transposedChords = result.chords;
      semitones = result.semitones;
      changedChordCount = result.changedChordCount;

      const val = validateTransposedPreview(song.chords || '', transposedChords, sourceChordKey, targetChordKey);
      if (!val.valid) {
        previewError = val.error || t('chordKeyRepair.previewValidationFailed', 'Erro na validação da prévia');
      }
    } else {
      transposedChords = song.chords || '';
    }
  } catch (err: any) {
    previewError = err.message || t('chordKeyRepair.previewValidationFailed', 'Erro ao gerar prévia');
  }

  const beforeLines = (song.chords || '').split('\n');
  const afterLines = transposedChords.split('\n');
  const visibleBefore = showFullPreview ? beforeLines : beforeLines.slice(0, 8);
  const visibleAfter = showFullPreview ? afterLines : afterLines.slice(0, 8);

  const semitonesLabel = signedSemitones > 0 ? `+${signedSemitones}` : `${signedSemitones}`;

  const confidenceTextMap: Record<string, string> = {
    high: t('chordKeyRepair.confidenceHigh', 'Alta'),
    medium: t('chordKeyRepair.confidenceMedium', 'Média'),
    low: t('chordKeyRepair.confidenceLow', 'Baixa')
  };

  const isApplyDisabled =
    loading ||
    !sourceChordKey ||
    !targetChordKey ||
    isSameKey ||
    isAlreadyInTargetKey ||
    !sourceConfirmation ||
    !!previewError;

  const handleSourceKeyChange = (val: string) => {
    setSourceChordKey(val);
    // Any change to source select invalidates confirmation
    setSourceConfirmation(null);
  };

  const handleConfirmDetected = (detectedKey: string) => {
    if (!topCandidate) return;
    setSourceChordKey(detectedKey);
    setSourceConfirmation({
      type: 'detected',
      detectedKey,
      detectionConfidence: topCandidate.confidence as 'high' | 'medium'
    });
  };

  const handleConfirmManual = () => {
    if (!sourceChordKey) return;
    setSourceConfirmation({
      type: 'manual',
      selectedKey: sourceChordKey
    });
  };

  const handleConfirmOverride = () => {
    if (!sourceChordKey || !topCandidate) return;
    setSourceConfirmation({
      type: 'override',
      selectedKey: sourceChordKey,
      detectedKey: topCandidate.key,
      detectionConfidence: topCandidate.confidence as 'high' | 'medium',
      acknowledgedConflict: true
    });
  };

  const handleApply = async () => {
    if (loading || isApplyDisabled) return;
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

    if (!targetChordKey) {
      setError(t('chordKeyRepair.selectTargetKey', 'Selecione o tom de destino.'));
      return;
    }

    if (isSameKey) {
      setError(t('chordKeyRepair.sameKeysError', 'O tom de origem não pode ser igual ao de destino.'));
      return;
    }

    if (isAlreadyInTargetKey) {
      setError(t('chordKeyRepair.alreadyInKey', 'A cifra já está neste tom.'));
      return;
    }

    if (!sourceConfirmation) {
      setError(t('chordKeyRepair.sourceConfirmationRequired', 'É necessário confirmar o tom de origem antes de aplicar.'));
      return;
    }

    setLoading(true);

    try {
      const chordKeyCorrection = buildChordKeyCorrectionMetadata({
        previousContentKey: sourceChordKey,
        correctedContentKey: targetChordKey,
        sourceConfirmation,
        topCandidate,
        correctedBy: userProfile?.uid || 'unknown'
      });

      const updatedMetadata = {
        ...(song.metadata || {}),
        chordContentKey: targetChordKey,
        normalizedToConcertKey: true,
        chordKeyCorrection
      };

      if (props.mode === 'draft') {
        const updatedDraft: ChordKeyRepairDraftSong = {
          ...props.song,
          chords: transposedChords,
          metadata: updatedMetadata
        };

        if (props.onSuccess) {
          props.onSuccess(updatedDraft);
        }
      } else {
        if (!api) {
          throw new Error('Serviço de API indisponível no momento.');
        }

        const savedSong = await api.repairOrganizationSongChordKey({
          songId: props.song.id,
          organizationId: effectiveOrganizationId || '',
          sourceChordKey,
          targetChordKey,
          expectedUpdatedAt: props.song.lastModifiedAt || props.song.chordsLastModifiedAt || (props.song as any).updatedAt || null,
          sourceConfirmation
        });

        if (!savedSong) {
          throw new Error("Erro ao reler o documento da música após a gravação.");
        }

        // Show toast
        toast({
          title: t('chordKeyRepair.successTitle', 'Cifra corrigida'),
          description: t('chordKeyRepair.successMessage', 'Os acordes foram ajustados de {{from}} para {{to}}.', {
            from: sourceChordKey,
            to: targetChordKey
          }),
          type: 'success'
        });

        if (props.onSuccess) {
          props.onSuccess(savedSong);
        }
      }

      onClose();
    } catch (err: any) {
      console.error('[ChordKeyRepair] Repair failed:', err);
      setError(err.message || 'Erro inesperado ao corrigir a cifra');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = () => {
    if (loading) return; // Do not close during loading
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[140] overflow-hidden flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Background Overlay */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={handleBackdropClick}
      />

      {/* Main Container: Bottom Sheet on Mobile, Centered Dialog on Desktop */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        aria-busy={loading}
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
            <p id="modal-description" className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              {t('chordKeyRepair.description', 'Use esta ferramenta quando os acordes estiverem escritos em um tom diferente do tom real da música.')}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none disabled:opacity-50"
            aria-label={t('chordKeyRepair.ariaLabelClose', 'Fechar')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div 
              aria-live="polite"
              className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm flex gap-3"
            >
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Low Confidence Warning */}
          {(!topCandidate || topCandidate.confidence === 'low') && (
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs flex gap-2 items-center">
              <AlertTriangle className="w-4 h-4 shrink-0 text-blue-500" />
              <span>{t('chordKeyRepair.analysisInconclusive', 'Análise do tom não foi conclusiva. Selecione o tom de origem manualmente.')}</span>
            </div>
          )}

          {/* Conflict Warning Banner */}
          {hasMetadataContentConflict && topCandidate && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm space-y-3">
              <div className="flex gap-2 items-center font-bold">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  {t('chordKeyRepair.conflictTitle', 'O tom informado não corresponde aos acordes encontrados')}
                </span>
              </div>
              <p className="text-xs leading-relaxed">
                {t('chordKeyRepair.conflictMessage', 'A metadata indica {{metadataKey}}, mas a cifra parece estar escrita em {{detectedKey}}. Revise o tom de origem antes de aplicar a correção.', {
                  metadataKey,
                  detectedKey: topCandidate.key
                })}
              </p>
              <div className="pt-2 text-xs flex flex-wrap gap-x-6 gap-y-1 font-mono text-amber-900 dark:text-amber-200 border-t border-amber-500/20">
                <div>
                  <span className="font-sans text-amber-700 dark:text-amber-400">{t('chordKeyRepair.metadataKeyLabel', 'Tom indicado pela metadata')}:</span>{' '}
                  <strong>{metadataKey}</strong>
                </div>
                <div>
                  <span className="font-sans text-amber-700 dark:text-amber-400">{t('chordKeyRepair.detectedKeyLabel', 'Tom provável da cifra')}:</span>{' '}
                  <strong>{topCandidate.key}</strong>
                </div>
                <div>
                  <span className="font-sans text-amber-700 dark:text-amber-400">{t('chordKeyRepair.confidenceLabel', 'Confiança')}:</span>{' '}
                  <strong>{confidenceTextMap[topCandidate.confidence] || topCandidate.confidence}</strong>
                </div>
              </div>

              {/* Explicit Confirmation Actions inside Conflict Banner */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  ref={confirmActionRef}
                  variant="secondary"
                  size="sm"
                  onClick={() => handleConfirmDetected(topCandidate.key)}
                  className="text-xs font-bold"
                >
                  {t('chordKeyRepair.useDetectedKey', 'Usar {{detectedKey}}', { detectedKey: topCandidate.key })}
                </Button>
                {sourceChordKey && !areKeysEnharmonicallyEquivalent(sourceChordKey, topCandidate.key) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleConfirmOverride}
                    className="text-xs font-bold"
                  >
                    {t('chordKeyRepair.confirmOverride', 'Confirmar uso de {{sourceChordKey}}', { sourceChordKey })}
                  </Button>
                )}
              </div>
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
                  ref={sourceSelectRef}
                  value={sourceChordKey}
                  onChange={(e) => handleSourceKeyChange(e.target.value)}
                  disabled={loading}
                  className="w-full min-h-[44px] px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl font-medium focus:ring-2 focus:ring-primary/20 appearance-none outline-none disabled:opacity-50"
                >
                  <option value="">
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
                  ref={targetSelectRef}
                  value={targetChordKey}
                  onChange={(e) => setTargetChordKey(e.target.value)}
                  disabled={loading}
                  className="w-full min-h-[44px] px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl font-medium focus:ring-2 focus:ring-primary/20 appearance-none outline-none disabled:opacity-50"
                >
                  <option value="">
                    {t('chordKeyRepair.selectTargetKey', 'Selecione o tom de destino')}
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
          </div>

          {/* Explicit Confirmation Action outside Conflict Banner */}
          {!hasMetadataContentConflict && sourceChordKey && !sourceConfirmation && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-amber-800 dark:text-amber-300">
                {isSourceDivergentFromDetected ? (
                  <span>{t('chordKeyRepair.overrideWarning', 'Atenção: Você está selecionando um tom diferente do tom detectado. Confirme para prosseguir.')}</span>
                ) : (
                  <span>{t('chordKeyRepair.sourceConfirmationRequired', 'É necessário confirmar o tom de origem antes de aplicar.')}</span>
                )}
              </div>
              <div className="flex gap-2">
                {topCandidate && (topCandidate.confidence === 'high' || topCandidate.confidence === 'medium') ? (
                  isSourceDivergentFromDetected ? (
                    <Button
                      ref={confirmActionRef}
                      variant="outline"
                      size="sm"
                      onClick={handleConfirmOverride}
                      className="shrink-0 font-bold"
                    >
                      {t('chordKeyRepair.confirmOverride', 'Confirmar uso de {{sourceChordKey}}', { sourceChordKey })}
                    </Button>
                  ) : (
                    <Button
                      ref={confirmActionRef}
                      variant="secondary"
                      size="sm"
                      onClick={() => handleConfirmDetected(topCandidate.key)}
                      className="shrink-0 font-bold"
                    >
                      {t('chordKeyRepair.useDetectedKey', 'Usar {{detectedKey}}', { detectedKey: topCandidate.key })}
                    </Button>
                  )
                ) : (
                  <Button
                    ref={confirmActionRef}
                    variant="outline"
                    size="sm"
                    onClick={handleConfirmManual}
                    className="shrink-0 font-bold"
                  >
                    {t('chordKeyRepair.confirmManualKey', 'Confirmar tom selecionado')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Real-time Summary Badge Row */}
          {sourceChordKey && targetChordKey && !isSameKey && !previewError && (
            <div className="flex flex-wrap gap-4 items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/40 text-xs text-slate-600 dark:text-slate-400">
              <div>
                <span className="font-bold">{t('chordKeyRepair.difference', 'Diferença')}:</span>{' '}
                <span className="font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10">
                  {semitonesLabel} {t('chordKeyRepair.semitone', { count: Math.abs(signedSemitones) })}
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
            ref={applyBtnRef}
            variant="primary"
            onClick={handleApply}
            disabled={isApplyDisabled}
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
