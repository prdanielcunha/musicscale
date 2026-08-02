const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HomeFocusCard.tsx', 'utf8');

content = content.replace(
  /<Button onClick=\{\(\) => onOpenPerformance\(targetEvent\)\} className="w-full sm:w-auto" size="lg" variant="primary">/g,
  '<Button onClick={() => onOpenPerformance(targetEvent)} className="w-full sm:w-auto rounded-full h-12 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out shadow-lg shadow-indigo-500/25" size="lg" variant="primary">'
);

content = content.replace(
  /<Button onClick=\{\(\) => onOpenEvent\(targetEvent\)\} className="w-full sm:w-auto" size="lg" variant="primary">/g,
  '<Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto rounded-full h-12 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out shadow-lg shadow-indigo-500/25" size="lg" variant="primary">'
);

content = content.replace(
  /<Button onClick=\{\(\) => onOpenEvent\(targetEvent\)\} className="w-full sm:w-auto" size="lg" variant="ghost">/g,
  '<Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto rounded-full h-12 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-[0.98] transition-all duration-300 ease-out font-medium" size="lg" variant="ghost">'
);

fs.writeFileSync('components/dashboard/HomeFocusCard.tsx', content);
