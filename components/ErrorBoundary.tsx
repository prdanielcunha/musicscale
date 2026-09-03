import { logger } from "../lib/logger";
import React, { Component, ErrorInfo, ReactNode } from "react";
import Button from "./common/Button";

const WarningIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const isChunkLoadError = (error: Error | null) => {
  if (!error) return false;
  const message = error.message || error.toString();
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("ChunkLoadError") ||
    message.includes("Importing a module script failed") ||
    message.includes("dynamically imported module")
  );
};

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("Uncaught error:", error, errorInfo);

    if (isChunkLoadError(error)) {
      const RELOAD_FLAG = "musicscale_chunk_reloaded";
      const lastReload = sessionStorage.getItem(RELOAD_FLAG);
      const now = Date.now();
      const lastReloadAt = lastReload ? Number(lastReload) : 0;

      // A stale SPA shell can reference a chunk from the previous deployment.
      // Recover once with a cache-busting reload, but never enter a reload loop.
      if (!Number.isFinite(lastReloadAt) || now - lastReloadAt > 10000) {
        sessionStorage.setItem(RELOAD_FLAG, now.toString());
        logger.warn("ErrorBoundary: stale chunk detected; performing one guarded reload.");
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set("v", now.toString());
        window.location.replace(newUrl.toString());
      }
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    const { children } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      const chunkFailure = isChunkLoadError(error);

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#070709] p-6 text-center">
          <div className="w-full max-w-md rounded-[28px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#111113] p-7 sm:p-9 shadow-[0_20px_70px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 mb-5">
              <WarningIcon className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
              {chunkFailure ? "Atualizando o MusicScale" : "Não foi possível concluir esta tela"}
            </h1>
            <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-400 mb-6">
              {chunkFailure
                ? "Uma versão mais recente do aplicativo pode ter sido publicada. Recarregue para continuar com segurança."
                : "Seus dados continuam protegidos. Recarregue o aplicativo e tente novamente."}
            </p>
            <Button onClick={this.handleReload} className="w-full justify-center">
              Recarregar MusicScale
            </Button>

            {import.meta.env.DEV && error && (
              <pre className="mt-6 p-4 bg-slate-100 dark:bg-black/40 rounded-xl text-left text-xs text-red-600 dark:text-red-400 overflow-auto max-h-64">
                {error.toString()}
                <br />
                {error.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}
