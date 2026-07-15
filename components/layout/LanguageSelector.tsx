import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { ChevronUp, Globe } from 'lucide-react';

// Maps advanced variants like pt-BR, en-US safely to client code-bases
const getBaseLanguage = (lang: string): string => {
  if (!lang) return 'pt';
  const base = lang.split('-')[0].split('_')[0].toLowerCase();
  if (['pt', 'en', 'es'].includes(base)) return base;
  return 'pt';
};

export const LanguageSelector: React.FC<{ isCollapsed?: boolean }> = ({ isCollapsed = false }) => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const currentLang = getBaseLanguage(i18n.language);

  const languages = [
    { code: 'pt', label: 'Português' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' }
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  };

  const activeLanguage = languages.find(l => l.code === currentLang) || languages[0];

  const popoverContent = (
    <div
      ref={popoverRef}
      className="absolute z-[200] w-44 bg-white/95 dark:bg-[#1A1A1C]/95 backdrop-blur-3xl border border-black/[0.08] dark:border-white/[0.08] rounded-2xl shadow-2xl p-1.5 animate-scale-in origin-bottom"
      style={isCollapsed ? {
          bottom: '80px',
          left: '80px',
      } : {
          bottom: '100%',
          left: '0',
          marginBottom: '8px'
      }}
    >
      <div className="absolute inset-0 cinematic-noise mix-blend-overlay pointer-events-none rounded-2xl"></div>
      <p className="relative z-10 px-2.5 py-1.5 text-[10px] font-bold text-slate-400 dark:text-[#666] uppercase tracking-widest border-b border-black/[0.03] dark:border-white/5 mb-1">
        {t('settings.language', 'Idioma')}
      </p>
      <div className="relative z-10 space-y-0.5">
        {languages.map((lang) => {
          const isSelected = currentLang === lang.code;
          return (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[13px] font-semibold rounded-xl transition-all duration-200 ${
                isSelected
                  ? 'bg-black/[0.03] dark:bg-white/[0.06] text-black dark:text-white font-bold'
                  : 'text-slate-500 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.01]/50 dark:hover:bg-white/[0.02]/50'
              }`}
            >
              <span className="truncate">{lang.label}</span>
              {isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="relative mt-1">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between px-3 py-2.5 text-[13px] font-semibold transition-all duration-300 ${
          isCollapsed 
            ? 'justify-center mx-auto rounded-xl w-[42px] h-[42px] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]' 
            : 'w-full rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.02] text-slate-500 hover:text-slate-800 dark:text-[#888] dark:hover:text-[#ccc]'
        }`}
        title={t('settings.language', 'Idioma')}
      >
        <div className="flex items-center gap-2.5">
          <Globe className={`w-4 h-4 text-slate-400 dark:text-[#888] transition-transform duration-300 ${isOpen ? 'rotate-12' : ''}`} />
          {!isCollapsed && (
            <span className="truncate leading-none">
              {activeLanguage.label}
            </span>
          )}
        </div>
        {!isCollapsed && (
          <ChevronUp className={`w-3.5 h-3.5 opacity-50 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && (isCollapsed ? createPortal(popoverContent, document.body) : popoverContent)}
    </div>
  );
};
