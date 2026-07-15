import React, { useState } from 'react';
import { Lock, Crown, Sparkles } from 'lucide-react';
import { UpgradePlanModal } from '../premium/EntitlementGates';
import { MusicScaleFeatures } from '../../services/entitlementsService';
import Button, { ButtonProps } from '../common/Button';

export interface LockedActionButtonProps extends Omit<ButtonProps, 'onClick'> {
  label: string;
  isLocked: boolean;
  featureKey: keyof MusicScaleFeatures;
  requiredPlan: 'advanced' | 'pro';
  onClick: () => void;
  onLockedClick?: () => void;
}

export const LockedActionButton: React.FC<LockedActionButtonProps> = ({
  label,
  isLocked,
  featureKey,
  requiredPlan,
  onClick,
  onLockedClick,
  className = '',
  leftIcon,
  rightIcon,
  ...buttonProps
}) => {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isLocked) {
      if (onLockedClick) {
        onLockedClick();
      }
      setShowUpgradeModal(true);
    } else {
      onClick();
    }
  };

  const planBadge = requiredPlan === 'pro' ? (
    <span className="ml-2 text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-900/30">PRO</span>
  ) : (
    <span className="ml-2 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-900/30">ADV</span>
  );

  return (
    <>
      <Button
        onClick={handleClick}
        leftIcon={leftIcon || (isLocked ? <Lock className="w-4 h-4 opacity-70" /> : undefined)}
        rightIcon={isLocked && !rightIcon ? planBadge : rightIcon}
        className={`${className} ${isLocked ? 'opacity-90 grayscale-[0.2]' : ''}`}
        {...buttonProps}
      >
        {label}
        {isLocked && rightIcon && planBadge}
      </Button>

      {isLocked && (
        <UpgradePlanModal 
          isOpen={showUpgradeModal} 
          onClose={() => setShowUpgradeModal(false)} 
          featureKey={featureKey} 
        />
      )}
    </>
  );
};
