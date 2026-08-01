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

const AiSongImportModal: React.FC<AiSongImportModalProps> = ({ isOpen, onClose, defaultOptions }) => {
  const { t } = useTranslation();
  const { userProfile, permissions, organization } = useAuth();
  const { isEcosystemAdmin } = useEcosystemAdmin();
  const api = useApi();
  const { refreshData, songs } = useMusic();
  const { success, error: toastError, feedbackToast } = useToast();
  const { openFeedback } = useModals();
  const isAiImportAllowed = useMusicScaleFeature('aiImport');

  const canManageSongs = !!permissions?.manageSongs || !!permissions?.['musicScale.manageSongs'];

  const [step, setStep] = useState<"input" | "processing" | "preview" | "assisted_paste">("input");
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
  };

  const handleRawTextPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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

    if (!textToSend && !formData.url) {
      setError("Cole a letra/cifra ou informe um link.");
      return;
    }

    if (textToSend && textToSend.length > AI_IMPORT_RAW_TEXT_MAX_CHARS) {
      setError("O texto colado é grande demais para a importação automática. Reduza o conteúdo ou cole apenas a letra/cifra principal.");
      return;
    }

    setStep("processing");
    setError(null);

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
      
      if (data?.ok === false && data?.reason === "SOURCE_BLOCKED") {
        setStep("assisted_paste");
        return;
      }

      setPreviewData(data.song || data.result);
      setStep("preview");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Não conseguimos importar essa música agora. Tente colar a letra/cifra manualmente ou tente novamente em alguns instantes.");
      setStep("input");
    }
  };

  const executeSave = async (songDataToSave: any, forceSave = false) => {
    setIsSaving(true);
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
            Criar música por IA
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

          {step === "assisted_paste" && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.05 }}
               className="py-10 flex flex-col items-center max-w-2xl mx-auto space-y-6"
            >
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 text-center">
                Este site bloqueou a leitura automática
              </h3>
              <p className="text-slate-500 text-center text-sm mb-4 leading-relaxed">
                Alguns sites impedem que sistemas externos leiam cifras diretamente pelo link. Mas você ainda pode importar essa música: <strong className="text-slate-900 dark:text-white">abra o link, copie a letra/cifra e cole abaixo.</strong> A IA do MusicScale organiza tudo para você de qualquer forma.
              </p>
              
              <div className="flex gap-4 w-full mb-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => window.open(formData.url, "_blank")} icon={<ExternalLink className="w-4 h-4" />}>
                  Abrir link
                </Button>
                <Button type="button" variant="secondary" className="flex-1" onClick={async () => {
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
                  } catch (e) {
                     toastError(t("aiImport.clipboardError", "Não foi possível acessar a área de transferência. Cole manualmente no campo abaixo."));
                  }
                }} icon={<Clipboard className="w-4 h-4" />}>
                  Colar da área
                </Button>
              </div>

              <div className="w-full">
                <textarea
                  name="rawText"
                  value={formData.rawText}
                  onChange={handleChange}
                  onPaste={handleRawTextPaste}
                  className={`${formInputClass} min-h-[200px] font-mono text-sm resize-y`}
                  placeholder="Cole a letra ou cifra aqui..."
                />
              </div>
              
              <div className="flex justify-end gap-3 w-full mt-4">
                <Button type="button" variant="secondary" onClick={() => setStep("input")}>Voltar</Button>
                <Button 
                  type="button"
                  onClick={handleImport}
                  disabled={!formData.rawText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  icon={<Sparkles className="w-4 h-4" />}
                >
                  Continuar e Organizar
                </Button>
              </div>
            </motion.div>
          )}

      {step === "input" && (
        <motion.form 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          onSubmit={handleImport} 
          className="space-y-6 px-1"
        >
          {error && (
            <div className="p-4 bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}
          
          <div className="bg-indigo-50/50 dark:bg-indigo-500/5 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-500/10 mb-6 flex items-start gap-3">
             <Sparkles className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
             <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed font-medium">
               Cole o link da música (Cifraclub, Letras, etc) ou o texto bruto da letra/cifra.
               A nossa IA irá extrair automaticamente o <b>Título</b>, <b>Artista</b>, <b>Tom</b> e estruturar toda a música para você.
             </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={formLabelClass}>Título da Música (Opcional se houver link/texto)</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} className={formInputClass} placeholder="Ex: Oceanos" />
            </div>
            <div>
              <label className={formLabelClass}>Artista/Banda (Opcional se houver link/texto)</label>
              <input type="text" name="artist" value={formData.artist} onChange={handleChange} className={formInputClass} placeholder="Ex: Hillsong" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={formLabelClass}>Tom Desejado (Opcional)</label>
              <input type="text" name="desiredKey" value={formData.desiredKey} onChange={handleChange} className={formInputClass} placeholder="Ex: G#" />
            </div>
             <div>
              <label className={formLabelClass}>Versão (Opcional)</label>
              <input type="text" name="version" value={formData.version} onChange={handleChange} className={formInputClass} placeholder="Ex: Acústico" />
            </div>
             <div>
              <label className={formLabelClass}>BPM Manual (Opcional)</label>
              <input type="number" name="bpm" value={formData.bpm} onChange={handleChange} className={formInputClass} placeholder="Ex: 72" />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/20 p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                <h4 className="font-semibold text-slate-900 dark:text-white">Conteúdo Bruto</h4>
             </div>
             
             <div>
                <label className={formLabelClass}>Cole a Cifra ou Letra Bagunçada</label>
                <textarea rows={6} name="rawText" value={formData.rawText} onChange={handleChange} onPaste={handleRawTextPaste} className={`${formInputClass} font-mono text-sm leading-relaxed`} placeholder="Cole aqui o texto cheio de propagandas, cifras desestruturadas, etc. A IA vai limpar tudo!"></textarea>
             </div>
             
             <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-slate-200 dark:bg-white/10 flex-1"></div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">OU</span>
                <div className="h-px bg-slate-200 dark:bg-white/10 flex-1"></div>
             </div>
             
             <div>
                <label className={formLabelClass}>Importar via Link (Ex: Cifraclub, Letras.mus)</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <Link className="w-5 h-5 text-slate-400" />
                   </div>
                   <input type="url" name="url" value={formData.url} onChange={handleChange} className={`${formInputClass} pl-11`} placeholder="https://" />
                </div>
             </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
             <Button variant="secondary" onClick={onClose} type="button">{t("common.cancel", "Cancelar")}</Button>
             <button type="submit" className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold tracking-wide shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all">
                Processar com IA
             </button>
          </div>
        </motion.form>
      )}

      {step === "preview" && previewData && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
           {/* Save Options */}
           <div className="p-4 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Destino do Salvamento</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${options.saveToOrganization ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/20' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'}`}
                >
                  <input
                    type="checkbox"
                    name="saveToOrganization"
                    checked={options.saveToOrganization}
                    onChange={handleChange}
                    className="h-5 w-5 rounded bg-slate-200 dark:bg-gray-700 border-slate-300 dark:border-gray-600 text-primary focus:ring-primary-dark"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                       <ShieldCheck className={`w-4 h-4 ${options.saveToOrganization ? 'text-primary' : 'text-slate-400'}`} />
                       <span className={`text-sm font-bold ${options.saveToOrganization ? 'text-primary' : 'text-slate-700 dark:text-gray-300'}`}>Minha Organização</span>
                    </div>
                  </div>
                </label>

                {isEcosystemAdmin && (
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${options.saveToGlobalLibrary ? 'bg-orange-500/5 border-orange-500/20 ring-1 ring-orange-500/20' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'}`}
                  >
                    <input
                      type="checkbox"
                      name="saveToGlobalLibrary"
                      checked={options.saveToGlobalLibrary}
                      onChange={handleChange}
                      className="h-5 w-5 rounded bg-slate-200 dark:bg-gray-700 border-slate-300 dark:border-gray-600 text-orange-500 focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                         <Globe className={`w-4 h-4 ${options.saveToGlobalLibrary ? 'text-orange-500' : 'text-slate-400'}`} />
                         <span className={`text-sm font-bold ${options.saveToGlobalLibrary ? 'text-orange-500' : 'text-slate-700 dark:text-gray-300'}`}>{t("songs.save_to_global_library", "Salvar também na Biblioteca Viva MusicScale")}</span>
                      </div>
                    </div>
                  </label>
                )}
              </div>

              {options.saveToGlobalLibrary && isEcosystemAdmin && (
                <div className="mt-4 p-4 rounded-xl bg-orange-500/[0.03] border border-orange-500/10 space-y-4 animate-fade-in">
                  <p className="text-[12px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                    {t("library.b_viva_settings", "Ajustes da Biblioteca Viva")}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                        {t("songs.status_label", "Status na Biblioteca Viva")}
                      </label>
                      <div className="flex gap-2">
                        {[
                          { value: 'default', label: t("songs.no_status", 'Sem status') },
                          { value: 'new', label: t("songs.new", 'Nova') },
                          { value: 'old', label: t("songs.old", 'Antiga') }
                        ].map(item => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => setGlobalStatus(item.value as any)}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                              globalStatus === item.value
                                ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/10'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                        {t("songs.language_label", "Idioma na Biblioteca Viva")}
                      </label>
                      <select
                        value={globalLanguage}
                        onChange={(e) => setGlobalLanguage(e.target.value as any)}
                        className="w-full text-xs font-bold rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-[#1E1E24] text-slate-700 dark:text-slate-200 p-2.5 outline-none focus:border-orange-500"
                      >
                        <option value="pt">🇧🇷 Português / BR</option>
                        <option value="en">🇺🇸 Inglês</option>
                        <option value="es">🇪🇸 Espanhol</option>
                        <option value="other">🌐 Outro</option>
                        <option value="unknown">? Desconhecido</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
           </div>
           <div className="bg-gradient-to-tr from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 p-6 rounded-[24px] flex flex-col md:flex-row items-center md:items-start justify-between gap-6 border border-indigo-100 dark:border-indigo-500/10">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/30">
                   <CheckCircle2 className="w-6 h-6" />
                 </div>
                 <div>
                    <h4 className="font-black text-slate-900 dark:text-white text-lg tracking-tight">Estruturação Concluída</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">Inteligência Artificial concluída com sucesso.</p>
                    </div>
                 </div>
              </div>
              <div className="flex flex-col items-center md:items-end justify-center">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5">Confiança da IA</span>
                 
                 {(!previewData.confidence || previewData.confidence === 'high') ? (
                   <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-xs font-black uppercase tracking-widest leading-none mt-0.5">Alta Precisão</span>
                   </div>
                 ) : (
                   <div className="flex flex-col md:items-end w-full">
                     <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 mb-2">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-black uppercase tracking-widest leading-none mt-0.5">Revisão Recomendada</span>
                     </div>
                     {previewData.warnings && previewData.warnings.length > 0 && (
                       <ul className="text-[11px] text-amber-600 dark:text-amber-400/80 text-right space-y-1 list-disc list-inside">
                          {previewData.warnings.map((w: string, i: number) => (
                             <li key={i}>{w}</li>
                          ))}
                       </ul>
                     )}
                   </div>
                 )}
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-white/[0.02] dark:backdrop-blur-xl p-5 rounded-[20px] border border-black/[0.04] dark:border-white/5 shadow-sm">
                 <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3">
                   <Music className="w-3.5 h-3.5" /> {t("aiImport.titleAndArtist", "Título e Artista")}
                 </div>
                 <input
                   id="ai-import-title-input"
                   aria-label={t("aiImport.titleLabel", "Título")}
                   className="w-full bg-transparent font-black text-slate-900 dark:text-white text-lg tracking-tight border-b border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 focus:ring-0 outline-none transition-colors mb-2"
                   value={previewData.title || ''}
                   onChange={(e) => setPreviewData({...previewData, title: e.target.value})}
                   placeholder={t("aiImport.titlePlaceholder", "Título obrigatório")}
                 />
                 <input
                   aria-label={t("aiImport.artistLabel", "Artista")}
                   className="w-full bg-transparent text-[13px] font-semibold text-slate-500 border-b border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 focus:ring-0 outline-none transition-colors"
                   value={previewData.artist || ''}
                   onChange={(e) => setPreviewData({...previewData, artist: e.target.value})}
                   placeholder={t("aiImport.artistPlaceholder", "Artista")}
                 />
              </div>
               <div className="bg-white dark:bg-white/[0.02] dark:backdrop-blur-xl p-5 rounded-[20px] border border-black/[0.04] dark:border-white/5 shadow-sm">
                 <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3">
                   <Key className="w-3.5 h-3.5" /> {t("aiImport.keyLabel", "Tom")}
                 </div>
                 <div className="flex flex-col gap-2">
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold text-slate-400 uppercase">{t("aiImport.playLabel", "Tocar")}</span>
                     <input
                       aria-label={t("aiImport.selectedKeyLabel", "Tom selecionado")}
                       className="w-16 bg-transparent font-black text-slate-900 dark:text-white text-xl tracking-tighter text-right border-b border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 focus:ring-0 outline-none transition-colors"
                       value={previewData.selectedKey || ''}
                       onChange={(e) => setPreviewData({...previewData, selectedKey: e.target.value})}
                       placeholder="Ex: G"
                     />
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold text-slate-400 uppercase">{t("aiImport.origLabel", "Orig.")}</span>
                     <input
                       aria-label={t("aiImport.originalKeyLabel", "Tom original")}
                       className="w-16 bg-transparent font-black text-slate-900 dark:text-white text-lg tracking-tighter text-right border-b border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 focus:ring-0 outline-none transition-colors"
                       value={previewData.originalKey || ''}
                       onChange={(e) => setPreviewData({...previewData, originalKey: e.target.value})}
                       placeholder="Ex: G"
                     />
                   </div>
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
                    onChange={(e) => setPreviewData({...previewData, chords: e.target.value})}
                    spellCheck={false}
                 ></textarea>
                 
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

           <div className="flex flex-col-reverse sm:flex-row justify-between items-center pt-6 mt-4 border-t border-slate-200 dark:border-white/10 gap-4">
              <button type="button" onClick={() => setStep("input")} className="text-slate-500 hover:text-slate-800 dark:hover:text-white text-sm font-medium transition-colors p-2 w-full sm:w-auto text-center">
                 Voltar e Editar Info
              </button>
              
              <div className="flex flex-col-reverse sm:flex-row items-center gap-3 w-full sm:w-auto">
                 <Button variant="secondary" onClick={onClose} type="button" className="w-full sm:w-auto">{t("common.cancel", "Cancelar")}</Button>
                 <button onClick={handleSave} className="w-full sm:w-auto px-8 py-3 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold tracking-wide shadow-lg shadow-slate-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Salvar na Biblioteca
                 </button>
              </div>
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
