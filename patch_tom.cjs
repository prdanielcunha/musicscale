const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HomeFocusCard.tsx', 'utf8');

content = content.replace(
  /<span className="text-\[11px\] font-bold text-slate-400\/80 dark:text-slate-500\/60 shrink-0 uppercase tracking-widest">\s*\{effectiveKey\}\s*<\/span>/g,
  `<span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[13px] font-extrabold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 shrink-0 tracking-wide border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                          {effectiveKey}
                        </span>`
);

fs.writeFileSync('components/dashboard/HomeFocusCard.tsx', content);
