import React, { useState, useMemo, useEffect } from "react";
import { useMusic } from "../contexts/MusicDataContext";
import type { PopulatedSong, Tag } from "../types";
import Spinner from "../components/common/Spinner";
import LyricsViewerModal from "../components/songs/LyricsViewerModal";
import ChordCard from "../components/chords/ChordCard";
import { XCircleIcon } from "../components/icons/XCircleIcon";
import Card from "../components/common/Card";
import { FileText } from "lucide-react";
import { RepertoireMetricsView } from "../components/songs/RepertoireMetricsView";

const formSelectClass = "input-base";
const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor"
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
      clipRule="evenodd"
    />
  </svg>
);

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

  if (loading)
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner />
      </div>
    );
  if (error) return <div className="text-red-500 text-center">{error}</div>;

  return (
    <div className="space-y-6">
      <RepertoireMetricsView songs={songs} mode="lyrics" />
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1">
            <label
              htmlFor="search"
              className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1"
            >
              Buscar
            </label>
            <input
              id="search"
              type="search"
              placeholder="Buscar por título ou artista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-base px-3 py-2 text-[14px]"
            />
          </div>
          <div>
            <label
              htmlFor="keyFilter"
              className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1"
            >
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
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white dark:bg-[#1A1A1C]/60 border border-slate-300 dark:border-white/10 rounded-lg min-h-[44px]">
              {selectedFilterTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-1 bg-primary/10 text-primary-dark dark:text-primary-light text-xs font-semibold px-2 py-1 rounded-full"
                >
                  <span>{tag.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setTagFilterIds((prev) =>
                        prev.filter((id) => id !== tag.id),
                      )
                    }
                    className="hover:bg-primary/20 rounded-full"
                    aria-label={`Remover tag ${tag.name}`}
                  >
                    <XCircleIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="relative flex-grow min-w-[120px]">
                <select
                  id="tag-filter-add"
                  value=""
                  onChange={(e) => {
                    const newId = e.target.value;
                    if (newId && !tagFilterIds.includes(newId)) {
                      setTagFilterIds((prev) => [...prev, newId]);
                    }
                  }}
                  className="w-full h-full appearance-none bg-transparent border-none focus:ring-0 text-sm text-slate-500 dark:text-gray-400 p-1 cursor-pointer"
                  disabled={availableFilterTags.length === 0}
                >
                  <option value="" disabled>
                    {availableFilterTags.length > 0
                      ? "Adicionar tag..."
                      : "Nenhuma tag"}
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
        </div>
        <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-4 border-t border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-2">
            <label
              htmlFor="sortBy"
              className="text-xs font-medium text-slate-500 dark:text-gray-400"
            >
              Ordenar por:
            </label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`${formSelectClass} !py-1.5 !px-3`}
            >
              <option value="title">Título (A-Z)</option>
              <option value="artist">Artista (A-Z)</option>
              <option value="newest">Mais Recentes</option>
            </select>
          </div>
        </div>
      </Card>

      {filteredAndSortedSongs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAndSortedSongs.map((song) => (
            <ChordCard key={song.id} song={song} onClick={setSongInModal} showFormatBadge="letra" />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white/60 dark:bg-[#1A1A1C]/60 rounded-[28px] border border-black/[0.04] dark:border-white/[0.06]">
          <FileText className="mx-auto h-16 w-16 text-slate-400 dark:text-gray-500 opacity-50" />
          <h3 className="mt-4 text-xl font-bold text-slate-800 dark:text-white">
            Nenhuma Letra Encontrada
          </h3>
          <p className="mt-2 text-base text-slate-500 dark:text-gray-400 max-w-md mx-auto">
            Ajuste os filtros ou adicione letras às músicas no seu repertório
            para vê-las aqui.
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
