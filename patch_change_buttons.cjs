const fs = require('fs');
let content = fs.readFileSync('components/scales/AssignmentResponseActions.tsx', 'utf8');

content = content.replace(
  /<div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white\/5">/,
  '<div className="flex flex-wrap gap-2 pt-2 mt-2">'
);

content = content.replace(
  /className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium transition-colors bg-emerald-500\/10 hover:bg-emerald-500\/20 text-emerald-400 rounded-xl border border-emerald-500\/20"/g,
  'className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium transition-colors bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl"'
);

content = content.replace(
  /className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium transition-colors bg-white\/5 hover:bg-white\/10 text-slate-300 rounded-xl border border-white\/10"/g,
  'className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium transition-colors bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-300 rounded-xl"'
);

fs.writeFileSync('components/scales/AssignmentResponseActions.tsx', content);
