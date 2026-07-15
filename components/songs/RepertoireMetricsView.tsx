import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { 
  Music, 
  Sparkles, 
  FileText, 
  Layers, 
  Activity, 
  FileWarning, 
  CheckCircle2, 
  Music2, 
  Compass, 
  AlignLeft,
  ListRestart
} from "lucide-react";
import type { PopulatedSong } from "../../types";

interface RepertoireMetricsViewProps {
  songs: PopulatedSong[] | any[];
  mode: 'repertoire' | 'chords' | 'lyrics';
}

export const RepertoireMetricsView: React.FC<RepertoireMetricsViewProps> = ({ songs, mode }) => {
  const { t } = useTranslation();

  const metrics = useMemo(() => {
    const total = songs.length;
    const active = songs.filter((s) => s.status === "active").length;
    const inactive = total - active;

    // Recently added songs (30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newSongs = songs.filter((s) => {
      if (s.isNew) return true;
      if (s.createdAt) {
        try {
          const dt = new Date(s.createdAt);
          return dt >= thirtyDaysAgo;
        } catch (_) {
          return false;
        }
      }
      return false;
    });
    const totalNew = newSongs.length;

    // Chords and lyrics availability
    const withChords = songs.filter((s) => !!s.chords?.trim() || !!s.chordsUrl?.trim());
    const totalWithChords = withChords.length;
    const chordsPct = total > 0 ? Math.round((totalWithChords / total) * 100) : 0;
    const missingChords = active - songs.filter((s) => s.status === "active" && (!!s.chords?.trim() || !!s.chordsUrl?.trim())).length;
    const missingChordsCount = missingChords > 0 ? missingChords : 0;

    const withLyrics = songs.filter((s) => !!s.lyrics?.trim());
    const totalWithLyrics = withLyrics.length;
    const lyricsPct = total > 0 ? Math.round((totalWithLyrics / total) * 100) : 0;
    const missingLyrics = active - songs.filter((s) => s.status === "active" && !!s.lyrics?.trim()).length;
    const missingLyricsCount = missingLyrics > 0 ? missingLyrics : 0;

    // Both chords and lyrics
    const fullyComplete = songs.filter((s) => (!!s.chords?.trim() || !!s.chordsUrl?.trim()) && !!s.lyrics?.trim()).length;
    const completenessPct = total > 0 ? Math.round((fullyComplete / total) * 100) : 0;

    // Unique Keys (tones)
    const uniqueKeys = new Set(
      songs
        .map((s) => s.key)
        .filter((k) => k && k !== "-" && k !== "N/A" && k !== "Tom")
    );
    const uniqueKeysCount = uniqueKeys.size;

    // BPM coverage
    const withBpm = songs.filter((s) => !!s.bpm || !!s.suggestedBpm);
    const bpmPct = total > 0 ? Math.round((withBpm.length / total) * 100) : 0;

    // Dominant key
    const keyCounts: { [key: string]: number } = {};
    songs.forEach((s) => {
      if (s.key && s.key !== "-" && s.key !== "N/A" && s.key !== "Tom") {
        keyCounts[s.key] = (keyCounts[s.key] || 0) + 1;
      }
    });
    let dominantKey = "-";
    let dominantKeyCount = 0;
    Object.entries(keyCounts).forEach(([k, count]) => {
      if (count > dominantKeyCount) {
        dominantKeyCount = count;
        dominantKey = k;
      }
    });

    // Lyrical structure (sections coverage)
    // Lyrics with [verso], [chorus], [refrão], etc.
    const structuredLyrics = withLyrics.filter((s) => {
      const text = (s.lyrics || "").toLowerCase();
      return text.includes("[") || text.includes("refrão") || text.includes("verso") || text.includes("coro") || text.includes("bridge") || text.includes("ponte");
    });
    const structuredLyricsPct = withLyrics.length > 0 ? Math.round((structuredLyrics.length / withLyrics.length) * 100) : 0;

    return {
      total,
      active,
      inactive,
      totalNew,
      totalWithChords,
      chordsPct,
      missingChordsCount,
      totalWithLyrics,
      lyricsPct,
      missingLyricsCount,
      completenessPct,
      fullyComplete,
      uniqueKeysCount,
      bpmPct,
      dominantKey,
      dominantKeyCount,
      structuredLyricsPct,
    };
  }, [songs]);

  // Framer Motion entrance variations
  const containerVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: 0.04,
        duration: 0.35,
        ease: "easeOut",
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.98, y: 4 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.25, ease: "easeOut" },
    },
  };

  if (songs.length === 0) return null;

  // REPERTOIRE MODE
  if (mode === "repertoire") {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full"
      >
        {/* Total Repertoire */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0d0d0e]/60 border border-slate-200/50 dark:border-white/[0.04] p-4 flex flex-col justify-between group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 dark:opacity-[0.03] group-hover:opacity-20 dark:group-hover:opacity-[0.08] transition-opacity">
            <Music className="w-16 h-16 text-slate-900 dark:text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {t("metrics.total_collection", "Acervo Geral")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-sans text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                {metrics.total}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {metrics.total === 1 ? "música" : "músicas"}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between text-[11px] text-slate-500 font-semibold tracking-tight">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {metrics.active} {t("metrics.active", "Ativas")}
            </span>
            {metrics.inactive > 0 && (
              <span className="flex items-center gap-1 opacity-75">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600"></span>
                {metrics.inactive} {t("metrics.inactive", "Arquivadas")}
              </span>
            )}
          </div>
        </motion.div>

        {/* Featured / Recently Added */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0d0d0e]/60 border border-slate-200/50 dark:border-white/[0.04] p-4 flex flex-col justify-between group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 dark:opacity-[0.03] group-hover:opacity-20 dark:group-hover:opacity-[0.08] transition-opacity">
            <Sparkles className="w-16 h-16 text-slate-900 dark:text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {t("metrics.new_songs", "Novas Músicas")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-sans text-indigo-600 dark:text-indigo-400 tracking-tight leading-none flex items-center gap-1.5">
                {metrics.totalNew}
                {metrics.totalNew > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                )}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                adicionadas recentemente
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-tight truncate">
            {metrics.totalNew > 0 
              ? `${metrics.totalNew} novos títulos integrados` 
              : "Nenhum novo título nos últimos 30 dias"}
          </div>
        </motion.div>

        {/* Collection Integrity */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0d0d0e]/60 border border-slate-200/50 dark:border-white/[0.04] p-4 flex flex-col justify-between group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 dark:opacity-[0.03] group-hover:opacity-20 dark:group-hover:opacity-[0.08] transition-opacity">
            <Layers className="w-16 h-16 text-slate-900 dark:text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {t("metrics.completely_filled", "Repertório Completo")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-sans text-emerald-600 dark:text-emerald-400 tracking-tight leading-none">
                {metrics.completenessPct}%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                com cifra e letra
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${metrics.completenessPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="bg-emerald-500 dark:bg-emerald-400 h-full rounded-full"
              />
            </div>
            <div className="flex justify-between items-center mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
              <span>{metrics.fullyComplete} COMPLETAS</span>
              <span>{metrics.total - metrics.fullyComplete} INCOMPLETAS</span>
            </div>
          </div>
        </motion.div>

        {/* Unique Keys range */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0d0d0e]/60 border border-slate-200/50 dark:border-white/[0.04] p-4 flex flex-col justify-between group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 dark:opacity-[0.03] group-hover:opacity-20 dark:group-hover:opacity-[0.08] transition-opacity">
            <Compass className="w-16 h-16 text-slate-900 dark:text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {t("metrics.harmonic_ranges", "Variabilidade de Tons")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-sans text-amber-500 dark:text-amber-400 tracking-tight leading-none">
                {metrics.uniqueKeysCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                tons mapeados
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-tight truncate">
            {metrics.dominantKey !== "-" 
              ? `Dominante: tom ${metrics.dominantKey} (${metrics.dominantKeyCount} músicas)`
              : "Nenhum tom definido"}
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // CHORDS MODE
  if (mode === "chords") {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full"
      >
        {/* Chords count */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0d0d0e]/60 border border-slate-200/50 dark:border-white/[0.04] p-4 flex flex-col justify-between group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 dark:opacity-[0.03] group-hover:opacity-20 dark:group-hover:opacity-[0.08] transition-opacity">
            <Music2 className="w-16 h-16 text-slate-900 dark:text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {t("metrics.active_chords", "Cifras Cadastradas")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-sans text-indigo-600 dark:text-indigo-400 tracking-tight leading-none">
                {metrics.totalWithChords}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                cifras disponíveis
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-tight truncate">
            {metrics.chordsPct}% de cobertura no repertório geral
          </div>
        </motion.div>

        {/* Chords pending */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0d0d0e]/60 border border-slate-200/50 dark:border-white/[0.04] p-4 flex flex-col justify-between group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 dark:opacity-[0.03] group-hover:opacity-20 dark:group-hover:opacity-[0.08] transition-opacity">
            <FileWarning className="w-16 h-16 text-slate-900 dark:text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {t("metrics.pending_chords", "Cifras Pendentes")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-sans text-rose-500 dark:text-rose-400 tracking-tight leading-none">
                {metrics.missingChordsCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                músicas sem cifra
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] text-[11px] text-rose-500/80 dark:text-rose-400/80 font-semibold tracking-tight">
            {metrics.missingChordsCount > 0 
              ? `Requer atenção: ${metrics.missingChordsCount} músicas ativas sem cifras`
              : "Repertório 100% cifrado!"}
          </div>
        </motion.div>

        {/* BPM coverage */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0d0d0e]/60 border border-slate-200/50 dark:border-white/[0.04] p-4 flex flex-col justify-between group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 dark:opacity-[0.03] group-hover:opacity-20 dark:group-hover:opacity-[0.08] transition-opacity">
            <Activity className="w-16 h-16 text-slate-900 dark:text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {t("metrics.tempo_precision", "Metrônomo & BPM")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-sans text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                {metrics.bpmPct}%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                com andamento definido
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${metrics.bpmPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="bg-sky-500 h-full rounded-full"
              />
            </div>
            <div className="flex justify-between items-center mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
              <span>Alta Precisão de Andamento</span>
            </div>
          </div>
        </motion.div>

        {/* Key spectrum */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0d0d0e]/60 border border-slate-200/50 dark:border-white/[0.04] p-4 flex flex-col justify-between group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 dark:opacity-[0.03] group-hover:opacity-20 dark:group-hover:opacity-[0.08] transition-opacity">
            <Compass className="w-16 h-16 text-slate-900 dark:text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {t("metrics.harmonic_ranges", "Tom Dominante")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-sans text-amber-500 dark:text-amber-400 tracking-tight leading-none">
                {metrics.dominantKey}
              </span>
              {metrics.dominantKey !== "-" && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  tom de destaque
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-tight truncate">
            {metrics.dominantKey !== "-" 
              ? `O tom mais comum presente em ${metrics.dominantKeyCount} cifras`
              : "Defina tons para músicos modularem"}
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // LYRICS MODE
  if (mode === "lyrics") {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full"
      >
        {/* Total Lyrics */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0d0d0e]/60 border border-slate-200/50 dark:border-white/[0.04] p-4 flex flex-col justify-between group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 dark:opacity-[0.03] group-hover:opacity-20 dark:group-hover:opacity-[0.08] transition-opacity">
            <AlignLeft className="w-16 h-16 text-slate-900 dark:text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {t("metrics.registered_lyrics", "Letras Cadastradas")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-sans text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                {metrics.totalWithLyrics}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                músicas com letra
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-tight truncate">
            {metrics.lyricsPct}% de cobertura no repertório geral
          </div>
        </motion.div>

        {/* Hard Warning for Missing lyrics */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0d0d0e]/60 border border-slate-200/50 dark:border-white/[0.04] p-4 flex flex-col justify-between group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 dark:opacity-[0.03] group-hover:opacity-20 dark:group-hover:opacity-[0.08] transition-opacity">
            <FileWarning className="w-16 h-16 text-slate-900 dark:text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {t("metrics.pending_lyrics", "Letras Pendentes")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-sans text-amber-500 dark:text-amber-500 tracking-tight leading-none">
                {metrics.missingLyricsCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                músicas sem letra
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-tight">
            {metrics.missingLyricsCount > 0 
              ? `Atenção: ${metrics.missingLyricsCount} músicas ativas necessitam de importação`
              : "Todas as músicas ativas possuem letras!"}
          </div>
        </motion.div>

        {/* Structural Quality card */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0d0d0e]/60 border border-slate-200/50 dark:border-white/[0.04] p-4 flex flex-col justify-between group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 dark:opacity-[0.03] group-hover:opacity-20 dark:group-hover:opacity-[0.08] transition-opacity">
            <Layers className="w-16 h-16 text-slate-900 dark:text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {t("metrics.structured_sections", "Estruturação de Seções")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-sans text-emerald-600 dark:text-emerald-400 tracking-tight leading-none">
                {metrics.structuredLyricsPct}%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                com marcação de estrofes
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${metrics.structuredLyricsPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="bg-emerald-500 dark:bg-emerald-400 h-full rounded-full"
              />
            </div>
            <div className="flex justify-between items-center mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
              <span>Melhora Legibilidade Contínua</span>
            </div>
          </div>
        </motion.div>

        {/* Integration suggestions count or status */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0d0d0e]/60 border border-slate-200/50 dark:border-white/[0.04] p-4 flex flex-col justify-between group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 dark:opacity-[0.03] group-hover:opacity-20 dark:group-hover:opacity-[0.08] transition-opacity">
            <ListRestart className="w-16 h-16 text-slate-900 dark:text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {t("metrics.lyrics_status", "Biblioteca Sincronizada")}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-sans text-indigo-500 dark:text-indigo-400 tracking-tight leading-none">
                Ativa
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] text-[11px] text-slate-400 dark:text-slate-500 font-bold tracking-tight uppercase truncate">
            {metrics.totalWithLyrics} Letras prontas para projeção
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return null;
};
