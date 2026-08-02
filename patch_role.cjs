const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HomeFocusCard.tsx', 'utf8');

content = content.replace(
  /<div>\s*<p className="text-base font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">\s*<span className="text-lg">🎹<\/span>\s*\{t\('dashboard.focus.functionLabel', 'Sua função:'\)\} <span className="font-semibold">\{targetEvent.userFunctionNames.join\(', '\)\}<\/span>\s*<\/p>\s*<\/div>/g,
  `<div>
            <p className="text-[15px] text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span className="text-base">🎹</span>
              <span className="font-bold text-slate-900 dark:text-white">{targetEvent.userFunctionNames.join(', ')}</span>
            </p>
          </div>`
);

fs.writeFileSync('components/dashboard/HomeFocusCard.tsx', content);
