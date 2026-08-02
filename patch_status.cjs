const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HomeFocusCard.tsx', 'utf8');

content = content.replace(
  /label: t\('dashboard\.focus\.scaleDraft', 'Rascunho'\),\s*style: 'bg-amber-500\/10 text-amber-600 dark:text-amber-500 border border-amber-500\/20'/g,
  `label: t('dashboard.focus.scaleDraft', 'Rascunho'),
        style: 'bg-amber-500/[0.05] text-amber-600 dark:text-amber-400 border border-amber-500/10'`
);

content = content.replace(
  /label: t\('dashboard\.focus\.repertoireIncomplete', 'Repertório incompleto'\),\s*style: 'bg-rose-500\/10 text-rose-600 dark:text-rose-500 border border-rose-500\/20'/g,
  `label: t('dashboard.focus.repertoireIncomplete', 'Repertório incompleto'),
        style: 'bg-rose-500/[0.05] text-rose-600 dark:text-rose-400 border border-rose-500/10'`
);

content = content.replace(
  /label: t\('dashboard\.focus\.teamIncomplete', 'Equipe incompleta'\),\s*style: 'bg-amber-500\/10 text-amber-600 dark:text-amber-500 border border-amber-500\/20'/g,
  `label: t('dashboard.focus.teamIncomplete', 'Equipe incompleta'),
        style: 'bg-amber-500/[0.05] text-amber-600 dark:text-amber-400 border border-amber-500/10'`
);

content = content.replace(
  /label: t\('dashboard\.focus\.incompleteData', 'Dados incompletos'\),\s*style: 'bg-amber-500\/10 text-amber-600 dark:text-amber-500 border border-amber-500\/20'/g,
  `label: t('dashboard.focus.incompleteData', 'Dados incompletos'),
        style: 'bg-amber-500/[0.05] text-amber-600 dark:text-amber-400 border border-amber-500/10'`
);

content = content.replace(
  /label: t\('dashboard\.focus\.pendingResponses', 'Aguardando respostas'\),\s*style: 'bg-amber-500\/10 text-amber-600 dark:text-amber-500 border border-amber-500\/20'/g,
  `label: t('dashboard.focus.pendingResponses', 'Aguardando respostas'),
        style: 'bg-amber-500/[0.05] text-amber-600 dark:text-amber-400 border border-amber-500/10'`
);

content = content.replace(
  /label: t\('dashboard\.focus\.inPreparation', 'Em preparação'\),\s*style: 'bg-blue-500\/10 text-blue-600 dark:text-blue-500 border border-blue-500\/20'/g,
  `label: t('dashboard.focus.inPreparation', 'Em preparação'),
        style: 'bg-blue-500/[0.05] text-blue-600 dark:text-blue-400 border border-blue-500/10'`
);

content = content.replace(
  /label: t\('dashboard\.focus\.repertoireReady', 'Escala pronta'\),\s*style: 'bg-emerald-500\/5 text-emerald-600 dark:text-emerald-500 border border-emerald-500\/10'/g,
  `label: t('dashboard.focus.repertoireReady', 'Escala pronta'),
      style: 'bg-emerald-500/[0.03] text-emerald-600 dark:text-emerald-400 border border-emerald-500/[0.08]'`
);

content = content.replace(
  /<div className="flex items-center">\s*<span className=\{\`inline-flex items-center px-2 py-0\.5 rounded text-\[11px\] font-bold uppercase tracking-wider \$\{statusBadge\.style\}\`\}>\s*\{statusBadge\.label\}\s*<\/span>\s*<\/div>/g,
  `<div className="flex items-center">
          <span className={\`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium tracking-wide \$\{statusBadge.style\}\`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
            {statusBadge.label}
          </span>
        </div>`
);

fs.writeFileSync('components/dashboard/HomeFocusCard.tsx', content);
