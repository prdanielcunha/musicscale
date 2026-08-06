import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { Sparkles, FileText, Link, Beaker, CheckCircle2, Music, Key, Activity, List, Loader2, AlertCircle, Globe, ShieldCheck, Lock, Clipboard, ExternalLink } from "lucide-react";
import { useApi } from "../../contexts/ApiContext";
import { useAuth } from "../../contexts/AuthContext";
import { DuplicateSongModal, DuplicateMatch } from "./DuplicateSongModal";
import { getSongSimilarityScore } from "../../lib/songMatch";
import { useMusic } from "../../contexts/MusicDataContext";
import { useEcosystemAdmin } from "../../hooks/useEcosystemAdmin";

interface AiSongImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultOptions?: { saveToOrganization: boolean; saveToGlobalLibrary: boolean };
}

const formInputClass = "mt-1 input-base";
const formLabelClass = "block text-sm font-medium text-slate-600 dark:text-gray-300";

import { useToast } from "../../contexts/ToastContext";
import { useModals } from "../../contexts/ModalContext";
import { submitFeedback } from "../../services/feedback";
import { normalizePastedSongText } from "../../utils/textNormalizer";
import { useMusicScaleFeature } from "../../hooks/useMusicScaleEntitlements";
import { auth } from "../../services/firebase";
import { FeatureLockedCard } from "../premium/EntitlementGates";
import { transposeChordDocument, validateChordContentKeyConsistency, isValidKey, normalizeKey, areKeysEnharmonicallyEquivalent } from "../../utils/chordEngine";

type AiPreviewKeyValidationStatus =
  | "MATCH"
  | "INDETERMINATE"
  | "NO_CHORDS"
  | "MISMATCH";

export type AiImportMetadata = Record<string, unknown>;

export interface AiImportPayload {
  metadata?: AiImportMetadata;
  [key: string]: unknown;
}

export interface AiImportApiResponse {
  song?: unknown;
  result?: unknown;
}

const isPlainRecord = (
  value: unknown
): value is Record<string, unknown> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
};

export const mergeAiImportResponse = (data: unknown) => {
  if (!isPlainRecord(data)) return null;

  const rawResult = data.result;
  const rawSong = data.song;

  const safeResult = isPlainRecord(rawResult) ? rawResult : {};
  const safeSong = isPlainRecord(rawSong) ? rawSong : {};

  const rawResultMetadata = safeResult.metadata;
  const rawSongMetadata = safeSong.metadata;

  const safeResultMetadata = isPlainRecord(rawResultMetadata) ? rawResultMetadata : {};
  const safeSongMetadata = isPlainRecord(rawSongMetadata) ? rawSongMetadata : {};

  return {
    ...safeResult,
    ...safeSong,
    metadata: {
      ...safeResultMetadata,
      ...safeSongMetadata
    }
  };
};

const AiSongImportModal: React.FC<AiSongImportModalProps> = ({ isOpen, onClose, defaultOptions }) => {
  const { t } = useTranslation();
  const { userProfile, permissions, organization } = useAuth();
  const { isEcosystemAdmin } = useEcosystemAdmin();
  const api = useApi();
  const { refreshData, songs } = useMusic();
  const { success, error: toastError, feedbackToast } = useToast();
  const { openFeedback } = useModals();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const isAiImportAllowed = useMusicScaleFeature('aiImport');

  const canManageSongs = !!permissions?.manageSongs || !!permissions?.['musicScale.manageSongs'];

  const [step, setStep] = useState<"input" | "processing" | "preview">("input");
  const [processingStage, setProcessingStage] = useState(0);
  const [globalStatus, setGlobalStatus] = useState<'default' | 'new' | 'old'>('default');
  const [globalLanguage, setGlobalLanguage] = useState<'pt' | 'en' | 'es' | 'other' | 'unknown'>('unknown');
  
  const [formData, setFormData] = useState({
    title: "",
    artist: "",
    rawText: "",
    url: "",
    desiredKey: "",
    version: "",
    bpm: "",
  });

  const [options, setOptions] = useState({
    saveToOrganization: defaultOptions?.saveToOrganization ?? true,
    saveToGlobalLibrary: defaultOptions?.saveToGlobalLibrary ?? false,
  });
  
  const [previewData, setPreviewData] = useState<any>(null);
  const [targetKey, setTargetKey] = useState("");
  const [currentChordKey, setCurrentChordKey] = useState<string | null>(null);
  const [transpositionMessage, setTranspositionMessage] = useState<string | null>(null);
  const [transpositionError, setTranspositionError] = useState<string | null>(null);
  const [requiresChordReview, setRequiresChordReview] = useState(false);
  const [chordReviewConfirmed, setChordReviewConfirmed] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ songData: any, matches: DuplicateMatch[] } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { openSongForm } = useModals();

  useEffect(() => {
    if (previewData?.language) {
      setGlobalLanguage(previewData.language);
    } else {
      setGlobalLanguage('unknown');
    }
  }, [previewData]);

  const processingStages = [
    "Inicializando motor cognitivo...",
    "Analisando acordes...",
    "Detectando tonalidade...",
    "Organizando seções...",
    "Limpando metadata desnecessária...",
    "Refinando estrutura musical...",
    "Preparando Performance Mode..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "processing") {
      setProcessingStage(0);
      interval = setInterval(() => {
        setProcessingStage((prev) => (prev < processingStages.length - 1 ? prev + 1 : prev));
      }, 800); 
    }
    return () => clearInterval(interval);
  }, [step]);

  const COMMON_KEYS = [
    "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B",
    "Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"
  ];

  const resolveInitialPhysicalChordKey = (data: any) => {
    if (!data) return null;
    
    if (data.metadata?.chordContentKey && isValidKey(data.metadata.chordContentKey)) {
      return data.metadata.chordContentKey;
    }
    if (data.selectedKey && isValidKey(data.selectedKey)) {
      return data.selectedKey;
    }
    if (data.originalKey && isValidKey(data.originalKey)) {
      return data.originalKey;
    }
    return null;
  };

  const normalizePreviewChordDocumentForTranspose = (chords: string): string => {
    if (!chords) return "";
    return chords.split('\n').map(line => {
      const trimmed = line.trim();
      const sectionMatch = trimmed.match(/^(\[[^\]]+\])(.+)$/);
      if (sectionMatch) {
        const section = sectionMatch[1];
        const rest = sectionMatch[2].trim();
        if (rest.length > 0) {
          // Check if rest contains at least one likely chord token
          const hasTokens = rest.split(/\s+/).some(t => /^[A-G][#b]?(m|M|maj|min|dim|aug|sus|add|[0-9])*(\/[A-G][#b]?)?$/.test(t));
          if (hasTokens) {
            return `${section}\n${rest}`;
          }
        }
      }
      return line;
    }).join('\n');
  };

  const handleApplyPreviewTransposition = () => {
    setTranspositionMessage(null);
    setTranspositionError(null);
    
    if (!currentChordKey || !targetKey || !isValidKey(currentChordKey) || !isValidKey(targetKey)) {
       setTranspositionError(t("aiImport.preview.noChordsToTranspose", "Não há acordes para transpor."));
       return;
    }

    if (!previewData?.chords || previewData.chords.trim().length === 0) {
       setTranspositionError(t("aiImport.preview.noChordsToTranspose", "Não há acordes para transpor."));
       return;
    }

    const normalizedChords = normalizePreviewChordDocumentForTranspose(previewData.chords);
    if (!normalizedChords.trim()) {
       setTranspositionError(t("aiImport.preview.noChordsToTranspose", "Não há acordes para transpor."));
       return;
    }

    // Very fast basic token check to avoid false NO_CHORDS from full validation engine
    const hasAnyLikelyChord = normalizedChords.split(/\s+/).some(t => /^[A-G][#b]?(m|M|maj|min|dim|aug|sus|add|[0-9])*(\/[A-G][#b]?)?$/.test(t));
    if (!hasAnyLikelyChord) {
       setTranspositionError(t("aiImport.preview.noChordsToTranspose", "Não há acordes para transpor."));
       return;
    }

    const consistency = validateChordContentKeyConsistency(normalizedChords, currentChordKey);
    
    if (consistency.status === "MISMATCH") {
       setTranspositionError(t("aiImport.preview.keyMismatch", "Os acordes exibidos não correspondem ao tom atual. Revise a cifra antes de aplicar outro tom."));
       return;
    }
    
    // We already did a basic chord check, so if NO_CHORDS appears here, we ignore it 
    // unless our own check failed. We want to allow transposing even if INDETERMINATE/NO_CHORDS
    // as long as there is some physical chords.

    const normalizedTargetKey = normalizeKey(targetKey);
    
    if (areKeysEnharmonicallyEquivalent(currentChordKey, normalizedTargetKey)) {
       setPreviewData((prev: any) => ({ ...prev, selectedKey: normalizedTargetKey }));
       setTranspositionMessage(t("aiImport.preview.alreadyInKey", "A cifra já está neste tom."));
       return;
    }

    const result = transposeChordDocument(normalizedChords, currentChordKey, normalizedTargetKey);

    if (result.changedChordCount === 0) {
       // Maybe it failed to transpose anything?
    }

    setPreviewData((prev: any) => {
       const newMetadata = { ...prev.metadata };
       
       if (consistency.status === "MATCH") {
          newMetadata.chordContentKey = normalizedTargetKey;
          newMetadata.chordContentKeyValidationStatus = "MATCH";
       } else if (consistency.status === "INDETERMINATE" || consistency.status === "NO_CHORDS") {
          delete newMetadata.chordContentKey;
          newMetadata.chordContentKeyValidationStatus = "INDETERMINATE";
          setRequiresChordReview(true);
       }
       
       newMetadata.previewTransposition = {
          fromKey: currentChordKey,
          toKey: normalizedTargetKey,
          semitones: result.semitones,
          changedChordCount: result.changedChordCount,
          appliedAt: new Date().toISOString()
       };
       
       return {
         ...prev,
         chords: result.chords,
         selectedKey: normalizedTargetKey,
         key: normalizedTargetKey,
         metadata: newMetadata
       };
    });
    
    setCurrentChordKey(normalizedTargetKey);

    if (result.changedChordCount === 1) {
       setTranspositionMessage(t("aiImport.preview.transposeSuccessOne", "A cifra foi atualizada de {{from}} para {{to}}. 1 acorde foi ajustado.", { from: currentChordKey, to: normalizedTargetKey }));
    } else {
       setTranspositionMessage(t("aiImport.preview.transposeSuccess", "A cifra foi atualizada de {{from}} para {{to}}. {{count}} acordes foram ajustados.", { from: currentChordKey, to: normalizedTargetKey, count: result.changedChordCount }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const { checked } = e.target as HTMLInputElement;
      if (name === "saveToOrganization" || name === "saveToGlobalLibrary") {
        setOptions(prev => ({ ...prev, [name]: checked }));
        return;
      }
    }
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === "rawText" && error) {
      setError(null);
    }
  };

  const handleRawTextPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (error) setError(null);
    try {
      const pastedText = e.clipboardData.getData("text/plain");
      if (pastedText) {
        const { text, wasDecoded } = normalizePastedSongText(pastedText);
        if (wasDecoded) {
          e.preventDefault();
          const target = e.target as HTMLTextAreaElement;
          const start = target.selectionStart;
          const end = target.selectionEnd;
          const currentText = formData.rawText;
          const newText = currentText.substring(0, start) + text + currentText.substring(end);
          setFormData(prev => ({ ...prev, rawText: newText }));
          
          setTimeout(() => {
            if (target) {
              target.selectionStart = target.selectionEnd = start + text.length;
            }
          }, 0);

          success(t("aiImport.decodedTitle", "Conteúdo normalizado"), t("aiImport.decodedMessage", "O conteúdo colado estava codificado e foi convertido para texto normal."));
        }
      }
    } catch (err) {
      // Allow default behavior
    }
  };

  const safeJsonResponse = async (response: Response) => {
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(text || 'Resposta inválida do servidor');
    }

    const data = await response.json();

    if (response.status === 413) {
      throw new Error(data?.message || "O texto informado é grande demais para importação automática.");
    }

    if (response.status === 422) {
      throw new Error(data?.message || "Os dados enviados são inválidos para importação automática.");
    }

    if (response.status === 429) {
      throw new Error(data?.message || "Muitas tentativas de importação em pouco tempo. Aguarde alguns minutos e tente novamente.");
    }

    if (!response.ok || (data?.ok === false && data?.reason !== "SOURCE_BLOCKED")) {
      throw new Error(data?.message || data?.error || 'Erro ao processar importação');
    }

    return data;
  };

  const AI_IMPORT_RAW_TEXT_MAX_CHARS = 64000;

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    let textToSend = formData.rawText;

    if (textToSend && typeof textToSend === "string") {
      const { text: normalized, wasDecoded } = normalizePastedSongText(textToSend);
      if (wasDecoded) {
        textToSend = normalized;
        setFormData(prev => ({ ...prev, rawText: normalized }));
      }
    }

    if (!textToSend.trim()) {
      setError(t("aiImport.errorEmpty", "Cole a letra ou cifra para continuar."));
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
      return;
    }

    if (textToSend && textToSend.length > AI_IMPORT_RAW_TEXT_MAX_CHARS) {
      setError("O texto colado é grande demais para a importação automática. Reduza o conteúdo ou cole apenas a letra/cifra principal.");
      return;
    }

    setStep("processing");
    setError(null);

    if (error) setError(null);
    try {
      // Call the new express backend to process with Gemini
      const token = await auth.currentUser?.getIdToken() || "";
      const payload = { ...formData, rawText: textToSend, orgId: organization?.id, userId: userProfile?.uid };
      const response = await fetch("/api/ai-import", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });
      
      const data = await safeJsonResponse(response);
      


      const mergedPreview = mergeAiImportResponse(data) as any;
      setPreviewData(mergedPreview);
      setCurrentChordKey(resolveInitialPhysicalChordKey(mergedPreview));
      
      const newTargetKey = formData.desiredKey || mergedPreview?.selectedKey || mergedPreview?.originalKey || "";
      setTargetKey(newTargetKey);
      
      setStep("preview");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Não conseguimos importar essa música agora. Tente colar a letra/cifra manualmente ou tente novamente em alguns instantes.");
      setStep("input");
    }
  };

  const executeSave = async (songDataToSave: any, forceSave = false) => {
    setIsSaving(true);
    if (error) setError(null);
    try {
      if (options.saveToOrganization) {
        await api.songs.create(songDataToSave);
      }

      if (options.saveToGlobalLibrary && isEcosystemAdmin) {
        await api.submitToGlobal(userProfile, songDataToSave, forceSave, isEcosystemAdmin);
      }

      refreshData();
      onClose();

      if (options.saveToGlobalLibrary && options.saveToOrganization) {
         success("Música importada!", "A música foi cadastrada no seu repertório e na Biblioteca Viva.");
      } else if (options.saveToGlobalLibrary) {
         success("Música importada!", "A música foi adicionada à Biblioteca Viva.");
      } else {
        success("Música importada com sucesso!", `O arranjo estruturado de ${songDataToSave.title} foi cadastrado.`);
      }
      
      // Trigger contextual feedback after a short delay
      setTimeout(() => {
        feedbackToast(
          "Como foi a experiência de importar com IA?",
          () => { submitFeedback(userProfile?.uid, userProfile?.organizationId, { type: 'rating', rating: 'positive', context: 'import_ai' }); },
          () => { 
            submitFeedback(userProfile?.uid, userProfile?.organizationId, { type: 'rating', rating: 'negative', context: 'import_ai' });
            openFeedback('suggestion'); 
          },
          "Mágica ✨",
          "Pode melhorar"
        );
      }, 1500);

      // Reset Modal state
      setTimeout(() => {
        setStep("input");
        setFormData({ title: "", artist: "", rawText: "", url: "", desiredKey: "", version: "", bpm: "" });
        setOptions({ saveToOrganization: true, saveToGlobalLibrary: false });
        setPreviewData(null);
        setDuplicateInfo(null);
      }, 300);
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        setError("Sem permissão para salvar músicas. Verifique seu perfil.");
      } else {
        setError(err.message || "Erro ao salvar a música.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (forceSave = false) => {
    if (!api || !userProfile || !previewData) return;
    
    if (targetKey && isValidKey(targetKey) && previewData.selectedKey && !areKeysEnharmonicallyEquivalent(targetKey, previewData.selectedKey)) {
      toastError(t("aiImport.preview.applyBeforeSave", "Você escolheu outro tom. Toque em \"Aplicar tom\" para atualizar a cifra antes de salvar."));
      const applyBtn = document.getElementById("ai-import-apply-key");
      if (applyBtn) applyBtn.focus();
      return;
    }

    if (requiresChordReview && !chordReviewConfirmed) {
      toastError(t("aiImport.preview.reviewRequired", "Revise a cifra e confirme o tom antes de salvar."));
      return;
    }

    const safeTitle = (previewData.title || formData.title || "").trim();
    if (!safeTitle) {
       toastError(t("aiImport.titleRequired", "O título da música é obrigatório."));
       setTimeout(() => {
           const titleInput = document.getElementById("ai-import-title-input");
           if (titleInput) titleInput.focus();
       }, 100);
       return;
    }

    const songData = {
      title: safeTitle,
      artist: (previewData.artist || formData.artist || "").trim(),
      key: (previewData.selectedKey || previewData.originalKey || "").trim(),
      originalKey: (previewData.originalKey || "").trim() || null,
      bpm: previewData.bpm || null,
      suggestedBpm: previewData.suggestedBpm || null,
      bpmConfidence: previewData.bpmConfidence || 'unknown',
      bpmSource: previewData.bpmSource || 'not_detected',
      rhythm: (previewData.rhythm || "").trim() || null,
      sections: previewData.sections || [],
      status: "active" as const,
      tagIds: [],
      lyrics: previewData.lyrics || "",
      chords: previewData.chords || "",
      chordsUrl: formData.url,
      videoUrl: "",
      version: (formData.version || previewData.version || "Original").trim(),
      aiProcessed: true,
      sourceType: formData.url ? ("url" as const) : ("text" as const),
      language: globalLanguage,
      tabs: previewData.tabs || [],
      metadata: previewData.metadata || {},
      languageDetection: {
        confidence: previewData.language ? 0.9 : 0,
        method: 'ai' as const
      },
      freshness: {
        status: globalStatus,
        source: 'manual' as const,
        manualResetAt: new Date().toISOString()
      }
    };

    if (!forceSave) {
        let matches: DuplicateMatch[] = [];

        if (options.saveToOrganization) {
            for (const s of songs) {
              const score = getSongSimilarityScore(songData, s);
              if (score >= 0.7) {
                 matches.push({
                   song: s,
                   score,
                   matchType: score === 1.0 ? 'exact' : (score >= 0.85 ? 'probable' : 'possible'),
                   location: 'repertoire'
                 });
              }
            }
        }
        
        if (options.saveToGlobalLibrary && isEcosystemAdmin) {
            const { checkGlobalDuplicates } = await import('../../services/globalLibraryService');
            const result = await checkGlobalDuplicates(songData.title, songData.artist, songData.key);
            if (result.isDuplicate || result.matches.length > 0) {
                for (const match of result.matches) {
                   matches.push({
                       song: match,
                       score: result.isDuplicate ? 1.0 : 0.85,
                       matchType: result.isDuplicate ? 'exact' : 'probable',
                       location: 'global_library'
                   });
                }
            }
        }
        
        matches.sort((a, b) => b.score - a.score);

        if (matches.length > 0) {
            setDuplicateInfo({ songData, matches });
            return;
        }
    }
    
    await executeSave(songData, forceSave);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={
      <div className="flex items-center gap-3">
         <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
            <Sparkles className="w-5 h-5" />
         </div>
         <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300">
            {t("aiImport.modalTitle", "Criar música com IA")}
         </span>
      </div>
    } maxWidth="max-w-4xl">
      
      {!canManageSongs ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
            <span className="text-3xl">🚷</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white text-center">{t("songs.restricted_access", "Acesso Restrito")}</h3>
          <p className="mt-2 text-slate-500 text-center max-w-sm mb-6">
            {t("songs.restricted_access_msg", "Você não possui permissão para adicionar músicas neste ministério. Fale com um líder.")}
          </p>
          <Button variant="secondary" onClick={onClose}>{t("songs.back", "Voltar")}</Button>
        </div>
      ) : !isAiImportAllowed ? (
        <div className="py-8">
          <FeatureLockedCard featureKey="aiImport" />
        </div>
      ) : (
        <>
        <AnimatePresence mode="wait">
          {step === "processing" && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.05 }}
               className="py-24 flex flex-col items-center justify-center min-h-[400px]"
            >
              <div className="relative w-32 h-32 mb-8">
                <motion.div 
                  className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div 
                  className="absolute inset-2 border-4 border-purple-500/40 border-t-purple-500 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full backdrop-blur-sm">
                  <Sparkles className="w-10 h-10 text-indigo-500" />
                </div>
              </div>
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 mb-4">
                Mágica em andamento
              </h3>
              <div className="h-8 overflow-hidden relative w-full max-w-sm text-center">
                 <AnimatePresence mode="wait">
                   <motion.div
                     key={processingStage}
                     initial={{ y: 20, opacity: 0 }}
                     animate={{ y: 0, opacity: 1 }}
                     exit={{ y: -20, opacity: 0 }}
                     className="text-slate-500 dark:text-slate-400 font-medium absolute inset-x-0"
                   >
                     {processingStages[processingStage]}
                   </motion.div>
                 </AnimatePresence>
              </div>
            </motion.div>
          )}

          
      
      {step === "input" && (
        <motion.form 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="space-y-6"
            onSubmit={handleImport}
        >
          <div className="bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-4 sm:p-5 flex gap-4 items-start shadow-sm shadow-indigo-100/50 dark:shadow-none">
             <Sparkles className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
             <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed font-medium">
               {t("aiImport.modalDescription", "Cole o conteúdo da música. A IA organiza título, artista, tom, letra, cifra e seções para você revisar antes de salvar.")}
             </p>
          </div>
          
          <div className="space-y-4">
             <div>
                <div className="flex justify-between items-end mb-2">
                   <label className={formLabelClass}>{t("aiImport.inputLabel", "Cole a cifra ou letra")}</label>
                   {navigator.clipboard && (
                     <button
                        type="button"
                        onClick={async () => {
                           try {
                              const text = await navigator.clipboard.readText();
                              if (!text) {
                                 toastError(t("aiImport.clipboardEmpty", "A área de transferência está vazia."));
                                 return;
                              }
                              const { text: normalized, wasDecoded } = normalizePastedSongText(text);
                              if (wasDecoded) {
                                 success(t("aiImport.decodedTitle", "Conteúdo normalizado"), t("aiImport.decodedMessage", "O conteúdo colado estava codificado e foi convertido para texto normal."));
                              }
                              setFormData(prev => ({ ...prev, rawText: normalized }));
                              if (error) setError(null);
                           } catch (e) {
                              toastError(t("aiImport.clipboardError", "Não foi possível acessar a área de transferência. Cole manualmente no campo abaixo."));
                           }
                        }}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1.5 transition-colors"
                     >
                        <Clipboard className="w-3.5 h-3.5" />
                        {t("aiImport.pasteClipboard", "Colar da área de transferência")}
                     </button>
                   )}
                </div>
                <textarea 
                   ref={textareaRef}
                   aria-label={t("aiImport.inputLabel", "Cole a cifra ou letra")}
                   rows={10} 
                   name="rawText" 
                   value={formData.rawText} 
                   onChange={handleChange} 
                   onPaste={handleRawTextPaste} 
                   className={`${formInputClass} font-mono text-sm leading-relaxed`} 
                   placeholder={t("aiImport.inputPlaceholder", "Cole aqui a letra, a cifra ou o conteúdo completo da música...")}></textarea>
             </div>
             
             {error && (
                <div role="alert" aria-live="polite" className="p-3 bg-red-100 dark:bg-red-500/10 flex items-center gap-3 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium border border-red-200 dark:border-red-500/20">
                   <AlertCircle className="w-5 h-5 shrink-0" />
                   {error}
                </div>
             )}
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
             <Button variant="secondary" onClick={onClose} type="button">{t("common.cancel", "Cancelar")}</Button>
             <button type="submit" disabled={isSaving} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold tracking-wide shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:pointer-events-none">
                {t("aiImport.processButton", "Processar com IA")}
             </button>
          </div>
        </motion.form>
      )}
      {step === "preview" && previewData && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 pb-24 sm:pb-0"
        >
           {/* Save Options */}
           <div className="p-4 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("aiImport.saveDestination", "Destino do Salvamento")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-500 transition-colors cursor-pointer bg-white dark:bg-white/5">
                    <input type="checkbox" checked={options.saveToOrganization} onChange={(e) => setOptions({...options, saveToOrganization: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("aiImport.saveToMinistry", "Salvar no Ministério")}</span>
                 </label>
                 <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-500 transition-colors cursor-pointer bg-white dark:bg-white/5">
                    <input type="checkbox" checked={options.saveToGlobalLibrary} onChange={(e) => setOptions({...options, saveToGlobalLibrary: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("aiImport.saveToLibrary", "Minha Biblioteca Pessoal")}</span>
                 </label>
              </div>
           </div>

           <div className="bg-white dark:bg-white/[0.02] dark:backdrop-blur-xl p-5 rounded-[20px] border border-black/[0.04] dark:border-white/5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">
                 <Music className="w-3.5 h-3.5" /> {t("aiImport.identification", "Identificação")}
              </div>
              <div className="flex flex-col gap-4">
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t("aiImport.preview.titleField", "Título")}</label>
                   <input
                     aria-label={t("aiImport.preview.titleField", "Título")}
                     className="w-full bg-slate-50 dark:bg-white/5 font-bold text-slate-900 dark:text-white text-xl sm:text-2xl tracking-tight border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors min-w-0"
                     value={previewData.title || ''}
                     onChange={(e) => setPreviewData({...previewData, title: e.target.value})}
                     placeholder={t("aiImport.titlePlaceholder", "Título obrigatório")}
                     id="ai-import-title-input"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t("aiImport.preview.artistField", "Artista")}</label>
                   <input
                     aria-label={t("aiImport.preview.artistField", "Artista")}
                     className="w-full bg-slate-50 dark:bg-white/5 font-medium text-slate-900 dark:text-white text-base border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors min-w-0"
                     value={previewData.artist || ''}
                     onChange={(e) => setPreviewData({...previewData, artist: e.target.value})}
                     placeholder={t("aiImport.artistPlaceholder", "Artista")}
                   />
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <div className="bg-white dark:bg-white/[0.02] dark:backdrop-blur-xl p-5 rounded-[20px] border border-black/[0.04] dark:border-white/5 shadow-sm">
                 <div className="flex flex-col gap-3">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                       <Key className="w-3.5 h-3.5" /> {t("aiImport.keyLabel", "Tom")}
                     </div>
                     {previewData.metadata?.chordContentKeyValidationStatus === "MATCH" && (
                       <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 uppercase">
                         {t("aiImport.preview.keyConfirmed", "Tom da cifra conferido.")}
                       </span>
                     )}
                     {previewData.metadata?.chordContentKeyValidationStatus === "INDETERMINATE" && (
                       <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 uppercase">
                         {t("aiImport.preview.keyIndeterminate", "Confira os acordes antes de salvar.")}
                       </span>
                     )}
                     {previewData.metadata?.chordContentKeyValidationStatus === "NO_CHORDS" && (
                       <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 uppercase">
                         {t("aiImport.preview.lyricsOnly", "Esta importação não possui cifra.")}
                       </span>
                     )}
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold text-slate-400 uppercase">{t("aiImport.preview.originalKey", "Tom original")}</span>
                     <span className="font-bold text-slate-500">{previewData.originalKey || "-"}</span>
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold text-slate-400 uppercase">{t("aiImport.preview.currentChordKey", "Tom atual da cifra")}</span>
                     <span className="font-bold text-slate-500">{currentChordKey || "-"}</span>
                   </div>
                   <div className="flex flex-col gap-1.5 mt-2">
                     <label className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase">{t("aiImport.preview.targetKey", "Tom para tocar")}</label>
                     <select
                       aria-label={t("aiImport.preview.targetKey", "Tom para tocar")}
                       className="w-full bg-slate-50 dark:bg-white/5 font-black text-slate-900 dark:text-white text-lg border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                       value={targetKey}
                       onChange={(e) => setTargetKey(e.target.value)}
                     >
                       <option value="">Selecione...</option>
                       {COMMON_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                     </select>
                   </div>
                   <Button
                     type="button"
                     id="ai-import-apply-key"
                     onClick={handleApplyPreviewTransposition}
                     variant="primary"
                     className="w-full min-h-[44px] mt-1"
                   >
                     {t("aiImport.preview.applyKey", "Aplicar tom")}
                   </Button>
                   
                   {transpositionMessage && (
                      <div aria-live="polite" className="p-3 bg-green-100 dark:bg-green-500/10 flex items-start gap-2 text-green-700 dark:text-green-400 rounded-xl text-xs font-medium border border-green-200 dark:border-green-500/20 leading-snug">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        {transpositionMessage}
                      </div>
                   )}
                   
                   {transpositionError && (
                      <div role="alert" aria-live="polite" className="p-3 bg-amber-100 dark:bg-amber-500/10 flex items-start gap-2 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-medium border border-amber-200 dark:border-amber-500/20 leading-snug">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        {transpositionError}
                      </div>
                   )}
                 </div>
              </div>
               <div className="bg-white dark:bg-white/[0.02] dark:backdrop-blur-xl p-5 rounded-[20px] border border-black/[0.04] dark:border-white/5 shadow-sm">
                 <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3">
                   <Activity className="w-3.5 h-3.5" /> {t("aiImport.tempoLabel", "Andamento (BPM)")}
                 </div>
                 <div className="flex items-end gap-1 mb-2">
                   <input
                     type="number"
                     min="0"
                     aria-label={t("aiImport.bpmLabel", "BPM")}
                     className="w-16 bg-transparent font-black text-slate-900 dark:text-white text-2xl tracking-tighter border-b border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 focus:ring-0 outline-none transition-colors"
                     value={previewData.bpm || ''}
                     onChange={(e) => setPreviewData({...previewData, bpm: e.target.value ? Number(e.target.value) : null})}
                     placeholder="---"
                   />
                   <span className="text-[13px] font-semibold text-slate-400 tracking-normal pb-1">BPM</span>
                 </div>
                 <input
                   aria-label={t("aiImport.rhythmLabel", "Ritmo")}
                   className="w-full bg-transparent text-[13px] font-semibold text-slate-500 border-b border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 focus:ring-0 outline-none transition-colors"
                   value={previewData.rhythm || ''}
                   onChange={(e) => setPreviewData({...previewData, rhythm: e.target.value})}
                   placeholder={t("aiImport.rhythmPlaceholder", "Ritmo (Ex: Rock 4/4)")}
                 />
              </div>
               <div className="bg-white dark:bg-white/[0.02] dark:backdrop-blur-xl p-5 rounded-[20px] border border-black/[0.04] dark:border-white/5 shadow-sm flex flex-col justify-between">
                 <div>
                   <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3">
                     <List className="w-3.5 h-3.5" /> {t("aiImport.metadataLabel", "Metadados")}
                   </div>
                   <input
                     aria-label={t("aiImport.versionLabel", "Versão")}
                     className="w-full bg-transparent text-[13px] font-semibold text-slate-500 border-b border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 focus:ring-0 outline-none transition-colors mb-2"
                     value={formData.version || previewData.version || 'Original'}
                     onChange={(e) => {
                         setFormData({...formData, version: e.target.value});
                         setPreviewData({...previewData, version: e.target.value});
                     }}
                     placeholder={t("aiImport.versionPlaceholder", "Versão (Ex: Ao Vivo)")}
                   />
                 </div>
                 <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 mt-2">
                   <span>{t("aiImport.sectionsLabel", "Seções:")}</span>
                   <span className="text-indigo-600 dark:text-indigo-400 font-bold">{previewData.sections?.length || 0}</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              <div className="flex flex-col">
                 <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-white mb-2">
                   <span className="w-2 h-2 rounded-full bg-purple-500"></span> Cifra Estruturada
                 </label>
                 <textarea 
                    className={`${formInputClass} font-mono text-xs leading-relaxed flex-1 min-h-[300px] whitespace-pre-wrap`}
                    value={previewData.chords}
                    onChange={(e) => {
                       const val = e.target.value;
                       setPreviewData((prev: any) => {
                          const newMetadata = { ...prev.metadata };
                          delete newMetadata.chordContentKey;
                          newMetadata.chordContentKeyValidationStatus = "INDETERMINATE";
                          delete newMetadata.previewTransposition;
                          return { ...prev, chords: val, metadata: newMetadata };
                       });
                       setRequiresChordReview(true);
                       setChordReviewConfirmed(false);
                       setTranspositionMessage(null);
                    }}
                    spellCheck={false}
                 ></textarea>
                 
                 {requiresChordReview && (
                   <label className="flex items-center gap-3 p-3 mt-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl cursor-pointer">
                      <input 
                         type="checkbox" 
                         checked={chordReviewConfirmed} 
                         onChange={(e) => setChordReviewConfirmed(e.target.checked)} 
                         className="w-5 h-5 shrink-0 text-amber-600 rounded border-amber-300 focus:ring-amber-500" 
                      />
                      <span className="text-sm font-bold text-amber-800 dark:text-amber-400 leading-tight">
                         {t("aiImport.preview.reviewCheckbox", "Revisei a cifra e confirmei que os acordes correspondem ao tom para tocar.")}
                      </span>
                   </label>
                 )}
                 
                 {previewData.tabs && previewData.tabs.length > 0 && (
                   <div className="mt-4 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                      <details className="group">
                        <summary className="flex items-center justify-between p-3 cursor-pointer bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                           <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                              <Music className="w-4 h-4" />
                              Ver Tablaturas Detectadas ({previewData.tabs.length})
                           </span>
                        </summary>
                        <div className="p-4 bg-white dark:bg-black/20 space-y-4">
                           {previewData.tabs.map((tab: any, i: number) => (
                             <div key={i} className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tab.section}</span>
                                <pre className="font-mono text-[10px] text-slate-600 dark:text-slate-400 overflow-x-auto bg-slate-50 dark:bg-white/5 p-2 rounded-lg">{tab.content}</pre>
                             </div>
                           ))}
                        </div>
                      </details>
                   </div>
                 )}
              </div>
              <div className="flex flex-col">
                 <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-white mb-2">
                   <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Letra Limpa
                 </label>
                 <textarea 
                    className={`${formInputClass} font-sans text-sm leading-relaxed flex-1 min-h-[300px] whitespace-pre-wrap`}
                    value={previewData.lyrics}
                    onChange={(e) => setPreviewData({...previewData, lyrics: e.target.value})}
                 ></textarea>
              </div>
           </div>

           {error && (
            <div className="p-4 bg-red-100 dark:bg-red-500/10 flex items-center gap-3 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium border border-red-200 dark:border-red-500/20">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
           )}

           <div className="hidden sm:flex flex-row justify-between items-center pt-6 mt-4 border-t border-slate-200 dark:border-white/10 gap-4">
              <button type="button" onClick={() => setStep("input")} className="text-slate-500 hover:text-slate-800 dark:hover:text-white text-sm font-medium transition-colors p-2 text-center">
                 Voltar e Editar Info
              </button>
              
              <div className="flex flex-row items-center gap-3">
                 <Button variant="secondary" onClick={onClose} type="button">{t("common.cancel", "Cancelar")}</Button>
                 <button onClick={() => handleSave(false)} className="px-8 py-3 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold tracking-wide shadow-lg shadow-slate-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Salvar na Biblioteca
                 </button>
              </div>
           </div>

           {/* Mobile Sticky Footer */}
           <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#111] backdrop-blur-xl border-t border-slate-200 dark:border-white/10 z-50 flex gap-3 shadow-[0_-4px_24px_rgba(0,0,0,0.1)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button variant="secondary" onClick={onClose} type="button" className="flex-1 min-h-[48px]">{t("common.cancel", "Cancelar")}</Button>
              <button onClick={() => handleSave(false)} className="flex-[2] min-h-[48px] rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold tracking-wide shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2">
                 <CheckCircle2 className="w-5 h-5" />
                 Salvar música
              </button>
           </div>
        </motion.div>
      )}
       </AnimatePresence>

       <DuplicateSongModal
          isOpen={!!duplicateInfo}
          onClose={() => setDuplicateInfo(null)}
          candidateSong={duplicateInfo?.songData}
          matches={duplicateInfo?.matches || []}
          onSaveAnyway={() => {
              const song = duplicateInfo?.songData;
              setDuplicateInfo(null);
              if (song) executeSave(song, true);
          }}
          onEditExisting={(song) => {
              setDuplicateInfo(null);
              onClose();
              openSongForm(song);
          }}
       />
      </>
      )}
    </Modal>
  );
};

export default AiSongImportModal;
