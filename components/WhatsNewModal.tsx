import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ReleaseHighlights } from './ReleaseHighlights';
import { useReleaseNews } from '../hooks/useReleaseNews';
import { beginInteractionPaintMeasurement } from '../lib/interactionTelemetry';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { markReleaseSeen } = useReleaseNews();
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const previousBodyOverflow = useRef('');

  const handleClose = useCallback(() => {
    const finishMeasurement = beginInteractionPaintMeasurement('release_news_close_to_paint_ms');
    markReleaseSeen();
    onClose();
    finishMeasurement();
  }, [markReleaseSeen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null;
    previousBodyOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => modalRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusableElements = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled'));

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      const restoreOverflow = previousBodyOverflow.current;
      const restoreFocus = previouslyFocusedElement.current;

      window.requestAnimationFrame(() => {
        document.body.style.overflow = restoreOverflow;
        if (restoreFocus?.isConnected) {
          try {
            restoreFocus.focus({ preventScroll: true });
          } catch {
            restoreFocus.focus();
          }
        }
      });
    };
  }, [handleClose, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex bg-black/78 sm:items-center sm:justify-center sm:bg-black/55 sm:p-6 sm:backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) handleClose();
      }}
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-title"
        tabIndex={-1}
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#09090c] outline-none sm:h-auto sm:max-h-[min(860px,calc(100dvh-48px))] sm:max-w-6xl sm:rounded-[30px] sm:border sm:border-white/[0.08] sm:shadow-[0_30px_100px_rgba(0,0,0,0.62)]"
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#09090c]/95 px-5 py-4 sm:px-7 sm:backdrop-blur-xl">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/34">
            {t('releaseNews.label')}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 text-sm font-semibold text-white/70 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/55"
            aria-label={t('releaseNews.close')}
          >
            <span className="hidden sm:inline">{t('releaseNews.close')}</span>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-7 sm:px-9 sm:pt-9">
          <ReleaseHighlights />
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};

export default WhatsNewModal;
