import fs from 'fs';
let content = fs.readFileSync('components/layout/GlobalCreateAction.tsx', 'utf8');

// Fix Desktop Button text
content = content.replace(
  '<Plus className={`w-5 h-5 transition-transform duration-300 ${isOpen ? \'rotate-45\' : \'\'}`} />\n        </button>',
  '<Plus className={`w-4 h-4 mr-1.5 transition-transform duration-300 ${isOpen ? \'rotate-45\' : \'\'}`} />\n          <span className="text-[13px] sm:text-sm font-bold tracking-wide">{t(\'globalCreate.trigger\', \'Criar\')}</span>\n        </button>'
);

// Ensure the button itself isn't a small circle on desktop but a rounded rect
content = content.replace(
  'className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all border',
  'className={`flex items-center justify-center h-9 sm:h-10 px-3 sm:px-4 rounded-full transition-all border'
);

// Add ARIA attributes to desktop popover
content = content.replace(
  'className="absolute right-0 top-[calc(100%+12px)] w-[320px]',
  'id="global-create-menu"\n              role="menu"\n              className="absolute right-0 top-[calc(100%+12px)] w-[320px]'
);

// Change aria-haspopup="menu" on desktop to include aria-controls
content = content.replace(
  'aria-haspopup="menu"\n          aria-label={t(\'globalCreate.trigger\', \'Criar\')}',
  'aria-haspopup="menu"\n          aria-controls="global-create-menu"\n          aria-expanded={isOpen}\n          aria-label={t(\'globalCreate.trigger\', \'Criar\')}'
);

// Change mobile structure to relative
content = content.replace(
  '<div className="absolute left-1/2 -translate-x-1/2 -top-[24px] pointer-events-auto">',
  '<div className="pointer-events-auto flex justify-center w-full z-[110] relative">'
);

// Change mobile trigger ARIA
content = content.replace(
  'aria-haspopup="menu"\n          aria-label={t(\'globalCreate.trigger\', \'Criar\')}\n          className="flex items-center justify-center w-[52px] h-[52px]',
  'aria-haspopup="dialog"\n          aria-controls="global-create-dialog"\n          aria-expanded={isOpen}\n          aria-label={t(\'globalCreate.trigger\', \'Criar\')}\n          className="flex items-center justify-center w-[52px] h-[52px]'
);

// Change mobile dialog ARIA
content = content.replace(
  'role="dialog"\n                aria-modal="true"\n                aria-labelledby="global-create-title"',
  'id="global-create-dialog"\n                role="dialog"\n                aria-modal="true"\n                aria-labelledby="global-create-title"'
);

fs.writeFileSync('components/layout/GlobalCreateAction.tsx', content);
