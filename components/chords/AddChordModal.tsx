import { logger } from "../../lib/logger";

import React, { useState, useEffect, useMemo } from "react";
import type { PopulatedSong } from "../../types";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Spinner from "../common/Spinner";

const ClipboardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
  </svg>
);
const Trash2Icon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

interface AddChordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { songId: string; chords: string }) => Promise<void>;
  songs: PopulatedSong[];
  isSubmitting: boolean;
}

const AddChordModal: React.FC<AddChordModalProps> = ({
  isOpen,
  onClose,
  onSave,
  songs,
  isSubmitting,
}) => {
  const [selectedSongId, setSelectedSongId] = useState("");
  const [chords, setChords] = useState("");

  const sortedSongs = useMemo(() => {
    return [...songs].sort((a, b) => a.title.localeCompare(b.title));
  }, [songs]);

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setSelectedSongId("");
      setChords("");
    }
  }, [isOpen]);

  const handleClear = () => setChords("");

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setChords((prev) => (prev ? `${prev}\n${text}` : text));
    } catch (err) {
      logger.error("Failed to paste from clipboard: ", err);
      alert("Não foi possível colar da área de transferência.");
    }
  };

  const handleSave = () => {
    if (!selectedSongId || !chords.trim()) return;
    onSave({ songId: selectedSongId, chords });
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
        Cancelar
      </Button>
      <Button
        onClick={handleSave}
        disabled={isSubmitting || !selectedSongId || !chords.trim()}
      >
        {isSubmitting ? <Spinner size="sm" /> : "Salvar Cifra"}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adicionar Nova Cifra"
      maxWidth="max-w-4xl"
      footer={footer}
      zIndexClass="z-[110]"
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="song-select"
            className="block text-sm font-medium text-slate-600 dark:text-gray-300"
          >
            Vincular à Música
          </label>
          <select
            id="song-select"
            value={selectedSongId}
            onChange={(e) => setSelectedSongId(e.target.value)}
            className="mt-1 input-base"
          >
            <option value="" disabled>
              Selecione uma música...
            </option>
            {sortedSongs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title} - {song.artist}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-gray-800/50 rounded-lg">
          <Button
            size="sm"
            variant="secondary"
            onClick={handlePaste}
            leftIcon={<ClipboardIcon className="w-4 h-4" />}
          >
            Colar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleClear}
            className="ml-auto !border-red-500/50 !bg-red-500/10 !text-red-500 hover:!bg-red-500/20"
            leftIcon={<Trash2Icon className="w-4 h-4" />}
          >
            Limpar
          </Button>
        </div>

        <textarea
          value={chords}
          onChange={(e) => setChords(e.target.value)}
          className="input-base !h-[50vh] font-mono text-sm resize-none"
          placeholder="Cole a cifra aqui..."
          aria-label="Editor de Cifras"
        />
      </div>
    </Modal>
  );
};

export default AddChordModal;
