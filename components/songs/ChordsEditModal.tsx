import React, { useState, useEffect } from "react";
import type { PopulatedSong } from "../../types";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Spinner from "../common/Spinner";

interface ChordsEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { songId: string; chords: string }) => Promise<void>;
  song: PopulatedSong | null;
  isSubmitting: boolean;
}

const ChordsEditModal: React.FC<ChordsEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  song,
  isSubmitting,
}) => {
  const [chords, setChords] = useState("");

  useEffect(() => {
    if (isOpen && song) {
      setChords(song.chords);
    } else if (!isOpen) {
      setChords("");
    }
  }, [isOpen, song]);

  const handleSave = () => {
    if (!song) return;
    onSave({ songId: song.id, chords: chords.trim() });
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
        Cancelar
      </Button>
      <Button onClick={handleSave} disabled={isSubmitting || !chords.trim()}>
        {isSubmitting ? <Spinner size="sm" /> : "Salvar Alterações"}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editando Cifra: ${song?.title}`}
      maxWidth="max-w-4xl"
      footer={footer}
      zIndexClass="z-[110]"
    >
      <textarea
        value={chords}
        onChange={(e) => setChords(e.target.value)}
        className="input-base !h-[60vh] font-mono text-sm resize-none"
        placeholder="Cole a cifra aqui..."
        aria-label="Editor de Cifras"
      />
    </Modal>
  );
};

export default ChordsEditModal;
