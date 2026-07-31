import fs from 'fs';
let content = fs.readFileSync('components/layout/GlobalCreateAction.tsx', 'utf8');

// 1. Remove the first console.log
content = content.replace(
  'console.log("GlobalCreateAction rendering with variant:", variant);',
  ''
);

// 2. Remove the second console.log
content = content.replace(
  'console.log("handleExitComplete called, pendingAction:", pendingActionRef.current);',
  ''
);

// 3. Update the mobile trigger button
const oldMobileTrigger = `
      <div className="pointer-events-auto flex justify-center w-full z-[110] relative">
        <button
          ref={triggerRef}
          onClick={() => setIsOpen(true)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-controls="global-create-dialog"
          aria-label={t('globalCreate.trigger', 'Criar')}
          className="flex items-center justify-center w-[52px] h-[52px] rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-[0_8px_20px_rgba(99,102,241,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all duration-300 border border-indigo-400/30"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>
`.trim();

const newMobileTrigger = `
      <div className="pointer-events-auto z-[110] relative shadow-lg rounded-full">
        <button
          ref={triggerRef}
          onClick={() => setIsOpen(true)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-controls="global-create-dialog"
          aria-label={t('globalCreate.trigger', 'Criar')}
          className="flex items-center h-12 w-auto px-4 sm:px-5 rounded-full bg-indigo-600 text-white shadow-md active:scale-95 transition-transform duration-200 border border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <Plus className="w-[18px] h-[18px] mr-[7px]" />
          <span className="text-[13.5px] font-semibold">{t('globalCreate.trigger', 'Criar')}</span>
        </button>
      </div>
`.trim();

content = content.replace(oldMobileTrigger, newMobileTrigger);

fs.writeFileSync('components/layout/GlobalCreateAction.tsx', content);
