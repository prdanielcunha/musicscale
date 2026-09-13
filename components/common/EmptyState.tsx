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

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.42, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className={`isolate flex flex-col items-center justify-center px-6 py-16 text-center sm:py-20 ${className}`}
    >
      <div className="relative mb-7 flex h-[84px] w-[84px] items-center justify-center">
        <div className="pointer-events-none absolute inset-2 rounded-full bg-primary/[0.12] blur-2xl" />
        <motion.div
          initial={shouldReduceMotion ? false : { scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={transition}
          className="relative flex h-[84px] w-[84px] items-center justify-center rounded-[24px] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(79,140,255,0.10),rgba(255,255,255,0.025)_48%,rgba(120,104,255,0.07))] text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_44px_-28px_rgba(0,0,0,0.9)]"
        >
          {icon || (
            <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          )}
        </motion.div>
      </div>

      <h3 className="mb-2.5 max-w-sm px-4 text-[20px] font-semibold tracking-[-0.025em] text-white sm:text-[22px]">
        {title}
      </h3>
      <p className="mx-auto mb-7 max-w-md px-4 text-[14px] font-medium leading-relaxed text-white/45 sm:text-[15px]">
        {description}
      </p>

      {action && (
        <div
          className="flex w-full justify-center"
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