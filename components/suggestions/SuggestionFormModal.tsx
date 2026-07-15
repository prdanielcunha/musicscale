import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Spinner from "../common/Spinner";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";
import { LinkIcon } from "../icons/LinkIcon";
import { PlusCircleIcon } from "../icons/PlusCircleIcon";
import { XCircleIcon } from "../icons/XCircleIcon";
import { UserIcon } from "../icons/UserIcon";
import { useAuth } from "../../contexts/AuthContext";
import { SuggestionIcon } from "../icons/SuggestionIcon";

const formInputClass = "mt-1 input-base";
const formLabelClass = "block text-[11px] font-black tracking-widest text-slate-400 uppercase dark:text-slate-500 mb-2 ml-1";

interface SuggestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    songs: { title: string; artist: string; link: string }[],
  ) => Promise<void>;
  isSubmitting: boolean;
}

const SuggestionFormModal: React.FC<SuggestionFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  isSubmitting,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [songs, setSongs] = useState([
    { id: 1, title: "", artist: "", link: "" },
  ]);

  const addSongField = () => {
    setSongs([...songs, { id: Date.now(), title: "", artist: "", link: "" }]);
  };

  const removeSongField = (id: number) => {
    if (songs.length > 1) {
      setSongs(songs.filter((song) => song.id !== id));
    }
  };

  const handleSongChange = (
    id: number,
    field: "title" | "artist" | "link",
    value: string,
  ) => {
    setSongs(
      songs.map((song) =>
        song.id === id ? { ...song, [field]: value } : song,
      ),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validSongs = songs.filter((s) => s.title.trim() && s.artist.trim());
    if (validSongs.length > 0) {
      onSave(validSongs);
    }
  };

  const footer = (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-gray-400">
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || ""}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <UserIcon className="w-4 h-4" />
          )}
        </div>
        <span>
          {t("suggestions.suggesting_as")} <strong>{user?.displayName}</strong>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          {t("suggestions.cancel")}
        </Button>
        <Button
          type="submit"
          form="suggestion-form"
          disabled={
            isSubmitting ||
            songs.every((s) => !s.title.trim() || !s.artist.trim())
          }
        >
          {isSubmitting ? <Spinner size="sm" /> : t("suggestions.submit_btn")}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      footer={footer}
      maxWidth="max-w-3xl"
      noPadding
    >
      <div className="p-6">
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center mb-3">
            <SuggestionIcon className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t("suggestions.form_title")}
          </h2>
          <p className="text-slate-500 dark:text-gray-400 mt-1">
            {t("suggestions.form_desc")}
          </p>
        </div>
        <form
          id="suggestion-form"
          onSubmit={handleSubmit}
          className="space-y-4 max-h-[60vh] overflow-y-auto pr-2"
        >
          {songs.map((song, index) => (
            <div
              key={song.id}
              className="p-4 bg-slate-100 dark:bg-gray-700/50 rounded-lg border border-slate-200 dark:border-gray-700 relative"
            >
              {songs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSongField(song.id)}
                  className="absolute top-2 right-2 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400"
                  aria-label={t("suggestions.remove_song")}
                >
                  <XCircleIcon className="w-5 h-5" />
                </button>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor={`title-${song.id}`}
                    className={formLabelClass}
                  >
                    {t("suggestions.song_title_label")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id={`title-${song.id}`}
                    value={song.title}
                    onChange={(e) =>
                      handleSongChange(song.id, "title", e.target.value)
                    }
                    className={formInputClass}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor={`artist-${song.id}`}
                    className={formLabelClass}
                  >
                    {t("suggestions.song_artist_label")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id={`artist-${song.id}`}
                    value={song.artist}
                    onChange={(e) =>
                      handleSongChange(song.id, "artist", e.target.value)
                    }
                    className={formInputClass}
                    required
                  />
                </div>
              </div>
              <div className="mt-4">
                <label htmlFor={`link-${song.id}`} className={formLabelClass}>
                  {t("suggestions.song_link_label")}
                </label>
                <input
                  type="url"
                  id={`link-${song.id}`}
                  value={song.link}
                  onChange={(e) =>
                    handleSongChange(song.id, "link", e.target.value)
                  }
                  className={formInputClass}
                  placeholder="https://..."
                />
              </div>
            </div>
          ))}
        </form>
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={addSongField}
            leftIcon={<PlusCircleIcon className="w-5 h-5" />}
          >
            {t("suggestions.add_another_song_btn")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SuggestionFormModal;
