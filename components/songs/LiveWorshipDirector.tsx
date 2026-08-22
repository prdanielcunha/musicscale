import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useLiveWorshipSession } from "../../hooks/useLiveWorshipSession";
import { PopulatedSong } from "../../types";
import { useTranslation } from "react-i18next";

interface LiveWorshipDirectorProps {
  scaleId: string;
  songs: PopulatedSong[];
  currentSongId: string;
  onNavigateToSong: (songId: string) => void;
}

export const LiveWorshipDirector: React.FC<LiveWorshipDirectorProps> = ({
  scaleId,
  songs,
  currentSongId,
  onNavigateToSong,
}) => {
  const { t } = useTranslation();
  const {
    liveSession,
    isLeader,
    isLive,
    canManageLiveSession,
    canStartLiveSession,
    sessionStatus,
    pushCue,
    activateSession,
    deactivateSession,
    changeSong,
  } = useLiveWorshipSession(scaleId);
  const [cueStack, setCueStack] = useState<
    { id: string; type: string; message?: string }[]
  >([]);

  useEffect(() => {
    if (
      isLive &&
      !isLeader &&
      liveSession?.activeSongId &&
      liveSession.activeSongId !== currentSongId
    ) {
      onNavigateToSong(liveSession.activeSongId);
    }
  }, [isLive, isLeader, liveSession?.activeSongId, currentSongId, onNavigateToSong]);

  useEffect(() => {
    if (!isLive) {
      setCueStack([]);
      return;
    }

    if (liveSession?.activeCue) {
      const cue = liveSession.activeCue;
      setCueStack((prev) => {
        const isDuplicate = prev.some((c) => c.id === cue.id);
        if (isDuplicate) return prev;
        return [...prev, { id: cue.id, type: cue.type, message: cue.message }];
      });

      const timer = setTimeout(() => {
        setCueStack((prev) => prev.filter((c) => c.id !== cue.id));
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [isLive, liveSession?.activeCue?.id]);

  const [spontaneousSearch, setSpontaneousSearch] = useState("");

  const handleSongSelect = async (songId: string) => {
    const changed = await changeSong(songId);
    if (changed) onNavigateToSong(songId);
  };

  const handleSpontaneousSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = spontaneousSearch.trim();
    if (!message) return;

    const sent = await pushCue("spontaneous", message);
    if (sent) setSpontaneousSearch("");
  };

  const showLeaderPanel =
    canManageLiveSession &&
    sessionStatus === "ready" &&
    (isLeader || canStartLiveSession);

  return (
    <>
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[140] pointer-events-none flex flex-col gap-2 items-center w-full max-w-sm px-4">
        <AnimatePresence>
          {cueStack.map((cue) => (
            <motion.div
              key={cue.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-[#1A1A1C]/95 backdrop-blur-3xl border border-white/[0.08] px-6 py-3 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.6)] flex items-center justify-center pointer-events-auto"
            >
              <span className="text-white font-bold tracking-widest uppercase text-sm">
                {cue.type === "chorus"
                  ? t('performance.cue_chorus', '🔥 Repetir Refrão')
                  : cue.type === "instrumental"
                    ? t('performance.cue_instrumental', '🎸 Instrumental')
                    : cue.type === "bridge"
                      ? t('performance.cue_bridge', '🌉 Ponte')
                      : cue.type === "spontaneous"
                        ? t('performance.cue_spontaneous', '✨ Espontâneo')
                        : cue.type === "end"
                          ? t('performance.cue_end', '⏹️ Encerrar')
                          : cue.message || cue.type}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {showLeaderPanel && (
        <div className="fixed left-6 top-1/2 -translate-y-1/2 z-[140] hidden lg:flex flex-col gap-3">
          <div className="bg-[#0A0A0C]/90 backdrop-blur-3xl border border-white/[0.08] rounded-3xl p-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)] flex flex-col gap-2 w-56">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                {t('performance.direction', 'Direção')} {liveSession?.mode === 'rehearsal' ? t('performance.rehearsal_mode', '(Ensaio)') : (liveSession?.mode === 'worship' ? t('performance.worship_mode', '(Culto)') : '')}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${isLive ? "bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-white/20"}`}
                ></span>
              </div>
            </div>

            {!isLive ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => void activateSession("worship")}
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white text-xs font-bold uppercase tracking-widest border border-white/5"
                >
                  {t('performance.start_worship', 'Iniciar Culto')}
                </button>
                <button
                  onClick={() => void activateSession("rehearsal")}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/70 text-xs font-bold uppercase tracking-widest border border-white/5"
                >
                  {t('performance.start_rehearsal', 'Iniciar Ensaio')}
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    onClick={() => void pushCue("chorus")}
                    className="bg-white/5 hover:bg-white/10 text-white/80 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-white/5"
                  >
                    {t('performance.chorus_short', 'Refrão')}
                  </button>
                  <button
                    onClick={() => void pushCue("instrumental")}
                    className="bg-white/5 hover:bg-white/10 text-white/80 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-white/5"
                  >
                    {t('performance.instrumental_short', 'Inst.')}
                  </button>
                  <button
                    onClick={() => void pushCue("bridge")}
                    className="bg-white/5 hover:bg-white/10 text-white/80 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-white/5"
                  >
                    {t('performance.bridge_short', 'Ponte')}
                  </button>
                  <button
                    onClick={() => void pushCue("spontaneous")}
                    className="bg-white/5 hover:bg-white/10 border-indigo-500/30 text-indigo-300 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border"
                  >
                    {t('performance.spontaneous_short', 'Espontâneo')}
                  </button>
                </div>
                <button
                  onClick={() => void pushCue("end")}
                  className="mt-1 w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-red-500/20"
                >
                  {t('performance.end_short', 'Encerrar')}
                </button>

                <div className="h-px w-full bg-white/10 my-2"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">
                  {t('performance.live_setlist', 'Setlist Vivo')}
                </span>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto hide-scrollbar">
                  {songs.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => void handleSongSelect(song.id)}
                      className={`text-left px-3 py-2 rounded-xl transition-colors text-[11px] font-medium leading-tight truncate ${song.id === currentSongId ? "bg-indigo-500 text-white shadow-lg" : "text-white/60 hover:bg-white/10"} `}
                    >
                      {song.title}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(event) => void handleSpontaneousSubmit(event)}
                  className="mt-2 flex gap-1"
                >
                  <input
                    type="text"
                    placeholder={t('performance.play_spontaneous_placeholder', 'Tocar espontâneo...')}
                    value={spontaneousSearch}
                    onChange={(e) => setSpontaneousSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50"
                  />
                  <button
                    type="submit"
                    className="bg-white/10 text-white rounded-xl px-3 text-[10px] font-bold hover:bg-white/20"
                  >
                    +
                  </button>
                </form>

                <button
                  onClick={() => void deactivateSession()}
                  className="mt-2 w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/40 text-[10px] font-bold uppercase tracking-widest border border-white/5"
                >
                  {t('performance.stop_direction', 'Soltar Direção')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
