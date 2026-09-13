import React, { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { emotionTracker } from "../../services/emotionTelemetry";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  contextTrackingKey?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = "",
  contextTrackingKey,
}) => {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    emotionTracker.track(
      "hesitation",
      `empty_state_viewed_${contextTrackingKey || title.toLowerCase().replace(/\s/g, "_")}`,
    );
  }, [contextTrackingKey, title]);

  const initial = shouldReduceMotion ? false : { opacity: 0, y: 8 };
  const animate = { opacity: 1, y: 0 };
  const transition = { duration: shouldReduceMotion ? 0 : 0.42, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      className={`flex flex-col items-center justify-center py-16 sm:py-20 px-5 text-center isolate ${className}`}
    >
      <div className="relative mb-6 w-[76px] h-[76px] flex items-center justify-center">
        <div className="absolute inset-2 bg-indigo-500/[0.08] blur-2xl rounded-full pointer-events-none" />
        <div className="relative w-[72px] h-[72px] rounded-[22px] bg-[#12151c] shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_12px_32px_rgba(0,0,0,0.2)] border border-white/[0.07] flex items-center justify-center text-slate-400">
          {icon || (
            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          )}
        </div>
      </div>

      <h3 className="text-[21px] sm:text-[23px] font-bold text-white mb-2 tracking-[-0.03em] max-w-sm px-4">
        {title}
      </h3>
      <p className="text-[14px] sm:text-[15px] text-slate-400 font-medium max-w-md mx-auto mb-7 leading-relaxed px-4 text-pretty">
        {description}
      </p>

      {action && (
        <div
          className="flex justify-center w-full"
          onClick={() =>
            emotionTracker.track(
              "recovery",
              `empty_state_action_${contextTrackingKey || title.toLowerCase().replace(/\s/g, "_")}`,
            )
          }
        >
          {action}
        </div>
      )}
    </motion.div>
  );
};

export default EmptyState;
