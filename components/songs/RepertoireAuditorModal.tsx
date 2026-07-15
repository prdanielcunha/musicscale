import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { 
  ListRestart, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp, 
  Loader2,
  Music,
  Activity,
  CheckCircle,
  Database,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import type { PopulatedSong } from "../../types";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Spinner from "../common/Spinner";
import ConfirmationModal from "../common/ConfirmationModal";
import { executeFreshnessEvaluation, FreshnessExecutionItem } from "../../services/songFreshnessExecutor";

interface RepertoireAuditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: PopulatedSong[];
  organizationId: string;
  canManageRepertoire: boolean;
  refreshSongs?: () => Promise<void>;
}

const REASON_TRANSLATIONS: Record<string, string> = {
  expired_new: "Nova há mais de seis meses sem uso",
  expired_default: "Sem uso ou agendamento há mais de seis meses",
  future_schedule_active: "Protegida por escala futura",
  manual_old_preserved: "Marcada manualmente como Antiga",
  already_old: "Já está classificada como Antiga",
  not_expired: "Ainda dentro do período de seis meses",
  missing_reference_date: "Não possui data suficiente para análise",
  invalid_date: "Possui uma data inválida que precisa ser revisada"
};

const formatPortugueseDate = (ymdString?: string | null) => {
  if (!ymdString) return "-";
  const dateOnly = ymdString.split("T")[0];
  const parts = dateOnly.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return ymdString;
};

// Local timezone safe date-only helper
const getLocalDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const RepertoireAuditorModal: React.FC<RepertoireAuditorModalProps> = ({
  isOpen,
  onClose,
  songs,
  organizationId,
  canManageRepertoire,
  refreshSongs
}) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "applying" | "apply-success">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [analysisDate, setAnalysisDate] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Consolidate dry-run results
  const [items, setItems] = useState<FreshnessExecutionItem[]>([]);
  // Consolidate apply results
  const [applyItems, setApplyItems] = useState<FreshnessExecutionItem[]>([]);

  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Confirmation trigger
  const [isConfirming, setIsConfirming] = useState(false);

  // Filter only local organization songs, strictly excluding global songs (which have organizationId undefined or some other key, or can be determined safely)
  const localSongsOnly = useMemo(() => {
    return songs.filter(s => s.organizationId && s.organizationId === organizationId);
  }, [songs, organizationId]);

  const handleStartAnalysis = async () => {
    if (!canManageRepertoire || !organizationId) {
      setStatus("error");
      setErrorMessage("Permissão insuficiente ou organização não identificada.");
      return;
    }

    try {
      setStatus("loading");
      setErrorMessage("");
      setItems([]);
      setApplyItems([]);
      setExpandedSection(null);

      // Get safe date
      const today = getLocalDateString();
      setAnalysisDate(today);

      const songIds = localSongsOnly.map(s => s.id);
      if (songIds.length === 0) {
        setStatus("success");
        return;
      }

      // Remove duplicates
      const uniqueIds = Array.from(new Set(songIds)) as string[];
      setProgress({ current: 0, total: uniqueIds.length });

      // Split into lots of at most 500
      const BATCH_SIZE = 500;
      const idBatches: string[][] = [];
      for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
        idBatches.push(uniqueIds.slice(i, i + BATCH_SIZE));
      }

      let allProcessedItems: FreshnessExecutionItem[] = [];

      for (let batchIndex = 0; batchIndex < idBatches.length; batchIndex++) {
        const currentBatch = idBatches[batchIndex];
        
        try {
          // Strictly call in dry-run mode
          const result = await executeFreshnessEvaluation({
            organizationId,
            songIds: currentBatch,
            today,
            mode: "dry-run"
          });

          if (result && result.items) {
            allProcessedItems = [...allProcessedItems, ...result.items];
          }
        } catch (batchError) {
          console.error(`Erro ao processar lote ${batchIndex + 1}:`, batchError);
          // Don't wipe previous lot results, just register failure for these songs
          const mockFailures: FreshnessExecutionItem[] = currentBatch.map(id => ({
            songId: id,
            currentStatus: "default",
            currentSource: "auto",
            shouldUpdate: false,
            reason: batchError instanceof Error ? batchError.message : "Simulated/Network Batch Error",
            outcome: "failed"
          }));
          allProcessedItems = [...allProcessedItems, ...mockFailures];
        }

        setProgress(prev => {
          const updated = prev.current + currentBatch.length;
          return { ...prev, current: updated > prev.total ? prev.total : updated };
        });
      }

      setItems(allProcessedItems);
      setStatus("success");
    } catch (err) {
      console.error("Erro geral na auditoria:", err);
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Erro desconhecido durante a análise.");
    }
  };

  const handleOpenConfirmApply = () => {
    // Permission checks
    if (!canManageRepertoire || !organizationId) {
      setErrorMessage("Permissão insuficiente ou organização não identificada.");
      setStatus("error");
      return;
    }

    // Midnight timezone / Device date change protection
    const checkDate = getLocalDateString();
    if (checkDate !== analysisDate) {
      setErrorMessage(`A data do dispositivo mudou de "${analysisDate}" para "${checkDate}". Por segurança de fuso-horário, refaça a análise antes de aplicar.`);
      setStatus("error");
      return;
    }

    setIsConfirming(true);
  };

  const handleConfirmExecution = async () => {
    setIsConfirming(false);

    if (!canManageRepertoire || !organizationId) {
      setErrorMessage("Permissão insuficiente ou organização não identificada para escrita.");
      setStatus("error");
      return;
    }

    const checkDate = getLocalDateString();
    if (checkDate !== analysisDate) {
      setErrorMessage(`A data do dispositivo mudou de "${analysisDate}" para "${checkDate}". Por segurança de fuso-horário, refaça a análise antes de aplicar.`);
      setStatus("error");
      return;
    }

    try {
      setStatus("applying");
      setErrorMessage("");
      setProgress({ current: 0, total: 0 });

      // Gather ONLY candidates where isEligible/shouldUpdate is true in the dry-run
      const candidateIds = items
        .filter(item => item.shouldUpdate === true)
        .map(item => item.songId);

      if (candidateIds.length === 0) {
        setStatus("success");
        return;
      }

      setProgress({ current: 0, total: candidateIds.length });

      // Split into batches of at most 500
      const BATCH_SIZE = 500;
      const idBatches: string[][] = [];
      for (let i = 0; i < candidateIds.length; i += BATCH_SIZE) {
        idBatches.push(candidateIds.slice(i, i + BATCH_SIZE));
      }

      let allAppliedItems: FreshnessExecutionItem[] = [];

      for (let batchIndex = 0; batchIndex < idBatches.length; batchIndex++) {
        const currentBatch = idBatches[batchIndex];

        try {
          const result = await executeFreshnessEvaluation({
            organizationId,
            songIds: currentBatch,
            today: analysisDate,
            mode: "apply"
          });

          if (result && result.items) {
            allAppliedItems = [...allAppliedItems, ...result.items];
          }
        } catch (batchError) {
          console.error(`Erro ao gravar lote ${batchIndex + 1}:`, batchError);
          const mockFailures: FreshnessExecutionItem[] = currentBatch.map(id => ({
            songId: id,
            currentStatus: "default",
            currentSource: "auto",
            shouldUpdate: true,
            reason: batchError instanceof Error ? batchError.message : "Simulated/Network Write Error",
            outcome: "failed"
          }));
          allAppliedItems = [...allAppliedItems, ...mockFailures];
        }

        setProgress(prev => {
          const updated = prev.current + currentBatch.length;
          return { ...prev, current: updated > prev.total ? prev.total : updated };
        });
      }

      setApplyItems(allAppliedItems);
      setStatus("apply-success");

      // Reactively trigger refresh of state lists
      if (refreshSongs) {
        await refreshSongs();
      }
    } catch (err) {
      console.error("Erro durante a gravação real:", err);
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Erro desconhecido durante a aplicação.");
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setItems([]);
    setApplyItems([]);
    setExpandedSection(null);
    setErrorMessage("");
    setProgress({ current: 0, total: 0 });
  };

  const handleCloseAndReset = () => {
    setIsConfirming(false);
    setStatus("idle");
    setItems([]);
    setApplyItems([]);
    setExpandedSection(null);
    setExpandedSection(null);
    setErrorMessage("");
    setProgress({ current: 0, total: 0 });
    onClose();
  };

  // Dry Run Mathematical closure verification
  const closureValidation = useMemo(() => {
    const uniqueRequested = items.length;
    if (uniqueRequested === 0) return { passed: true, equation: "" };

    const missing = items.filter(i => i.outcome === 'missing').length;
    const wrongOrganization = items.filter(i => i.outcome === 'wrong-organization').length;
    const failed = items.filter(i => i.outcome === 'failed').length;
    const evaluated = uniqueRequested - missing - wrongOrganization - failed;

    const wouldUpdate = items.filter(i => i.outcome === 'would-update').length;
    const invalid = items.filter(i => i.reason === 'invalid_date' || i.outcome === 'invalid').length;
    const unchanged = evaluated - wouldUpdate - invalid;

    const evaluationFormulaPassed = (evaluated + missing + wrongOrganization + failed === uniqueRequested);
    const splitFormulaPassed = (wouldUpdate + unchanged + invalid === evaluated);
    const passed = evaluationFormulaPassed && splitFormulaPassed;

    const equationStr = `${uniqueRequested} Solicitadas = ${evaluated} Avaliadas + ${missing} Ausentes + ${wrongOrganization} Org Divergente + ${failed} Falhas | Avaliadas = ${wouldUpdate} Elegíveis + ${unchanged} Sem alteração + ${invalid} Inválidas`;

    return { passed, equation: equationStr };
  }, [items]);

  // Apply Mathematical closure verification
  const applyClosureValidation = useMemo(() => {
    const uniqueRequestedForApply = applyItems.length;
    if (uniqueRequestedForApply === 0) return { passed: true, equation: "" };

    const updated = applyItems.filter(i => i.outcome === 'updated').length;
    const unchanged = applyItems.filter(i => i.outcome === 'unchanged').length;
    const missing = applyItems.filter(i => i.outcome === 'missing').length;
    const wrongOrganization = applyItems.filter(i => i.outcome === 'wrong-organization').length;
    const invalid = applyItems.filter(i => i.outcome === 'invalid' || i.reason === 'invalid_date').length;
    const failed = applyItems.filter(i => i.outcome === 'failed').length;

    const sumApplyMath = updated + unchanged + missing + wrongOrganization + invalid + failed;
    const passed = (sumApplyMath === uniqueRequestedForApply);

    const equationStr = `${uniqueRequestedForApply} Solicitadas para Escrita = ${updated} Atualizadas + ${unchanged} Permaneceram Sem Alteração + ${missing} Ausentes + ${wrongOrganization} Org Divergente + ${invalid} Inválidas + ${failed} Falhas`;

    return { passed, equation: equationStr };
  }, [applyItems]);

  // Grouping categorizations for visually rich presentation
  const groupedItems = useMemo(() => {
    const map: Record<string, { title: string; color: string; items: { item: FreshnessExecutionItem; song?: PopulatedSong }[] }> = {
      wouldUpdate: {
        title: "Seriam marcadas como Antigas",
        color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
        items: []
      },
      protectedByScale: {
        title: "Protegidas por escala futura",
        color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        items: []
      },
      preservedManual_manualSet: {
        title: "Preservadas por decisão manual",
        color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
        items: []
      },
      notExpired: {
        title: "Ainda dentro do prazo",
        color: "text-slate-500 bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10",
        items: []
      },
      missingDate: {
        title: "Sem data de referência confiável",
        color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
        items: []
      },
      failures: {
        title: "Falhas ou Erros",
        color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
        items: []
      }
    };

    items.forEach(item => {
      const song = localSongsOnly.find(s => s.id === item.songId);
      const songWithRefObj = { item, song };

      if (item.outcome === "failed" || item.reason === "invalid_date" || item.outcome === "invalid") {
        map.failures.items.push(songWithRefObj);
      } else if (item.shouldUpdate && item.outcome === "would-update") {
        map.wouldUpdate.items.push(songWithRefObj);
      } else if (item.reason === "future_schedule_active") {
        map.protectedByScale.items.push(songWithRefObj);
      } else if (item.reason === "manual_old_preserved" || item.currentSource === "manual") {
        map.preservedManual_manualSet.items.push(songWithRefObj);
      } else if (item.reason === "missing_reference_date") {
        map.missingDate.items.push(songWithRefObj);
      } else {
        map.notExpired.items.push(songWithRefObj);
      }
    });

    return map;
  }, [items, localSongsOnly]);

  const metricsCounts = useMemo(() => {
    return {
      evaluated: localSongsOnly.length,
      wouldUpdate: groupedItems.wouldUpdate.items.length,
      protected: groupedItems.protectedByScale.items.length,
      manual: groupedItems.preservedManual_manualSet.items.length,
      noDate: groupedItems.missingDate.items.length,
      unchanged: groupedItems.notExpired.items.length,
      failed: groupedItems.failures.items.length
    };
  }, [localSongsOnly.length, groupedItems]);

  const toggleSection = (sectionKey: string) => {
    setExpandedSection(prev => (prev === sectionKey ? null : sectionKey));
  };

  const getTranslatedReason = (reasonStr: string) => {
    return REASON_TRANSLATIONS[reasonStr] || reasonStr || "Classificada com sucesso";
  };

  // Custom visual components for states
  const renderContent = () => {
    if (status === "idle") {
      return (
        <div className="flex flex-col items-center justify-center text-center py-12 px-4 select-none">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-6">
            <ListRestart className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
            Análise Inteligente de Antiguidade
          </h4>
          <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm leading-relaxed mb-6">
            Analise quais músicas do repertório local já completaram seis meses sem uso ou agendamento estruturado. Esta primeira etapa não realiza nenhuma escrita física.
          </p>
          <div className="space-y-4 w-full max-w-sm mb-6">
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] rounded-2xl p-4 text-xs text-left space-y-2 text-slate-500 dark:text-slate-400">
              <p className="font-semibold text-slate-700 dark:text-slate-200">Garantias operacionais primárias:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Simulação segura efetuada exclusivamente em dry-run.</li>
                <li>Exclui totalmente a Biblioteca Viva (catálogo global).</li>
                <li>Protege músicas agendadas em escalas futuras.</li>
                <li>Preserva decisões e mudanças manuais recentes.</li>
              </ul>
            </div>
            <Button
              className="w-full h-11 text-xs font-bold font-sans tracking-wide"
              onClick={handleStartAnalysis}
            >
              Iniciar análise
            </Button>
          </div>
        </div>
      );
    }

    if (status === "loading" || status === "applying") {
      const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
      const titleStr = status === "applying" ? "Gravando Alterações Transacionais..." : "Análise do Repertório...";
      return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-6" />
          <h4 className="text-md font-bold text-slate-800 dark:text-white mb-1">
            {titleStr}
          </h4>
          <p className="text-xs text-slate-400 mb-6">
            Processando músicas {progress.current} de {progress.total} ({percentage}%)
          </p>
          <div className="w-full max-w-xs bg-slate-100 dark:bg-white/5 h-2 rounded-full overflow-hidden mb-4">
            <motion.div
              className="bg-indigo-500 h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <span className="text-[11px] text-slate-400 font-medium select-none">
            {status === "applying"
              ? "Reavaliando cada documento individualmente na transação de escrita."
              : "Nenhuma alteração física está sendo feita."}
          </span>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="flex flex-col items-center justify-center text-center py-10 px-4">
          <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-md font-bold text-slate-800 dark:text-white mb-2">
            Ocorreu uma inconsistência
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
            {errorMessage || "Não foi possível coletar as músicas ou interagir com o gateway de processamento."}
          </p>
          <Button variant="secondary" onClick={handleReset} className="h-11 min-h-[44px] text-xs py-2 font-semibold">
            Tentar Novamente
          </Button>
        </div>
      );
    }

    if (status === "apply-success") {
      const applyRequested = applyItems.length;
      const applyUpdated = applyItems.filter(i => i.outcome === 'updated').length;
      const applyUnchanged = applyItems.filter(i => i.outcome === 'unchanged').length;
      const applyMissing = applyItems.filter(i => i.outcome === 'missing').length;
      const applyWrongOrganization = applyItems.filter(i => i.outcome === 'wrong-organization').length;
      const applyInvalid = applyItems.filter(i => i.outcome === 'invalid' || i.reason === 'invalid_date').length;
      const applyFailed = applyItems.filter(i => i.outcome === 'failed').length;

      const hasPartialFailures = applyFailed > 0;

      return (
        <div className="space-y-6">
          <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <h4 className="text-md font-bold text-emerald-800 dark:text-emerald-400 mb-1">
                {hasPartialFailures ? "Aplicação Concluída com Falhas Parciais" : "Aplicação Concluída com Sucesso"}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                {hasPartialFailures 
                  ? "Alguns itens falharam durante o lote transacional. Os itens bem-sucedidos foram salvos no banco. Sugerimos realizar uma nova auditoria para diagnosticar."
                  : "Todas as músicas elegíveis reavaliadas foram marcadas fisicamente como antigas com carimbo de auditoria manual."}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.04] rounded-3xl p-5">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200/55 dark:border-white/[0.04]">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Resumo da Execução de Escrita</span>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md">
                Referência: {formatPortugueseDate(analysisDate)}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3.5 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Planejadas</span>
                <span className="text-xl font-extrabold text-slate-800 dark:text-white block mt-1">{applyRequested}</span>
              </div>
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3.5 text-left">
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Atualizadas</span>
                <span className="text-xl font-extrabold text-emerald-500 block mt-1">{applyUpdated}</span>
              </div>
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3.5 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sem Mudança</span>
                <span className="text-xl font-extrabold text-slate-700 dark:text-slate-300 block mt-1">{applyUnchanged}</span>
              </div>
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3.5 text-left">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">Inválidas</span>
                <span className="text-xl font-extrabold text-purple-400 block mt-1">{applyInvalid}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ausentes</span>
                <span className="text-md font-bold text-slate-700 dark:text-slate-300 block mt-1">{applyMissing}</span>
              </div>
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outra Org</span>
                <span className="text-md font-bold text-slate-700 dark:text-slate-300 block mt-1">{applyWrongOrganization}</span>
              </div>
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3 text-left">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Falhas</span>
                <span className="text-md font-bold text-rose-500 block mt-1">{applyFailed}</span>
              </div>
            </div>

            {applyClosureValidation.passed ? (
              <div className="mt-4 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-center justify-between text-[11px] text-indigo-500">
                <div className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Consistência Matemática Validada (100% dos registros fechados)</span>
                </div>
                <span className="font-mono text-[9px] opacity-80 hidden md:inline">
                  {applyClosureValidation.equation}
                </span>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-center gap-1.5 text-[11px] text-amber-600">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Aviso: Divergência na consolidação matemática dos registros.</span>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-100/65 dark:bg-white/[0.01] border border-slate-200/60 dark:border-white/5 rounded-2xl text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed space-y-1.5 select-none">
            <p className="font-bold text-slate-700 dark:text-slate-200">Nota informativa de auditoria:</p>
            <p>
              O número de músicas marcadas fisicamente como antigas pode ser menor do que o previsto no Dry Run inicial, porque cada documento foi relido e reavaliado pelo sistema no momento exato em que a escrita estava ocorrendo. Alterações manuais recentes de status, mudanças de data ou escalas futuras marcadas concorrentemente no mesmo período foram protegidas.
            </p>
          </div>
        </div>
      );
    }

    // Success result panel for Dry Run
    return (
      <div className="space-y-6">
        <div className="bg-slate-50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.04] rounded-3xl p-5">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200/55 dark:border-white/[0.04]">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Resumo da Avaliação</span>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md">
              Data da simulação: {formatPortugueseDate(analysisDate)}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Total */}
            <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3.5 text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avaliadas</span>
              <span className="text-xl font-extrabold text-slate-800 dark:text-white block mt-1">{metricsCounts.evaluated}</span>
            </div>
            {/* Would Update */}
            <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3.5 text-left">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Seriam Antigas</span>
              <span className="text-xl font-extrabold text-amber-500 block mt-1">{metricsCounts.wouldUpdate}</span>
            </div>
            {/* Protected */}
            <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3.5 text-left">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Escalas Futuras</span>
              <span className="text-xl font-extrabold text-emerald-500 block mt-1">{metricsCounts.protected}</span>
            </div>
            {/* Preservation Manual */}
            <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3.5 text-left">
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">Preservadas</span>
              <span className="text-xl font-extrabold text-blue-500 block mt-1">{metricsCounts.manual}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3">
            {/* Safe / Not Expired */}
            <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3 text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sem Alteração</span>
              <span className="text-md font-bold text-slate-700 dark:text-slate-300 block mt-1">{metricsCounts.unchanged}</span>
            </div>
            {/* Missing Date */}
            <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3 text-left">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">Sem Data</span>
              <span className="text-md font-bold text-purple-400 block mt-1">{metricsCounts.noDate}</span>
            </div>
            {/* Failed */}
            <div className="bg-white dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.04] rounded-2xl p-3 text-left">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Falhas</span>
              <span className="text-md font-bold text-rose-500 block mt-1">{metricsCounts.failed}</span>
            </div>
          </div>

          {closureValidation.passed ? (
            <div className="mt-4 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-center justify-between text-[11px] text-indigo-500 select-none">
              <div className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Consistência Matemática Validada (Sem sobreposição ou duplicatas)</span>
              </div>
              <span className="font-mono text-[9.5px] opacity-80 hidden md:inline">
                {closureValidation.equation}
              </span>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-center gap-1.5 text-[11px] text-amber-600">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Aviso: Divergência na consolidação matemática da simulação.</span>
            </div>
          )}
        </div>

        {/* Detailed Categories List */}
        <div className="space-y-3">
          <h5 className="text-[12px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1 select-none">
            Detalhamento por Categorias
          </h5>

          {Object.entries(groupedItems).map(([sectionKey, sectionValue]) => {
            const section = sectionValue as { title: string; color: string; items: { item: FreshnessExecutionItem; song?: PopulatedSong }[] };
            const isExpanded = expandedSection === sectionKey;
            const count = section.items.length;
            if (count === 0) return null;

            return (
              <div 
                key={sectionKey} 
                className="overflow-hidden bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl transition-all"
              >
                <button
                  type="button"
                  onClick={() => toggleSection(sectionKey)}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors min-h-[48px]"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 font-extrabold rounded-full ${section.color}`}>
                      {count}
                    </span>
                    <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
                      {section.title}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-transparent overflow-hidden"
                    >
                      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                        {section.items.map(({ item, song }) => (
                          <div 
                            key={item.songId}
                            className="bg-white dark:bg-[#0E0E10] border border-slate-100 dark:border-white/[0.03] rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <Music className="w-3.5 h-3.5 text-slate-400" />
                                {song ? song.title : "ID Desconhecido ou Externo"}
                              </div>
                              <div className="text-slate-400 text-[11px] mt-0.5 font-sans">
                                {song ? `por ${song.artist}` : `ID: ${item.songId}`}
                              </div>
                              <div className="text-indigo-500/90 dark:text-indigo-400 font-semibold mt-1 text-[11px]">
                                Motivo: {getTranslatedReason(item.reason)}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 text-[10px] md:self-center">
                              <div className="bg-slate-100 dark:bg-white/5 border border-slate-250 dark:border-white/10 px-2 py-1 rounded-md text-slate-500 dark:text-slate-400">
                                Status atual: <strong className="uppercase">{item.currentStatus}</strong> ({item.currentSource})
                              </div>

                              {item.referenceDate && (
                                <div className="bg-slate-100 dark:bg-white/5 border border-slate-250 dark:border-white/10 px-2 py-1 rounded-md text-slate-500 dark:text-slate-400">
                                  Referência: <strong className="font-mono">{formatPortugueseDate(item.referenceDate)}</strong>
                                </div>
                              )}

                              {item.expirationDate && (
                                <div className="bg-slate-100 dark:bg-white/5 border border-slate-250 dark:border-white/10 px-2 py-1 rounded-md text-slate-500 dark:text-slate-400">
                                  Expiração: <strong className="font-mono text-amber-500 dark:text-amber-400">{formatPortugueseDate(item.expirationDate)}</strong>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleCloseAndReset}
        title={
          <div className="flex items-center gap-2 select-none">
            <ListRestart className="w-5 h-5 text-indigo-500 shrink-0 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Auditoria de Repertório
              </h3>
              <p className="text-[11px] text-slate-400 font-medium font-sans">
                {status === "apply-success" 
                  ? "Resultado de Escrita Física de Antiguidade"
                  : "Análise Controlada de Freshness de Receptáculo"}
              </p>
            </div>
          </div>
        }
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          {renderContent()}

          {/* Footer controls */}
          {(status === "success" || status === "apply-success") && (
            <div className="pt-4 border-t border-slate-200/50 dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 card-footer">
              <div className="text-[11px] text-slate-400 font-medium font-sans text-left">
                {status === "success" && (
                  <span>
                    Usando fuso local: <strong className="font-mono">{formatPortugueseDate(analysisDate)}</strong>
                  </span>
                )}
                {status === "apply-success" && (
                  <span className="text-emerald-500 font-semibold">
                    ✓ Alterações físicas aplicadas com sucesso
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {status === "success" && (
                  <Button
                    variant="secondary"
                    onClick={handleReset}
                    className="text-xs font-bold font-sans tracking-tight h-11 min-h-[44px] w-full sm:w-auto"
                  >
                    Analisar novamente
                  </Button>
                )}

                {status === "success" && canManageRepertoire && organizationId && (
                  metricsCounts.wouldUpdate > 0 ? (
                    <Button
                      variant="primary"
                      onClick={handleOpenConfirmApply}
                      className="text-xs font-bold font-sans tracking-tight h-11 min-h-[44px] bg-indigo-600 hover:bg-indigo-500 text-white w-full sm:w-auto"
                    >
                      Marcar elegíveis como Antigas
                    </Button>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 text-xs font-bold select-none px-2 py-2 border border-dashed border-slate-200 dark:border-white/5 rounded-xl bg-slate-50 dark:bg-transparent min-h-[44px] flex items-center">
                      Nenhuma música precisa ser atualizada.
                    </span>
                  )
                )}

                <Button
                  variant={status === "apply-success" ? "primary" : "secondary"}
                  onClick={handleCloseAndReset}
                  className="text-xs font-bold font-sans tracking-tight h-11 min-h-[44px] w-full sm:w-auto"
                >
                  {status === "apply-success" ? "Fechar Auditoria" : "Cancelar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Structured Confirmation Dialog Overlaying securely */}
      <ConfirmationModal
        isOpen={isConfirming}
        onClose={() => setIsConfirming(false)}
        onConfirm={handleConfirmExecution}
        title="Aplicar classificação de músicas?"
        message={`Esta ação irá marcar como Antigas apenas as músicas que continuarem elegíveis no momento da execução. Alterações manuais recentes serão preservadas.

• Número previsto de músicas: ${metricsCounts.wouldUpdate}
• Data utilizada na análise: ${formatPortugueseDate(analysisDate)} (Data local do dispositivo)
• Organização: Identificada para auditoria física (${organizationId})

O sistema fará uma nova validação transacional individual de cada música antes de realizar qualquer alteração física. Nenhuma música da Biblioteca Viva (global) será alterada.`}
        confirmText="Confirmar aplicação"
        cancelText="Voltar"
        zIndexClass="z-[200]"
      />
    </>
  );
};
