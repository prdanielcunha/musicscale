import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  Minus,
  Music2,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { PopulatedSong } from "../../types";
import {
  isValidKey,
  transposeChord,
  transposeChordDocument,
} from "../../utils/chordEngine";
import {
  buildSongParts,
  getFocusedSongParts,
  type SongPart,
  type SongPartInstrument,
  type SongPartKind,
} from "./songParts";

interface TechnicalPartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: PopulatedSong | null;
  focusAssignmentNames?: string[];
  onOpenPerformance?: () => void;
}

const KIND_KEYS: Record<SongPartKind, string> = {
  solo: "solo",
  riff: "riff",
  instrumental: "instrumental",
  interlude: "interlude",
  intro: "intro",
  outro: "outro",
  technical: "technical",
};

const INSTRUMENT_KEYS: Record<SongPartInstrument, string> = {
  guitar: "guitar",
  acoustic_guitar: "acoustic_guitar",
  bass: "bass",
  keys: "keys",
  piano: "piano",
  synth: "synth",
  drums: "drums",
  sax: "sax",
  violin: "violin",
  strings: "strings",
  other: "other",
  unknown: "unknown",
};

const TechnicalPartsModal: React.FC<TechnicalPartsModalProps> = ({
  isOpen,
  onClose,
  song,
  focusAssignmentNames,
  onOpenPerformance,
}) => {
  const { t } = useTranslation();
  const parts = useMemo(() => buildSongParts(song), [song]);
  const focusedParts = useMemo(
    () => getFocusedSongParts(parts, focusAssignmentNames),
    [parts, focusAssignmentNames],
  );
  const [focusMode, setFocusMode] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [transpose, setTranspose] = useState(0);

  const hasPersonalFocus = focusedParts.length > 0;
  const visibleParts =
    focusMode && hasPersonalFocus ? focusedParts : parts;
  const safeIndex = activeIndex < visibleParts.length ? activeIndex : 0;
  const activePart: SongPart | undefined = visibleParts[safeIndex];

  const assignmentLabel = useMemo(
    () =>
      Array.from(
        new Set(
          (focusAssignmentNames || [])
            .map((name) => name.trim())
            .filter(Boolean),
        ),
      ).join(" · "),
    [focusAssignmentNames],
  );

  useEffect(() => {
    setFocusMode(true);
    setActiveIndex(0);
    setTranspose(0);
  }, [song?.id, assignmentLabel]);

  useEffect(() => {
    setActiveIndex(0);
    setTranspose(0);
  }, [focusMode]);

  useEffect(() => {
    setTranspose(0);
  }, [safeIndex]);

  const baseKey = useMemo(() => {
    if (!song) return "";
    const metadataKey =
      typeof song.metadata?.chordContentKey === "string"
        ? song.metadata.chordContentKey
        : "";
    if (metadataKey && isValidKey(metadataKey)) return metadataKey;

    return song.key || song.selectedKey || song.originalKey || "";
  }, [song]);

  const canTranspose = Boolean(
    activePart &&
      (activePart.format === "chords" || activePart.format === "mixed") &&
      baseKey &&
      isValidKey(baseKey),
  );

  const effectiveKey = useMemo(() => {
    if (!baseKey || !isValidKey(baseKey)) return "";
    return transposeChord(baseKey, transpose);
  }, [baseKey, transpose]);

  const visibleContent = useMemo(() => {
    if (!activePart) return "";
    if (!canTranspose || transpose === 0 || !effectiveKey) {
      return activePart.content;
    }

    try {
      return transposeChordDocument(
        activePart.content,
        baseKey,
        effectiveKey,
      ).chords;
    } catch {
      return activePart.content;
    }
  }, [activePart, baseKey, canTranspose, effectiveKey, transpose]);

  if (!song || parts.length === 0 || !activePart) return null;

  const kindLabel = t(
    `technicalParts.kind.${KIND_KEYS[activePart.kind]}`,
    activePart.kind,
  );
  const instrumentLabel =
    activePart.instrument === "unknown"
      ? null
      : t(
          `technicalParts.instrument.${INSTRUMENT_KEYS[activePart.instrument]}`,
          activePart.instrument,
        );
  const formatLabel = t(
    `technicalParts.format.${activePart.format}`,
    activePart.format,
  );

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

          <header className="relative z-10 min-h-20 md:min-h-24 px-4 md:px-7 py-3 flex items-center border-b border-white/[0.06] bg-[#08080B]/80 backdrop-blur-2xl">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 md:w-11 md:h-11 rounded-full border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-white/75 hover:text-white flex items-center justify-center transition-all active:scale-95"
              aria-label={t("technicalParts.close")}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="min-w-0 flex-1 px-4 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Sparkles className="w-3 h-3 text-indigo-300/70" />
                <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-300/70">
                  {t("technicalParts.eyebrow")}
                </p>
              </div>
              <h2 className="text-[17px] md:text-xl font-bold tracking-tight truncate mt-0.5">
                {song.title}
              </h2>
              <p className="text-[11px] md:text-xs text-white/40 truncate mt-0.5">
                {hasPersonalFocus
                  ? t("technicalParts.focus_detected_count", {
                      focus: focusedParts.length,
                      total: parts.length,
                    })
                  : t("technicalParts.detected_count", { count: parts.length })}
              </p>
            </div>

            <div className="w-10 md:w-11" aria-hidden />
          </header>

          <div className="relative z-10 flex-1 overflow-hidden flex flex-col">
            <div className="flex-none px-4 md:px-7 pt-5 pb-3">
              <div className="max-w-5xl mx-auto">
                {hasPersonalFocus && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-200/60">
                        {t("technicalParts.assignment_focus")}
                      </p>
                      {assignmentLabel && (
                        <p className="mt-0.5 text-[11px] text-white/30 truncate">
                          {assignmentLabel}
                        </p>
                      )}
                    </div>
                    {focusedParts.length < parts.length && (
                      <div className="inline-flex rounded-full border border-white/[0.07] bg-white/[0.025] p-1">
                        <button
                          type="button"
                          onClick={() => setFocusMode(true)}
                          className={`h-8 px-3 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] transition-all ${
                            focusMode
                              ? "bg-white text-black"
                              : "text-white/40 hover:text-white/75"
                          }`}
                        >
                          {t("technicalParts.my_focus")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFocusMode(false)}
                          className={`h-8 px-3 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] transition-all ${
                            !focusMode
                              ? "bg-white text-black"
                              : "text-white/40 hover:text-white/75"
                          }`}
                        >
                          {t("technicalParts.all_parts")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {visibleParts.map((part, index) => (
                  <button
                    type="button"
                    key={part.id}
                    onClick={() => setActiveIndex(index)}
                    className={`h-9 px-4 rounded-full border text-[10px] md:text-[11px] font-bold uppercase tracking-[0.12em] whitespace-nowrap transition-all ${
                      safeIndex === index
                        ? "bg-white text-black border-white shadow-[0_8px_24px_rgba(255,255,255,0.10)]"
                        : "bg-white/[0.035] border-white/[0.07] text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
                    }`}
                  >
                    {part.displayLabel}
                  </button>
                ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 md:px-7 pb-[max(2rem,env(safe-area-inset-bottom))]">
              <motion.div
                key={activePart.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="max-w-5xl mx-auto"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-indigo-300/10 bg-indigo-400/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-indigo-200/75">
                    {kindLabel}
                  </span>
                  {instrumentLabel && (
                    <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-white/45">
                      {instrumentLabel}
                    </span>
                  )}
                  <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-white/45">
                    {formatLabel}
                  </span>
                  {activePart.confidence && (
                    <span className="rounded-full border border-white/[0.05] px-3 py-1 text-[10px] font-semibold text-white/30">
                      {t("technicalParts.ai_classified")}
                    </span>
                  )}
                </div>

                {(activePart.contextBefore || activePart.contextAfter) && (
                  <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-[11px] md:text-xs">
                    <div className="min-w-0 text-white/35">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-white/20 mb-0.5">
                        {t("technicalParts.before")}
                      </span>
                      <span className="truncate block">
                        {activePart.contextBefore || "—"}
                      </span>
                    </div>
                    <Music2 className="w-4 h-4 shrink-0 text-indigo-300/45" />
                    <div className="min-w-0 text-right text-white/35">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-white/20 mb-0.5">
                        {t("technicalParts.after")}
                      </span>
                      <span className="truncate block">
                        {activePart.contextAfter || "—"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="rounded-[24px] md:rounded-[28px] border border-white/[0.07] bg-[#0D0D11]/88 shadow-[0_24px_80px_rgba(0,0,0,0.35)] overflow-hidden">
                  <div className="min-h-12 px-4 md:px-5 py-2.5 border-b border-white/[0.05] flex flex-wrap gap-3 items-center justify-between bg-white/[0.018]">
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/38 truncate">
                        {activePart.displayLabel}
                      </span>
                      {activePart.preservesFingering && (
                        <span className="block mt-0.5 text-[9px] font-semibold text-amber-100/35">
                          {t("technicalParts.original_fingering")}
                        </span>
                      )}
                    </div>

                    {canTranspose && (
                      <div className="flex items-center gap-1 rounded-full border border-white/[0.07] bg-black/25 p-1">
                        <button
                          type="button"
                          onClick={() => setTranspose((value) => value - 1)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
                          aria-label={t("technicalParts.transpose_down")}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <div className="min-w-14 text-center">
                          <span className="block text-[9px] uppercase tracking-[0.12em] text-white/25">
                            {t("technicalParts.key")}
                          </span>
                          <span className="block text-xs font-black text-white/85">
                            {effectiveKey}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTranspose((value) => value + 1)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
                          aria-label={t("technicalParts.transpose_up")}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        {transpose !== 0 && (
                          <button
                            type="button"
                            onClick={() => setTranspose(0)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white/35 hover:text-white hover:bg-white/[0.08] transition-colors"
                            aria-label={t("technicalParts.reset_key")}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <pre className="m-0 p-5 md:p-7 overflow-x-auto text-[13px] sm:text-[14px] md:text-[15px] leading-[1.8] font-mono font-semibold text-white/88 selection:bg-indigo-500/35 whitespace-pre">
                    {visibleContent}
                  </pre>
                </div>

                {activePart.preservesFingering && transpose !== 0 && (
                  <div className="mt-4 rounded-2xl border border-amber-400/10 bg-amber-400/[0.045] px-4 py-3 text-[11px] md:text-xs text-amber-100/60 leading-relaxed">
                    {t("technicalParts.key_notice")}
                  </div>
                )}

                {onOpenPerformance && song.chords && (
                  <button
                    type="button"
                    onClick={onOpenPerformance}
                    className="mt-4 w-full h-12 rounded-2xl border border-white/[0.08] bg-white/[0.045] hover:bg-white/[0.08] text-white/80 hover:text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {t("technicalParts.open_full_performance")}
                  </button>
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
