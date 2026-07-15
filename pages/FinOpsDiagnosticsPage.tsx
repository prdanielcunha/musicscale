import React, { useState, useEffect } from "react";
import { auth } from "../services/firebase";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  RotateCw,
  Terminal,
  Database,
  Lock,
  Server,
  UserCheck
} from "lucide-react";

interface CheckItem {
  key: string;
  label: string;
  status: "passed" | "warning" | "failed";
  detail: string;
}

interface PreflightData {
  ok: boolean;
  environment: "preview" | "staging" | "development" | "production" | "unknown";
  productionBlocked: boolean;
  safeNonProduction: boolean;
  diagnosticsEnabled: boolean;
  hasHmacSecret: boolean;
  writePathEnabled: boolean;
  readPathEnabled: boolean;
  authorized: boolean;
  canRun: boolean;
  reasons: string[];
}

interface DiagnosticResult {
  ok: boolean;
  status: "passed" | "warning" | "failed";
  requestId: string;
  checks: CheckItem[];
  publicResponseContract: {
    preserved: boolean;
    forbiddenKeysAbsent: boolean;
  };
  firestore: {
    checked: boolean;
    expectedPaths: string[];
    createdOrUpdated: string[];
    idempotencyFinalStatus: string;
    sensitiveDataFound: boolean;
  };
  copyableReport: string;
}

export default function FinOpsDiagnosticsPage() {
  const [preflight, setPreflight] = useState<PreflightData | null>(null);
  const [loadingPreflight, setLoadingPreflight] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mapErrorMessage = (errorStr: string): string => {
    const lower = errorStr.toLowerCase();
    if (lower.includes("not_safe") || lower.includes("ambiente desconhecido") || lower.includes("unknown")) {
      return "Ambiente desconhecido. Por favor, configure a variável AI_FINOPS_DIAGNOSTICS_ENV como 'preview' nas configurações da plataforma e atualize a página.";
    }
    if (lower.includes("authorized") || lower.includes("autorizado") || lower.includes("role") || lower.includes("apenas ceo") || lower.includes("403") || lower.includes("forbidden")) {
      return "Não autorizado. Apenas usuários com papel global canônico podem executar este diagnóstico.";
    }
    if (lower.includes("fetch") || lower.includes("network") || lower.includes("failed to fetch") || lower.includes("connection") || lower.includes("rejeitada")) {
      return "Conexão rejeitada pelo servidor. Por favor, tente novamente.";
    }
    if (lower.includes("preflight_error") || lower.includes("diagnósticos")) {
      return "Não foi possível carregar o diagnóstico com segurança.";
    }
    return errorStr || "Não foi possível carregar o diagnóstico com segurança.";
  };

  const fetchPreflight = async () => {
    setLoadingPreflight(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Token de autenticação não encontrado. Faça login novamente.");
      }

      const res = await fetch("/api/admin/finops-diagnostics/preflight", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      setPreflight(data);
    } catch (err: any) {
      console.error("[FinOps Diagnostics] Preflight error:", err);
      setError(mapErrorMessage(err.message || ""));
    } finally {
      setLoadingPreflight(false);
    }
  };

  const runDiagnostics = async () => {
    if (preflight?.environment === "production") {
      setError("Diagnóstico bloqueado em Production por segurança.");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Token de autenticação não encontrado. Faça login novamente.");
      }

      const res = await fetch("/api/admin/finops-diagnostics/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error("[FinOps Diagnostics] Execution error:", err);
      setError(mapErrorMessage(err.message || ""));
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    fetchPreflight();
  }, []);

  const handleCopy = () => {
    if (result?.copyableReport) {
      navigator.clipboard.writeText(result.copyableReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderStatusBadge = (status: "passed" | "warning" | "failed") => {
    switch (status) {
      case "passed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
            <CheckCircle2 className="w-3.5 h-3.5" /> APROVADO
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
            <AlertTriangle className="w-3.5 h-3.5" /> ATENÇÃO
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.05)]">
            <XCircle className="w-3.5 h-3.5" /> REPROVADO
          </span>
        );
    }
  };

  return (
    <div id="finops_diagnostics_container" className="min-h-screen bg-transparent text-slate-100 flex flex-col space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800/60 pb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-400" />
            Diagnóstico FinOps
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Validação segura da shadow-write em Preview/Staging
          </p>
        </div>
        <button
          onClick={fetchPreflight}
          disabled={loadingPreflight || running}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/60 hover:bg-slate-700/80 transition-all text-xs font-medium text-slate-300 hover:text-white disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loadingPreflight ? "animate-spin" : ""}`} />
          Atualizar Preflight
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Preflight Status & Execution Control */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300 flex items-center gap-2 mb-4 border-b border-slate-800/60 pb-2">
              <Server className="w-4 h-4 text-slate-400" /> Pré-Requisitos do Sistema
            </h2>

            {loadingPreflight ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2">
                <RotateCw className="w-6 h-6 text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-400 font-mono">Lendo ambiente...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Ambiente Detectado</span>
                    <span className="font-mono uppercase font-semibold text-white px-2 py-0.5 rounded bg-slate-800">
                      {preflight?.environment === "preview" ? "Preview" : 
                       preflight?.environment === "staging" ? "Staging" :
                       preflight?.environment === "development" ? "Development" :
                       preflight?.environment === "production" ? "Production" : "Desconhecido"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Diagnóstico Permitido?</span>
                    <span className={`font-semibold ${preflight?.canRun ? "text-emerald-400" : "text-rose-400"}`}>
                      {preflight?.canRun ? "SIM" : "NÃO"}
                    </span>
                  </div>
                  {preflight?.environment === "production" && (
                    <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/40">
                      <span className="text-slate-400">Production Bloqueada?</span>
                      <span className="font-semibold text-emerald-400">SIM</span>
                    </div>
                  )}
                  {preflight?.environment !== "production" && preflight?.environment !== "unknown" && (
                    <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/40">
                      <span className="text-slate-400">Ambiente seguro para diagnóstico</span>
                      <span className="font-semibold text-emerald-400">SIM</span>
                    </div>
                  )}
                  {preflight?.environment === "unknown" && (
                    <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/40">
                      <span className="text-slate-400">Ambiente seguro para diagnóstico</span>
                      <span className="font-semibold text-rose-400">NÃO</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Diagnósticos Habilitados</span>
                    <span className={`font-semibold ${preflight?.diagnosticsEnabled ? "text-emerald-400" : "text-rose-400"}`}>
                      {preflight?.diagnosticsEnabled ? "SIM" : "NÃO"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Chave HMAC Configurada</span>
                    <span className={`font-semibold ${preflight?.hasHmacSecret ? "text-emerald-400" : "text-rose-400"}`}>
                      {preflight?.hasHmacSecret ? "SIM" : "NÃO"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Shadow-Write Ativa</span>
                    <span className={`font-semibold ${preflight?.writePathEnabled ? "text-emerald-400" : "text-rose-400"}`}>
                      {preflight?.writePathEnabled ? "SIM" : "NÃO"}
                    </span>
                  </div>
                </div>

                {preflight?.environment === "production" && (
                  <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 mt-4 text-xs text-rose-400 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Diagnóstico bloqueado em Production por segurança.
                  </div>
                )}

                {preflight?.reasons && preflight.reasons.length > 0 && (
                  <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 mt-4">
                    <div className="flex items-center gap-2 mb-2 text-rose-400 text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Pendências Identificadas
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300">
                      {preflight.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  id="btn_run_diagnostics"
                  onClick={runDiagnostics}
                  disabled={!preflight?.canRun || running || preflight?.environment === "production"}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs tracking-wider uppercase transition-all duration-300 border border-indigo-500/30 hover:border-indigo-400/40 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:shadow-none mt-4"
                >
                  {running ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      Executando diagnóstico...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Executar diagnóstico seguro
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Columns: Main Output & Copyable Report */}
        <div className="lg:col-span-2 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-1">Falha na Operação</span>
                {error}
              </div>
            </div>
          )}

          {!result && !running && !error && (
            <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800">
                <Terminal className="w-6 h-6 text-slate-400" />
              </div>
              <div className="max-w-md">
                <h3 className="text-sm font-semibold text-white">Nenhum resultado gerado</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Certifique-se de que os pré-requisitos estão verdes no painel esquerdo e clique no botão para executar o teste sintético de shadow-write.
                </p>
              </div>
            </div>
          )}

          {running && (
            <div className="rounded-xl border border-slate-800 p-12 text-center flex flex-col items-center justify-center space-y-4 bg-slate-900/20">
              <RotateCw className="w-10 h-10 text-indigo-400 animate-spin" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Realizando auditoria FinOps sintética</h3>
                <p className="text-xs text-slate-400">
                  Criando requestId diag_finops_, executando shadow-write, atualizando Firestore e analisando dados para vazamento...
                </p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-fade-in">
              {/* Glowing Overall Result Block */}
              <div
                className={`rounded-xl border p-5 flex items-center justify-between backdrop-blur-md relative overflow-hidden ${
                  result.status === "passed"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : result.status === "warning"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-rose-500/30 bg-rose-500/5"
                }`}
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">Resultado da Auditoria</span>
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    Status Geral:{" "}
                    <span
                      className={`uppercase font-black tracking-wide ${
                        result.status === "passed"
                          ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]"
                          : result.status === "warning"
                          ? "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]"
                          : "text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,133,0.3)]"
                      }`}
                    >
                      {result.status === "passed"
                        ? "Aprovado"
                        : result.status === "warning"
                        ? "Atenção"
                        : "Reprovado"}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    ID Diagnóstico: <span className="text-slate-300 font-semibold">{result.requestId}</span>
                  </p>
                </div>
                <div>{renderStatusBadge(result.status)}</div>
              </div>

              {/* Checks Stack */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4 border-b border-slate-800/60 pb-2">
                  <UserCheck className="w-4 h-4 text-indigo-400" /> Checklist de Validação Estática e de Runtime
                </h3>
                <div className="divide-y divide-slate-800/40">
                  {result.checks.map((check) => (
                    <div key={check.key} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-white">{check.label}</span>
                        <p className="text-[11px] text-slate-400">{check.detail}</p>
                      </div>
                      <div className="shrink-0">{renderStatusBadge(check.status)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Firestore Inspection Card */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4 border-b border-slate-800/60 pb-2">
                  <Database className="w-4 h-4 text-indigo-400" /> Auditoria de Integridade e Isolamento (Firestore)
                </h3>
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-slate-400 block">Status de Idempotency</span>
                      <span className={`font-mono font-semibold uppercase ${result.firestore.idempotencyFinalStatus === "COMPLETED" ? "text-emerald-400" : "text-rose-400"}`}>
                        {result.firestore.idempotencyFinalStatus}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 block">Pesquisa de Vazamento de Dados</span>
                      <span className={`font-mono font-semibold ${!result.firestore.sensitiveDataFound ? "text-emerald-400" : "text-rose-400"}`}>
                        {!result.firestore.sensitiveDataFound ? "NENHUM DADO SENSÍVEL VAZADO" : "VAZAMENTO DETECTADO!"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-800/40 pt-3">
                    <span className="text-slate-400 font-semibold block">Documentos Gravados / Atualizados:</span>
                    <div className="flex flex-wrap gap-2">
                      {result.firestore.createdOrUpdated.map((doc) => (
                        <span key={doc} className="px-2 py-0.5 rounded font-mono text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase">
                          {doc}
                        </span>
                      ))}
                      {result.firestore.createdOrUpdated.length === 0 && (
                        <span className="text-slate-400 italic">Nenhum documento detectado</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-800/40 pt-3">
                    <span className="text-slate-400 font-semibold block">Paths Esperados Auditados:</span>
                    <ul className="space-y-1 font-mono text-[10px] text-slate-400 list-inside list-disc">
                      {result.firestore.expectedPaths.map((path) => (
                        <li key={path} className="truncate">{path}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Copyable Report Area */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-400" /> Relatório Criptográfico / Não Técnico Pronto
                  </h3>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white transition-all shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? "Copiado!" : "Copiar Relatório"}
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    readOnly
                    value={result.copyableReport}
                    className="w-full h-44 bg-slate-950 border border-slate-800/80 rounded-lg p-3 font-mono text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/50 resize-none select-all"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
