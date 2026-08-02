const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HomeFocusCard.tsx', 'utf8');

content = content.replace(
  /<div key=\{song.id \|\| idx\} className="flex items-baseline justify-between group">\s*<div className="flex items-baseline gap-3 pr-4 overflow-hidden">\s*<span className="text-xs font-mono font-medium text-slate-400 dark:text-slate-500 w-4 shrink-0">\{song.order\}<\/span>\s*<span className="text-base font-medium text-slate-800 dark:text-slate-100 truncate">\{song.title\}<\/span>\s*<\/div>\s*\{effectiveKey && \(\s*<span className="text-xs font-medium text-slate-400 dark:text-slate-500\/70 shrink-0">\s*\{effectiveKey\}\s*<\/span>\s*\)\}\s*<\/div>/g,
  `<div key={song.id || idx} className="flex items-center justify-between group py-0.5">
                      <div className="flex items-center gap-3 pr-4 overflow-hidden">
                        <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500/60 w-4 shrink-0 text-right">{song.order}</span>
                        <span className="text-[15px] font-medium text-slate-800 dark:text-slate-200 truncate">{song.title}</span>
                      </div>
                      {effectiveKey && (
                        <span className="text-[11px] font-bold text-slate-400/80 dark:text-slate-500/60 shrink-0 uppercase tracking-widest">
                          {effectiveKey}
                        </span>
                      )}
                    </div>`
);

// We need to replace it correctly, the original regex might fail if spaces are different.
fs.writeFileSync('components/dashboard/HomeFocusCard.tsx', content);
