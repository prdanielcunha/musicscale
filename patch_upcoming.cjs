const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HomeUpcomingEvents.tsx', 'utf8');

content = content.replace(
  /className="w-full text-left bg-white dark:bg-\[#101014\] border border-slate-200 dark:border-white\/\[0.08\] rounded-xl p-4 flex gap-4 items-start transition-all hover:border-slate-300 dark:hover:border-white\/\[0.15\] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/g,
  'className="w-full text-left rounded-2xl p-4 flex gap-4 items-start transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-indigo-500"'
);

fs.writeFileSync('components/dashboard/HomeUpcomingEvents.tsx', content);
