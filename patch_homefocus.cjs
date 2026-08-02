const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HomeFocusCard.tsx', 'utf8');

// 1. Reduce padding and gap on card:
// <div className="flex flex-col gap-10"> -> <div className="flex flex-col gap-6">
// <Card className="p-6 sm:p-10... -> <Card className="p-6 sm:p-8...
content = content.replace(
  /<div className="flex flex-col gap-10">/g,
  '<div className="flex flex-col gap-6">'
);

content = content.replace(
  /<Card className="p-6 sm:p-10 bg-gradient-to-b from-white to-slate-50\/50 dark:from-\[#13131A\] dark:to-\[#0D0D12\] border-none shadow-2xl shadow-black\/5 dark:shadow-black\/40 relative overflow-hidden rounded-3xl">/g,
  '<Card className="p-5 sm:p-8 bg-gradient-to-b from-white to-slate-50/50 dark:from-[#13131A] dark:to-[#0D0D12] border-none shadow-2xl shadow-black/5 dark:shadow-black/40 relative overflow-hidden rounded-3xl">'
);


// 2. Headings & relative time
content = content.replace(
  /<div>\s*<span className="text-xs font-bold uppercase tracking-\[0.2em\] text-slate-400 dark:text-slate-500">\s*\{fixed\}\{relative \? ` • \$\{relative\}` : ''\}\s*<\/span>\s*<\/div>/,
  `<div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-slate-200">
            {fixed}
          </span>
          {relative && (
            <>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">
                {relative}
              </span>
            </>
          )}
        </div>`
);

// 3. Date / Time / Location
content = content.replace(
  /<div className="flex flex-col gap-1">\s*<p className="text-lg font-medium text-slate-700 dark:text-slate-300">\s*\{formattedDate\(\)\}\{targetEvent.time \? ` • \$\{targetEvent.time\}` : ''\}\s*<\/p>\s*\{targetEvent.locationName && \(\s*<p className="text-lg text-slate-500 dark:text-slate-400">\s*\{targetEvent.locationName\}\s*<\/p>\s*\)\}\s*<\/div>/,
  `<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium text-slate-700 dark:text-slate-300">
          <span>{formattedDate()}</span>
          {targetEvent.time && (
            <>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span>{targetEvent.time}</span>
            </>
          )}
          {targetEvent.locationName && (
            <>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-slate-500 dark:text-slate-400">{targetEvent.locationName}</span>
            </>
          )}
        </div>`
);

// 4. Role
content = content.replace(
  /<div>\s*<p className="text-lg font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">\s*<span className="text-xl">🎹<\/span>\s*\{t\('dashboard.focus.functionLabel', 'Você servirá como'\)\} \{targetEvent.userFunctionNames.join\('', '\)\}\s*<\/p>\s*<\/div>/,
  `<div>
            <p className="text-base font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="text-lg">🎹</span>
              {t('dashboard.focus.functionLabel', 'Sua função:')} <span className="font-semibold">{targetEvent.userFunctionNames.join(', ')}</span>
            </p>
          </div>`
);


// 5. Repertoire loop
content = content.replace(
  /<div key=\{song.id \|\| idx\} className="flex items-baseline justify-between group">\s*<div className="flex items-baseline gap-4 pr-4 overflow-hidden">\s*<span className="text-sm font-mono text-slate-400 dark:text-slate-500 w-4 shrink-0">\{song.order\}<\/span>\s*<span className="text-lg font-medium text-slate-900 dark:text-white truncate">\{song.title\}<\/span>\s*<\/div>\s*\{effectiveKey && \(\s*<span className="text-sm font-semibold text-slate-400 dark:text-slate-500 shrink-0">\s*\{effectiveKey\}\s*<\/span>\s*\)\}\s*<\/div>/g,
  `<div key={song.id || idx} className="flex items-baseline justify-between group">
                      <div className="flex items-baseline gap-3 pr-4 overflow-hidden">
                        <span className="text-xs font-mono font-medium text-slate-400 dark:text-slate-500 w-4 shrink-0">{song.order}</span>
                        <span className="text-base font-medium text-slate-800 dark:text-slate-100 truncate">{song.title}</span>
                      </div>
                      {effectiveKey && (
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500/70 shrink-0">
                          {effectiveKey}
                        </span>
                      )}
                    </div>`
);

// 6. See Details Button
content = content.replace(
  /<button onClick=\{\(\) => onOpenEvent\(targetEvent\)\} className="w-full sm:w-auto text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors h-10">\s*\{t\('dashboard.focus.seeDetails', 'Ver detalhes da escala'\)\}\s*<\/button>/g,
  `<Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto" size="lg" variant="ghost">
                {t('dashboard.focus.seeDetails', 'Ver detalhes da escala')}
              </Button>`
);

content = content.replace(
  /<div className="flex flex-col gap-3 pt-2">/g,
  '<div className="flex flex-col gap-3 pt-4">' // Give buttons a bit more breathing room
);


// 7. Status Badge generator
content = content.replace(
  /const getScaleStatusBadge = \(targetEvent: HomeEventSummary, currentMode: string\) => \{[\s\S]*?return \{\s*label: t\('dashboard.focus.repertoireReady', 'Escala pronta'\),\s*style: 'text-emerald-600 dark:text-emerald-500'\s*\};\s*\};/m,
  `const getScaleStatusBadge = (targetEvent: HomeEventSummary, currentMode: string) => {
    if (
      targetEvent.status === 'draft' ||
      currentMode === 'continue-draft' ||
      (attentionItems && attentionItems.some(i => i.code === 'draft'))
    ) {
      return {
        label: t('dashboard.focus.scaleDraft', 'Rascunho'),
        style: 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20'
      };
    }

    if (
      (targetEvent.type === 'music' && targetEvent.songCount === 0) ||
      (attentionItems && attentionItems.some(i => i.code === 'missing-repertoire'))
    ) {
      return {
        label: t('dashboard.focus.repertoireIncomplete', 'Repertório incompleto'),
        style: 'bg-rose-500/10 text-rose-600 dark:text-rose-500 border border-rose-500/20'
      };
    }

    if (attentionItems && attentionItems.some(i => i.code === 'missing-team')) {
      return {
        label: t('dashboard.focus.teamIncomplete', 'Equipe incompleta'),
        style: 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20'
      };
    }

    if (
      attentionItems &&
      attentionItems.some(i => i.code === 'missing-time' || i.code === 'missing-location')
    ) {
      return {
        label: t('dashboard.focus.incompleteData', 'Dados incompletos'),
        style: 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20'
      };
    }

    if (
      attentionItems &&
      attentionItems.some(i => i.code === 'pending-responses')
    ) {
      return {
        label: t('dashboard.focus.pendingResponses', 'Aguardando respostas'),
        style: 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20'
      };
    }

    if (attentionItems && attentionItems.length > 0) {
      return {
        label: t('dashboard.focus.inPreparation', 'Em preparação'),
        style: 'bg-blue-500/10 text-blue-600 dark:text-blue-500 border border-blue-500/20'
      };
    }

    return {
      label: t('dashboard.focus.repertoireReady', 'Escala pronta'),
      style: 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-500 border border-emerald-500/10'
    };
  };`
);


// 8. Status Span
content = content.replace(
  /<div>\s*<span className=\{`text-sm font-semibold tracking-wide \$\{statusBadge.style\}`\}>\s*\{statusBadge.label\}\s*<\/span>\s*<\/div>/,
  `<div className="flex items-center">
          <span className={\`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider \$\{statusBadge.style\}\`}>
            {statusBadge.label}
          </span>
        </div>`
);


fs.writeFileSync('components/dashboard/HomeFocusCard.tsx', content);
