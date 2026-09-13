import React, { useState, useMemo, useEffect } from "react";
import { useMusic } from "../contexts/MusicDataContext";
import type { PopulatedSong, Tag } from "../types";
import LyricsViewerModal from "../components/songs/LyricsViewerModal";
import ChordCard from "../components/chords/ChordCard";
import { XCircleIcon } from "../components/icons/XCircleIcon";
import { FileText, Search, SlidersHorizontal } from "lucide-react";
import { RepertoireMetricsView } from "../components/songs/RepertoireMetricsView";
import MusicWorkspaceSkeleton from "../components/common/MusicWorkspaceSkeleton";

const formSelectClass = "input-base";

const LyricsPage: React.FC = () => {
  const { songs, tags, loading, error } = useMusic();
  const [songInModal, setSongInModal] = useState<PopulatedSong | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [keyFilter, setKeyFilter] = useState("all");
  const [tagFilterIds, setTagFilterIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("title");

  useEffect(() => {
    if (songInModal) {
      const updatedSong = songs.find((s) => s.id === songInModal.id);
      if (
        updatedSong &&
        (updatedSong.lastModifiedAt !== songInModal.lastModifiedAt ||
          updatedSong.chordsLastModifiedAt !== songInModal.chordsLastModifiedAt)
      ) {
        setSongInModal(updatedSong);
      }
    }
  }, [songs, songInModal]);

  const uniqueKeys = useMemo(() => {
    const keys = new Set(
      songs.filter((s) => !!s.lyrics).map((s) => s.key),
    );
    return Array.from(keys).sort();
  }, [songs]);

  const selectedFilterTags = useMemo(() => {
    return tagFilterIds
      .map((id) => tags.find((t) => t.id === id))
      .filter(Boolean) as Tag[];
  }, [tagFilterIds, tags]);

  const availableFilterTags = useMemo(() => {
    return tags
      .filter((t) => !tagFilterIds.includes(t.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tagFilterIds, tags]);

  const filteredAndSortedSongs = useMemo(() => {
    let processedSongs = songs
      .filter((song) => !!song.lyrics)
      .filter(
        (song) =>
          searchTerm === "" ||
          song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (song.lyrics && song.lyrics.toLowerCase().includes(searchTerm.toLowerCase())),
      )
      .filter((song) => keyFilter === "all" || song.key === keyFilter)
      .filter((song) => {
        if (tagFilterIds.length === 0) return true;
        return tagFilterIds.some((tagId) => song.tagIds.includes(tagId));
      });

    switch (sortBy) {
      case "artist":
        processedSongs.sort((a, b) => a.artist.localeCompare(b.artist));
        break;
      case "newest":
        processedSongs.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case "title":
      default:
        processedSongs.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return processedSongs;
  }, [songs, searchTerm, keyFilter, tagFilterIds, sortBy]);

  if (loading) return <MusicWorkspaceSkeleton />;
  if (error) {
    return (
      <div className="ms-panel border-red-400/[0.14] p-5 text-center text-sm font-medium text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <RepertoireMetricsView songs={songs} mode="lyrics" />

      <section className="ms-panel relative overflow-hidden p-4 sm:p-5">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="search" className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">
              <Search className="h-3.5 w-3.5 text-primary-light/75" aria-hidden="true" />
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/26" aria-hidden="true" />
              <input
                id="search"
                type="search"
                placeholder="Buscar por título ou artista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-base min-h-[48px] w-full pl-11 pr-4 text-[14px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:w-[520px]">
            <div>
              <label htmlFor="keyFilter" className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/32">
                Tom
              </label>
              <select
                id="keyFilter"
                value={keyFilter}
                onChange={(e) => setKeyFilter(e.target.value)}
                className={`w-full ${formSelectClass}`}
              >
                <option value="all">Todos os tons</option>
                {uniqueKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sortBy" className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/32">
                Ordenar por:
              </label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`w-full ${formSelectClass}`}
              >
                <option value="title">Título (A-Z)</option>
                <option value="artist">Artista (A-Z)</option>
                <option value="newest">Mais Recentes</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/32">
                <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
                Tags
              </label>
              <select
                id="tag-filter-add"
                value=""
                onChange={(e) => {
                  const newId = e.target.value;
                  if (newId && !tagFilterIds.includes(newId)) {
                    setTagFilterIds((prev) => [...prev, newId]);
                  }
                }}
                className={`w-full ${formSelectClass}`}
                disabled={availableFilterTags.length === 0}
              >
                <option value="" disabled>
                  {availableFilterTags.length > 0 ? "Adicionar tag..." : "Nenhuma tag"}
                </option>
                {availableFilterTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedFilterTags.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.055] pt-4">
            {selectedFilterTags.map((tag) => (
              <div
                key={tag.id}
                className="flex min-h-[32px] items-center gap-1.5 rounded-full border border-primary/15 bg-primary/[0.07] px-3 text-[11px] font-semibold text-primary-light"
              >
                <span>{tag.name}</span>
                <button
                  type="button"
                  onClick={() => setTagFilterIds((prev) => prev.filter((id) => id !== tag.id))}
                  className="premium-interactive flex h-6 w-6 items-center justify-center rounded-full hover:bg-primary/10"
                  aria-label={`Remover tag ${tag.name}`}
                >
                  <XCircleIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {filteredAndSortedSongs.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4">
          {filteredAndSortedSongs.map((song) => (
            <ChordCard key={song.id} song={song} onClick={setSongInModal} showFormatBadge="letra" />
          ))}
        </div>
      ) : (
        <div className="ms-panel relative overflow-hidden px-5 py-16 text-center sm:py-20">
          <div className="pointer-events-none absolute left-1/2 top-0 h-28 w-52 -translate-x-1/2 rounded-full bg-primary/[0.055] blur-3xl" />
          <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-[17px] border border-white/[0.07] bg-white/[0.035] text-white/32">
            <FileText className="h-7 w-7" />
          </span>
          <h3 className="relative mt-4 text-lg font-semibold tracking-[-0.02em] text-white">
            Nenhuma Letra Encontrada
          </h3>
          <p className="relative mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-white/42">
            Ajuste os filtros ou adicione letras às músicas no seu repertório para vê-las aqui.
          </p>
        </div>
      )}

      <LyricsViewerModal
        isOpen={!!songInModal}
        onClose={() => setSongInModal(null)}
        song={songInModal}
      />
    </div>
  );
};

export default LyricsPage;
