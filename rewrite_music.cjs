const fs = require('fs');
const path = './components/scales/MusicBuilder.tsx';
let content = fs.readFileSync(path, 'utf8');

const startOfTabsEnd = content.indexOf('      {/* Mobile Summary Banner */}');
const endOfBrokenMap = content.indexOf('          ) : (', startOfTabsEnd);

if (startOfTabsEnd > -1 && endOfBrokenMap > -1) {
  const replacement = `
      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Library Column */}
        <div className={\`flex-col w-full lg:w-1/2 h-full overflow-hidden \${mobileTab === 'library' ? 'flex' : 'hidden md:flex'}\`}>
          <div className="flex flex-col space-y-3 flex-shrink-0 mb-4">
             <div className="relative">
               <input 
                 type="text" 
                 value={songSearch} 
                 onChange={e => setSongSearch(e.target.value)} 
                 placeholder={t('scaleModal.searchSongs', 'Buscar músicas...')}
                 className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-white placeholder:text-slate-400"
               />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 pb-20 md:pb-4">
            {filteredSongs.length > 0 ? (
              filteredSongs.map(song => {
                const isSelected = selectedSongsList.some(s => s.id === song.id);
                return (
                  <div key={song.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-white dark:bg-[#1C1C1E] shadow-sm hover:border-primary/30 transition-colors">
                    <div className="flex flex-col overflow-hidden pr-3">
                      <span className="text-[13px] font-bold text-slate-800 dark:text-white truncate">{song.title}</span>
                      <span className="text-[11px] font-medium text-slate-500 truncate">{song.artist || t('scaleModal.unknownArtist', 'Artista desconhecido')}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleSongToggle(song.id)}
                      className={\`shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all \${isSelected ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/20'}\`}
                    >
                      <span className="text-[18px] font-bold leading-none mb-0.5">{isSelected ? '✓' : '+'}</span>
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-1">{t('scaleModal.noSongsFoundTitle', 'Nenhuma música')}</span>
                <span className="text-[11px] text-slate-500 max-w-[200px]">{t('scaleModal.noSongsFoundDesc', 'Tente buscar com outros termos')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Setlist Column */}
        <div className={\`flex-col w-full lg:w-1/2 h-full overflow-hidden \${mobileTab === 'setlist' ? 'flex' : 'hidden md:flex'}\`}>
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
              onClick={() => setMobileTab('library')}
              className="shrink-0 bg-white dark:bg-[#2A2A2C] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm"
            >
              {t('scaleModal.addMore', 'Adicionar mais')}
            </button>
          </div>
        )}
      </div>
      
          <div className="hidden md:flex items-center justify-between mb-4 flex-shrink-0">
             <h3 className="text-[14px] font-bold text-slate-800 dark:text-white flex items-center gap-2">
               {t('scaleModal.repertoireTitle', 'Repertório')} 
               <span className="bg-primary/10 text-primary dark:text-primary-light px-2 py-0.5 rounded-full text-[11px]">{selectedSongsList.length}</span>
             </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 pb-20 md:pb-4">
             {selectedSongsList.length > 0 ? (
                selectedSongsList.map((song, index) => {
                  return (
                    <React.Fragment key={song.id}>
                      <div 
                        onDragOver={(e) => handleDragOver(e, song.id)}
                        onDrop={(e) => handleDrop(e, song.id)}
                        onDragLeave={() => setDropTargetId(null)}
                        className={\`h-2 rounded-md transition-all duration-150 \${dropTargetId === song.id ? "bg-primary/50 h-8" : ""}\`}
                      />
                      <div 
                        draggable
                        onDragStart={() => handleDragStart(song.id)}
                        onDragEnd={handleDragEnd}
                        onTouchStart={(e) => handleTouchStart(e, song.id)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        className={\`group relative flex items-center p-3 bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm transition-all duration-200 \${draggedSongId === song.id ? 'opacity-50 scale-[0.98]' : 'hover:border-primary/30 cursor-grab active:cursor-grabbing'}\`}
                      >
                         <div className="flex-1 flex flex-col overflow-hidden pl-1">
                           <span className="text-[13px] font-bold text-slate-800 dark:text-white truncate">{song.title}</span>
                           <span className="text-[11px] font-medium text-slate-500 truncate">{song.artist || t('scaleModal.unknownArtist', 'Artista desconhecido')}</span>
                         </div>
                         <div className="flex items-center gap-0.5">
                            <button type="button" onClick={() => moveSong(index, -1)} disabled={index === 0} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"><span className="text-[12px]">↑</span></button>
                            <button type="button" onClick={() => moveSong(index, 1)} disabled={index === selectedSongsList.length - 1} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"><span className="text-[12px]">↓</span></button>
                            <button type="button" onClick={() => handleSongToggle(song.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg ml-1"><span className="text-[12px]">✕</span></button>
                         </div>
                      </div>
                    </React.Fragment>
                  )
                })
`;
  
  const before = content.substring(0, startOfTabsEnd);
  const after = content.substring(endOfBrokenMap + 7); // 7 is length of "          ) : ("
  
  // Actually, we replaced everything up to the broken map end.
  // Wait, let's make sure the `after` string has the empty state.
  fs.writeFileSync(path, before + replacement + '          ) : (\n' + after);
  console.log('MusicBuilder.tsx rewritten successfully!');
} else {
  console.log('Markers not found.');
}
