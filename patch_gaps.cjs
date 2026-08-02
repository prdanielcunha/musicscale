const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HomeFocusCard.tsx', 'utf8');

content = content.replace(
  /<Card className="p-5 sm:p-8/g,
  '<Card className="p-4 sm:p-6'
);

content = content.replace(
  /<div className="flex flex-col gap-6">/g,
  '<div className="flex flex-col gap-4">'
);

content = content.replace(
  /<h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">/g,
  '<h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">'
);

fs.writeFileSync('components/dashboard/HomeFocusCard.tsx', content);
