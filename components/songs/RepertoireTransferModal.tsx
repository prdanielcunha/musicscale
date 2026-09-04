import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PopulatedSong } from "../../types";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Spinner from "../common/Spinner";
import {
  normalizeSongIdentity,
  parseRepertoireCsv,
  serializeRepertoireCsv,
  type RepertoireTransferRow,
} from "../../utils/repertoireTransfer";
import { useApi } from "../../contexts/ApiContext";
import { useAuth } from "../../contexts/AuthContext";

interface RepertoireTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: PopulatedSong[];
  maxSongs: number;
  onImported: () => Promise<void> | void;
}

type PreviewRow = RepertoireTransferRow & {
  identity: string;
  duplicate: boolean;
  selected: boolean;
};

const downloadText = (content: string, fileName: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const RepertoireTransferModal: React.FC<RepertoireTransferModalProps> = ({
  isOpen,
  onClose,
  songs,
  maxSongs,
  onImported,
}) => {
  const { t } = useTranslation();
  const api = useApi();
  const { permissions } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canManageRepertoire = !!(
    permissions?.manageSongs ||
    permissions?.["musicScale.manageSongs"] ||
    permissions?.["musicscale.songs.edit"]
  );

  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const existingIdentities = useMemo(
    () => new Set(songs.map((song) => normalizeSongIdentity(song.title, song.artist))),
    [songs],
  );

  const selectedRows = preview.filter((row) => row.selected && !row.duplicate);
  const remainingCapacity = Number.isFinite(maxSongs)
    ? Math.max(0, maxSongs - songs.length)
    : Number.POSITIVE_INFINITY;
  const importableRows = Number.isFinite(remainingCapacity)
    ? selectedRows.slice(0, remainingCapacity)
    : selectedRows;
  const capacityExceeded = selectedRows.length > importableRows.length;

  const reset = () => {
    setPreview([]);
    setFileName("");
    setUnknownHeaders([]);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (isImporting) return;
    reset();
    onClose();
  };

  const handleExport = () => {
    const csv = serializeRepertoireCsv(songs);
    const date = new Date().toISOString().slice(0, 10);
    downloadText(csv, `musicscale-repertorio-${date}.csv`);
  };

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setPreview([]);
      setError(
        t(
          "repertoireTransfer.csv_only",
          "Neste primeiro importador seguro, selecione um arquivo CSV. O backup JSON existente continua disponível sem alterações.",
        ),
      );
      return;
    }

    try {
      const text = await file.text();
      const result = parseRepertoireCsv(text);
      if (result.rows.length === 0) {
        throw new Error(
          t(
            "repertoireTransfer.no_rows",
            "Não encontramos músicas válidas. O arquivo precisa ter uma coluna de título/música.",
          ),
        );
      }

      const seen = new Set(existingIdentities);
      const nextPreview = result.rows.map((row) => {
        const identity = normalizeSongIdentity(row.title, row.artist);
        const duplicate = seen.has(identity);
        seen.add(identity);
        return {
          ...row,
          identity,
          duplicate,
          selected: !duplicate,
        };
      });

      setUnknownHeaders(result.unknownHeaders);
      setPreview(nextPreview);
    } catch (reason: any) {
      setPreview([]);
      setError(
        reason?.message ||
          t("repertoireTransfer.read_error", "Não conseguimos ler este arquivo."),
      );
    }
  };

  const toggleRow = (identity: string) => {
    setPreview((current) =>
      current.map((row) =>
        row.identity === identity && !row.duplicate
          ? { ...row, selected: !row.selected }
          : row,
      ),
    );
  };

  const handleImport = async () => {
    if (!api || !canManageRepertoire || importableRows.length === 0) return;

    setIsImporting(true);
    setError(null);
    setProgress(0);

    try {
      for (let index = 0; index < importableRows.length; index++) {
        const row = importableRows[index];
        await api.songs.create({
          title: row.title,
          artist: row.artist || t("repertoireTransfer.unknown_artist", "Artista não informado"),
          key: row.key || "C",
          originalKey: row.key || undefined,
          selectedKey: row.key || undefined,
          version: row.version || "Original",
          bpm: row.bpm,
          rhythm: row.rhythm || undefined,
          sections: [],
          status: "active",
          tagIds: [],
          lyrics: row.lyrics,
          chords: row.chords,
          chordsUrl: row.chordsUrl,
          videoUrl: row.videoUrl,
          language: ["pt", "en", "es", "other", "unknown"].includes(row.language)
            ? (row.language as any)
            : "unknown",
          tabs: row.tabs,
          metadata: {
            importSource: "repertoire_csv",
            importedAt: new Date().toISOString(),
            originalFileName: fileName,
          },
          aiProcessed: false,
          sourceType: "csv",
          freshness: {
            status: "new",
            source: "manual",
            manualResetAt: new Date().toISOString(),
          },
        } as any);

        setProgress(Math.round(((index + 1) / importableRows.length) * 100));
      }

      await onImported();
      reset();
      onClose();
    } catch (reason: any) {
      setError(
        reason?.message ||
          t(
            "repertoireTransfer.import_error",
            "A importação foi interrompida. As músicas já concluídas foram preservadas; nenhuma música existente foi sobrescrita.",
          ),
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("repertoireTransfer.title", "Transferir repertório")}
      maxWidth="max-w-5xl"
    >
      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#09090C] text-white">
        <div className="absolute -top-32 right-[-5rem] h-72 w-72 rounded-full bg-indigo-500/[0.10] blur-[100px] pointer-events-none" />
        <div className="relative p-5 md:p-7 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canManageRepertoire || isImporting}
              className="group min-h-[138px] text-left rounded-[22px] border border-white/[0.08] bg-white/[0.035] hover:bg-white/[0.055] p-5 transition-all disabled:opacity-45"
            >
              <div className="w-10 h-10 rounded-xl border border-indigo-300/15 bg-indigo-400/[0.09] text-indigo-200 flex items-center justify-center mb-4">
                <span className="text-xl leading-none">↓</span>
              </div>
              <p className="text-[15px] font-bold tracking-tight">
                {t("repertoireTransfer.import_csv", "Trazer repertório")}
              </p>
              <p className="text-xs leading-relaxed text-white/42 mt-1.5">
                {t(
                  "repertoireTransfer.import_desc",
                  "Importe CSV de outro sistema ou planilha. Antes de salvar, o MusicScale mostra duplicatas e o que será criado.",
                )}
              </p>
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={songs.length === 0 || isImporting}
              className="group min-h-[138px] text-left rounded-[22px] border border-white/[0.08] bg-white/[0.035] hover:bg-white/[0.055] p-5 transition-all disabled:opacity-45"
            >
              <div className="w-10 h-10 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.08] text-emerald-200 flex items-center justify-center mb-4">
                <span className="text-xl leading-none">↑</span>
              </div>
              <p className="text-[15px] font-bold tracking-tight">
                {t("repertoireTransfer.export_csv", "Exportar repertório")}
              </p>
              <p className="text-xs leading-relaxed text-white/42 mt-1.5">
                {t(
                  "repertoireTransfer.export_desc",
                  "Baixe uma cópia portátil com tom, BPM, letra, cifra, links, versão, ritmo e partes técnicas.",
                )}
              </p>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          {fileName && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white/75 truncate">{fileName}</p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  {preview.length
                    ? t("repertoireTransfer.rows_found", "{{count}} músicas encontradas", {
                        count: preview.length,
                      })
                    : t("repertoireTransfer.analyzing_file", "Arquivo selecionado")}
                </p>
              </div>
              {!isImporting && (
                <button
                  type="button"
                  onClick={reset}
                  className="text-[10px] font-bold uppercase tracking-widest text-white/35 hover:text-white/70"
                >
                  {t("repertoireTransfer.change", "Trocar")}
                </button>
              )}
            </div>
          )}

          {unknownHeaders.length > 0 && (
            <p className="text-[11px] leading-relaxed text-white/32">
              {t(
                "repertoireTransfer.ignored_columns",
                "Colunas extras foram preservadas no arquivo original e ignoradas na importação: {{columns}}",
                { columns: unknownHeaders.join(", ") },
              )}
            </p>
          )}

          {error && (
            <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.06] px-4 py-3 text-xs leading-relaxed text-red-100/75">
              {error}
            </div>
          )}

          {preview.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-3">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-white/30 font-bold">
                    {t("repertoireTransfer.new_label", "Novas")}
                  </p>
                  <p className="text-xl font-black mt-0.5">{selectedRows.length}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-3">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-white/30 font-bold">
                    {t("repertoireTransfer.duplicates", "Duplicadas")}
                  </p>
                  <p className="text-xl font-black mt-0.5">
                    {preview.filter((row) => row.duplicate).length}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-3">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-white/30 font-bold">
                    {t("repertoireTransfer.capacity", "Capacidade")}
                  </p>
                  <p className="text-xl font-black mt-0.5">
                    {Number.isFinite(remainingCapacity) ? remainingCapacity : "∞"}
                  </p>
                </div>
              </div>

              <div className="max-h-[340px] overflow-y-auto rounded-[22px] border border-white/[0.06] divide-y divide-white/[0.05]">
                {preview.map((row, index) => (
                  <button
                    type="button"
                    key={`${row.identity}-${index}`}
                    onClick={() => toggleRow(row.identity)}
                    disabled={row.duplicate || isImporting}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/[0.025] disabled:cursor-default"
                  >
                    <span
                      className={`w-4 h-4 rounded-[5px] border shrink-0 flex items-center justify-center text-[9px] ${
                        row.duplicate
                          ? "border-amber-300/15 bg-amber-300/[0.07] text-amber-200/50"
                          : row.selected
                            ? "border-emerald-300/30 bg-emerald-300 text-black"
                            : "border-white/15 bg-transparent"
                      }`}
                    >
                      {row.duplicate ? "•" : row.selected ? "✓" : ""}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold truncate">{row.title}</p>
                      <p className="text-[10px] text-white/32 truncate mt-0.5">
                        {row.artist || t("repertoireTransfer.unknown_artist", "Artista não informado")}
                        {row.key ? ` · ${row.key}` : ""}
                        {row.bpm ? ` · ${row.bpm} BPM` : ""}
                      </p>
                    </div>
                    {row.duplicate && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-200/55">
                        {t("repertoireTransfer.already_exists", "Já existe")}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {capacityExceeded && (
                <div className="rounded-2xl border border-amber-300/12 bg-amber-300/[0.05] px-4 py-3 text-[11px] text-amber-100/65 leading-relaxed">
                  {t(
                    "repertoireTransfer.limit_notice",
                    "Seu plano não comporta todas as músicas selecionadas. O MusicScale importará somente até o limite atual, sem apagar nenhuma música existente.",
                  )}
                </div>
              )}

              {isImporting && (
                <div className="space-y-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-emerald-300 transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/32 text-center">{progress}%</p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={handleClose} disabled={isImporting}>
              {t("common.cancel", "Cancelar")}
            </Button>
            {preview.length > 0 && (
              <Button
                variant="primary"
                onClick={() => void handleImport()}
                disabled={!canManageRepertoire || isImporting || importableRows.length === 0}
              >
                {isImporting ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" />
                    {t("repertoireTransfer.importing", "Importando")}
                  </span>
                ) : (
                  t("repertoireTransfer.import_count", "Importar {{count}} músicas", {
                    count: importableRows.length,
                  })
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default RepertoireTransferModal;
