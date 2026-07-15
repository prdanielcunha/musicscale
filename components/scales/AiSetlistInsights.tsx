import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { SetlistIntelligence } from "../../services/aiDirector";
import Spinner from "../common/Spinner";

interface AiSetlistInsightsProps {
  insights: SetlistIntelligence | null;
  isAnalyzing: boolean;
  onClose?: () => void;
}

export const AiSetlistInsights: React.FC<AiSetlistInsightsProps> = ({
  insights,
  isAnalyzing,
  onClose,
}) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0, scale: 0.95 }}
        animate={{ opacity: 1, height: "auto", scale: 1 }}
        exit={{ opacity: 0, height: 0, scale: 0.95 }}
        className="overflow-hidden w-full"
      >
        <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 backdrop-blur-xl border border-indigo-100/50 dark:border-indigo-500/10 rounded-3xl p-5 md:p-6 mb-6 shadow-sm-soft relative shadow-inner">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <div className="px-2 py-0.5 rounded-full bg-indigo-100/50 dark:bg-indigo-900/30 text-[10px] uppercase tracking-widest font-bold text-indigo-500 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/20">
              AI Director
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-400"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-6">
              <Spinner size="md" />
              <p className="mt-4 text-[13px] font-medium text-indigo-600/70 dark:text-indigo-400/70 animate-pulse">
                Analisando padrão congregacional...
              </p>
            </div>
          ) : insights ? (
            <div className="space-y-6">
              {/* Score & Feedback */}
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative shrink-0 flex items-center justify-center">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      className="text-indigo-100 dark:text-indigo-950/40"
                    />
                    <motion.circle
                      initial={{ strokeDasharray: "0 251.2" }}
                      animate={{
                        strokeDasharray: `${(insights.healthScore / 100) * 251.2} 251.2`,
                      }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      strokeLinecap="round"
                      className="text-indigo-500 dark:text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                      {insights.healthScore}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                      Score
                    </span>
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left space-y-2">
                  <h4 className="text-[17px] font-bold text-slate-900 dark:text-white tracking-tight">
                    Worship Health Score
                  </h4>
                  <p className="text-[14px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    {insights.feedback}
                  </p>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-indigo-100/30 dark:border-indigo-500/10">
                {Object.entries(insights.metrics).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-white/5"
                  >
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      {key}
                    </span>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${value}%` }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className="h-full bg-indigo-500 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Suggestions & Learning */}
              {insights.suggestions && insights.suggestions.length > 0 && (
                <div className="pt-2">
                  <h5 className="text-[12px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Sugestões de Direção Musical
                  </h5>
                  <div className="space-y-2">
                    {insights.suggestions.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/40 dark:border-white/5"
                      >
                        <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2"></div>
                        <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                          {s.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insights.learningInsight && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/10 dark:border-indigo-500/20">
                  <svg
                    className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  <p className="text-[13px] text-indigo-900 dark:text-indigo-200 font-medium italic">
                    "{insights.learningInsight}"
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
