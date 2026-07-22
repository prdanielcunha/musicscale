import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Compass } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface HomeSecondaryContentProps {
  children: React.ReactNode;
}

export const HomeSecondaryContent: React.FC<HomeSecondaryContentProps> = ({ children }) => {
  const { t } = useTranslation();
  // On mobile it should be collapsed by default. 
  // We can just set it to false and let the user expand it.
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="secondary-content"
        className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[44px]"
      >
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium">
          <Compass className="w-5 h-5 text-indigo-500" />
          {t('dashboard.secondaryContent.exploreMore', 'Explorar mais')}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            id="secondary-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 pb-4 space-y-6">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
