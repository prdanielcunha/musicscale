import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNews } from '../../hooks/useNews';

const WhatsNewModal = lazy(() =>
  import('../WhatsNewModal').then((module) => ({ default: module.WhatsNewModal })),
);

/**
 * Owns first-access/news auto-presentation state outside ModalContext.
 * Opening or closing this presentation must not invalidate every useModals()
 * consumer in the active application tree.
 */
export const WelcomeAutoPresenter: React.FC = () => {
  const { hasUnseen } = useNews();
  const [isOpen, setIsOpen] = useState(false);
  const autoOpenAttempted = useRef(false);

  useEffect(() => {
    if (!hasUnseen || autoOpenAttempted.current) return;
    autoOpenAttempted.current = true;
    setIsOpen(true);
  }, [hasUnseen]);

  if (!isOpen) return null;

  return (
    <Suspense fallback={null}>
      <WhatsNewModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </Suspense>
  );
};

export default WelcomeAutoPresenter;
