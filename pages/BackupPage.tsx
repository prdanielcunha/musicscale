import React, { useState, useRef } from "react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Spinner from "../components/common/Spinner";
import { CloudArrowUpIcon } from "../components/icons/CloudArrowUpIcon";
import { CloudArrowDownIcon } from "../components/icons/CloudArrowDownIcon";
import { AlertTriangleIcon } from "../components/icons/AlertTriangleIcon";
import { CheckIcon } from "../components/icons/CheckIcon";
import {
  createFullBackup,
  parseBackupFile,
  restoreBackup,
  analyzeSongsForImport,
  BackupData,
  SongImportAnalysis,
} from "../services/backupService";
import ConfirmationModal from "../components/common/ConfirmationModal";
import Modal from "../components/common/Modal";
import { useAuth } from "../contexts/AuthContext";

const ALL_COLLECTIONS = [
  { id: "songs", label: "Dados Básicos das Músicas" },
  { id: "chords", label: "Cifras das Músicas" },
  { id: "lyrics", label: "Letras das Músicas" },
  { id: "users", label: "Usuários" },
  { id: "roles", label: "Funções" },
  { id: "scales", label: "Escalas Musicais" },
  { id: "bandScales", label: "Respostas de Escalas" },
  { id: "fixedBandScales", label: "Escalas Fixas" },
  { id: "suggestions", label: "Sugestões de Músicas" },
  { id: "eventTypes", label: "Tipos de Evento" },
  { id: "locations", label: "Locais" },
  { id: "eventNames", label: "Nomes de Eventos" },
  { id: "tags", label: "Tags" },
  { id: "instruments", label: "Instrumentos" },
];

import { useLocation } from "react-router-dom";

import { useEcosystemAdmin } from '../hooks/useEcosystemAdmin';

const BackupPage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { isEcosystemAdmin } = useEcosystemAdmin();
  const location = useLocation();
  const globalMode = !!location.state?.globalMode;

  const canExportGlobal = user?.email === "pastordanielpcunha@gmail.com" || userProfile?.systemRole === "admin" || userProfile?.systemRole === "ceo";

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportCollections, setExportCollections] = useState<string[]>(
    ALL_COLLECTIONS.map((c) => c.id),
  );
  const [isGlobalExport, setIsGlobalExport] = useState(globalMode);
  const [saveToGlobalLibrary, setSaveToGlobalLibrary] = useState(globalMode && isEcosystemAdmin);
  const [importToLocalOrganization, setImportToLocalOrganization] = useState(true);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedBackupData, setParsedBackupData] = useState<BackupData | null>(
    null,
  );
  const [importCollections, setImportCollections] = useState<string[]>([]);
  const [bindToCurrentOrganization, setBindToCurrentOrganization] =
    useState(!globalMode);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);
  const [globalSongStatus, setGlobalSongStatus] = useState<"active" | "draft">("draft");

  // General State
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [songAnalysis, setSongAnalysis] = useState<SongImportAnalysis | null>(
    null,
  );
  const [isResolvingSongs, setIsResolvingSongs] = useState(false);
  const [songResolutions, setSongResolutions] = useState<
    Record<string, string>
  >({}); // backupId -> dbId or 'CREATE_NEW'

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleExportCollection = (id: string) => {
    setExportCollections((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const toggleImportCollection = (id: string) => {
    setImportCollections((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const selectAllExport = () =>
    setExportCollections(ALL_COLLECTIONS.map((c) => c.id));
  const deselectAllExport = () => setExportCollections([]);

  const selectAllImport = () => {
    if (parsedBackupData) {
      setImportCollections(Object.keys(parsedBackupData.collections));
    }
  };
  const deselectAllImport = () => setImportCollections([]);

  const handleExport = async () => {
    if (exportCollections.length === 0) {
      setError("Selecione pelo menos um item para exportar.");
      return;
    }
    setIsExporting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await createFullBackup({
        collectionsToBackup: exportCollections,
        isGlobal: isGlobalExport,
      });
      setSuccessMessage(
        "Backup gerado e baixado com sucesso! Guarde o arquivo em um local seguro.",
      );
    } catch (err: any) {
      setError(err.message || "Erro ao gerar backup.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);
      setSuccessMessage(null);
      setParsedBackupData(null);

      try {
        const data = await parseBackupFile(file);
        setParsedBackupData(data);
        const availableCols = Object.keys(data.collections).filter(
          (col) =>
            Array.isArray(data.collections[col]) &&
            data.collections[col].length > 0,
        );
        setImportCollections(availableCols);
      } catch (err: any) {
        setError(err.message || "Erro ao processar arquivo.");
        setSelectedFile(null);
      }
    }
  };

  const handleRestoreClick = () => {
    if (!parsedBackupData) {
      setError(
        "Por favor, selecione um arquivo JSON de backup válido primeiro.",
      );
      return;
    }
    if (importCollections.length === 0) {
      setError("Selecione pelo menos um item para importar.");
      return;
    }
    setIsConfirmRestoreOpen(true);
  };

  const startImportProcess = async (
    resolutions: Record<string, string> = {},
  ) => {
    setIsImporting(true);
    setError(null);
    setSuccessMessage(null);
    setImportProgress(0);

    try {
      await restoreBackup({
        backupData: parsedBackupData!,
        collectionsToRestore: importCollections,
        bindToCurrentOrganization: bindToCurrentOrganization,
        importToLocalOrganization: importToLocalOrganization,
        saveToGlobalLibrary: saveToGlobalLibrary,
        globalSongStatus: globalSongStatus,
        songResolutions: resolutions,
        onProgress: (msg, progress) => {
          setImportStatus(msg);
          setImportProgress(progress);
        },
      });
      setSuccessMessage(
        "Dados restaurados com sucesso! O aplicativo será recarregado em instantes.",
      );
      setTimeout(() => window.location.reload(), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao restaurar backup.");
      setIsImporting(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!parsedBackupData || importCollections.length === 0) return;

    setIsConfirmRestoreOpen(false);

    const hasMusicFiles = importCollections.some((c) =>
      ["songs", "lyrics", "chords"].includes(c),
    );

    if (hasMusicFiles) {
      try {
        setIsImporting(true);
        setImportStatus("Identificando músicas na base de dados...");
        const analysis = await analyzeSongsForImport(
          parsedBackupData,
          importCollections,
        );
        setIsImporting(false);
        setImportStatus("");

        if (analysis.unmatched.length > 0) {
          setSongAnalysis(analysis);
          const defaultRes: Record<string, string> = {};
          analysis.unmatched.forEach(
            (u) => (defaultRes[u.backupId] = "CREATE_NEW"),
          );
          setSongResolutions(defaultRes);
          setIsResolvingSongs(true);
          return;
        } else {
          const resolutions: Record<string, string> = {};
          analysis.exactMatches.forEach(
            (em) => (resolutions[em.backupId] = em.matchedDbId),
          );
          startImportProcess(resolutions);
        }
      } catch (err: any) {
        setError(err.message || "Erro ao analisar músicas.");
        setIsImporting(false);
      }
    } else {
      startImportProcess();
    }
  };

  const handleConfirmResolutions = () => {
    setIsResolvingSongs(false);
    const combinedRes = { ...songResolutions };
    songAnalysis?.exactMatches.forEach(
      (em) => (combinedRes[em.backupId] = em.matchedDbId),
    );
    startImportProcess(combinedRes);
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          Backup e Restauração
        </h1>
        <p className="text-slate-500 dark:text-gray-400">
          Gerencie a segurança dos seus dados. Exporte uma cópia completa ou
          restaure informações anteriores. Exporte itens separados, e importe o
          que desejar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* EXPORT CARD */}
        <Card className="relative overflow-hidden border-l-4 border-l-blue-500 p-8 flex flex-col justify-between h-full group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
            <CloudArrowUpIcon className="w-32 h-32 text-blue-500" />
          </div>

          <div className="relative z-10 flex-1">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400">
              <CloudArrowUpIcon className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              Exportar Dados
            </h2>
            <p className="text-sm text-slate-600 dark:text-gray-300 mb-4 leading-relaxed">
              Gera um arquivo <strong>JSON</strong> contendo os dados
              selecionados, formatação garantida para reinserção perfeita.
            </p>

            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-gray-800/50 p-4 rounded-xl border border-slate-200 dark:border-gray-700">
                <div className="flex justify-between flex-wrap gap-2 items-center mb-3">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300">
                    O que Exportar?
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllExport}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      Todos
                    </button>
                    <span className="text-slate-300 dark:text-gray-600">|</span>
                    <button
                      onClick={deselectAllExport}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      Nenhum
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                  {ALL_COLLECTIONS.map((collection) => (
                    <label
                      key={collection.id}
                      className="flex items-center gap-2 cursor-pointer group/label"
                    >
                      <input
                        type="checkbox"
                        checked={exportCollections.includes(collection.id)}
                        onChange={() => toggleExportCollection(collection.id)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 pointer-events-auto"
                      />
                      <span className="text-xs font-medium text-slate-600 dark:text-gray-300 group-hover/label:text-blue-600 transition-colors dropdown-label">
                        {collection.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {canExportGlobal && (
                <label className="flex items-start gap-3 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 cursor-pointer group/global">
                  <div className="mt-0.5">
                    <input
                      type="checkbox"
                      checked={isGlobalExport}
                      onChange={(e) => setIsGlobalExport(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-blue-900 dark:text-blue-100 mb-1">
                      Exportação Global
                    </span>
                    <span className="block text-xs text-blue-700/80 dark:text-blue-300/80 leading-relaxed">
                      Remove o vínculo da sua organização atual. O arquivo
                      gerado poderá ser importado por{" "}
                      <strong>qualquer outra organização</strong> ou app
                      independente, sem conflito de IDs. Ideal para compartilhar
                      bancos de cifras/músicas.
                    </span>
                  </div>
                </label>
              )}
            </div>
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-slate-100 dark:border-white/10">
            <Button
              onClick={handleExport}
              disabled={isExporting || exportCollections.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
              size="lg"
            >
              {isExporting ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" className="text-white" /> Gerando
                  Arquivo...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CloudArrowUpIcon className="w-5 h-5" /> Fazer Backup Agora
                </span>
              )}
            </Button>
            <p className="text-xs text-center text-slate-400 dark:text-gray-500 mt-3">
              {exportCollections.length} coleções selecionadas.
            </p>
          </div>
        </Card>

        {/* IMPORT CARD */}
        <Card className="relative overflow-hidden border-l-4 border-l-purple-500 p-8 flex flex-col justify-between h-full group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
            <CloudArrowDownIcon className="w-32 h-32 text-purple-500" />
          </div>

          <div className="relative z-10 flex-1">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-6 text-purple-600 dark:text-purple-400">
              <CloudArrowDownIcon className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              Importar Dados
            </h2>

            {!isImporting ? (
              <div className="space-y-4">
                <div className="relative group/input">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".json"
                    className="hidden"
                    id="backup-file"
                  />
                  <label
                    htmlFor="backup-file"
                    className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${selectedFile ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : "border-slate-300 dark:border-gray-600 hover:border-purple-400 hover:bg-slate-50 dark:hover:bg-gray-800"}`}
                  >
                    {selectedFile ? (
                      <div className="text-center p-4">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <CheckIcon className="w-5 h-5 text-purple-500" />
                          <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[200px]">
                            {selectedFile.name}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                          {(selectedFile.size / 1024).toFixed(2)} KB • Clique
                          para trocar
                        </p>
                      </div>
                    ) : (
                      <div className="text-center p-4">
                        <p className="text-sm font-bold text-slate-700 dark:text-gray-300">
                          Selecionar arquivo de Backup (.json)
                        </p>
                      </div>
                    )}
                  </label>
                </div>

                {parsedBackupData && (
                  <div className="animate-fade-in-up space-y-4">
                    <div className="bg-slate-50 dark:bg-gray-800/50 p-4 rounded-xl border border-slate-200 dark:border-gray-700">
                      <div className="flex justify-between flex-wrap gap-2 items-center mb-3">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300">
                          Itens encontrados no backup (
                          {parsedBackupData?.metadata?.exportDate
                            ? new Date(
                                parsedBackupData.metadata.exportDate,
                              ).toLocaleDateString()
                            : "N/A"}
                          )
                        </h3>
                        <div className="flex gap-2">
                          <button
                            onClick={selectAllImport}
                            className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
                          >
                            Todos
                          </button>
                          <span className="text-slate-300 dark:text-gray-600">
                            |
                          </span>
                          <button
                            onClick={deselectAllImport}
                            className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
                          >
                            Nenhum
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(parsedBackupData.collections).map(
                          ([colName, items]) => {
                            const colInfo = ALL_COLLECTIONS.find(
                              (c) => c.id === colName,
                            );
                            const label = colInfo ? colInfo.label : colName;
                            const count = Array.isArray(items)
                              ? items.length
                              : 0;

                            if (count === 0) return null;

                            return (
                              <label
                                key={colName}
                                className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700/50 cursor-pointer group/label"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={importCollections.includes(
                                      colName,
                                    )}
                                    onChange={() =>
                                      toggleImportCollection(colName)
                                    }
                                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 dark:border-gray-600 bg-transparent"
                                  />
                                  <span
                                    className="text-xs font-medium text-slate-700 dark:text-gray-300 group-hover/label:text-purple-600 transition-colors dropdown-label truncate"
                                    title={label}
                                  >
                                    {label}
                                  </span>
                                </div>
                                <span className="text-[10px] bg-slate-200 dark:bg-gray-700 text-slate-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                                  {count}
                                </span>
                              </label>
                            );
                          },
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 cursor-pointer group">
                        <div className="mt-0.5">
                          <input
                            type="checkbox"
                            checked={importToLocalOrganization}
                            onChange={(e) => setImportToLocalOrganization(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <span className="block text-sm font-bold text-slate-800 dark:text-white mb-1">
                            Salvar no acervo da minha Organização
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                            O padrão é importar os dados para a sua organização. Desmarque se deseja apenas exportar para a Biblioteca Viva.
                          </span>
                        </div>
                      </label>

                      {importToLocalOrganization && (
                        <label className="flex items-start gap-3 p-4 rounded-xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 cursor-pointer group/global">
                          <div className="mt-0.5">
                            <input
                              type="checkbox"
                              checked={bindToCurrentOrganization}
                              onChange={(e) =>
                                setBindToCurrentOrganization(e.target.checked)
                              }
                              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                            />
                          </div>
                          <div>
                            <span className="block text-sm font-bold text-purple-900 dark:text-purple-100 mb-1 flex items-center gap-2">
                              Vincular à Organização Atual
                              {parsedBackupData.metadata.isGlobal && (
                                <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-black">
                                  Backup Global Reconhecido
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-purple-700/80 dark:text-purple-300/80 leading-relaxed">
                              Garante que todos os itens importados pertençam à sua
                              organização evitando exclusão do histórico e erro de
                              sincronia.
                              <strong className="text-purple-900 dark:text-purple-200 ml-1">
                                Para restaurar perfeitamente neste app, mantenha
                                ativo.
                              </strong>
                            </span>
                          </div>
                        </label>
                      )}
                      
                      {isEcosystemAdmin && importCollections.some(c => ['songs', 'lyrics', 'chords'].includes(c)) && (
                        <div className="mt-4 border-t border-slate-200 dark:border-white/10 pt-4">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2">
                            Biblioteca Viva MusicScale
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            Como administrador do ecossistema, você pode transformar músicas importadas em acervo global para reutilização por outras organizações.
                          </p>
                          <label className="flex items-start gap-3 p-4 rounded-xl bg-orange-50/80 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-500/30 cursor-pointer group/global">
                            <div className="mt-0.5">
                              <input
                                type="checkbox"
                                checked={saveToGlobalLibrary}
                                onChange={(e) => setSaveToGlobalLibrary(e.target.checked)}
                                className="w-4 h-4 text-orange-500 bg-white border-orange-300 rounded focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 outline-none"
                              />
                            </div>
                            <div className="flex-1">
                              <span className="block text-sm font-bold text-orange-900 dark:text-orange-100 mb-1 flex items-center gap-2">
                                Também salvar músicas importadas na Biblioteca Viva
                              </span>
                              <span className="block text-xs text-orange-700/80 dark:text-orange-400/80 leading-relaxed font-medium mb-3">
                                ⚠️ Essa ação afeta o acervo global. Revise as músicas antes de confirmar.
                              </span>
                              {saveToGlobalLibrary && (
                                <div className="mt-2" onClick={(e) => e.preventDefault()}>
                                  <label className="text-xs font-bold text-orange-900 dark:text-orange-200 block mb-1">Status inicial no acervo global:</label>
                                  <select 
                                    className="bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-500/30 text-sm rounded-lg block w-full p-2 text-orange-900 dark:text-orange-100 outline-none"
                                    value={globalSongStatus}
                                    onChange={(e) => setGlobalSongStatus(e.target.value as "active" | "draft")}
                                  >
                                    <option value="draft">Rascunho (Seguro, precisa aprovação/revisão antes de ir para vitrine)</option>
                                    <option value="active">Ativo (Público, imediato na vitrine)</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-100 dark:bg-gray-900/50 rounded-xl p-6 text-center h-full flex flex-col justify-center">
                <Spinner size="lg" className="mx-auto mb-4 text-purple-500" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                  Restaurando...
                </h3>
                <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
                  {importStatus}
                </p>
                <div className="w-full bg-slate-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-2">
                  {Math.round(importProgress)}%
                </p>
              </div>
            )}
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-slate-100 dark:border-white/10">
            <Button
              onClick={handleRestoreClick}
              disabled={
                !parsedBackupData ||
                importCollections.length === 0 ||
                isImporting
              }
              className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20"
              size="lg"
            >
              <span className="flex items-center gap-2 justify-center w-full">
                {isImporting
                  ? "Processando Restauração..."
                  : "Importar Dados Selecionados"}
              </span>
            </Button>
          </div>
        </Card>
      </div>

      {/* Feedback Area */}
      {(error || successMessage) && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 animate-fade-in-up ${error ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800" : "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"}`}
        >
          {error ? (
            <AlertTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <h4 className="font-bold text-sm">{error ? "Erro" : "Sucesso"}</h4>
            <p className="text-sm opacity-90">{error || successMessage}</p>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isConfirmRestoreOpen}
        onClose={() => setIsConfirmRestoreOpen(false)}
        onConfirm={handleConfirmRestore}
        title="Confirmar Restauração Parcial/Global"
        message={
          <>
            Você está prestes a restaurar as seguintes informações:{" "}
            <strong>
              {importCollections
                .map((c) => ALL_COLLECTIONS.find((x) => x.id === c)?.label || c)
                .join(", ")}
            </strong>
            .
            <br />
            <br />
            IDs já existentes no banco{" "}
            <strong>serão atualizados/sobrescritos</strong> e os ausentes serão
            criados.
            <br />
            Verifique se você confia neste arquivo JSON antes de prosseguir.
            {saveToGlobalLibrary && (
              <>
                <br />
                <br />
                <span className="text-orange-600 dark:text-orange-400 font-bold">
                  ⚠️ Você está prestes a adicionar músicas à Biblioteca Viva MusicScale. 
                  Esse acervo é compartilhado globalmente com outras organizações. Deseja continuar?
                </span>
              </>
            )}
          </>
        }
        confirmText="Sim, Importar Dados"
        isLoading={false}
        zIndexClass="z-[100]"
      />

      <Modal
        isOpen={isResolvingSongs}
        onClose={() => setIsResolvingSongs(false)}
        title="Vincular Músicas Importadas"
        size="3xl"
      >
        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-gray-300 mb-6">
            Encontramos {songAnalysis?.unmatched.length} músicas/letras/cifras
            no backup que não correspondem exatamente ao nome e artista e
            nenhuma música já existente. Você pode criar novos cadastros para
            elas ou vinculá-las a uma música existente.
          </p>

          <div className="max-h-[50vh] overflow-y-auto space-y-3 custom-scrollbar pr-2 mb-6">
            {songAnalysis?.unmatched.map((item) => (
              <div
                key={item.backupId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 dark:bg-gray-800/50 dark:border-gray-700"
              >
                <div>
                  <h5 className="font-bold text-slate-800 dark:text-white text-sm">
                    {item.title}
                  </h5>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    {item.artist}
                  </p>
                </div>
                <select
                  className="input-base px-2 py-1.5 w-full sm:w-[300px] h-10"
                  value={songResolutions[item.backupId] || "CREATE_NEW"}
                  onChange={(e) =>
                    setSongResolutions((prev) => ({
                      ...prev,
                      [item.backupId]: e.target.value,
                    }))
                  }
                >
                  <option value="CREATE_NEW">➕ Criar nova música</option>
                  <optgroup label="Vincular a uma música existente">
                    {songAnalysis.existingSongs.map((dbSong) => (
                      <option key={dbSong.id} value={dbSong.id}>
                        {dbSong.title} - {dbSong.artist}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
            <Button
              variant="secondary"
              onClick={() => setIsResolvingSongs(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleConfirmResolutions}
            >
              Continuar e Importar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BackupPage;
