const fs = require('fs');
let content = fs.readFileSync('components/scales/AssignmentResponseActions.tsx', 'utf8');

// Adjust the container padding
content = content.replace(
  /\} py-2`\}>/,
  '} pt-1`}>'
);

// Adjust Pending Title
content = content.replace(
  /<h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">\{t\('responses.titlePending', 'Confirme sua participação'\)\}<\/h4>/g,
  '<h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t(\'responses.titlePending\', \'Sua presença\')}</h4>'
);

// Adjust grid mt-4 -> mt-3
content = content.replace(
  /<div className=\{`grid \$\{compact \? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'\} gap-2 mt-4`\}>/g,
  '<div className={`grid ${compact ? \'grid-cols-1 sm:grid-cols-3\' : \'grid-cols-1 sm:grid-cols-3\'} gap-2 mt-3`}>'
);

// Accepted/Maybe/Declined Titles
content = content.replace(
  /<h4 className="font-medium text-slate-900 dark:text-white">\{t\('responses.titleAccepted', 'Presença confirmada'\)\}<\/h4>/g,
  '<h4 className="font-medium text-slate-800 dark:text-slate-200">{t(\'responses.titleAccepted\', \'Presença confirmada\')}</h4>'
);

content = content.replace(
  /<h4 className="font-medium text-slate-900 dark:text-white">\{t\('responses.titleMaybe', 'Você ainda não confirmou'\)\}<\/h4>/g,
  '<h4 className="font-medium text-slate-800 dark:text-slate-200">{t(\'responses.titleMaybe\', \'Ainda não confirmada\')}</h4>'
);

content = content.replace(
  /<h4 className="font-medium text-slate-900 dark:text-white">\{t\('responses.titleDeclined', 'Indisponibilidade informada'\)\}<\/h4>/g,
  '<h4 className="font-medium text-slate-800 dark:text-slate-200">{t(\'responses.titleDeclined\', \'Não participará\')}</h4>'
);

// Adjust spacing for Accepted/Maybe/Declined icons (w-8 h-8 -> w-6 h-6) to make it more elegant
content = content.replace(
  /<div className="w-8 h-8 rounded-full bg-emerald-500\/10 flex items-center justify-center shrink-0 text-emerald-500">/g,
  '<div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-500">'
);
content = content.replace(
  /<div className="w-8 h-8 rounded-full bg-amber-500\/10 flex items-center justify-center shrink-0 text-amber-500">/g,
  '<div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-500">'
);
content = content.replace(
  /<div className="w-8 h-8 rounded-full bg-red-500\/10 flex items-center justify-center shrink-0 text-red-500">/g,
  '<div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 text-red-600 dark:text-red-500">'
);
content = content.replace(/<CheckCircle2 className="w-4 h-4" \/>/g, '<CheckCircle2 className="w-3.5 h-3.5" />');
content = content.replace(/<HelpCircle className="w-4 h-4" \/>/g, '<HelpCircle className="w-3.5 h-3.5" />');
content = content.replace(/<XCircle className="w-4 h-4" \/>/g, '<XCircle className="w-3.5 h-3.5" />');


fs.writeFileSync('components/scales/AssignmentResponseActions.tsx', content);
