import { logger } from "../lib/logger";
import React, { Component, ErrorInfo, ReactNode } from "react";
import Button from "./common/Button";

const BugIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    
    // Check if this is a chunk load error (Vite dynamic import failure)
    const errorMessage = error.message || error.toString();
    if (
      errorMessage.includes('Failed to fetch dynamically imported module') ||
      errorMessage.includes('ChunkLoadError') ||
      errorMessage.includes('Importing a module script failed') ||
      errorMessage.includes('dynamically imported module')
    ) {
      const RELOAD_FLAG = 'musicscale_chunk_reloaded';
      const lastReload = sessionStorage.getItem(RELOAD_FLAG);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload) > 10000) {
        sessionStorage.setItem(RELOAD_FLAG, now.toString());
        console.warn('ErrorBoundary: Chunk load failed, forcing reload once...');
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('v', now.toString());
        window.location.href = newUrl.toString();
      }
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    // FIX: Correctly accessing inherited props and state properties from the base React.Component class.
    const { children } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-gray-900 p-4 text-center">
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
            <BugIcon className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Algo deu errado
          </h1>
          <p className="text-slate-600 dark:text-gray-300 max-w-md mb-6">
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <Button onClick={this.handleReload}>Recarregar Página</Button>
          {error && (
            <pre className="mt-8 p-4 bg-slate-200 dark:bg-black/50 rounded-lg text-left text-xs text-red-600 dark:text-red-400 overflow-auto max-w-2xl max-h-64">
              {error.toString()}
              <br />
              {error.stack}
            </pre>
          )}
        </div>
      );
    }

    return children;
  }
}
