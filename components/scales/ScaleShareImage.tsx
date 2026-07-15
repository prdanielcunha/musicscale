import React, { forwardRef } from "react";
import type { PopulatedScale, PopulatedSong, PopulatedBandScale } from "../../types";
import { getScaleTitle } from "../../utils/scaleHelper";
import { RepertoireIcon } from "../icons/RepertoireIcon";
import { CalendarIcon } from "../icons/CalendarIcon";
import { LocationMarkerIcon } from "../icons/LocationMarkerIcon";
import { UserIcon } from "../icons/UserIcon";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";

interface ScaleShareImageProps {
  scale: PopulatedScale | PopulatedBandScale;
}

const FullSongListItem: React.FC<{ song: PopulatedSong; index: number }> = ({
  song,
  index,
}) => (
  <div className="flex justify-between items-center p-6 rounded-[24px] bg-white/5 border border-white/10 shadow-sm">
    <div className="flex items-center gap-6">
      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white/50 font-black text-xl border border-white/5">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="flex-1">
        <p className="text-3xl font-black text-white tracking-tight mb-1">
          {song.title}
        </p>
        <p className="text-xl text-zinc-400 font-medium">{song.artist}</p>
      </div>
    </div>
    <div className="flex gap-4">
      {song.key && (
        <div className="flex flex-col items-center bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">
          <span className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
            Tom
          </span>
          <span className="text-2xl font-black text-white">{song.key}</span>
        </div>
      )}
      {song.bpm && (
        <div className="flex flex-col items-center bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">
          <span className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
            BPM
          </span>
          <span className="text-2xl font-black text-white">{song.bpm || "—"}</span>
        </div>
      )}
    </div>
  </div>
);


const MemberListItem: React.FC<{ assignment: any; index: number }> = ({ assignment, index }) => (
  <div className="flex justify-between items-center p-4 rounded-[20px] bg-white/5 border border-white/10 shadow-sm">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/50 font-bold text-lg border border-white/5">
        <UserIcon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="text-2xl font-black text-white tracking-tight">
          {assignment.user.displayName}
        </p>
      </div>
    </div>
    <div className="flex gap-3">
      <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-xl text-blue-400">
        <span className="text-xl font-bold">{assignment.instrument.name}</span>
      </div>
    </div>
  </div>
);

const CompactSongListItem: React.FC<{ song: PopulatedSong; index: number }> = ({
  song,
  index,
}) => (
  <div className="flex justify-between items-center p-4 rounded-[20px] bg-white/5 border border-white/10 shadow-sm">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/50 font-bold text-lg border border-white/5">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="flex-1">
        <p className="text-2xl font-black text-white tracking-tight">
          {song.title}
        </p>
        <p className="text-lg text-zinc-400 font-medium">{song.artist}</p>
      </div>
    </div>
    <div className="flex gap-3">
      {song.key && (
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Tom
          </span>
          <span className="text-xl font-black text-white">{song.key}</span>
        </div>
      )}
      {song.bpm && (
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            BPM
          </span>
          <span className="text-xl font-black text-white">{song.bpm}</span>
        </div>
      )}
    </div>
  </div>
);

const ScaleShareImage = forwardRef<HTMLDivElement, ScaleShareImageProps>(
  ({ scale }, ref) => {
    const formattedDate = new Date(scale.date + "T00:00:00").toLocaleDateString(
      "pt-BR",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    );

    
    const isBandScale = 'assignments' in scale;
    const items = isBandScale ? (scale as PopulatedBandScale).assignments : (scale as PopulatedScale).songs;
    const totalItems = items.length;
    const isCompact = totalItems >= 7;
    const isTruncated = totalItems > 10;
    const visibleItems = isTruncated ? items.slice(0, 10) : items;
    const remainingItems = isTruncated ? totalItems - 10 : 0;
    const itemTypeLabel = isBandScale ? "membros da banda" : "músicas na escala";
    const itemTypeLabelSingular = isBandScale ? "membro na banda" : "música na escala";
    const emptyMessage = isBandScale ? "Nenhum membro escalado" : "Nenhuma música definida";
    const headerTitle = isBandScale ? "Equipe / Banda" : "Repertório";


    return (
      <div
        ref={ref}
        style={{ width: "1080px", backgroundColor: "#0b0f19" }}
        className="text-white p-16 font-sans flex flex-col antialiased relative overflow-hidden"
      >
        {/* Background Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-12">
          {/* Header */}
          <div className="flex flex-col items-center justify-center text-center gap-6 mt-8">
            <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl backdrop-blur-md">
              <img src="/LogoIcon.png" alt="MusicScale Logo" className="w-12 h-12 object-contain" crossOrigin="anonymous" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-base font-bold tracking-widest uppercase mb-6">
                Escala de Louvor
              </div>
              <h1 className="text-7xl font-black tracking-tight text-white mb-4">
                {getScaleTitle(scale)}
              </h1>
            </div>
          </div>

          {/* Event Info Card */}
          <div className="bg-[#151a23]/60 border border-white/10 rounded-[32px] p-8 backdrop-blur-sm shadow-xl flex flex-col gap-8 mt-4">
            <div className="grid grid-cols-2 gap-8 divide-x divide-white/10">
              <div className="flex items-center justify-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-black/20 flex items-center justify-center text-zinc-400 border border-white/5 shrink-0">
                  <CalendarIcon className="w-10 h-10" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Data
                  </p>
                  <p className="text-3xl font-semibold text-white capitalize truncate">
                    {formattedDate}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-6 pl-8">
                <div className="w-20 h-20 rounded-2xl bg-black/20 flex items-center justify-center text-zinc-400 border border-white/5 shrink-0">
                  <LocationMarkerIcon className="w-10 h-10" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Local
                  </p>
                  <p className="text-3xl font-semibold text-white pr-4 line-clamp-2 leading-tight">
                    {scale.location.name}
                  </p>
                </div>
              </div>
            </div>
            {scale.createdBy?.displayName && (
              <div className="pt-8 border-t border-white/5 flex items-center justify-center">
                <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-3xl border border-white/5 shadow-sm">
                  <UserIcon className="w-6 h-6 text-zinc-500" />
                  <p className="text-2xl text-zinc-400 font-medium">
                    Organizado por{" "}
                    <span className="text-white font-bold">
                      {scale.createdBy.displayName}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          
          {/* Repertory Area */}
          <div className="flex flex-col gap-8 mt-4">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-4xl font-bold tracking-tight text-white flex items-center gap-4">
                {headerTitle}
              </h3>
              <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10">
                <span className="text-2xl font-semibold text-white">
                  {totalItems} {totalItems === 1 ? itemTypeLabelSingular : itemTypeLabel}
                </span>
              </div>
            </div>

            {totalItems === 0 ? (
              <div className="h-48 flex items-center justify-center rounded-[32px] bg-white/5 border border-white/10 border-dashed">
                <p className="text-3xl font-medium text-zinc-500">
                  {emptyMessage}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {visibleItems.map((item: any, index: number) => {
                  if (isBandScale) {
                    return <MemberListItem key={index} assignment={item} index={index} />;
                  } else {
                    return isCompact ? (
                      <CompactSongListItem key={item.id} song={item} index={index} />
                    ) : (
                      <FullSongListItem key={item.id} song={item} index={index} />
                    );
                  }
                })}
                {isTruncated && (
                  <div className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center gap-3 mt-4">
                    <p className="text-3xl font-bold text-white">
                      +{remainingItems} {remainingItems === 1 ? itemTypeLabelSingular : itemTypeLabel}
                    </p>
                    <p className="text-xl text-zinc-500 font-medium">
                      Abra no MusicScale para ver a lista completa
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-10 border-t border-white/5 text-center flex flex-col items-center gap-4 pb-4">
            <p className="text-2xl font-bold text-zinc-400 tracking-wide flex items-center justify-center">
              MusicScale <span className="opacity-30 mx-4">•</span>{" "}
              Tecnologia para fortalecer igrejas
            </p>
          </div>
        </div>
      </div>
    );
  },
);

export default ScaleShareImage;
