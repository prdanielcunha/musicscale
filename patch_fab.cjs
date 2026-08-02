const fs = require('fs');
let content = fs.readFileSync('components/layout/GlobalCreateAction.tsx', 'utf8');

// Reduce mobile FAB size, shadow, and prominence
content = content.replace(
  /className="flex items-center h-12 w-auto px-4 sm:px-5 rounded-full bg-\[linear-gradient\(180deg,rgba\(49,46,129,0\.94\)_0%,rgba\(30,27,75,0\.94\)_100%\)\] backdrop-blur-xl text-white shadow-\[0_10px_28px_rgba\(0,0,0,0\.46\),inset_0_1px_0_rgba\(255,255,255,0\.10\)\] active:scale-\[0\.98\] active:bg-\[linear-gradient\(180deg,rgba\(55,48,163,0\.94\)_0%,rgba\(49,46,129,0\.94\)_100%\)\] transition-all duration-150 border border-\[#a5b4fc\]\/25 focus:outline-none focus:ring-2 focus:ring-indigo-400\/50"/g,
  'className="flex items-center h-11 w-auto px-4 rounded-full bg-[linear-gradient(180deg,rgba(49,46,129,0.90)_0%,rgba(30,27,75,0.90)_100%)] backdrop-blur-xl text-white/90 shadow-[0_6px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] active:scale-[0.98] active:bg-[linear-gradient(180deg,rgba(55,48,163,0.90)_0%,rgba(49,46,129,0.90)_100%)] transition-all duration-300 ease-out border border-[#a5b4fc]/20 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"'
);

content = content.replace(
  /<Plus className="w-\[18px\] h-\[18px\] mr-\[7px\] text-\[#C7D2FE\]" \/>/g,
  '<Plus className="w-4 h-4 mr-1.5 text-[#a5b4fc]" />'
);

content = content.replace(
  /<span className="text-\[13\.5px\] font-semibold">\{t\('globalCreate\.trigger', 'Criar'\)\}<\/span>/g,
  '<span className="text-[13px] font-semibold">{t(\'globalCreate.trigger\', \'Criar\')}</span>'
);

fs.writeFileSync('components/layout/GlobalCreateAction.tsx', content);
