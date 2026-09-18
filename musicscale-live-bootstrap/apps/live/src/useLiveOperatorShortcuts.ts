import { useEffect, useRef } from 'react';

interface LiveOperatorShortcutOptions {
  enabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(
    target.closest(
      'input,textarea,select,button,[role="textbox"],[role="combobox"],[contenteditable="true"]'
    )
  );
}

/**
 * Deliberately tiny shortcut surface.
 *
 * ArrowLeft = previous
 * ArrowRight = TAKE/next
 *
 * We intentionally do not bind Space, Enter, number keys, F-keys or letters:
 * those collide too easily with search, Bible references, provider software and
 * assistive navigation during a service.
 */
export function useLiveOperatorShortcuts({
  enabled,
  onPrevious,
  onNext
}: LiveOperatorShortcutOptions): void {
  const handlers = useRef({ onPrevious, onNext });

  useEffect(() => {
    handlers.current = { onPrevious, onNext };
  }, [onPrevious, onNext]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditingTarget(event.target)
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlers.current.onPrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handlers.current.onNext();
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [enabled]);
}
