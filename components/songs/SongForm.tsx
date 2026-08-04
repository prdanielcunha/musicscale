// FIX: Implemented the SongForm component for adding and editing songs.
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Song, PopulatedSong, Tag, ChordKeyRepairDraftSong } from "../../types";
import { useEcosystemAdmin } from "../../hooks/useEcosystemAdmin";
import Button from "../common/Button";
import { useAuth } from "../../contexts/AuthContext";
import { useModals } from "../../contexts/ModalContext";
import { detectLanguageFromText } from "../../utils/languageDetector";
import { getSongFreshnessStatus } from "../../utils/songHelpers";
import { Globe, ShieldCheck } from "lucide-react";

const formInputClass = "mt-1 input-base";
const formLabelClass =
  "block text-[11px] font-black tracking-widest text-slate-400 uppercase dark:text-slate-500 mb-2 ml-1";

interface SongFormProps {
  songToEdit?: PopulatedSong | null;
  onSave: (
    songData:
      | Omit<Song, "id" | "createdAt" | "lastPlayed" | "createdBy">
      | Song,
    options: { saveToOrganization: boolean; saveToGlobalLibrary: boolean },
    onSuccess?: () => void
  ) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
  tags: Tag[];
  defaultOptions?: { saveToOrganization: boolean; saveToGlobalLibrary: boolean };
}

const SongForm: React.FC<SongFormProps> = ({
  songToEdit,
  onSave,
  onClose,
  isSubmitting,
  tags,
  defaultOptions,
}) => {
  const { t } = useTranslation();
  const { openChordKeyRepair } = useModals();
  const { userProfile, permissions, organization } = useAuth();
  const { isEcosystemAdmin } = useEcosystemAdmin();
  const canManageRepertoire = !!(permissions?.manageSongs || permissions?.['musicScale.manageSongs']);
  const canManageChords = !!(permissions?.manageSongs || permissions?.['musicScale.manageSongs'] || permissions?.manageChords || permissions?.['musicscale.chords.edit']);

  const [formData, setFormData] = useState({
    title: songToEdit?.title || "",
    artist: songToEdit?.artist || "",
    key: songToEdit?.key || "",
    bpm: songToEdit?.bpm ?? '',
    status: songToEdit?.status || "active",
    tagIds: songToEdit?.tagIds || [],
    lyrics: songToEdit?.lyrics || "",
    chords: songToEdit?.chords || "",
    chordsUrl: songToEdit?.chordsUrl || "",
    videoUrl: songToEdit?.videoUrl || "",
    freshnessStatus: songToEdit ? getSongFreshnessStatus(songToEdit) : "new",
    language: songToEdit?.language || "unknown",
  });

  const [formMetadata, setFormMetadata] = useState<Record<string, any>>(songToEdit?.metadata || {});
  
  const [manualLanguageSelected, setManualLanguageSelected] = useState(false);

  const [options, setOptions] = useState({
    saveToOrganization: defaultOptions?.saveToOrganization ?? true,
    saveToGlobalLibrary: defaultOptions?.saveToGlobalLibrary ?? false,
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    if (e.target.type === "checkbox") {
      const { name, checked } = e.target as HTMLInputElement;
      if (name === "saveToOrganization" || name === "saveToGlobalLibrary") {
        setOptions((prev) => ({ ...prev, [name]: checked }));
        return;
      }
      setFormData((prev) => ({ ...prev, [name]: checked }));
      return;
    }
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tagId: string) => {
    setFormData((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Detect language
    const textForDetection = formData.lyrics || formData.title + ' ' + formData.artist;
    const detected = detectLanguageFromText(textForDetection);

    const finalBpm = formData.bpm ? Number(formData.bpm) : null;
    const isNewBpm = finalBpm !== null && finalBpm !== songToEdit?.bpm;

    const finalLanguage = manualLanguageSelected ? formData.language : (formData.language !== 'unknown' ? formData.language : detected.language);

    const nowIso = new Date().toISOString();
    const currentStatus = songToEdit ? getSongFreshnessStatus(songToEdit) : 'new';
    const isManualFreshness = formData.freshnessStatus !== currentStatus;

    const finalFreshness = {
      status: formData.freshnessStatus as "default" | "new" | "old",
      source: (isManualFreshness ? 'manual' : (songToEdit?.freshness?.source || 'auto')) as "auto" | "manual",
      manualResetAt: isManualFreshness ? nowIso : (songToEdit?.freshness?.manualResetAt || null),
      autoUpdatedAt: songToEdit?.freshness?.autoUpdatedAt || null
    };

    if (songToEdit) {
      const updatedSong: Song = {
        id: songToEdit.id,
        organizationId: songToEdit.organizationId,
        title: formData.title,
        artist: formData.artist,
        key: formData.key,
        bpm: finalBpm,
        ...(isNewBpm && { bpmConfidence: 'user_provided', bpmSource: 'manual' }),
        status: formData.status as "active" | "inactive",
        tagIds: formData.tagIds,
        lyrics: formData.lyrics,
        chords: formData.chords,
        chordsUrl: formData.chordsUrl,
        videoUrl: formData.videoUrl,
        language: finalLanguage,
        languageDetection: detected,
        createdAt: songToEdit.createdAt,
        lastPlayed: songToEdit.lastPlayed,
        createdBy: songToEdit.createdBy,
        freshness: finalFreshness,
        metadata: {
          ...(songToEdit.metadata || {}),
          ...formMetadata,
        },
      };
      onSave(updatedSong, options);
    } else {
      const songDataForNew = {
        title: formData.title,
        artist: formData.artist,
        key: formData.key,
        bpm: finalBpm,
        ...(isNewBpm && { bpmConfidence: 'user_provided', bpmSource: 'manual' }),
        status: formData.status as "active" | "inactive",
        tagIds: formData.tagIds,
        lyrics: formData.lyrics,
        chords: formData.chords,
        chordsUrl: formData.chordsUrl,
        videoUrl: formData.videoUrl,
        language: finalLanguage,
        languageDetection: detected,
        freshness: finalFreshness,
        metadata: { ...formMetadata },
      };
      // Type casting because the type might expect other things that are implicitly excluded or included
      onSave(songDataForNew as any, options);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="title" className={formLabelClass}>
            Título
          </label>
          <input
            type="text"
            name="title"
            id="title"
            value={formData.title}
            onChange={handleChange}
            className={formInputClass}
            required
            disabled={!canManageRepertoire}
          />
        </div>
        <div>
          <label htmlFor="artist" className={formLabelClass}>
            Artista
          </label>
          <input
            type="text"
            name="artist"
            id="artist"
            value={formData.artist}
            onChange={handleChange}
            className={formInputClass}
            required
            disabled={!canManageRepertoire}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label htmlFor="key" className={formLabelClass}>
            Tom
          </label>
          <input
            type="text"
            name="key"
            id="key"
            value={formData.key}
            onChange={handleChange}
            className={formInputClass}
            required
            disabled={!canManageRepertoire}
          />
        </div>
        <div>
          <label htmlFor="bpm" className={formLabelClass}>
            BPM
          </label>
          <input
            type="number"
            name="bpm"
            id="bpm"
            value={formData.bpm}
            onChange={handleChange}
            className={formInputClass}
            required
            disabled={!canManageRepertoire}
          />
        </div>
        <div>
          <label htmlFor="status" className={formLabelClass}>
            Status
          </label>
          <select
            name="status"
            id="status"
            value={formData.status}
            onChange={handleChange}
            className={formInputClass}
            required
            disabled={!canManageRepertoire}
          >
            <option value="active">Ativa</option>
            <option value="inactive">Inativa</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status da Música */}
        <div>
          <label className={formLabelClass}>Status da Música</label>
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl w-full border border-slate-200/50 dark:border-white/10 shadow-sm">
            {(["default", "new", "old"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, freshnessStatus: status }))}
                disabled={!canManageRepertoire}
                className={`flex-1 text-[13px] py-2 px-2 font-bold rounded-xl transition-all ${
                  formData.freshnessStatus === status 
                    ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md dark:shadow-black/50 border border-slate-200/50 dark:border-white/10" 
                    : "text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {status === "default" ? "Sem status" : status === "new" ? "Nova" : "Antiga"}
              </button>
            ))}
          </div>
        </div>

        {/* Idioma */}
        <div>
          <label className={formLabelClass}>Idioma</label>
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl w-full border border-slate-200/50 dark:border-white/10 shadow-sm overflow-x-auto scroller-hide">
            {(["unknown", "pt", "en", "es", "other"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, language: lang }));
                  setManualLanguageSelected(true);
                }}
                disabled={!canManageRepertoire}
                className={`flex-1 min-w-max text-[13px] py-2 px-3 font-bold rounded-xl transition-all ${
                  formData.language === lang 
                    ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md dark:shadow-black/50 border border-slate-200/50 dark:border-white/10" 
                    : "text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {lang === "unknown" && "? Desc."}
                {lang === "pt" && "🇧🇷 Português"}
                {lang === "en" && "🇺🇸 Inglês"}
                {lang === "es" && "🇪🇸 Espanhol"}
                {lang === "other" && "🌐 Outro"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className={formLabelClass}>Tags</label>
        <fieldset
          disabled={!canManageRepertoire}
          className="mt-2 flex flex-wrap gap-2 p-3 bg-slate-100 dark:bg-gray-700/30 rounded-lg border border-slate-200 dark:border-gray-600"
        >
          {tags.length > 0 ? (
            tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleTagToggle(tag.id)}
                className={`px-3 py-1 text-sm rounded-full transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed ${
                  formData.tagIds.includes(tag.id)
                    ? "bg-primary text-white shadow-md"
                    : "bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700"
                }`}
              >
                {tag.name}
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-400 dark:text-gray-500">
              Nenhuma tag cadastrada.
            </p>
          )}
        </fieldset>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="lyrics" className={formLabelClass}>
            Letra
          </label>
          <textarea
            name="lyrics"
            id="lyrics"
            rows={8}
            value={formData.lyrics}
            onChange={handleChange}
            className={formInputClass}
            placeholder="Cole a letra da música aqui..."
            disabled={!canManageRepertoire}
          ></textarea>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="chords" className="block text-[11px] font-black tracking-widest text-slate-400 uppercase dark:text-slate-500 ml-1 mb-0">
              Cifra
            </label>
            {formData.chords && canManageChords && (
              <button
                type="button"
                onClick={() => {
                  const draftSong: ChordKeyRepairDraftSong = {
                    title: formData.title,
                    artist: formData.artist,
                    key: formData.key,
                    originalKey: songToEdit?.originalKey || songToEdit?.key || formData.key,
                    selectedKey: formData.key,
                    chords: formData.chords,
                    metadata: { ...(songToEdit?.metadata || {}), ...formMetadata },
                  };
                  openChordKeyRepair(
                    draftSong,
                    (updatedSong) => {
                      setFormData((prev) => ({
                        ...prev,
                        chords: updatedSong.chords || prev.chords,
                      }));
                      if (updatedSong.metadata) {
                        setFormMetadata((prev) => ({
                          ...prev,
                          ...updatedSong.metadata,
                        }));
                      }
                    },
                    'draft'
                  );
                }}
                className="text-xs text-indigo-500 hover:text-indigo-600 font-bold flex items-center gap-1 focus:outline-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A1.79 1.79 0 0020 18.25l-5.83-5.83M11.42 15.17l2.43-2.43M11.42 15.17L3 12h8l3-3 3 3h-2l-3.58 3.58M12 3v9h9" />
                </svg>
                {t('chordKeyRepair.title', 'Ajustar tom da cifra')}
              </button>
            )}
          </div>
          <textarea
            name="chords"
            id="chords"
            rows={8}
            value={formData.chords}
            onChange={handleChange}
            className={`${formInputClass} font-mono`}
            placeholder="Cole a cifra completa aqui..."
            disabled={!canManageChords}
          ></textarea>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="chordsUrl" className={formLabelClass}>
            URL da Cifra (Opcional)
          </label>
          <input
            type="url"
            name="chordsUrl"
            id="chordsUrl"
            value={formData.chordsUrl}
            onChange={handleChange}
            className={formInputClass}
            placeholder="https://..."
            disabled={!canManageChords}
          />
        </div>
        <div>
          <label htmlFor="videoUrl" className={formLabelClass}>
            Referência de Ensaio (YouTube/Audio URL)
          </label>
          <input
            type="url"
            name="videoUrl"
            id="videoUrl"
            value={formData.videoUrl}
            onChange={handleChange}
            className={formInputClass}
            placeholder="https://youtube.com/... (Opcional)"
            disabled={!canManageRepertoire}
          />
        </div>
      </div>

      {/* Save Options */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Destino do Salvamento</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${options.saveToOrganization ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/20' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'}`}
          >
            <input
              type="checkbox"
              name="saveToOrganization"
              checked={options.saveToOrganization}
              onChange={handleChange}
              className="h-5 w-5 rounded bg-slate-200 dark:bg-gray-700 border-slate-300 dark:border-gray-600 text-primary focus:ring-primary-dark"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${options.saveToOrganization ? 'text-primary' : 'text-slate-400'}`} />
                <span className={`text-sm font-bold ${options.saveToOrganization ? 'text-primary' : 'text-slate-700 dark:text-gray-300'}`}>Organização Atual</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{organization?.name || 'Sua equipe'}</p>
            </div>
          </label>

          {isEcosystemAdmin && (
            <label
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${options.saveToGlobalLibrary ? 'bg-orange-500/5 border-orange-500/20 ring-1 ring-orange-500/20' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'}`}
            >
              <input
                type="checkbox"
                name="saveToGlobalLibrary"
                checked={options.saveToGlobalLibrary}
                onChange={handleChange}
                className="h-5 w-5 rounded bg-slate-200 dark:bg-gray-700 border-slate-300 dark:border-gray-600 text-orange-500 focus:ring-orange-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Globe className={`w-4 h-4 ${options.saveToGlobalLibrary ? 'text-orange-500' : 'text-slate-400'}`} />
                  <span className={`text-sm font-bold ${options.saveToGlobalLibrary ? 'text-orange-500' : 'text-slate-700 dark:text-gray-300'}`}>Salvar também na Biblioteca Viva MusicScale</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Estará disponível publicamente na Biblioteca Viva</p>
              </div>
            </label>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || (!canManageRepertoire && !canManageChords) || (!options.saveToOrganization && !options.saveToGlobalLibrary)}
        >
          {isSubmitting
            ? "Salvando..."
            : songToEdit
              ? "Salvar Alterações"
              : "Adicionar Música"}
        </Button>
      </div>
    </form>
  );
};

export default SongForm;
