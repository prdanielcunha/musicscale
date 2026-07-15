import React, { forwardRef } from "react";
import type { PopulatedSong } from "../../types";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";
import { KeyIcon } from "../icons/KeyIcon";
import { BpmIcon } from "../icons/BpmIcon";

interface SongShareImageProps {
  song: PopulatedSong;
}

const SongShareImage = forwardRef<HTMLDivElement, SongShareImageProps>(
  ({ song }, ref) => {
    return (
      <div
        ref={ref}
        style={{ width: "450px" }}
        className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 font-sans flex flex-col antialiased relative overflow-hidden"
      >
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 md:blur-[60px] blur-[15px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/20 md:blur-[60px] blur-[15px] rounded-full pointer-events-none"></div>

        <div className="relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 border border-white/10 shadow-lg">
              <MusicNoteIcon className="w-8 h-8 text-primary-light" />
            </div>
            <h1
              className="text-3xl font-extrabold text-white mb-2 leading-tight"
              style={{ textWrap: "balance" }}
            >
              {song.title}
            </h1>
            <p className="text-lg text-gray-300 font-medium">{song.artist}</p>
          </div>

          {/* Details Card */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-xl mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-black/20 rounded-xl">
                <div className="flex justify-center mb-2 text-primary-light">
                  <KeyIcon className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Tom
                </p>
                <p className="text-2xl font-bold text-white mt-1">{song.key}</p>
              </div>
              <div className="text-center p-4 bg-black/20 rounded-xl">
                <div className="flex justify-center mb-2 text-accent">
                  <BpmIcon className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  BPM
                </p>
                <p className="text-2xl font-bold text-white mt-1">{song.bpm || "—"}</p>
              </div>
            </div>
          </div>

          {/* Tags */}
          {song.tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {song.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-3 py-1 bg-white/10 text-gray-200 text-xs font-semibold rounded-full border border-white/5"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="text-center pt-6 border-t border-white/10">
            <p className="text-xs font-bold text-gray-400 tracking-widest uppercase">
              MusicScale
            </p>
          </div>
        </div>
      </div>
    );
  },
);

export default SongShareImage;
