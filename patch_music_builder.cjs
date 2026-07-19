const fs = require('fs');

const path = './components/scales/MusicBuilder.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace Meu Repertório logic
content = content.replace(
  /\{t\('scaleModal\.myRepertoire', 'Meu Repertório'\)\}.*<\/button>/s,
  `{t('scaleModal.repertoireTab', 'Repertório')} 
          <span className={\`text-[10px] px-1.5 py-0.5 rounded-full \${mobileTab === 'setlist' ? (selectedSongsList.length > 0 ? 'bg-primary text-white' : 'bg-primary/20 text-primary dark:text-primary-light') : (selectedSongsList.length > 0 ? 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300' : 'bg-transparent text-slate-400')}\`}>{selectedSongsList.length}</span>
        </button>`
);

// Insert the summary banner after the tabs
const tabsEndIndex = content.indexOf('</div>', content.indexOf('<!-- Mobile Tabs -->') > -1 ? content.indexOf('<!-- Mobile Tabs -->') : content.indexOf('{/* Mobile Tabs */}'));
if (tabsEndIndex === -1) {
  console.log('Tabs end not found');
  process.exit(1);
}

// Actually, finding the closing div of tabs:
const afterTabs = `
      {/* Mobile Summary Banner */}
      <div className={\`md:hidden mb-4 rounded-xl border p-3 flex flex-col gap-2 transition-all \${selectedSongsList.length > 0 ? 'bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30' : 'bg-slate-50 border-slate-200 dark:bg-white/5 dark:border-white/10'}\`}>
        {selectedSongsList.length === 0 ? (
          <div className="flex flex-col">
            <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200" aria-live="polite">{t('scaleModal.noSongsSelected', 'Nenhuma música selecionada')}</span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('scaleModal.noSongsSelectedDescription', 'Escolha músicas da biblioteca para montar o repertório.')}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col overflow-hidden">
              <span className="text-[13px] font-bold text-primary-dark dark:text-primary-light" aria-live="polite">
                {selectedSongsList.length === 1 
                  ? t('scaleModal.selectedSongsCount_one', '1 música selecionada') 
                  : t('scaleModal.selectedSongsCount', '{{count}} músicas selecionadas', { count: selectedSongsList.length })}
              </span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate">
                {selectedSongsList.length <= 2 
                  ? selectedSongsList.map(s => s.title).join(', ')
                  : t('scaleModal.selectedSongsPreviewMore', '{{songs}} +{{more}}', { 
                      songs: selectedSongsList.slice(0, 2).map(s => s.title).join(', '), 
                      more: selectedSongsList.length - 2 
                    })}
              </span>
            </div>
            <button 
              type="button"
              onClick={() => setMobileTab('setlist')}
              className="shrink-0 bg-white dark:bg-[#2A2A2C] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm"
              aria-label={t('scaleModal.viewSetlist', 'Ver repertório')}
            >
              {t('scaleModal.viewSetlist', 'Ver repertório')}
            </button>
          </div>
        )}
      </div>
`;

// Insert it right after the tabs div
content = content.replace(/(<\/button>\s*<\/div>)/, `$1\n${afterTabs}`);

// Also fix the automatic tab switching behavior if it exists
// Wait, the user said "na primeira música adicionada, pode usar uma microanimação discreta no resumo".
// But we must NOT change the tab automatically. Let's see handleSongToggle.

fs.writeFileSync(path, content);
console.log('MusicBuilder patched');
