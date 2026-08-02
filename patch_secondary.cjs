const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HomeSecondaryContent.tsx', 'utf8');

content = content.replace(
  /className="w-full flex items-center justify-between p-4 bg-white dark:bg-\[#101014\] border border-slate-200 dark:border-white\/\[0.08\] rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-white\/\[0.02\] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-\[44px\]"/,
  'className="w-full flex items-center justify-between py-4 text-left transition-colors hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[44px]"'
);

content = content.replace(
  /bg-white dark:bg-\[#101014\] border border-slate-200 dark:border-white\/\[0.08\] rounded-xl/,
  '' // I already replaced it above though, so this is just in case
);

fs.writeFileSync('components/dashboard/HomeSecondaryContent.tsx', content);
