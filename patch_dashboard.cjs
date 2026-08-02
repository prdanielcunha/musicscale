const fs = require('fs');
let content = fs.readFileSync('pages/DashboardPage.tsx', 'utf8');

content = content.replace(
  /className="w-full text-left bg-white dark:bg-\[#1A1A1F\] border border-amber-200 dark:border-amber-500\/20 rounded-xl p-3 flex items-center gap-3 hover:border-amber-300 dark:hover:border-amber-500\/40 transition-colors"/g,
  'className="w-full text-left rounded-xl py-3 flex items-center gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02]"'
);

content = content.replace(
  /className="w-full text-left bg-slate-50 dark:bg-white\/\[0.02\] border border-transparent hover:border-slate-200 dark:hover:border-white\/\[0.05\] rounded-xl p-3 flex flex-col transition-colors"/g,
  'className="w-full text-left rounded-xl py-2 flex flex-col transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02]"'
);

content = content.replace(
  /className="w-full text-left bg-slate-50 dark:bg-white\/\[0.02\] border border-transparent hover:border-slate-200 dark:hover:border-white\/\[0.05\] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors"/g,
  'className="w-full text-left rounded-xl py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02]"'
);

fs.writeFileSync('pages/DashboardPage.tsx', content);
