import React, { useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { useTranslation } from "react-i18next";
import {
  parseBackupFile,
  restoreBackup,
  BackupData,
} from "../../services/backupService";
import {
  Upload as FileUpIcon,
  Check as CheckIcon,
  X as XMarkIcon,
  FileText as DocumentTextIcon,
  Music as MusicalNoteIcon,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportGlobalSongsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collectionsToRestore, setCollectionsToRestore] = useState<string[]>([
    "songs",
    "lyrics",
    "chords",
  ]);

  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const processFile = async (selected: File) => {
    setFile(selected);
    setIsParsing(true);
    setError(null);
    setBackupData(null);

    try {
      const data = await parseBackupFile(selected);
      // Validate that at least one of the target collections exists in the backup
      const hasSongs =
        data.collections.songs && data.collections.songs.length > 0;
      const hasLyrics =
        data.collections.lyrics && data.collections.lyrics.length > 0;
      const hasChords =
        data.collections.chords && data.collections.chords.length > 0;

      if (!hasSongs && !hasLyrics && !hasChords) {
        throw new Error(
          t("library.import_modal.empty_error", "O arquivo não contém músicas, letras ou cifras válidas."),
        );
      }

      setBackupData(data);
    } catch (err: any) {
      setError(err.message || t("library.import_modal.parse_error", "Erro ao ler arquivo."));
      setFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (droppedFile.name.endsWith(".json")) {
        processFile(droppedFile);
      } else {
        setError(t("library.import_modal.only_json_error", "Por favor, selecione apenas arquivos .json"));
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const handleImport = async () => {
    if (!backupData || collectionsToRestore.length === 0) return;

    setIsImporting(true);
    setError(null);

    try {
      await restoreBackup({
        backupData,
        collectionsToRestore,
        bindToCurrentOrganization: false,
        importToLocalOrganization: false,
        saveToGlobalLibrary: true,
        globalSongStatus: "active", // Make them active instantly in the global library
        onProgress: (msg, prog) => {
          setStatusMsg(msg);
          setProgress(prog);
        },
      });

      onSuccess();
      onClose();
      // Reset state
      setFile(null);
      setBackupData(null);
      setIsImporting(false);
      setProgress(0);
      setStatusMsg("");
    } catch (err: any) {
      setError(err.message || t("library.import_modal.import_error", "Erro ao importar dados."));
      setIsImporting(false);
    }
  };

  const toggleCollection = (col: string) => {
    setCollectionsToRestore((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const getCollectionCount = (col: string) => {
    return backupData?.collections[col]?.length || 0;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isImporting ? () => {} : onClose}
      title={t("library.import_modal.title", "Importar para Biblioteca Viva")}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {!backupData ? (
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {t("library.import_modal.desc", "Faça upload de um arquivo de backup do MusicScale (JSON) para extrair as músicas, cifras e letras e enviá-las diretamente para o acervo global.")}
            </p>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer group ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[1.01] ring-4 ring-primary/10"
                  : "border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-[#1C1C1E]"
              }`}
            >
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={isParsing}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center w-full"
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <FileUpIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </div>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {isParsing
                    ? t("library.import_modal.analyzing", "Analisando arquivo...")
                    : t("library.import_modal.btn_json", "Importar arquivo .JSON")}
                </span>
                <span className="text-xs text-slate-500 mt-1 font-medium">
                  {t("library.import_modal.drop_msg", "Clique ou arraste o backup para cá")}
                </span>
              </label>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-900/30">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-white/10 pb-4">
              <div>
                <h4 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                  <CheckIcon className="w-5 h-5 text-green-500" />
                  {t("library.import_modal.recognized", "Arquivo reconhecido")}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {t("library.import_modal.select_desc", "Selecione quais dados você deseja importar para a Biblioteca Viva")}
                </p>
              </div>
              <button
                onClick={() => setBackupData(null)}
                disabled={isImporting}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                {t("library.import_modal.change_file", "Trocar Arquivo")}
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {[
                {
                  id: "songs",
                  icon: MusicalNoteIcon,
                  label: t("library.import_modal.songs_pool", "Acervo de Músicas"),
                },
                {
                  id: "lyrics",
                  icon: DocumentTextIcon,
                  label: t("library.import_modal.lyrics_sync", "Letras (Sincronizadas)"),
                },
                { id: "chords", icon: DocumentTextIcon, label: t("library.import_modal.chords", "Cifras") },
              ].map((col) => {
                const count = getCollectionCount(col.id);
                if (count === 0) return null;

                return (
                  <label
                    key={col.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={collectionsToRestore.includes(col.id)}
                        onChange={() => toggleCollection(col.id)}
                        disabled={isImporting}
                        className="w-4 h-4 text-primary rounded bg-transparent"
                      />
                      <div className="flex items-center gap-2">
                        <col.icon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {col.label}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md text-slate-500 dark:text-slate-400">
                      {count} {count === 1 ? t("item", "item") : t("items", "itens")}
                    </span>
                  </label>
                );
              })}
            </div>

            {isImporting && (
              <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between text-sm mb-2 font-medium text-primary-dark dark:text-primary-light">
                  <span>{statusMsg || t("library.import_modal.processing", "Processando...")}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-white/50 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-900/30">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
              <Button
                disabled={isImporting}
                variant="secondary"
                onClick={onClose}
              >
                {t("library.import_modal.cancel", "Cancelar")}
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || collectionsToRestore.length === 0}
                variant="primary"
              >
                {isImporting ? t("library.import_modal.importing", "Importando...") : t("library.import_modal.import_btn", "Importar Selecionados")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
