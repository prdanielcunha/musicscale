import React, { useEffect } from "react";
import { motion } from "motion/react";
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
  useEffect(() => {
    emotionTracker.track(
      "hesitation",
      `empty_state_viewed_${contextTrackingKey || title.toLowerCase().replace(/\s/g, "_")}`,
    );
  }, [contextTrackingKey, title]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col items-center justify-center py-24 px-6 text-center isolate ${className}`}
    >
      <div className="relative mb-10 w-24 h-24 flex items-center justify-center">
        <motion.div
           initial={{ scale: 0.5, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
           className="absolute inset-0 bg-gradient-to-tr from-slate-200/50 to-white dark:from-white/[0.04] dark:to-white/[0.08] blur-2xl rounded-full pointer-events-none" 
        />
        {icon ? (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-24 h-24 rounded-[32px] bg-gradient-to-b from-white to-slate-50 dark:from-white/[0.03] dark:to-white/[0.06] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.4)] border border-black/5 dark:border-white/[0.08] flex items-center justify-center text-slate-400 dark:text-slate-400 backdrop-blur-xl"
          >
            {icon}
          </motion.div>
        ) : (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-24 h-24 rounded-[32px] bg-gradient-to-b from-white to-slate-50 dark:from-white/[0.03] dark:to-white/[0.06] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.4)] border border-black/5 dark:border-white/[0.08] flex items-center justify-center backdrop-blur-xl"
          >
            <svg
              className="w-10 h-10 text-slate-300 dark:text-slate-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </motion.div>
        )}
      </div>

      <motion.h3 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-[24px] font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight max-w-sm font-sans px-4"
      >
        {title}
      </motion.h3>
      <motion.p 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-[15px] text-slate-500 dark:text-white/50 font-medium max-w-md mx-auto mb-10 leading-relaxed font-sans px-4"
      >
        {description}
      </motion.p>

      {action && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center w-full"
          onClick={() =>
            emotionTracker.track(
              "recovery",
              `empty_state_action_${contextTrackingKey || title.toLowerCase().replace(/\s/g, "_")}`,
            )
          }
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
};

export default EmptyState;
