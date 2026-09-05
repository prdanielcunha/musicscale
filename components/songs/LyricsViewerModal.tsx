import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import type { PopulatedSong } from "../../types";
import {
  parseLyricsAndSections,
  buildSongSectionNavigatorItems,
} from "./ChordsRenderer";
import { 
  CopyIcon, X, Settings2, Play, Pause, 
  AlignLeft, AlignCenter, Type, Minus, Plus, Maximize, Minimize 
} from "lucide-react";

interface LyricsViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: PopulatedSong | null;
}

interface LyricsSettings {
  fontSize: number;
  align: 'left' | 'center';
  lineSpacing: 'normal' | 'relaxed' | 'loose';
}

const DEFAULT_SETTINGS: LyricsSettings = {
  fontSize: 20,
  align: 'left',
  lineSpacing: 'relaxed',
};

const MAX_AUTOSCROLL_FRAME_DELTA_MS = 100;
const AUTOSCROLL_BASELINE_FPS = 60;

const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(console.error);
    } else {
      await document.exitFullscreen().catch(console.error);
    }
  };

  return { isFullscreen, toggleFullscreen };
};

const LyricsViewerModal: React.FC<LyricsViewerModalProps> = ({
  isOpen,
  onClose,
  song,
}) => {
  const [settings, setSettings] = useState<LyricsSettings>(() => {
    const saved = localStorage.getItem("lyrics-viewer-settings");
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [showSettings, setShowSettings] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1.5);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(null);
  const parsedLyrics = useMemo(
    () => parseLyricsAndSections(song?.lyrics || ""),
    [song?.lyrics],
  );
  const sectionNavigatorItems = useMemo(
    () => buildSongSectionNavigatorItems(parsedLyrics),
    [parsedLyrics],
  );
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      setIsAutoScrolling(false);
      setShowSettings(false);
      setActiveSectionIndex(null);
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem("lyrics-viewer-settings", JSON.stringify(settings));
  }, [settings]);

  const updateSetting = <K extends keyof LyricsSettings>(
    key: K,
    value: LyricsSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateActiveSection = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    const scrollPos = container.scrollTop;
    const offset = 150;
    let closest: number | null = null;

    const keys = Array.from(sectionRefs.current.keys()) as number[];
    keys.sort((a, b) => a - b);
    for (const key of keys) {
      const element = sectionRefs.current.get(key);
      if (element && element.offsetTop <= scrollPos + offset) {
        closest = key;
      }
    }

    setActiveSectionIndex((current) => (current === closest ? current : closest));
  }, []);

  const scrollToSection = useCallback((sectionIndex: number) => {
    const container = contentRef.current;
    const target = sectionRefs.current.get(sectionIndex);
    if (!container || !target) return;

    setIsAutoScrolling(false);
    const top = Math.max(0, target.offsetTop - 132);
    container.scrollTo({ top, behavior: "smooth" });
    setActiveSectionIndex(sectionIndex);
  }, []);

  const handleCopy = () => {
    if (song?.lyrics) {
      navigator.clipboard.writeText(song.title + "\n\n" + song.lyrics);
    }
  };

  // Autoscroll Logic
  const autoScroll = useCallback((timestamp: number) => {
    const content = contentRef.current;
    if (!content || !isAutoScrolling) return;

    const previousTimestamp = lastFrameTimeRef.current;
    lastFrameTimeRef.current = timestamp;
    const elapsedMs = previousTimestamp === null
      ? 0
      : Math.min(
          Math.max(timestamp - previousTimestamp, 0),
          MAX_AUTOSCROLL_FRAME_DELTA_MS,
        );
    const pixelsPerSecond = scrollSpeed * AUTOSCROLL_BASELINE_FPS;
    content.scrollTop += (pixelsPerSecond / 1000) * elapsedMs;

    if (content.scrollTop + content.clientHeight >= content.scrollHeight - 1) {
      setIsAutoScrolling(false);
      animationFrameRef.current = null;
      lastFrameTimeRef.current = null;
      return;
    }

    animationFrameRef.current = requestAnimationFrame(autoScroll);
  }, [isAutoScrolling, scrollSpeed]);

  useEffect(() => {
    if (isAutoScrolling) {
      lastFrameTimeRef.current = null;
      animationFrameRef.current = requestAnimationFrame(autoScroll);
    } else {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      lastFrameTimeRef.current = null;
    }
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      lastFrameTimeRef.current = null;
    };
  }, [isAutoScrolling, autoScroll]);

  useEffect(() => {
    const resetAutoScrollClock = () => {
      lastFrameTimeRef.current = null;
    };

    document.addEventListener("visibilitychange", resetAutoScrollClock);
    return () =>
      document.removeEventListener("visibilitychange", resetAutoScrollClock);
  }, []);

  // Handle double tap to toggle fullscreen/nav logic if needed
  const [isNavVisible, setIsNavVisible] = useState(true);
  const navTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isAutoScrolling && isFullscreen) {
      navTimeoutRef.current = setTimeout(() => setIsNavVisible(false), 3000);
    } else {
      setIsNavVisible(true);
    }
    return () => {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    };
  }, [isAutoScrolling, isFullscreen]);

  const handleInteraction = () => {
    setIsNavVisible(true);
    if (isAutoScrolling && isFullscreen) {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = setTimeout(() => setIsNavVisible(false), 3000);
    }
  };

  if (!isOpen || !song) return null;

  const fontSizes = {
    normal: "leading-[1.6]",
    relaxed: "leading-[1.8]",
    loose: "leading-[2.2]",
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex flex-col bg-[#0A0A0C] isolate"
          onMouseMove={handleInteraction}
          onTouchStart={handleInteraction}
        >
          {/* Header */}
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: isNavVisible ? 0 : -100, opacity: isNavVisible ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="flex-none h-20 md:h-24 border-b border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between px-4 sm:px-6 bg-[#0A0A0C]/85 backdrop-blur-2xl absolute top-0 inset-x-0 z-20 shadow-sm"
          >
            <div className="flex flex-col min-w-0 flex-1">
              <h2 className="text-lg md:text-xl font-bold text-white tracking-tight truncate">
                {song.title}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-white/60 truncate tracking-wide mt-0.5">
                {song.artist}
              </p>
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                className={`w-10 h-10 md:w-11 md:h-11 rounded-full transition-all flex items-center justify-center border ${isAutoScrolling ? 'bg-[#34d399] text-black border-[#34d399] shadow-sm scale-105' : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border-white/5 shadow-sm'}`}
                title={isAutoScrolling ? "Pausar Rolagem" : "Rolagem Automática"}
              >
                {isAutoScrolling ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />}
              </button>
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`w-10 h-10 md:w-11 md:h-11 rounded-full transition-all flex items-center justify-center border ${showSettings ? 'bg-white text-black border-white shadow-md shadow-white/20' : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border-white/5 shadow-sm'}`}
                title="Configurações de Leitura"
              >
                <Settings2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                onClick={toggleFullscreen}
                className="hidden sm:flex w-10 h-10 md:w-11 md:h-11 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/5 transition-all shadow-sm"
                title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
              >
                {isFullscreen ? <Minimize className="w-4 h-4 md:w-5 md:h-5" /> : <Maximize className="w-4 h-4 md:w-5 md:h-5" />}
              </button>

              <div className="w-[1px] h-6 bg-white/10 mx-1"></div>

              <button
                onClick={onClose}
                className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/5 transition-all shadow-sm"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </motion.div>

          {sectionNavigatorItems.length > 1 && (
            <div className="absolute top-20 md:top-24 inset-x-0 z-[19] pointer-events-none">
              <div className="mx-auto max-w-4xl px-3 sm:px-6 pt-2">
                <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto hide-scrollbar rounded-full border border-white/[0.07] bg-[#0A0A0C]/[0.94] p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                  {sectionNavigatorItems.map((section) => (
                    <button
                      key={`${section.index}-${section.displayLabel}`}
                      type="button"
                      onClick={() => scrollToSection(section.index)}
                      className={`shrink-0 h-8 px-3.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.11em] transition-all active:scale-[0.97] ${
                        activeSectionIndex === section.index
                          ? "bg-white text-black"
                          : "text-white/45 hover:text-white/80 hover:bg-white/[0.055]"
                      }`}
                    >
                      {section.displayLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Settings Popover/Drawer */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="absolute top-20 right-4 sm:right-6 w-72 bg-[#1A1A1C]/95 border border-white/[0.08] shadow-2xl rounded-2xl z-30 p-5 origin-top-right backdrop-blur-3xl"
              >
                <div className="space-y-6">
                  {/* Font Size */}
                  <div>
                    <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Type className="w-3.5 h-3.5" /> Tamanho do Texto
                    </p>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => updateSetting('fontSize', Math.max(12, settings.fontSize - 2))}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className="flex-1 text-center font-mono text-sm font-bold text-white">
                        {settings.fontSize}px
                      </div>
                      <button 
                         onClick={() => updateSetting('fontSize', Math.min(64, settings.fontSize + 2))}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Alignment */}
                  <div>
                    <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">
                      Alinhamento
                    </p>
                    <div className="flex bg-white/5 p-1 rounded-xl">
                      <button
                        onClick={() => updateSetting('align', 'left')}
                        className={`flex-1 py-2 flex justify-center items-center rounded-lg transition-all ${settings.align === 'left' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
                      >
                        <AlignLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateSetting('align', 'center')}
                        className={`flex-1 py-2 flex justify-center items-center rounded-lg transition-all ${settings.align === 'center' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
                      >
                        <AlignCenter className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Auto-scroll speed */}
                  <div>
                    <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">
                      Velocidade da Rolagem
                    </p>
                    <input 
                      type="range" 
                      min="0.2" 
                      max="4" 
                      step="0.1" 
                      value={scrollSpeed}
                      onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
                      className="w-full accent-[#34d399]"
                    />
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <button 
                      onClick={handleCopy}
                      className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/90 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <CopyIcon className="w-4 h-4" /> Copiar Letra
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Body/Content */}
          <div 
            ref={contentRef}
            className={`flex-1 overflow-y-auto overscroll-y-contain px-4 sm:px-8 ${sectionNavigatorItems.length > 1 ? "pt-36 sm:pt-40" : "pt-24 sm:pt-32"} pb-[50vh] z-0 ${settings.align === 'center' ? 'text-center' : 'text-left'}`}
            onScroll={updateActiveSection}
            onClick={() => showSettings && setShowSettings(false)}
          >
            <div className={`max-w-4xl mx-auto transition-all duration-300`}>
              <div 
                className={`whitespace-pre-wrap font-sans text-white/95 font-semibold tracking-tight ${fontSizes[settings.lineSpacing]}`}
                style={{ fontSize: `${settings.fontSize}px`, textShadow: "0 1px 2px rgba(0,0,0,0.1)" }}
              >
                {parsedLyrics.length > 0 ? (
                  parsedLyrics.map((line, index) =>
                    line.type === "section" ? (
                      <div
                        key={`section-${index}`}
                        ref={(element) => {
                          if (element) sectionRefs.current.set(index, element);
                          else sectionRefs.current.delete(index);
                        }}
                        className="inline-flex items-center px-3 py-1.5 mt-8 mb-4 rounded-xl border border-white/[0.08] bg-white/[0.05] text-[0.72em] font-black uppercase tracking-[0.10em] text-indigo-200"
                      >
                        {line.content.replace(/^\[?|\]?:?$/g, "")}
                      </div>
                    ) : (
                      <div
                        key={`lyric-${index}`}
                        className={line.content.trim() === "" ? "h-[1.2em]" : ""}
                      >
                        {line.content || " "}
                      </div>
                    ),
                  )
                ) : (
                  <span className="italic text-white/50">
                    Nenhuma letra cadastrada para esta música.
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Subtle gradient overlay at bottom to indicate scrollable content */}
          <div className="absolute inset-x-0 bottom-0 h-16 sm:h-24 bg-gradient-to-t from-[#0A0A0C] to-transparent pointer-events-none z-10" />
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default LyricsViewerModal;
