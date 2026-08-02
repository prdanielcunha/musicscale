const fs = require('fs');

function patchFile(path) {
  let content = fs.readFileSync(path, 'utf8');

  // I18N
  // Add useTranslation
  if (!content.includes('useTranslation')) {
    content = content.replace(
      /import \{([^\}]+)\} from 'lucide-react';/,
      "import {$1} from 'lucide-react';\nimport { useTranslation } from 'react-i18next';"
    );
    // Find component declaration
    content = content.replace(
      /const (SongCard|LibrarySongCard|LibrarySongListRow): React\.FC<[^>]+> = \([^\)]+\) => \{/,
      "$& \n  const { t } = useTranslation();"
    );
  }

  // Replace "Na letra:" with `{t('library.in_lyrics', 'Na letra:')}`
  content = content.replace(
    /<span className="font-semibold text-primary mr-1">Na letra:<\/span>/g,
    `<span className="font-semibold text-primary mr-1">{t('library.in_lyrics', 'Na letra:')}</span>`
  );

  // Replace "Tom" with `{t('library.key_short', 'Tom')}`
  content = content.replace(
    /<span className="text-\[9px\] font-bold uppercase tracking-wider text-slate-400 dark:text-white\/40 mb-0\.5">Tom<\/span>/g,
    `<span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40 mb-0.5">{t('library.key_short', 'Tom')}</span>`
  );
  content = content.replace(
    /<span className="text-\[10px\] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0\.5">Tom<\/span>/g,
    `<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">{t('library.key_short', 'Tom')}</span>`
  );

  // Highlight fix
  // We want to replace `{searchMatch && searchTerm ?` with `{searchMatch?.matchOrigin === 'key' ?`
  content = content.replace(
    /\{searchMatch && searchTerm \? \(/g,
    `{searchMatch?.matchOrigin === 'key' ? (`
  );
  
  // Make sure normal state uses `song.selectedKey || song.key || song.originalKey || "—"`
  // In SongCard.tsx:
  content = content.replace(
    /<span className="text-\[13px\] font-bold text-slate-800 dark:text-white\/90 leading-none">\{song\.key \|\| "—"\}<\/span>/g,
    `<span className="text-[13px] font-bold text-slate-800 dark:text-white/90 leading-none">{song.selectedKey || song.key || song.originalKey || "—"}</span>`
  );
  // In LibrarySongCard.tsx / Row:
  content = content.replace(
    /<span className="text-\[14px\] font-bold text-slate-900 dark:text-white leading-none">\{song\.key \|\| "—"\}<\/span>/g,
    `<span className="text-[14px] font-bold text-slate-900 dark:text-white leading-none">{song.selectedKey || song.key || song.originalKey || "—"}</span>`
  );
  
  // Also check `searchMatch?.matchOrigin === 'key' ?` in LibrarySongListRow if it was different
  content = content.replace(
    /searchMatch \? \(/g,
    `searchMatch?.matchOrigin === 'key' ? (`
  );

  fs.writeFileSync(path, content);
  console.log("Patched " + path);
}

patchFile('components/songs/SongCard.tsx');
patchFile('components/library/LibrarySongCard.tsx');
patchFile('components/library/LibrarySongListRow.tsx');

