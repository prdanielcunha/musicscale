const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HomeFocusCard.tsx', 'utf8');

content = content.replace(
  /<button onClick=\{\(\) => onOpenEvent\(targetEvent\)\} className="w-full sm:w-auto text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors h-10">\s*\{t\('dashboard.focus.viewScaleDetails', 'Ver detalhes'\)\}\s*<\/button>/g,
  `<Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto" size="lg" variant="ghost">
                {t('dashboard.focus.viewScaleDetails', 'Ver detalhes')}
              </Button>`
);

// We should also look at the other buttons in Actions Button Bar, maybe space them evenly or inline.
// <div className="flex flex-col gap-3 pt-4">
// Can we make them side by side on desktop?
// <div className="flex flex-col sm:flex-row gap-3 pt-4">

content = content.replace(
  /<div className="flex flex-col gap-3 pt-4">/g,
  '<div className="flex flex-col sm:flex-row gap-3 pt-4">'
);

fs.writeFileSync('components/dashboard/HomeFocusCard.tsx', content);
