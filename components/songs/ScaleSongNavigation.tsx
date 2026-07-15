import React from 'react';
import { PopulatedSong } from '../../types';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';

interface ScaleSongNavigationProps {
  scaleContext: {
    scaleId?: string;
    songs: PopulatedSong[];
    currentIndex: number;
    scaleTitle?: string;
  };
  onNavigate: (direction: 'next' | 'previous') => void;
  onClose: () => void;
  isWorshipFlow?: boolean;
}

export const ScaleSongNavigation: React.FC<ScaleSongNavigationProps> = ({
  scaleContext,
  onNavigate,
  onClose,
  isWorshipFlow,
}) => {
  if (!scaleContext || scaleContext.songs.length === 0) return null;

  const { songs, currentIndex, scaleTitle = 'Culto' } = scaleContext;
  const currentNumber = currentIndex + 1;
  const total = songs.length;

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < total - 1;

  const prevSong = canGoPrev ? songs[currentIndex - 1] : null;
  const nextSong = canGoNext ? songs[currentIndex + 1] : null;

  // Em modo Worship Flow intenso não mostramos a navegação gigante pra não atrapalhar 
  // (a barra dock do ChordViewer já serve para algo, ou deixamos a navegação também).
  // Mas a spec pede pra respeitar o Worship Flow. Se isWorshipFlow for true o fundo fica "black", 
  // então podemos fazer algo extra dark.

  return (
    <div className="fixed top-20 md:top-24 left-0 w-full flex justify-center pointer-events-none z-[110] p-4 transition-all duration-500 ease-out hidden md:flex">
       <div className="pointer-events-auto bg-[#0A0A0C]/85 backdrop-blur-3xl border border-white/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.6)] rounded-3xl px-6 py-2.5 flex items-center gap-8 max-w-2xl w-full justify-between">
           
           <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-white/50 tracking-[0.2em]">Escala • {scaleTitle}</span>
              <span className="text-sm font-semibold text-white/90">Música {currentNumber} de {total}</span>
           </div>

           <div className="flex items-center gap-4">
               <button
                  onClick={() => canGoPrev ? onNavigate('previous') : onClose()}
                  className={`flex flex-col items-start px-3 py-1.5 rounded-2xl border border-transparent transition-all ${
                    canGoPrev ? 'hover:bg-white/5 cursor-pointer hover:border-white/10 active:scale-95' : 'hover:bg-white/5 text-white/50 cursor-pointer active:scale-95'
                  }`}
               >
                 <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-white/40 mb-0.5">
                    <ChevronLeftIcon className="w-3 h-3" />
                    {canGoPrev ? 'Anterior' : 'Sair da Escala'}
                 </div>
                 {canGoPrev ? (
                    <span className="text-xs font-semibold text-white max-w-[120px] truncate">{prevSong?.title}</span>
                 ) : (
                    <span className="text-xs font-semibold text-white/40">Voltar aos detalhes</span>
                 )}
               </button>

               <div className="w-px h-8 bg-white/[0.05]" />

               <button
                  onClick={() => canGoNext ? onNavigate('next') : onClose()}
                  className={`flex items-end flex-col px-3 py-1.5 rounded-2xl border border-transparent transition-all ${
                    canGoNext ? 'hover:bg-white/5 cursor-pointer hover:border-white/10 active:scale-95' : 'hover:bg-[#34d399]/10 hover:border-[#34d399]/20 cursor-pointer active:scale-95'
                  }`}
               >
                 <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-white/40 mb-0.5">
                    {canGoNext ? 'Próxima' : 'Finalizar'}
                    <ChevronRightIcon className="w-3 h-3" />
                 </div>
                 {canGoNext ? (
                    <span className="text-xs font-semibold text-white max-w-[120px] truncate">{nextSong?.title}</span>
                 ) : (
                    <span className="text-xs font-semibold text-[#34d399]">Concluir Escala</span>
                 )}
               </button>
           </div>
       </div>
    </div>
  );
};

export const ScaleSongNavigationMobile: React.FC<ScaleSongNavigationProps> = ({
  scaleContext,
  onNavigate,
  onClose,
  isWorshipFlow,
}) => {
  if (!scaleContext || scaleContext.songs.length === 0) return null;

  const { songs, currentIndex, scaleTitle = 'Culto' } = scaleContext;
  const currentNumber = currentIndex + 1;
  const total = songs.length;

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < total - 1;

  const prevSong = canGoPrev ? songs[currentIndex - 1] : null;
  const nextSong = canGoNext ? songs[currentIndex + 1] : null;

  return (
    <div className="fixed bottom-28 left-0 w-full pointer-events-none z-[110] transition-all duration-500 ease-out md:hidden px-4">
       <div className="pointer-events-auto bg-[#0A0A0C]/85 backdrop-blur-3xl border border-white/[0.08] p-3 pb-3 flex flex-col items-center gap-3 w-full shadow-[0_16px_40px_rgba(0,0,0,0.6)] rounded-3xl">
           <div className="flex w-full items-center justify-between px-2">
             <span className="text-[10px] uppercase font-bold text-white/50 tracking-[0.2em]">Cifra {currentNumber}/{total}</span>
             <span className="text-[11px] font-medium text-white/40">{scaleTitle}</span>
           </div>

           <div className="flex w-full items-center gap-2">
               <button
                  onClick={() => canGoPrev ? onNavigate('previous') : onClose()}
                  className={`flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl font-semibold text-[13px] transition-all active:scale-[0.98] ${
                    canGoPrev 
                      ? 'bg-white/5 hover:bg-white/10 text-white border border-white/[0.06]' 
                      : 'bg-white/[0.03] text-white/40 border border-white/[0.04]'
                  }`}
               >
                 <ChevronLeftIcon className="w-4 h-4 ml-[-4px]" />
                 {canGoPrev ? (
                    <span className="truncate max-w-[100px]">{prevSong?.title}</span>
                 ) : (
                    <span>Sair</span>
                 )}
               </button>

               <button
                  onClick={() => canGoNext ? onNavigate('next') : onClose()}
                  className={`flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl font-semibold text-[13px] transition-all active:scale-[0.98] ${
                    canGoNext 
                      ? 'bg-white hover:bg-white/90 text-black shadow-none' 
                      : 'bg-[#34d399] text-black shadow-none'
                  }`}
               >
                 {canGoNext ? (
                    <span className="truncate max-w-[100px]">{nextSong?.title}</span>
                 ) : (
                    <span>Fim</span>
                 )}
                 <ChevronRightIcon className="w-4 h-4 mr-[-4px]" />
               </button>
           </div>
       </div>
    </div>
  );
};
