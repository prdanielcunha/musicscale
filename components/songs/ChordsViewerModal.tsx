import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import type { PopulatedSong } from "../../types";
import Button from "../common/Button";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { KeyIcon } from "../icons/KeyIcon";
import { BpmIcon } from "../icons/BpmIcon";
import Spinner from "../common/Spinner";
import { SettingsIcon } from "../icons/SettingsIcon";
import { useApi } from "../../contexts/ApiContext";
import { ChevronLeftIcon } from "../icons/ChevronLeftIcon";
import { ChevronRightIcon } from "../icons/ChevronRightIcon";
import { FullscreenIcon } from "../icons/FullscreenIcon";
import { FullscreenExitIcon } from "../icons/FullscreenExitIcon";
import { useTranslation } from "react-i18next";
import {
  savePerformanceState,
  getPerformanceState,
} from "../../services/offline/database";
import { getSafeRecoveryScrollPosition } from "../../utils/performanceRecovery";
import { useMusic } from "../../contexts/MusicDataContext";
import { useModals } from "../../contexts/ModalContext";
import { AiContextualSuggestions } from "../scales/AiContextualSuggestions";
import { LiveWorshipDirector } from "./LiveWorshipDirector";
import { useLiveWorshipSession } from "../../hooks/useLiveWorshipSession";
import { useLiveDirectionFollow } from "../../hooks/useLiveDirectionFollow";
import { ScaleSongNavigation, ScaleSongNavigationMobile } from "./ScaleSongNavigation";

// --- Adaptive UI & Battery Detection (Experimental API) ---
const useAdaptivePerformance = () => {
  const [isPowerSave, setIsPowerSave] = useState(false);

  useEffect(() => {
    let battery: any;
    const updateBatteryStatus = (b: any) => {
      if (b.level <= 0.2 || b.savePower) setIsPowerSave(true);
      else setIsPowerSave(false);
    };

    if ("getBattery" in navigator) {
      (navigator as any).getBattery().then((b: any) => {
        battery = b;
        updateBatteryStatus(b);
        b.addEventListener("levelchange", () => updateBatteryStatus(b));
      });
    }
  }, []);

  return { isPowerSave };
};

const PlayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-6 h-6"
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
      clipRule="evenodd"
    />
  </svg>
);
const PauseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-6 h-6"
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75V5.25z"
      clipRule="evenodd"
    />
  </svg>
);
const CloseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);
const EditIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-5 h-5"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
    />
  </svg>
);

import {
  getNotesArray,
  parseKey,
  getKeyDifference,
  transposeChord,
  isChordLine,
  parseChordsAndLyrics,
  lightThemeColors,
  darkThemeColors
} from "./ChordsRenderer";

const fontFamilies = [
  { name: "Mono", class: "font-mono" },
  { name: "Modern", class: "font-sans" },
  { name: "Editorial", class: "font-serif" },
];

const defaultSettings = {
  fontSize: 24,
  fontFamily: "font-sans",
  lyricsColorIndex: 0,
  chordsColorIndex: 0,
};

const MAX_AUTOSCROLL_FRAME_DELTA_MS = 100;
const TAP_MOVEMENT_TOLERANCE_PX = 18;
const DOUBLE_TAP_MAX_DISTANCE_PX = 36;
const DOUBLE_TAP_INTERVAL_MS = 300;

const ColorPicker: React.FC<{
  label: string;
  colors: string[];
  selectedColor: string;
  onSelect: (color: string) => void;
}> = ({ label, colors, selectedColor, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      )
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={pickerRef}
      className="relative flex items-center justify-between w-full"
    >
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-8 h-8 rounded-full border border-slate-200 dark:border-white/10 shrink-0 outline-none ring-offset-2 dark:ring-offset-slate-900 focus:ring-2 focus:ring-primary/50 transition-transform hover:scale-105"
        style={{ backgroundColor: selectedColor || "#000000" }}
      />
      {isOpen && (
        <div className="absolute right-0 bottom-12 p-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl flex flex-wrap gap-2 w-48 z-10 animate-scale-in">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(color);
                setIsOpen(false);
              }}
              className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${(selectedColor || "").toLowerCase() === color.toLowerCase() ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-800" : ""}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ChordsViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: PopulatedSong | null;
  onSave: (data: { songId: string; chords: string }) => Promise<void>;
  onSongUpdate?: (updatedSong: PopulatedSong) => void;
  isSubmitting: boolean;
  scaleContext: {
    scaleId?: string;
    songs: PopulatedSong[];
    currentIndex: number;
  } | null;
  onNavigate: (direction: "next" | "previous" | number) => void;
}

const ChordsViewerModal: React.FC<ChordsViewerModalProps> = ({
  isOpen,
  onClose,
  song,
  onSave,
  onSongUpdate,
  isSubmitting,
  scaleContext,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { user, permissions, userProfile, effectiveOrganizationId } = useAuth();
  const { theme } = useTheme();
  const { songs: librarySongs } = useMusic();
  const api = useApi();
  const { isPowerSave } = useAdaptivePerformance();

  const canManageChords = !!(permissions?.manageSongs || permissions?.manageChords || permissions?.['musicscale.chords.edit']);
  const { openPersistedChordKeyRepair } = useModals();
  const canRepairChordKey = !!(permissions?.['musicscale.songs.edit'] || permissions?.manageSongs || permissions?.['musicScale.manageSongs']);

  const { lyrics: lyricsPalette, chords: chordsPalette } = useMemo(
    () => (theme === "dark" ? darkThemeColors : lightThemeColors),
    [theme],
  );

  const [settings, setSettings] = useState(() => ({
    ...defaultSettings,
    ...(userProfile?.chordViewerSettings || {}),
  }));
  const activeLyricsColor =
    lyricsPalette[settings.lyricsColorIndex ?? 0] || lyricsPalette[0];
  const activeChordsColor =
    chordsPalette[settings.chordsColorIndex ?? 0] || chordsPalette[0];

  const [transpose, setTranspose] = useState(0);
  const { liveSession, isLeader, changeKeyOverride } = useLiveWorshipSession(
    scaleContext?.scaleId,
  );
  const { isFollowingDirection } = useLiveDirectionFollow(scaleContext?.scaleId);

  useEffect(() => {
    if (song && liveSession?.keyOverrides?.[song.id]) {
      const targetKey = liveSession.keyOverrides[song.id];
      const diff = getKeyDifference(song.key, targetKey);
      setTranspose(diff);
    } else {
      setTranspose(0);
    }
  }, [song, liveSession?.keyOverrides]);

  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [speedLevel, setSpeedLevel] = useState(3);
  const [isEditing, setIsEditing] = useState(false);
  const [editedChords, setEditedChords] = useState("");

  const [isUIVisible, setIsUIVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<"none" | "font">("none");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(
          `Error attempting to enable full-screen mode: ${err.message} (${err.name})`,
        );
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const scaleRef = useRef<number>(1);
  const initialPinchDistRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const lastTapXRef = useRef<number | null>(null);
  const lastTapYRef = useRef<number | null>(null);
  const touchGestureHadMultiplePointersRef = useRef(false);

  const [isWorshipFlow, setIsWorshipFlow] = useState(false);

  useEffect(() => {
    if (liveSession?.mode === 'worship') {
        setIsWorshipFlow(true);
    } else if (liveSession?.mode === 'rehearsal') {
        setIsWorshipFlow(false);
    }
  }, [liveSession?.mode]);

  const clearTapCandidate = () => {
    lastTapRef.current = 0;
    lastTapXRef.current = null;
    lastTapYRef.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAutoScrolling) {
      setIsAutoScrolling(false);
    }

    if (e.touches.length === 1) {
      touchGestureHadMultiplePointersRef.current = false;
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    } else {
      touchGestureHadMultiplePointersRef.current = true;
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      clearTapCandidate();

      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        initialPinchDistRef.current = dist;
        scaleRef.current = settings.fontSize;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1) {
      touchGestureHadMultiplePointersRef.current = true;
      clearTapCandidate();
    }

    if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
      e.preventDefault();
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const delta = currentDist - initialPinchDistRef.current;

      const newSize = Math.min(
        Math.max(12, scaleRef.current + delta * 0.05),
        48,
      );

      if (Math.abs(newSize - settings.fontSize) > 1) {
        handleSettingsChange({ fontSize: Math.round(newSize) });
      }
    }
  };

  const [showWorshipFlowBadge, setShowWorshipFlowBadge] = useState(false);

  const handleTouchEnd = (e: React.TouchEvent) => {
    initialPinchDistRef.current = null;

    const finishTouchGesture = () => {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      if (e.touches.length === 0) {
        touchGestureHadMultiplePointersRef.current = false;
      }
    };

    const changedTouch = e.changedTouches[0];
    if (
      !changedTouch ||
      touchGestureHadMultiplePointersRef.current ||
      touchStartXRef.current === null ||
      touchStartYRef.current === null
    ) {
      clearTapCandidate();
      finishTouchGesture();
      return;
    }

    const touchEndX = changedTouch.clientX;
    const touchEndY = changedTouch.clientY;
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;
    const movement = Math.hypot(deltaX, deltaY);
    const isStationaryTap = movement <= TAP_MOVEMENT_TOLERANCE_PX;

    const now = Date.now();
    if (isStationaryTap) {
      const hasPreviousTap =
        lastTapRef.current > 0 &&
        lastTapXRef.current !== null &&
        lastTapYRef.current !== null;
      const previousTapDistance = hasPreviousTap
        ? Math.hypot(
            touchEndX - lastTapXRef.current!,
            touchEndY - lastTapYRef.current!,
          )
        : Number.POSITIVE_INFINITY;

      if (
        hasPreviousTap &&
        now - lastTapRef.current < DOUBLE_TAP_INTERVAL_MS &&
        previousTapDistance <= DOUBLE_TAP_MAX_DISTANCE_PX
      ) {
        setIsWorshipFlow((prev) => {
          const next = !prev;
          if (next) {
            setShowWorshipFlowBadge(true);
            setTimeout(() => setShowWorshipFlowBadge(false), 3000);
          }
          return next;
        });
        if (!document.fullscreenElement && !isWorshipFlow) {
          toggleFullscreen();
        }
        clearTapCandidate();
        finishTouchGesture();
        return;
      }

      lastTapRef.current = now;
      lastTapXRef.current = touchEndX;
      lastTapYRef.current = touchEndY;
    } else {
      clearTapCandidate();
    }

    const swipeThreshold = isWorshipFlow ? 120 : 60;
    const maxVerticalDrift = 60;

    if (
      Math.abs(deltaX) > swipeThreshold &&
      Math.abs(deltaY) < maxVerticalDrift
    ) {
      if (deltaX > 0 && scaleContext && scaleContext.currentIndex > 0) {
        onNavigate("previous");
      } else if (
        deltaX < 0 &&
        scaleContext &&
        scaleContext.currentIndex < scaleContext.songs.length - 1
      ) {
        onNavigate("next");
      }
    }
    finishTouchGesture();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        isEditing ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const scrollAmount = window.innerHeight * 0.6;
      const scrollContainer = scrollContainerRef.current;

      const goNext = () => {
        if (scaleContext && scaleContext.currentIndex < scaleContext.songs.length - 1) {
          onNavigate("next");
        }
      };

      const goPrev = () => {
        if (scaleContext && scaleContext.currentIndex > 0) {
          onNavigate("previous");
        }
      };

      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }

      if (scrollContainer && (e.key === "ArrowDown" || e.key === "PageDown")) {
        e.preventDefault();
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        if (scrollTop + clientHeight >= scrollHeight - 20) {
          goNext();
        } else {
          scrollContainer.scrollBy({ top: scrollAmount, behavior: "smooth" });
        }
        return;
      }

      if (scrollContainer && (e.key === "ArrowUp" || e.key === "PageUp")) {
        e.preventDefault();
        const { scrollTop } = scrollContainer;
        if (scrollTop <= 10) {
          goPrev();
        } else {
          scrollContainer.scrollBy({ top: -scrollAmount, behavior: "smooth" });
        }
        return;
      }

      if (e.key === " ") {
          e.preventDefault();
          setIsAutoScrolling((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isEditing, scaleContext, onNavigate]);

  useEffect(() => {
    if (!isOpen) return;

    let disposed = false;
    let wakeLock: any = null;
    let requestInFlight = false;

    const releaseWakeLock = (sentinel: any) => {
      if (!sentinel) return;
      sentinel.release().catch(console.warn);
    };

    const requestWakeLock = async () => {
      if (
        disposed ||
        requestInFlight ||
        document.visibilityState !== "visible" ||
        !("wakeLock" in navigator)
      ) {
        return;
      }

      requestInFlight = true;
      try {
        const sentinel = await (navigator as any).wakeLock.request("screen");

        if (disposed) {
          releaseWakeLock(sentinel);
          return;
        }

        if (wakeLock && wakeLock !== sentinel) {
          releaseWakeLock(wakeLock);
        }
        wakeLock = sentinel;
      } catch (err: any) {
        if (!disposed) {
          console.warn(`WakeLock error: ${err.name}, ${err.message}`);
        }
      } finally {
        requestInFlight = false;
      }
    };

    void requestWakeLock();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      const currentWakeLock = wakeLock;
      wakeLock = null;
      releaseWakeLock(currentWakeLock);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isOpen]);

  const scrollAnimationRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const scrollPosRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const resetAutoScrollClock = () => {
      lastTimeRef.current = undefined;
      if (scrollContainerRef.current) {
        scrollPosRef.current = scrollContainerRef.current.scrollTop;
      }
    };

    document.addEventListener("visibilitychange", resetAutoScrollClock);
    return () =>
      document.removeEventListener("visibilitychange", resetAutoScrollClock);
  }, [isOpen]);

  const [activeSection, setActiveSection] = useState<string>("");
  const sectionRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  const saveScrollTimeoutRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollPos = container.scrollTop;
    const organizationId = effectiveOrganizationId;
    const songId = song?.id;
    const scaleId = scaleContext?.scaleId;

    if (organizationId && songId) {
      if (saveScrollTimeoutRef.current) {
        window.clearTimeout(saveScrollTimeoutRef.current);
      }
      saveScrollTimeoutRef.current = window.setTimeout(() => {
        saveScrollTimeoutRef.current = null;
        void savePerformanceState({
          organizationId,
          songId,
          scaleId,
          scrollPosition: scrollPos,
        });
        window.dispatchEvent(new Event("musicscale:local_save"));
      }, 1000);
    }

    let closestSection = "";
    const offset = 150;

    const keys = Array.from(sectionRefs.current.keys()).sort(
      (a: number, b: number) => a - b,
    );
    for (const key of keys) {
      const el = sectionRefs.current.get(key);
      if (el && el.offsetTop <= scrollPos + offset) {
        closestSection = el.innerText;
      }
    }

    if (closestSection && closestSection !== activeSection) {
      setActiveSection(closestSection);
    }
  }, [activeSection, effectiveOrganizationId, song?.id, scaleContext?.scaleId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    return () => {
      if (saveScrollTimeoutRef.current) {
        window.clearTimeout(saveScrollTimeoutRef.current);
        saveScrollTimeoutRef.current = null;
      }
    };
  }, [effectiveOrganizationId, song?.id, scaleContext?.scaleId]);

  useEffect(() => {
    if (!isOpen) return;

    const organizationId = effectiveOrganizationId;
    const songId = song?.id;
    const scaleId = scaleContext?.scaleId;
    let cancelled = false;
    let restoreFrame: number | null = null;
    let restoreFallback: number | null = null;

    const setScrollPosition = (position: number) => {
      if (cancelled || !scrollContainerRef.current) return;
      scrollContainerRef.current.scrollTop = position;
    };

    const restoreState = async () => {
      if (!organizationId || !songId) {
        setScrollPosition(0);
        return;
      }

      try {
        const state = await getPerformanceState();
        if (cancelled) return;

        const scrollPosition = getSafeRecoveryScrollPosition(state, {
          organizationId,
          songId,
          scaleId,
        });

        if (scrollPosition > 0) {
          restoreFrame = requestAnimationFrame(() => {
            setScrollPosition(scrollPosition);
            restoreFallback = window.setTimeout(() => {
              setScrollPosition(scrollPosition);
            }, 50);
          });
        } else {
          setScrollPosition(0);
        }
      } catch (e) {
        setScrollPosition(0);
      }
    };

    setIsAutoScrolling(false);
    setIsEditing(false);
    setEditedChords("");
    setIsUIVisible(true);
    setActiveTab("none");
    void restoreState();

    return () => {
      cancelled = true;
      if (restoreFrame !== null) cancelAnimationFrame(restoreFrame);
      if (restoreFallback !== null) window.clearTimeout(restoreFallback);
    };
  }, [song?.id, scaleContext?.scaleId, effectiveOrganizationId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      if (userProfile)
        setSettings({
          ...defaultSettings,
          ...(userProfile.chordViewerSettings || {}),
        });
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen, userProfile]);

  useEffect(() => {
    if (speedLevel === 0) setIsAutoScrolling(false);
  }, [speedLevel]);

  const scrollStep = useCallback(
    (timestamp: number) => {
      if (!isAutoScrolling) return;
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;
      
      if (lastTimeRef.current === undefined) lastTimeRef.current = timestamp;
      const elapsed = Math.min(
        Math.max(timestamp - lastTimeRef.current, 0),
        MAX_AUTOSCROLL_FRAME_DELTA_MS,
      );

      const pxPerSecond = speedLevel > 0 ? 15 + Math.pow(speedLevel, 2.2) * 8 : 0;
      const scrollDelta = (pxPerSecond / 1000) * elapsed;
      
      scrollPosRef.current += scrollDelta;
      scrollContainer.scrollTop = Math.round(scrollPosRef.current);

      if (
        scrollContainer.scrollTop + scrollContainer.clientHeight >=
        scrollContainer.scrollHeight - 1
      ) {
        setIsAutoScrolling(false);
        return;
      }
      
      lastTimeRef.current = timestamp;
      scrollAnimationRef.current = requestAnimationFrame(scrollStep);
    },
    [speedLevel, isAutoScrolling],
  );

  useEffect(() => {
    if (isAutoScrolling && scrollContainerRef.current) {
      scrollPosRef.current = scrollContainerRef.current.scrollTop;
      lastTimeRef.current = undefined;
      scrollAnimationRef.current = requestAnimationFrame(scrollStep);
    } else {
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
        scrollAnimationRef.current = undefined;
      }
    }
    return () => {
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
        scrollAnimationRef.current = undefined;
      }
    };
  }, [isAutoScrolling, scrollStep]);

  const handleSettingsChange = (newSettingsPart: Partial<typeof settings>) => {
    const newSettings = { ...settings, ...newSettingsPart };
    setSettings(newSettings);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(async () => {
      if (user && api) {
        await api.users.update(user.uid, { chordViewerSettings: newSettings });
        window.dispatchEvent(new Event("musicscale:local_save"));
      }
    }, 1500);
  };

  const handleSafeClose = () => {
    if (isWorshipFlow || liveSession?.mode === "worship") {
      if (
        !window.confirm(
          "Você está em modo Performance/Culto.\n\nTem certeza que deseja sair agora?",
        )
      ) {
        return;
      }
    }
    if (song?.id && scrollContainerRef.current) {
      sessionStorage.setItem(
        `scroll_${song.id}`,
        scrollContainerRef.current.scrollTop.toString(),
      );
    }
    onClose();
  };

  const handleScreenClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    if (
      (e.target as HTMLElement).closest("button, .dock, .top-bar, .popup-panel")
    )
      return;

    if (isWorshipFlow) {
      setShowWorshipFlowBadge(true);
      setTimeout(() => setShowWorshipFlowBadge(false), 3000);
      return;
    }

    setIsUIVisible(!isUIVisible);
    if (isUIVisible) setActiveTab("none");
  };

  const parsedContent = useMemo(() => {
    if (!song?.chords) return [];
    const parsedLines = parseChordsAndLyrics(song.chords);
    if (transpose !== 0) {
      return parsedLines.map((line) =>
        line.type === "chord"
          ? { ...line, content: transposeChord(line.content, transpose) }
          : line,
      );
    }
    return parsedLines;
  }, [song, transpose]);

  const sectionNavigatorItems = useMemo(
    () =>
      parsedContent
        .map((line, index) =>
          line.type === "section"
            ? {
                index,
                label: line.content.replace(/^\[?|\]?:?$/g, "").trim(),
              }
            : null,
        )
        .filter(
          (section): section is { index: number; label: string } =>
            !!section && !!section.label,
        ),
    [parsedContent],
  );

  const scrollToSectionIndex = useCallback((sectionIndex: number) => {
    const container = scrollContainerRef.current;
    const target = sectionRefs.current.get(sectionIndex);
    if (!container || !target) return false;

    setIsAutoScrolling(false);
    const targetTop = Math.max(0, target.offsetTop - 126);
    container.scrollTo({ top: targetTop, behavior: "smooth" });
    return true;
  }, []);

  const lastHandledLiveSectionCommandRef = useRef<string | null>(null);

  useEffect(() => {
    const target = liveSession?.activeSection;
    if (
      !isOpen ||
      !isFollowingDirection ||
      !song ||
      !target ||
      target.songId !== song.id
    ) {
      return;
    }

    if (lastHandledLiveSectionCommandRef.current === target.commandId) return;
    lastHandledLiveSectionCommandRef.current = target.commandId;

    let frame: number | null = null;
    let fallback: number | null = null;
    frame = requestAnimationFrame(() => {
      if (!scrollToSectionIndex(target.sectionIndex)) {
        fallback = window.setTimeout(() => {
          scrollToSectionIndex(target.sectionIndex);
        }, 80);
      }
    });

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (fallback !== null) window.clearTimeout(fallback);
    };
  }, [
    isOpen,
    isFollowingDirection,
    liveSession?.activeSection?.commandId,
    liveSession?.activeSection?.songId,
    liveSession?.activeSection?.sectionIndex,
    parsedContent,
    scrollToSectionIndex,
    song?.id,
  ]);

  const [isFixingChords, setIsFixingChords] = useState(false);
  const [originalBackup, setOriginalBackup] = useState<string | null>(null);

  const handleAIAjuste = async (fromEditor: boolean = false) => {
    const prompt = window.prompt(
      "Instruções extras para a IA (Opcional):\nEx: 'Alinhe os acordes com a letra'",
    );
    if (prompt === null) return;
    const sourceChords = fromEditor ? editedChords : song?.chords;
    if (!sourceChords || !user || !effectiveOrganizationId) {
      if (!user || !effectiveOrganizationId) {
        alert("Falha ao ajustar cifras.");
      }
      setIsFixingChords(false);
      return;
    }

    setIsFixingChords(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/fix-chords", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          organizationId: effectiveOrganizationId,
          chords: sourceChords, 
          instructions: prompt 
        }),
      });
      
      if (!res.ok) {
        throw new Error("Erro na API");
      }
      
      const data = await res.json();
      if (data.fixedChords) {
        if (fromEditor) setEditedChords(data.fixedChords);
        else {
          setOriginalBackup(sourceChords);
          await onSave({ songId: song!.id, chords: data.fixedChords });
        }
      }
    } catch (err) {
      alert("Falha ao ajustar cifras.");
    } finally {
      setIsFixingChords(false);
    }
  };

  if (!isOpen || !song) return null;

  const canGoPrevious = scaleContext && scaleContext.currentIndex > 0;
  const canGoNext =
    scaleContext && scaleContext.currentIndex < scaleContext.songs.length - 1;

  return createPortal(
    <div
      className={`fixed inset-0 z-[120] overflow-hidden flex flex-col font-sans transition-colors duration-300 ${isWorshipFlow ? "bg-[#0A0A0C]" : "bg-[#0A0A0C]"}`}
    >
      <div
        className={`top-bar absolute top-0 w-full z-40 px-4 md:px-6 h-20 md:h-24 bg-[#0A0A0C]/85 backdrop-blur-2xl border-b border-white/[0.04] shadow-sm flex items-center justify-between transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${isUIVisible || isEditing ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`}
      >
        <div className="flex-1">
          <button
            onClick={handleSafeClose}
            data-testid="close-chords-viewer"
            className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/5 transition-all shadow-sm"
          >
            <CloseIcon className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <div
          className="flex-[2] flex flex-col items-center justify-center text-center cursor-pointer"
          onClick={() => setActiveTab(activeTab === "font" ? "none" : "font")}
        >
          <h2
            className="text-lg md:text-xl font-bold tracking-tight text-white/95 truncate max-w-[200px] md:max-w-[400px]"
          >
            {song.title}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[12px] md:text-[13px] font-medium text-white/60 truncate tracking-wide">
              {song.artist}
            </p>
            {activeSection && (
              <>
                <span className="text-white/20 text-[10px]">•</span>
                <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] text-[#34d399] bg-[#34d399]/10 px-2 py-0.5 rounded-full border border-[#34d399]/20 hidden sm:block">
                  {activeSection.replace(/^\[?|\]?:?$/g, "")}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 flex justify-end items-center gap-2 relative">
          {liveSession?.mode === 'rehearsal' && (
            <div className="hidden lg:flex px-3 h-9 items-center gap-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold tracking-wide">
               {t('songs.rehearsal_mode_active', 'Modo Ensaio Ativo')}
            </div>
          )}

          {canManageChords && !isEditing && (
            <button
              onClick={() => {
                setIsEditing(true);
                setEditedChords(song.chords);
                setIsUIVisible(true);
              }}
              className="px-3 h-9 md:h-10 flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/5 transition-all text-[13px] font-semibold tracking-wide"
            >
              <span className="hidden md:inline">Editar</span>
              <EditIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="w-10 h-10 md:w-11 md:h-11 hidden md:flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/5 transition-all"
          >
            {isFullscreen ? (
              <FullscreenExitIcon className="w-4 h-4 md:w-5 md:h-5" />
            ) : (
              <FullscreenIcon className="w-4 h-4 md:w-5 md:h-5" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab(activeTab === "font" ? "none" : "font");
            }}
            className={`w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-full transition-all border ${activeTab === "font" ? "bg-white text-black border-white shadow-md shadow-white/20" : "bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border-white/5"}`}
          >
            <span
              className="font-serif font-bold text-[15px] md:text-[17px] leading-none mt-0.5"
            >
              Aa
            </span>
          </button>

          {activeTab === "font" && (
            <div
              className="popup-panel absolute top-14 right-0 z-50 bg-[#0A0A0C]/90 backdrop-blur-3xl border border-white/[0.08] rounded-3xl p-5 shadow-[0_16px_40px_rgba(0,0,0,0.6)] flex flex-col gap-6 w-[320px] transition-all duration-300 transform origin-top-right animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">
                  Tamanho do texto
                </span>
                <div className="flex items-center gap-1 bg-black/40 rounded-full p-1 border border-white/5">
                  <button
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 font-bold transition-colors"
                    onClick={() =>
                      handleSettingsChange({
                        fontSize: Math.max(12, settings.fontSize - 1),
                      })
                    }
                  >
                    A-
                  </button>
                  <span className="w-8 text-center font-bold text-sm text-white">
                    {settings.fontSize}
                  </span>
                  <button
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 font-bold transition-colors"
                    onClick={() =>
                      handleSettingsChange({
                        fontSize: Math.min(48, settings.fontSize + 1),
                      })
                    }
                  >
                    A+
                  </button>
                </div>
              </div>

              <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
                {fontFamilies.map((f) => (
                  <button
                    key={f.class}
                    className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${settings.fontFamily === f.class ? "bg-[#2C2C2E] text-white shadow-md shadow-black/50" : "text-white/50 hover:text-white/80"}`}
                    onClick={() =>
                      handleSettingsChange({ fontFamily: f.class })
                    }
                  >
                    {f.name}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">
                  Tom (Transporte)
                </span>
                <div className="flex items-center gap-1 bg-black/40 rounded-full p-1 border border-white/5">
                  <button
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 font-bold transition-colors"
                    onClick={() => setTranspose(t => t - 1)}
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-bold text-sm text-white">
                    {transpose > 0 ? `+${transpose}` : transpose}
                  </span>
                  <button
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 font-bold transition-colors"
                    onClick={() => setTranspose(t => t + 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
                <ColorPicker
                  label="Cor da Letra"
                  colors={lyricsPalette}
                  selectedColor={activeLyricsColor}
                  onSelect={(c) =>
                    handleSettingsChange({
                      lyricsColorIndex: lyricsPalette.indexOf(c) || 0,
                    })
                  }
                />
                <ColorPicker
                  label="Cor da Cifra"
                  colors={chordsPalette}
                  selectedColor={activeChordsColor}
                  onSelect={(c) =>
                    handleSettingsChange({
                      chordsColorIndex: chordsPalette.indexOf(c) || 0,
                    })
                  }
                />
              </div>

              <div className="pt-2 flex flex-col gap-2 border-t border-white/5">
                {canRepairChordKey && (
                  <Button
                    size="sm"
                    variant="primary"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white border-none transition-colors"
                    onClick={() => {
                      setActiveTab("none");
                      if (song) {
                        openPersistedChordKeyRepair(song, (updatedSong) => {
                          if (onSongUpdate) {
                            onSongUpdate(updatedSong);
                          }
                        });
                      }
                    }}
                  >
                    Ajustar Tom da Cifra
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full bg-white/5 hover:bg-white/10 text-white/90 border-none transition-colors"
                  onClick={() => handleSettingsChange(defaultSettings)}
                >
                  Redefinir Padrões
                </Button>
                {canManageChords && originalBackup && (
                  <Button
                    size="sm"
                    variant="danger"
                    className="w-full"
                    onClick={async () => {
                      if (window.confirm("Restaurar cifra original?")) {
                        await onSave({
                          songId: song.id,
                          chords: originalBackup,
                        });
                        setOriginalBackup(null);
                      }
                    }}
                  >
                    Restaurar Original
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isEditing && isUIVisible && sectionNavigatorItems.length > 1 && (
        <div className="fixed top-20 md:top-24 inset-x-0 z-[38] pointer-events-none">
          <div className="mx-auto max-w-4xl px-3 md:px-6 pt-2">
            <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto hide-scrollbar rounded-full border border-white/[0.07] bg-[#0A0A0C]/[0.82] backdrop-blur-2xl p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.24)]">
              {sectionNavigatorItems.map((section) => {
                const normalizedActive = activeSection.replace(/^\[?|\]?:?$/g, "").trim().toLowerCase();
                const isActive = normalizedActive === section.label.toLowerCase();
                return (
                  <button
                    key={`${section.index}-${section.label}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      scrollToSectionIndex(section.index);
                    }}
                    className={`shrink-0 h-8 px-3.5 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-[0.11em] transition-all active:scale-[0.97] ${
                      isActive
                        ? "bg-white text-black shadow-[0_6px_18px_rgba(255,255,255,0.08)]"
                        : "text-white/45 hover:text-white/80 hover:bg-white/[0.055]"
                    }`}
                  >
                    {section.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className={`flex-1 w-full h-full overflow-y-auto cursor-pointer hide-scrollbar touch-pan-y ${isWorshipFlow ? "bg-black" : ""}`}
        onClick={handleScreenClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence>
          {showWorshipFlowBadge && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="pointer-events-none fixed top-10 w-full flex flex-col items-center gap-2 z-[130]"
            >
              <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-white/50 text-[10px] font-black tracking-[0.2em] uppercase flex items-center gap-2">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Worship Flow
              </div>
              <div className="bg-amber-500/10 dark:bg-amber-400/10 backdrop-blur-md px-3 py-1 rounded-full border border-amber-500/20 text-amber-600 dark:text-amber-200/90 text-[11px] font-bold tracking-wide">
                {t("performance.double_tap_to_unlock", "Dê um toque duplo na tela para sair")}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={song.id + (isWorshipFlow ? "wflow" : "normal")}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {isEditing ? (
              <div
                className="w-full max-w-4xl mx-auto pt-24 pb-32 px-5 cursor-default mt-4"
                onClick={(e) => e.stopPropagation()}
              >
                <textarea
                  value={editedChords}
                  onChange={(e) => setEditedChords(e.target.value)}
                  className="input-base !h-[65vh] font-mono text-[15px] !rounded-[32px] p-6 resize-none"
                  placeholder="Insira as cifras..."
                />
              </div>
            ) : (
              <div
                className="w-full max-w-4xl mx-auto pt-32 pb-[50vh] px-5 md:px-12 select-none"
                style={{
                  fontFamily: fontFamilies.find(
                    (f) => f.class === settings.fontFamily,
                  )?.name,
                }}
              >
                {liveSession?.mode === 'rehearsal' && (song.bandNotes || song.videoUrl) && (
                  <div className="mb-10 p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-blue-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Preparação & Notas do Ensaio
                    </h3>
                    {song.bandNotes && (
                      <p className="text-blue-100 text-sm leading-relaxed whitespace-pre-wrap mb-4">{song.bandNotes}</p>
                    )}
                    {song.videoUrl && (
                      <a href={song.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors text-xs font-bold uppercase tracking-widest">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                        Ouvir Referência
                      </a>
                    )}
                  </div>
                )}

                {parsedContent.length > 0 ? (
                  <div
                    className={`whitespace-pre-wrap ${settings.fontFamily}`}
                    style={{
                      fontSize: `${isWorshipFlow ? settings.fontSize + 4 : settings.fontSize}px`,
                      lineHeight: isWorshipFlow ? 1.6 : 1.55,
                      letterSpacing: "-0.01em",
                      fontWeight: 600,
                      transition: "all 0.3s ease",
                    }}
                  >
                    {parsedContent.map((line, index) => {
                      const isPrevChord =
                        index > 0 && parsedContent[index - 1]?.type === "chord";
                      const isNextLyric =
                        index < parsedContent.length - 1 &&
                        parsedContent[index + 1]?.type === "lyric";

                      if (line.type === "section") {
                        return (
                          <div
                            key={index}
                            ref={(el) => {
                              if (el) sectionRefs.current.set(index, el);
                              else sectionRefs.current.delete(index);
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 mt-8 mb-4 text-[0.75em] font-black tracking-[0.1em] uppercase rounded-xl border border-white/[0.08] dark:border-white/[0.08] bg-black-50/5 dark:bg-white/5 backdrop-blur-md shadow-sm"
                            style={{ color: activeChordsColor }}
                          >
                            {line.content.replace(/^\[?|\]?:?$/g, "")}
                          </div>
                        );
                      } else if (line.type === "chord") {
                        return (
                          <div
                            key={index}
                            className="font-bold tracking-wider"
                            style={{
                              color: activeChordsColor,
                              marginBottom: isNextLyric ? "-0.1em" : "0",
                              marginTop: isPrevChord ? "0" : "1em",
                              textShadow: "0 1px 2px rgba(0,0,0,0.1)",
                            }}
                          >
                            <motion.div
                              key={transpose}
                              initial={{
                                opacity: 0.5,
                                y: isPowerSave ? 0 : -2,
                              }}
                              animate={{
                                opacity: 1,
                                y: 0,
                              }}
                              transition={{
                                duration: isPowerSave ? 0 : 0.2,
                                ease: "easeOut",
                              }}
                            >
                              {line.content || " "}
                            </motion.div>
                          </div>
                        );
                      } else {
                        return (
                          <div
                            key={index}
                            className="font-semibold"
                            style={{
                              color: activeLyricsColor,
                              marginBottom:
                                line.content.trim() === "" ? "1.2em" : "0",
                              paddingBottom: isNextLyric ? "0" : "0",
                            }}
                          >
                            {line.content || " "}
                          </div>
                        );
                      }
                    })}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-48 font-medium">
                    Nenhuma cifra disponível.
                  </div>
                )}

                {scaleContext &&
                  scaleContext.currentIndex ===
                    scaleContext.songs.length - 1 && (
                    <div
                      className="mt-20 pt-10 border-t border-slate-200/50 dark:border-white/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <AiContextualSuggestions
                        currentSongs={scaleContext.songs}
                        librarySongs={librarySongs}
                        title="Quer continuar este fluxo?"
                      />
                    </div>
                  )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {!isEditing && (
        <div
          className={`dock fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-40 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-auto ${isUIVisible || isAutoScrolling ? "translate-y-0 opacity-100 scale-100" : "translate-y-20 opacity-0 scale-95"}`}
        >
          <div className="flex items-center gap-2 p-2 bg-[#0A0A0C]/85 backdrop-blur-3xl border border-white/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.6)] rounded-full isolate relative">
            <div className="flex items-center bg-[#000000]/50 rounded-full ml-1 border border-white/[0.04] shadow-inner">
              <button
                className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-l-full transition-colors font-medium text-lg px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  const newT = transpose - 1;
                  setTranspose(newT);
                  if (song && isLeader) {
                    changeKeyOverride(song.id, transposeChord(song.key, newT));
                  }
                }}
              >
                -
              </button>
              <div className="px-1 text-center min-w-[3.5rem] select-none flex flex-col items-center justify-center">
                <span className="text-[8px] font-bold uppercase tracking-widest text-white/40 mb-[1px]">
                  Tom
                </span>
                <span className="text-[15px] font-bold text-white tracking-wider leading-none" data-testid="chords-viewer-transposed-key">
                  {song ? transposeChord(song.key, transpose) : ""}
                </span>
              </div>
              <button
                className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-r-full transition-colors font-medium text-lg px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  const newT = transpose + 1;
                  setTranspose(newT);
                  if (song && isLeader) {
                    changeKeyOverride(song.id, transposeChord(song.key, newT));
                  }
                }}
              >
                +
              </button>
            </div>

            {!scaleContext && (
               <div className="w-1" />
            )}
            <button
              className={`w-12 h-12 md:w-14 md:h-14 mx-1 flex items-center justify-center rounded-full transition-all duration-300 ease-out shadow-sm ${isAutoScrolling ? "bg-[#34d399] text-black hover:bg-[#10b981] scale-105" : "bg-white text-black hover:bg-slate-200"}`}
              onClick={(e) => {
                e.stopPropagation();
                if (speedLevel === 0) setSpeedLevel(3);
                setIsAutoScrolling(!isAutoScrolling);
              }}
            >
              {isAutoScrolling ? (
                <PauseIcon className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" />
              ) : (
                <PlayIcon className="w-5 h-5 md:w-6 md:h-6 ml-1 flex-shrink-0" />
              )}
            </button>

            <div className="flex items-center bg-[#000000]/50 rounded-full border border-white/[0.04] shadow-inner mr-1">
              <button
                className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-l-full transition-colors font-medium text-lg px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setSpeedLevel(Math.max(0, speedLevel - 1));
                }}
              >
                -
              </button>
              <div className="px-1 text-center min-w-[2.5rem] select-none flex flex-col items-center justify-center">
                <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/40 mb-[1px]">
                  Vel
                </span>
                <span className="text-[15px] font-bold text-white font-mono leading-none">
                  {speedLevel}
                </span>
              </div>
              <button
                className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-r-full transition-colors font-medium text-lg px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setSpeedLevel(Math.min(5, speedLevel + 1));
                }}
              >
                +
              </button>
            </div>
            
          </div>
        </div>
      )}

      {scaleContext && isUIVisible && !isEditing && (
         <>
           <ScaleSongNavigation 
             scaleContext={scaleContext as any} 
             onNavigate={onNavigate} 
             onClose={handleSafeClose}
             isWorshipFlow={isWorshipFlow}
           />
           <ScaleSongNavigationMobile 
             scaleContext={scaleContext as any} 
             onNavigate={onNavigate} 
             onClose={handleSafeClose}
             isWorshipFlow={isWorshipFlow}
           />
         </>
      )}

      {isEditing && (
        <div className="absolute bottom-0 w-full pointer-events-auto bg-white/95 dark:bg-[#0A0A0C]/95 backdrop-blur-2xl p-4 border-t border-slate-200/50 dark:border-white/5 shadow-2xl flex flex-wrap gap-3 items-center justify-end z-50">
          <Button
            variant="secondary"
            onClick={() =>
              setEditedChords(
                editedChords
                  .split("\n")
                  .map((line) =>
                    isChordLine(line) ? line.trim().replace(/\s+/g, " ") : line,
                  )
                  .join("\n"),
              )
            }
          >
            Normalizar Espaços
          </Button>
          <Button
            variant="outline"
            className="border-indigo-500 text-indigo-500"
            onClick={() => handleAIAjuste(true)}
            disabled={isFixingChords}
          >
            {isFixingChords ? <Spinner size="sm" /> : "✨ IA: Ajustar"}
          </Button>
          <div className="flex-1 min-w-0" />
          <Button
            variant="secondary"
            onClick={() => setIsEditing(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              await onSave({ songId: song.id, chords: editedChords.trim() });
              setIsEditing(false);
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner size="sm" /> : "Salvar Cifra"}
          </Button>
        </div>
      )}

      {scaleContext?.scaleId && song && (
        <LiveWorshipDirector
          scaleId={scaleContext.scaleId}
          songs={scaleContext.songs}
          currentSongId={song.id}
          onNavigateToSong={(songId) => {
            const targetIndex = scaleContext.songs.findIndex(
              (s) => s.id === songId,
            );
            if (
              targetIndex !== -1 &&
              targetIndex !== scaleContext.currentIndex
            ) {
              onNavigate(targetIndex);
            }
          }}
        />
      )}
    </div>,
    document.body,
  );
};

export default ChordsViewerModal;
