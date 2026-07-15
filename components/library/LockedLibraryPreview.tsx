import React from 'react';
import { Sparkles, Music, FileText, Check, Loader2, ArrowRight } from 'lucide-react';
import { entitlementsService } from '../../services/entitlementsService';
import { useTranslation } from 'react-i18next';

export const LockedLibraryPreview: React.FC = () => {
  const { t } = useTranslation();
  const handleUpgrade = () => {
    try {
      const url = entitlementsService.getMillionsNestBaseUrl();
      window.open(`${url}/dashboard/billing`, '_blank', 'noreferrer,noopener');
    } catch {
      window.open("https://millionsnest.com/dashboard/musicscale/plans", "_blank");
    }
  };

  const dummySongs = [
    { title: "Oceanos (Onde Me Chamam)", artist: "Ana Nóbrega", tags: [t("library.with_lyrics_label", "Letra"), t("library.with_chords_label", "Cifra"), t("library.locked.benefit_metadata", "Tom"), "BPM"] },
    { title: "Lindo És", artist: "Juliano Son", tags: [t("library.with_lyrics_label", "Letra"), t("library.with_chords_label", "Cifra"), t("library.locked.benefit_metadata", "Tom")] },
    { title: "A Bênção", artist: "Gabriel Guedes", tags: [t("library.with_lyrics_label", "Letra"), t("library.with_chords_label", "Cifra"), "BPM"] },
    { title: "Ruja o Leão", artist: "Talita Catanzaro", tags: [t("library.with_lyrics_label", "Letra"), t("library.with_chords_label", "Cifra"), t("library.locked.benefit_metadata", "Tom"), "BPM"] },
    { title: "Me Atraiu", artist: "Gabriela Rocha", tags: [t("library.with_lyrics_label", "Letra"), t("library.locked.benefit_metadata", "Tom")] },
    { title: "Faz Chover", artist: "Fernandinho", tags: [t("library.with_lyrics_label", "Letra"), t("library.with_chords_label", "Cifra")] },
    { title: "Maranata", artist: "Ministério Avivah", tags: [t("library.with_lyrics_label", "Letra"), t("library.with_chords_label", "Cifra"), t("library.locked.benefit_metadata", "Tom"), "BPM"] },
    { title: "Teu Reino", artist: "Cristo Vivo", tags: [t("library.with_lyrics_label", "Letra"), t("library.with_chords_label", "Cifra"), t("library.locked.benefit_metadata", "Tom")] },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] overflow-hidden relative flex flex-col">
      {/* Abstract Background Layer */}
      <div className="absolute top-0 inset-x-0 h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[80%] bg-gradient-to-bl from-indigo-600/10 via-purple-500/5 to-transparent rounded-full md:blur-[120px] blur-[35px] mix-blend-multiply dark:mix-blend-screen opacity-70"></div>
      </div>

      {/* Hero Header */}
      <div className="pt-24 pb-12 px-5 sm:px-10 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 font-bold uppercase tracking-widest text-[10px] mb-6 border border-indigo-100 dark:border-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            {t("library.locked.premium_badge", "Acervo premium do MusicScale")}
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-[5.5rem] font-black text-slate-900 dark:text-white tracking-tighter mb-4 leading-[1.05]">
            {t("library.locked.main_title", "A música começa aqui.")}
          </h1>
          <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed font-medium">
            {t("library.locked.main_desc", "Um ecossistema vivo com milhares de cifras perfeitas, letras revisadas e tons organizados — a um clique do seu ministério.")}
          </p>
        </div>
      </div>

      {/* Library Preview & Lock Overlay */}
      <div className="relative flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* Dummy Cards Background */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 sm:gap-6 opacity-40 blur-[2px] transition-all duration-1000 scale-[0.99] select-none pointer-events-none">
          {dummySongs.map((song, i) => (
            <div key={i} className="bg-white dark:bg-[#151515] border border-black/5 dark:border-white/5 rounded-3xl p-5 flex flex-col gap-4">
              <div className="flex gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 flex shrink-0 items-center justify-center">
                  <Music className="w-6 h-6 text-slate-400 dark:text-slate-600" />
                </div>
                <div>
                  <div className="h-5 w-32 bg-slate-200 dark:bg-white/10 rounded-md mb-2"></div>
                  <div className="h-4 w-20 bg-slate-100 dark:bg-white/5 rounded-md"></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {song.tags.map((tag, j) => (
                  <div key={j} className="h-6 w-16 bg-slate-100 dark:bg-white/5 rounded-md"></div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Lock Modal Overlay */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pb-20 px-4 mt-[-100px] sm:mt-[-50px]">
          <div className="bg-white/70 dark:bg-[#1A1A1C]/70 backdrop-blur-2xl rounded-[32px] p-6 sm:p-10 w-full max-w-[480px] shadow-[0_20px_80px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_80px_rgba(0,0,0,0.4)] border border-white dark:border-white/10 relative overflow-hidden animate-fade-in-up">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[16px] sm:rounded-[20px] flex items-center justify-center mb-5 sm:mb-6 shadow-lg shadow-indigo-500/20 text-white">
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              
              <h3 className="text-[28px] sm:text-4xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter leading-none" dangerouslySetInnerHTML={{ __html: t("library.locked.unlock_title", "Desbloqueie a <br/>Biblioteca Viva") }}>
              </h3>
              
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-6 sm:mb-8 leading-relaxed font-medium">
                {t("library.locked.unlock_desc", "Importe músicas prontas com letra, cifra, tom e BPM — sem começar seu repertório do zero.")}
              </p>

              {/* Benefits Grid */}
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 mb-8 sm:mb-10 w-full">
                {[
                  { icon: FileText, label: t("library.locked.benefit_lyrics", "Letras prontas") },
                  { icon: Music, label: t("library.locked.benefit_chords", "Cifras organizadas") },
                  { icon: Check, label: t("library.locked.benefit_metadata", "Tom e BPM") },
                  { icon: ArrowRight, label: t("library.locked.benefit_fast", "Importação rápida") }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl">
                    <item.icon className="w-4 h-4 shrink-0 text-indigo-500" />
                    <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 dark:text-slate-300 tracking-tight sm:tracking-wide">{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Main CTA */}
              <div className="w-full flex justify-center mb-4">
                <button
                  type="button"
                  onClick={handleUpgrade}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold text-[14px] sm:text-[15px] py-3.5 sm:py-4 px-4 sm:px-6 rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all active:scale-[0.98] whitespace-nowrap"
                >
                  {t("library.locked.unlock_btn", "Liberar Biblioteca Viva")}
                </button>
              </div>
              <p className="text-center text-[13px] font-medium text-slate-500 dark:text-slate-400">
                {t("library.locked.price_starter", "A partir de R$ 29,90/mês no Advanced")}
              </p>

              <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5 flex flex-col items-center">
                <span className="text-[12px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                  {t("library.locked.unlimited_query", "Quer importar sem limites?")}
                </span>
                <button
                  onClick={handleUpgrade}
                  className="text-[14px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                >
                  {t("library.locked.view_pro", "Ver plano Pro &rarr;")}
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
