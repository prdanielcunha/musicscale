import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import type { PopulatedSong } from "../../types";

interface TechnicalPartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: PopulatedSong | null;
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const TechnicalPartsModal: React.FC<TechnicalPartsModalProps> = ({
  isOpen,
  onClose,
  song,
}) => {
  const { t } = useTranslation();
  const parts = useMemo(
    () => (song?.tabs || []).filter((part) => part?.content?.trim()),
    [song?.tabs],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = activeIndex < parts.length ? activeIndex : 0;
  const activePart = parts[safeIndex];

  if (!song || parts.length === 0) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[160] bg-[#060608] text-white flex flex-col isolate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[38rem] h-[22rem] rounded-full bg-indigo-500/[0.08] blur-[110px]" />
            <div className="absolute bottom-[-12rem] right-[-8rem] w-[28rem] h-[28rem] rounded-full bg-violet-500/[0.05] blur-[120px]" />
          </div>

          <header className="relative z-10 h-20 md:h-24 px-4 md:px-7 flex items-center border-b border-white/[0.06] bg-[#08080B]/80 backdrop-blur-2xl">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 md:w-11 md:h-11 rounded-full border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-white/75 hover:text-white flex items-center justify-center transition-all active:scale-95"
              aria-label={t("technicalParts.close", "Fechar partes técnicas")}
            >
              <CloseIcon />
            </button>

            <div className="min-w-0 flex-1 px-4 text-center">
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-300/70">
                {t("technicalParts.eyebrow", "Partes técnicas")}
              </p>
              <h2 className="text-[17px] md:text-xl font-bold tracking-tight truncate mt-0.5">
                {song.title}
              </h2>
              <p className="text-[11px] md:text-xs text-white/40 truncate mt-0.5">
                {song.artist}
              </p>
            </div>

            <div className="w-10 md:w-11" aria-hidden />
          </header>

          <div className="relative z-10 flex-1 overflow-hidden flex flex-col">
            <div className="flex-none px-4 md:px-7 pt-5 pb-3">
              <div className="max-w-5xl mx-auto flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {parts.map((part, index) => (
                  <button
                    type="button"
                    key={`${part.section || "part"}-${index}`}
                    onClick={() => setActiveIndex(index)}
                    className={`h-9 px-4 rounded-full border text-[10px] md:text-[11px] font-bold uppercase tracking-[0.12em] whitespace-nowrap transition-all ${
                      safeIndex === index
                        ? "bg-white text-black border-white shadow-[0_8px_24px_rgba(255,255,255,0.10)]"
                        : "bg-white/[0.035] border-white/[0.07] text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
                    }`}
                  >
                    {part.section || t("technicalParts.part", "Parte")}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 md:px-7 pb-[max(2rem,env(safe-area-inset-bottom))]">
              <motion.div
                key={safeIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="max-w-5xl mx-auto"
              >
                <div className="rounded-[24px] md:rounded-[28px] border border-white/[0.07] bg-[#0D0D11]/88 shadow-[0_24px_80px_rgba(0,0,0,0.35)] overflow-hidden">
                  <div className="h-12 px-4 md:px-5 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.018]">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">
                      {activePart?.section || t("technicalParts.part", "Parte")}
                    </span>
                    <span className="text-[10px] font-semibold text-white/28">
                      {t("technicalParts.original_fingering", "Digitação original")}
                    </span>
                  </div>
                  <pre className="m-0 p-5 md:p-7 overflow-x-auto text-[13px] sm:text-[14px] md:text-[15px] leading-[1.8] font-mono font-semibold text-white/88 selection:bg-indigo-500/35">
                    {activePart?.content}
                  </pre>
                </div>

                {song.originalKey && song.key && song.originalKey !== song.key && (
                  <div className="mt-4 rounded-2xl border border-amber-400/10 bg-amber-400/[0.045] px-4 py-3 text-[11px] md:text-xs text-amber-100/60 leading-relaxed">
                    {t(
                      "technicalParts.key_notice",
                      "Esta parte técnica preserva a digitação original. A cifra atual pode estar em outro tom.",
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default TechnicalPartsModal;
