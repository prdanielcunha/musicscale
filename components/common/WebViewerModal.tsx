import React from "react";
import { createPortal } from "react-dom";

interface WebViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
}

const WebViewerModal: React.FC<WebViewerModalProps> = ({
  isOpen,
  onClose,
  url,
  title,
}) => {
  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[110] bg-slate-100 dark:bg-gray-900 flex flex-col animate-fade-in"
      aria-labelledby="webview-modal-title"
      role="dialog"
      aria-modal="true"
    >
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
      `}</style>
      <header className="flex-shrink-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border-b border-slate-200/80 dark:border-gray-700/80 p-3 flex items-center justify-between">
        <h2
          id="webview-modal-title"
          className="text-lg font-semibold text-slate-800 dark:text-white truncate pr-4"
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 dark:text-gray-400 bg-transparent hover:bg-slate-200 dark:hover:bg-gray-600 rounded-lg text-sm p-1.5 inline-flex items-center flex-shrink-0"
          aria-label="Close"
        >
          <svg
            className="w-6 h-6"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            ></path>
          </svg>
        </button>
      </header>
      <main className="flex-1 bg-white dark:bg-gray-800">
        <iframe src={url} title={title} className="w-full h-full border-0" />
      </main>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default WebViewerModal;
