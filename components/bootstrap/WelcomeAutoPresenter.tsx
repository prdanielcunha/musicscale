import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useReleaseNews } from '../../hooks/useReleaseNews';

const WhatsNewModal = lazy(() =>
  import('../WhatsNewModal').then((module) => ({ default: module.WhatsNewModal })),
);

const isStageSurface = (pathname: string) =>
  pathname === '/stage-tools' || pathname.includes('/performance');

/**
 * Owns relevant feature-release auto-presentation outside ModalContext so the
 * global modal context does not re-render when the announcement opens/closes.
 * New users receive no special first-access presentation.
 */
export const WelcomeAutoPresenter: React.FC = () => {
  const { hasUnseenRelease } = useReleaseNews();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const autoOpenAttempted = useRef(false);

  useEffect(() => {
    if (
      !hasUnseenRelease ||
      autoOpenAttempted.current ||
      isStageSurface(location.pathname) ||
      document.querySelector('[data-performance-mode="true"]')
    ) {
      return;
    }

    autoOpenAttempted.current = true;
    setIsOpen(true);
  }, [hasUnseenRelease, location.pathname]);

  if (!isOpen) return null;

  return (
    <Suspense fallback={null}>
      <WhatsNewModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </Suspense>
  );
};

export default WelcomeAutoPresenter;
