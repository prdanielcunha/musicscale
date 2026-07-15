import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { 
  Sparkles, 
  Zap, 
  Bug, 
  Cpu, 
  Shield, 
  RefreshCw, 
  Trash2, 
  Check, 
  X, 
  Calendar, 
  User, 
  Plus, 
  CheckCircle, 
  Clock, 
  Activity, 
  AlertCircle,
  Eye,
  Settings,
  Flame,
  Globe,
  Star,
  ArrowUpRight,
  BookOpen
} from "lucide-react";

// Update Types to align with server structure
interface LocaleText {
  pt: string;
  en: string;
  es: string;
}

interface LocaleList {
  pt: string[];
  en: string[];
  es: string[];
}

interface ChangelogEntry {
  id: string;
  version: string;
  title: LocaleText;
  description: LocaleText;
  highlights: LocaleList;
  category: string;
  launchedAt: string;
  author: string;
  isMajor: boolean;
}

export const UpdatesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { userProfile, permissions } = useAuth();
  
  // States
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  
  // AI Suggestion & Editing Board (Admin panel)
  const [isAggregating, setIsAggregating] = useState<boolean>(false);
  const [showAdminConsole, setShowAdminConsole] = useState<boolean>(false);
  const [draftEntry, setDraftEntry] = useState<Partial<ChangelogEntry> | null>(null);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  
  // Newsletter Subscribe
  const [emailInput, setEmailInput] = useState<string>("");
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [subscribing, setSubscribing] = useState<boolean>(false);

  // Categories definition with premium custom indicators
  const categories = [
    { name: "All", labelPt: "Tudo", labelEn: "All", labelEs: "Todo", color: "bg-indigo-500" },
    { name: "Novidades", labelPt: "Novidades", labelEn: "New Features", labelEs: "Novedades", color: "bg-blue-500" },
    { name: "Performance Mode", labelPt: "Modo Performance", labelEn: "Performance Mode", labelEs: "Modo Performance", color: "bg-red-500" },
    { name: "IA", labelPt: "Inteligência Artificial", labelEn: "AI Co-pilot", labelEs: "IA", color: "bg-fuchsia-500" },
    { name: "Performance", labelPt: "Performance", labelEn: "Performance", labelEs: "Rendimiento", color: "bg-amber-500" },
    { name: "Experiência", labelPt: "UX / Design", labelEn: "Design System", labelEs: "Experiencia", color: "bg-emerald-500" },
    { name: "Estabilidade", labelPt: "Estabilidade", labelEn: "Reliability", labelEs: "Estabilidad", color: "bg-cyan-500" },
    { name: "Offline", labelPt: "Offline", labelEn: "Offline Sync", labelEs: "Offline", color: "bg-teal-500" },
    { name: "Refinamentos", labelPt: "Refinamentos", labelEn: "Refinements", labelEs: "Detalles", color: "bg-slate-400" }
  ];

  const currentLanguage = (i18n.language || "pt").substring(0, 2) as "pt" | "en" | "es";

  // Check if current user is admin/owner
  const canManage = permissions?.manageOrganization || false;

  const fetchChangelogs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/changelog");
      if (!res.ok) throw new Error("Could not fetch changelogs");
      const data = await res.json();
      if (data.changelogs) {
        setChangelogs(data.changelogs);
        setFilteredLogs(data.changelogs);
      }
    } catch (e: any) {
      setErrorMessage("Erro ao conectar com o servidor do Changelog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChangelogs();
    
    // Auto-mark latest as read in user storage to clear unread notifications
    localStorage.setItem("musicscale_last_viewed_changelog", new Date().toISOString());
  }, []);

  // Filter logs upon active category selection
  useEffect(() => {
    if (activeCategory === "All") {
      setFilteredLogs(changelogs);
    } else {
      setFilteredLogs(changelogs.filter(log => log.category.toLowerCase() === activeCategory.toLowerCase()));
    }
  }, [activeCategory, changelogs]);

  // Call Intelligent Aggregator (Gemini Endpoint)
  const handleAIAggregation = async () => {
    try {
      setIsAggregating(true);
      setErrorMessage("");
      setSuccessMessage("");
      
      const res = await fetch("/api/changelog/aggregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: currentLanguage })
      });
      
      if (!res.ok) throw new Error("Auto-generation failed");
      const data = await res.json();
      
      if (data.success && data.suggestion) {
        setDraftEntry(data.suggestion);
        setSuccessMessage("Inteligência Artificial gerou uma sugestão espetacular baseada nos últimos desenvolvimentos!");
      } else {
        throw new Error("Invalid structure returned");
      }
    } catch (e: any) {
      setErrorMessage("Não foi possível gerar atualizações com IA. Tente reescrever manualmente ou verifique as credenciais.");
    } finally {
      setIsAggregating(false);
    }
  };

  // Publish suggested AI release log
  const handlePublishDraft = async () => {
    if (!draftEntry) return;
    try {
      setIsPublishing(true);
      setErrorMessage("");
      
      const res = await fetch("/api/changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draftEntry,
          launchedAt: new Date().toISOString(),
          author: userProfile?.displayName || "Worship Architect"
        })
      });

      if (!res.ok) throw new Error("Failed to publish");
      const data = await res.json();
      
      if (data.success) {
        setSuccessMessage("Nota de Lançamento publicada na timeline ao vivo com sucesso!");
        setDraftEntry(null);
        fetchChangelogs();
      }
    } catch (e: any) {
      setErrorMessage("Não foi possível salvar o Changelog.");
    } finally {
      setIsPublishing(false);
    }
  };

  // Delete log entry
  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm("Deseja realmente remover esta nota de lançamento?")) return;
    try {
      const res = await fetch(`/api/changelog/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setSuccessMessage("Entrada removida com sucesso.");
        fetchChangelogs();
      }
    } catch (e: any) {
      setErrorMessage("Falha ao deletar entrada.");
    }
  };

  // Dynamic localization utility
  const getLocalizedText = (field: LocaleText | undefined, fallback: string = "") => {
    if (!field) return fallback;
    return field[currentLanguage] || field.pt || field.en || field.es || fallback;
  };

  const getLocalizedList = (field: LocaleList | undefined) => {
    if (!field) return [];
    return field[currentLanguage] || field.pt || field.en || field.es || [];
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    setSubscribing(true);
    setTimeout(() => {
      setSubscribed(true);
      setSubscribing(false);
      setEmailInput("");
    }, 1200);
  };

  return (
    <div className="relative min-h-screen pb-20 select-none antialiased">
      {/* Dynamic Background Mesh */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        <div className="absolute top-[10%] left-[5%] w-[450px] h-[450px] bg-indigo-500/[0.04] dark:bg-indigo-600/[0.09] md:blur-[120px] blur-[25px] rounded-full"></div>
        <div className="absolute bottom-[30%] right-[5%] w-[600px] h-[600px] bg-blue-500/[0.04] dark:bg-blue-600/[0.08] md:blur-[150px] blur-[30px] rounded-full"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        {/* Custom Premium Toast */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-6 right-6 z-[60] flex items-center gap-3 bg-slate-900/90 dark:bg-slate-950/95 text-emerald-400 border border-emerald-500/20 px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-xl"
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="font-bold text-sm text-slate-100">{t('updates.success', 'Processo Concluído')}</span>
                <span className="text-xs text-slate-400 font-medium">{successMessage}</span>
              </div>
              <button onClick={() => setSuccessMessage("")} className="ml-3 p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-6 right-6 z-[60] flex items-center gap-3 bg-slate-900/90 dark:bg-slate-950/95 text-red-400 border border-red-500/20 px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-xl"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="font-bold text-sm text-slate-100">{t('updates.error', 'Ocorreu um erro')}</span>
                <span className="text-xs text-slate-400 font-medium">{errorMessage}</span>
              </div>
              <button onClick={() => setErrorMessage("")} className="ml-3 p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Premium Page Header */}
        <div className="text-center pt-8 pb-12 sm:pt-12 sm:pb-16 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/15 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 mb-6 font-bold text-xs tracking-wider uppercase"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>{t('updates.badge_text', 'Evolução Contínua')}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-4"
          >
            {t('updates.page_title', 'Cronologia das')} <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-fuchsia-600 dark:from-indigo-400 dark:via-blue-400 dark:to-fuchsia-400">
              {t('updates.page_accent', 'Nossas Atualizações')}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-[17px] sm:text-[19px] font-medium text-slate-500 dark:text-[#888888] max-w-2xl leading-relaxed"
          >
            {t('updates.page_desc', 'Projetamos, refinamos e aprimoramos o ecossistema constantemente para silenciar o ruído operacional e dar liberdade no altar.')}
          </motion.p>
        </div>

        {/* Dynamic Category Filter System - Stripe Styled */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-12 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex flex-wrap justify-center md:justify-start gap-1.5 p-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-2xl border border-black/[0.04] dark:border-white/[0.05] overflow-x-auto max-w-full hide-scrollbar">
            {categories.map((cat) => {
              const label = currentLanguage === "pt" ? cat.labelPt : currentLanguage === "en" ? cat.labelEn : cat.labelEs;
              const isActive = activeCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 pointer-events-auto ${
                    isActive
                      ? "bg-white dark:bg-[#1C1C1E] text-slate-900 dark:text-white shadow-apple-hover border border-black/[0.02] dark:border-white/[0.04]"
                      : "text-slate-500 dark:text-[#888] hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {cat.name !== "All" && (
                    <span className={`w-1.5 h-1.5 rounded-full ${cat.color}`}></span>
                  )}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Admin Control Anchor - Magical Sparkles */}
          {canManage && (
            <button
              onClick={() => setShowAdminConsole(prev => !prev)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600/10 dark:hover:bg-indigo-600/20 text-white dark:text-indigo-400 border border-transparent dark:border-indigo-500/20 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_4px_16px_rgba(99,102,241,0.2)] dark:shadow-none active:scale-95 duration-250 cursor-pointer"
            >
              <Settings className="w-4 h-4 animate-spin-slow" />
              <span>{showAdminConsole ? "Fechar Painel" : "Painel da IA"}</span>
            </button>
          )}
        </div>

        {/* AI Intelligent Aggregator Panel (Admin console sliding door) */}
        <AnimatePresence>
          {showAdminConsole && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-12"
            >
              <div className="bg-gradient-to-br from-indigo-500/[0.03] to-purple-500/[0.03] dark:from-indigo-600/[0.06] dark:to-fuchsia-600/[0.06] backdrop-blur-xl border border-indigo-500/10 dark:border-indigo-500/20 rounded-3xl p-6 md:p-8 mt-5 flex flex-col gap-6 md:gap-8 isolate relative">
                {/* Visual Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 to-transparent blur-3xl pointer-events-none -z-10"></div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-col max-w-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center justify-center p-1.5 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-450">
                        <Star className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#B5A5FF] dark:text-indigo-300">Inteligência Estrutural</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-tight">
                      Sincronização & Processamento de Atualizações via IA
                    </h3>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-[#888]">
                      Nossa engenharia analisa alterações no repositório de arquivos do app e compacta refinamentos técnicos em uma rica narrativa literária de ganhos emocionais imediatos.
                    </p>
                  </div>
                  
                  <button
                    disabled={isAggregating}
                    onClick={handleAIAggregation}
                    className="flex-shrink-0 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm tracking-wide transition-all duration-300 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
                  >
                    {isAggregating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Espere, analisando código...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-white animate-pulse" />
                        <span>Sugestionar Alteração com IA</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Live AI Editor Panel */}
                {draftEntry && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-black/10 dark:border-white/10 rounded-2xl bg-white/50 dark:bg-black/40 p-5 space-y-5"
                  >
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-300 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-indigo-400" />
                        Revisão de Minuta Gerada
                      </span>
                      <button onClick={() => setDraftEntry(null)} className="text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">Versão do Lançamento</label>
                        <input
                          type="text"
                          value={draftEntry.version || ""}
                          onChange={(e) => setDraftEntry({ ...draftEntry, version: e.target.value })}
                          className="px-3.5 py-2.5 bg-black/5 rounded-xl text-sm font-semibold max-w-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">Categoria Elegante</label>
                        <select
                          value={draftEntry.category || "Novidades"}
                          onChange={(e) => setDraftEntry({ ...draftEntry, category: e.target.value })}
                          className="px-3.5 py-2.5 bg-black/5 rounded-xl text-sm font-semibold max-w-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {categories.filter(c => c.name !== "All").map(c => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold select-none text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={draftEntry.isMajor || false}
                            onChange={(e) => setDraftEntry({ ...draftEntry, isMajor: e.target.checked })}
                            className="rounded border-slate-300 dark:border-slate-700 w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Marcar como Destaque Visual Principal</span>
                        </label>
                      </div>
                    </div>

                    {/* Localized Titles */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 text-indigo-400">Título (Português)</label>
                        <input
                          type="text"
                          value={draftEntry.title?.pt || ""}
                          onChange={(e) => setDraftEntry({
                            ...draftEntry,
                            title: { ...(draftEntry.title || { pt: "", en: "", es: "" }), pt: e.target.value }
                          })}
                          className="px-3.5 py-2.5 bg-black/5 rounded-xl text-sm"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 text-blue-400">Title (English)</label>
                        <input
                          type="text"
                          value={draftEntry.title?.en || ""}
                          onChange={(e) => setDraftEntry({
                            ...draftEntry,
                            title: { ...(draftEntry.title || { pt: "", en: "", es: "" }), en: e.target.value }
                          })}
                          className="px-3.5 py-2.5 bg-black/5 rounded-xl text-sm"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 text-amber-500">Título (Español)</label>
                        <input
                          type="text"
                          value={draftEntry.title?.es || ""}
                          onChange={(e) => setDraftEntry({
                            ...draftEntry,
                            title: { ...(draftEntry.title || { pt: "", en: "", es: "" }), es: e.target.value }
                          })}
                          className="px-3.5 py-2.5 bg-black/5 rounded-xl text-sm"
                        />
                      </div>
                    </div>

                    {/* Localized Descriptions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">Descrição (Português)</label>
                        <textarea
                          rows={2}
                          value={draftEntry.description?.pt || ""}
                          onChange={(e) => setDraftEntry({
                            ...draftEntry,
                            description: { ...(draftEntry.description || { pt: "", en: "", es: "" }), pt: e.target.value }
                          })}
                          className="input-base !h-auto min-h-[80px]"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">Description (English)</label>
                        <textarea
                          rows={2}
                          value={draftEntry.description?.en || ""}
                          onChange={(e) => setDraftEntry({
                            ...draftEntry,
                            description: { ...(draftEntry.description || { pt: "", en: "", es: "" }), en: e.target.value }
                          })}
                          className="input-base !h-auto min-h-[80px]"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">Descripción (Español)</label>
                        <textarea
                          rows={2}
                          value={draftEntry.description?.es || ""}
                          onChange={(e) => setDraftEntry({
                            ...draftEntry,
                            description: { ...(draftEntry.description || { pt: "", en: "", es: "" }), es: e.target.value }
                          })}
                          className="input-base !h-auto min-h-[80px]"
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-end gap-2.5 pt-3">
                      <button
                        onClick={() => setDraftEntry(null)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                      >
                        Descartar
                      </button>
                      <button
                        onClick={handlePublishDraft}
                        disabled={isPublishing}
                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isPublishing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        <span>Salvar & Publicar</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Real-time Loading Skeleton */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Decodificando crônicas de evolução...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 mt-12">
            {/* The Main Living Feed Layout (Cols 1-3) */}
            <div className="lg:col-span-3 space-y-12 relative">
              {/* Dynamic Connecting timeline bar */}
              <div className="absolute left-6 md:left-[111px] top-6 bottom-6 w-0.5 bg-black/[0.04] dark:bg-white/[0.06] -z-10 pointer-events-none"></div>

              {filteredLogs.length === 0 ? (
                <div className="text-center py-20 bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-3xl p-8">
                  <Flame className="w-10 h-10 text-slate-400 mx-auto mb-4 animate-pulse" />
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Sem Atualizações Nesta Categoria</h4>
                  <p className="text-sm text-slate-500 dark:text-[#888]">Experimente selecionar outra categoria para ver a evolução constante do nosso software.</p>
                </div>
              ) : (
                filteredLogs.map((log, index) => {
                  const title = getLocalizedText(log.title, "Nova Atualização");
                  const description = getLocalizedText(log.description, "Melhorias gerais no sistema.");
                  const highlights = getLocalizedList(log.highlights);
                  const dateStr = new Date(log.launchedAt).toLocaleDateString(i18n.language || "pt", { month: "short", day: "numeric" });
                  
                  // Category color matching
                  const myCat = categories.find(c => c.name.toLowerCase() === log.category.toLowerCase()) || { color: "bg-indigo-500" };

                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.08 }}
                      className="flex flex-col md:flex-row gap-6 md:gap-10 items-start relative group"
                    >
                      {/* Left: Metadata date and version layout */}
                      <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start w-full md:w-24 flex-shrink-0 pt-1">
                        <span className="text-xs md:text-sm font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                          v{log.version}
                        </span>
                        <div className="flex md:flex-col items-center md:items-end gap-1.5 md:gap-0 mt-0.5">
                          <span className="text-xs font-semibold text-slate-600 dark:text-[#888]">{dateStr}</span>
                          <span className="hidden md:inline text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                            {log.author.split(" ")[0]}
                          </span>
                        </div>
                      </div>

                      {/* Spark Node Indicator on Timeline */}
                      <div className="absolute left-6 md:left-[111px] top-2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-[3px] border-white dark:border-[#0A0A0E] bg-indigo-500 group-hover:scale-125 transition-transform duration-300 pointer-events-none shadow-md"></div>

                      {/* Right: Premium glassmorphism card */}
                      <div className={`flex-1 relative p-6 md:p-8 rounded-3xl bg-white dark:bg-[#0E0E14] border hover:shadow-apple-hover transition-all duration-300 pb-8 hover:border-black/10 dark:hover:border-white/10 ${
                        log.isMajor 
                          ? "border-indigo-500/15 dark:border-indigo-500/15 shadow-[0_16px_36px_rgba(99,102,241,0.06)] dark:shadow-[0_16px_36px_rgba(99,102,241,0.02)]" 
                          : "border-black/[0.04] dark:border-white/[0.05] shadow-sm"
                      }`}>
                        
                        {/* Shimmer on major updates */}
                        {log.isMajor && (
                          <div className="absolute top-0 right-0 px-3.5 py-1 text-[9px] font-black uppercase tracking-widest text-[#B5A5FF] dark:text-indigo-300 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-bl-3xl border-bl border-indigo-500/20">
                            {t('updates.highlight', 'Destaque')}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mb-3.5">
                          <span className={`w-2 h-2 rounded-full ${myCat.color}`}></span>
                          <span className="text-[10px] text-slate-500 dark:text-[#a1a1a1] font-bold uppercase tracking-widest">{log.category}</span>
                        </div>

                        <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-3">
                          {title}
                        </h2>

                        <p className="text-sm md:text-base leading-relaxed text-slate-500 dark:text-slate-400 font-medium font-sans mb-6">
                          {description}
                        </p>

                        {/* Storytelling Bullet/Highlights points */}
                        {highlights.length > 0 && (
                          <div className="space-y-3.5 border-t border-black/[0.05] dark:border-white/[0.06] pt-6">
                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Detalhamento dos Refinamentos</h4>
                            {highlights.map((hlt, hIdx) => (
                              <div key={hIdx} className="flex items-start gap-3 group/item">
                                <div className="mt-1 flex-shrink-0 w-4 h-4 rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                  <Check className="w-2.5 h-2.5 font-bold" />
                                </div>
                                <span className="text-xs md:text-sm font-medium text-slate-500 dark:text-[#b4b4b4] group-hover/item:text-slate-800 dark:group-hover/item:text-white transition-colors duration-250 leading-relaxed">
                                  {hlt}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Admin Delete Option */}
                        {canManage && (
                          <button
                            onClick={() => handleDeleteEntry(log.id)}
                            className="absolute bottom-4 right-4 p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Deletar entrada"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Aesthetic Sidebar Widgets (Col 4) */}
            <div className="space-y-8 lg:sticky lg:top-8 self-start">
              {/* Product State Layer Widget */}
              <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.05] p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                    <Activity className="w-5 h-5 flex-shrink-0" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{t('updates.status_title', 'Status Tecnológico')}</h4>
                    <p className="text-[10px] text-slate-500 dark:text-[#888] font-semibold uppercase tracking-widest">{t('updates.active_nodes', 'Todos os Sistemas Operacionais')}</p>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 text-xs">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span>Versão Instalada</span>
                    <span className="font-bold text-slate-900 dark:text-white">v1.2.0</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span>Provedor de IA</span>
                    <span className="font-bold text-[#E566FF]">Gemini 2.5 Flash</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span>Latência das Transposições</span>
                    <span className="font-semibold text-emerald-400">~8ms (Sub-Sensorial)</span>
                  </div>
                </div>

                <div className="h-px bg-black/[0.05] dark:bg-white/[0.05]"></div>
                
                <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500 font-medium">
                  {t('updates.safety_note', 'Toda compilação de código passa por testes robustos para garantir que seu louvor nunca sofra interrupções.')}
                </p>
              </div>

              {/* Newsletter / Custom Subscribe Loop Widget */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500/[0.02] to-indigo-600/[0.01] dark:from-indigo-500/[0.06] dark:to-indigo-600/[0.02] border border-indigo-500/10 dark:border-indigo-500/15 p-6 animate-pulse-slow">
                <h4 className="font-black text-slate-900 dark:text-white text-[15px] mb-1.5 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  {t('updates.newsletter_title', 'Novidades no seu e-mail')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-[#888] leading-relaxed mb-4">
                  {t('updates.newsletter_desc', 'Seja o primeiro a receber recursos exclusivos, cifras raras e atualizações de design diretamente da fábrica.')}
                </p>

                <AnimatePresence mode="wait">
                  {subscribed ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 p-4 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>{t('updates.subscribed', 'Sua inscrição foi confirmada!')}</span>
                    </motion.div>
                  ) : (
                    <motion.form
                      onSubmit={handleSubscribe}
                      className="flex flex-col gap-2"
                    >
                      <input
                        type="email"
                        required
                        placeholder={t('updates.email_placeholder', 'coordenador@louvor.com')}
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full bg-white dark:bg-[#1A1A1E]/80 border border-black/5 dark:border-white/5 rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 dark:placeholder:text-[#555]"
                      />
                      <button
                        type="submit"
                        disabled={subscribing}
                        className="w-full bg-slate-900 hover:bg-indigo-600 active:scale-95 text-white py-3.5 rounded-xl text-xs font-bold leading-none cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-indigo-500/20"
                      >
                        {subscribing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <span>Inscrição Imediata</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdatesPage;
