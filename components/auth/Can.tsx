import React from 'react';
import { useCapability, MusicScaleCapability } from '../../hooks/useCapability';

interface CanProps {
  I: MusicScaleCapability | string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({ I, children, fallback = null }) => {
  const { hasCapability } = useCapability();

  if (hasCapability(I)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};
