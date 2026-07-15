import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Zap, Shield, Tag, AppWindow, ArrowRight, ChevronLeft, ChevronRight, Megaphone, ShoppingBag, Music, LayoutTemplate, Sliders } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNews, NewsAnnouncement, NewsCategory } from "../hooks/useNews";

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CategoryStyles: Record<NewsCategory, { icon: React.ElementType, badgeColor: string, title: string }> = {
  welcome: { icon: Sparkles, badgeColor: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30", title: "Bem-vindo" },
  feature: { icon: Sparkles, badgeColor: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30", title: "Novo Recurso" },
  improvement: { icon: Zap, badgeColor: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30", title: "Melhoria" },
  new_app: { icon: AppWindow, badgeColor: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/20 dark:text-fuchsia-300 dark:border-fuchsia-500/30", title: "Novo App" },
  promotion: { icon: Tag, badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30", title: "Oferta" },
  paid_addon: { icon: ShoppingBag, badgeColor: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30", title: "Novo Adicional" },
  announcement: { icon: Megaphone, badgeColor: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30", title: "Anúncio" },
  important: { icon: Shield, badgeColor: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30", title: "Importante" }
};

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  const { allActiveNews, unseenNews, markAsSeen, hasUnseen, isWelcomeDismissed, dismissWelcome } = useNews();
  
  // Local state for the checkbox in the footer
  const [dontShowWelcomeAgain, setDontShowWelcomeAgain] = useState(false);

  // Carousel references and state
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  // Layout logic
  const isFirstAccess = !isWelcomeDismissed;
  
  // If it's first access, "featured news" is actually the Welcome Presentation, and all active news goes to secondary.
  // If it's not first access, the first unseen active news is featured, or just the first active news. The welcome presentation goes below.
  const featuredNews = isFirstAccess ? null : allActiveNews[0];
  const secondaryNews = isFirstAccess ? allActiveNews : allActiveNews.slice(1);

  const checkScroll = () => {
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(Math.ceil(scrollLeft) > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    if (secondaryNews.length > 0) {
      checkScroll();
      window.addEventListener('resize', checkScroll);
      return () => window.removeEventListener('resize', checkScroll);
    }
  }, [secondaryNews]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [secondaryNews]);

  const handleScroll = () => {
    checkScroll();
    if (carouselRef.current && carouselRef.current.children.length > 0) {
      const itemWidth = carouselRef.current.children[0].clientWidth;
      const index = Math.round(carouselRef.current.scrollLeft / itemWidth);
      setActiveSlide(index);
    }
  };

  const scrollByAmount = (direction: 'left' | 'right') => {
    if (carouselRef.current && carouselRef.current.children.length > 0) {
      const amount = carouselRef.current.children[0].clientWidth + 16;
      carouselRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    }
  };

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    if (carouselRef.current) {
      const x = 'touches' in e ? e.touches[0].pageX : (e as React.MouseEvent).pageX;
      setStartX(x - carouselRef.current.offsetLeft);
      setScrollLeftState(carouselRef.current.scrollLeft);
    }
  };

  const endDrag = () => {
    setIsDragging(false);
  };

  const onDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !carouselRef.current) return;
    e.preventDefault();
    const x = 'touches' in e ? e.touches[0].pageX : (e as React.MouseEvent).pageX;
    const walk = (x - carouselRef.current.offsetLeft - startX) * 1.5;
    carouselRef.current.scrollLeft = scrollLeftState - walk;
  };

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handleClose();
        
        // Trap focus
        if (e.key === 'Tab' && modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = "auto";
        document.removeEventListener('keydown', handleKeyDown);
        if (previouslyFocusedElement.current) {
          previouslyFocusedElement.current.focus();
        }
      };
    }
  }, [isOpen]);

  const handleClose = () => {
    if (allActiveNews.length > 0) {
      markAsSeen(allActiveNews.map(n => n.id));
    }
    if (dontShowWelcomeAgain) {
      dismissWelcome();
    }
    onClose();
  };

  const handleCta = (route?: string) => {
    handleClose();
    if (route) {
      if (route.startsWith('http')) {
        window.open(route, '_blank');
      } else {
        navigate(route);
      }
    }
  };

  if (!isOpen) return null;

  const WelcomePresentation = () => (
    <div className="flex flex-col items-center text-center mb-14 pt-2 sm:pt-6">
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className="px-3.5 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg border bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10 shadow-sm">
           {isFirstAccess ? "BEM-VINDO AO MUSICSCALE" : "SOBRE O MUSICSCALE"}
        </span>
        {isFirstAccess && unseenNews.length > 0 && (
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            {unseenNews.length} novidade{unseenNews.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      
      <h2 className="text-5xl sm:text-7xl md:text-[80px] font-black text-slate-900 dark:text-white tracking-tighter leading-[1] mb-6 max-w-4xl drop-shadow-sm dark:drop-shadow-none">
         Organização musical <br className="hidden sm:block" />
         <span className="text-transparent bg-clip-text bg-gradient-to-br from-blue-600 via-indigo-500 to-purple-600 dark:from-sky-400 dark:via-blue-500 dark:to-indigo-400">
            fluida e silenciosa.
         </span>
      </h2>
      
      <p className="text-slate-500 dark:text-slate-400 text-lg sm:text-[21px] font-medium max-w-2xl leading-relaxed mb-12">
         Você está a poucos passos de centralizar seu repertório, montar suas escalas e equipar seu time com conforto e precisão.
      </p>

      {/* 3 Core Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full text-left">
        <div className="group flex flex-col p-6 rounded-[24px] bg-white dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:bg-white/[0.04] transition-all">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300 shadow-sm">
            <Music className="w-6 h-6" />
          </div>
          <h4 className="text-[16px] font-bold text-slate-900 dark:text-white mb-2.5">Biblioteca Viva</h4>
          <p className="text-[14px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Músicas prontas, cifras precisas e letras sincronizadas com sua equipe.</p>
        </div>
        <div className="group flex flex-col p-6 rounded-[24px] bg-white dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:bg-white/[0.04] transition-all">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300 shadow-sm">
            <LayoutTemplate className="w-6 h-6" />
          </div>
          <h4 className="text-[16px] font-bold text-slate-900 dark:text-white mb-2.5">Escalas Inteligentes</h4>
          <p className="text-[14px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Monte cultos rapidamente, notifique participantes e organize versões.</p>
        </div>
        <div className="group flex flex-col p-6 rounded-[24px] bg-white dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:bg-white/[0.04] transition-all">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300 shadow-sm">
            <Sliders className="w-6 h-6" />
          </div>
          <h4 className="text-[16px] font-bold text-slate-900 dark:text-white mb-2.5">Performance Mode</h4>
          <p className="text-[14px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Foco absoluto durante o culto com tela adaptativa e metrônomo visual.</p>
        </div>
      </div>
    </div>
  );

  const FeaturedNewsBlock = ({ news }: { news: NewsAnnouncement }) => {
    const CatInfo = CategoryStyles[news.category];
    return (
      <div className="flex flex-col mb-12">
        <div className="flex items-center gap-3 mb-6">
          <span className={`px-3 py-1 text-[11px] font-black uppercase tracking-widest rounded-lg border ${CatInfo.badgeColor}`}>
             {CatInfo.title}
          </span>
          {unseenNews.length > 0 && (
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              {unseenNews.length} novidade{unseenNews.length > 1 ? 's' : ''} não vista{unseenNews.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        <h2 id="whats-new-title" className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] mb-4">
           {news.title}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-lg sm:text-[19px] font-medium max-w-2xl leading-relaxed mb-8">
           {news.description}
        </p>

        <button
          onClick={() => handleCta(news.ctaRoute)}
          className="self-start inline-flex items-center justify-center min-h-[44px] gap-2 px-8 py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.1)] dark:shadow-none transition-all duration-300 active:scale-[0.98]"
        >
          {news.ctaLabel || 'Saber mais'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  };

  const CarouselSection = () => {
    if (secondaryNews.length === 0) return null;
    return (
      <div className="flex flex-col space-y-4 relative w-full pb-4 mt-8 pt-8 border-t border-slate-200/50 dark:border-white/10">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
             {isFirstAccess ? "Novidades no MusicScale" : "Outras Atualizações"}
          </h3>
          
          {/* Desktop Navigation Arrows */}
          <div className="hidden sm:flex items-center gap-1">
             <button
               onClick={() => scrollByAmount('left')}
               disabled={!canScrollLeft}
               className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
               aria-label="Anterior"
             >
               <ChevronLeft className="w-5 h-5" />
             </button>
             <button
               onClick={() => scrollByAmount('right')}
               disabled={!canScrollRight}
               className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
               aria-label="Próximo"
             >
               <ChevronRight className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* Carousel Container */}
        <div 
           className="flex snap-x snap-mandatory gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-6 px-6 sm:-mx-10 sm:px-10"
           ref={carouselRef}
           onScroll={handleScroll}
           onMouseDown={startDrag}
           onMouseUp={endDrag}
           onMouseLeave={endDrag}
           onMouseMove={onDrag}
           onTouchStart={startDrag}
           onTouchEnd={endDrag}
           onTouchMove={onDrag}
           style={{ cursor: isDragging ? 'grabbing' : 'auto' }}
        >
           {secondaryNews.map((news) => {
             const CatInfo = CategoryStyles[news.category];
             return (
               <article 
                 key={news.id} 
                 className="w-[86%] shrink-0 snap-start sm:w-[400px] flex flex-col p-5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/[0.08] rounded-2xl transition-colors select-none"
               >
                 <div className="flex items-center gap-3 mb-4">
                   <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${CatInfo.badgeColor} bg-opacity-50 border-0`}>
                     <CatInfo.icon className="w-4 h-4" />
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                     {CatInfo.title}
                   </span>
                 </div>
                 <h4 className="text-[15px] font-bold text-slate-900 dark:text-white mb-2 leading-snug">{news.title}</h4>
                 <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium mb-4 flex-grow">{news.description}</p>
                 {news.ctaRoute && (
                   <button
                     onClick={() => handleCta(news.ctaRoute)}
                     className="self-start inline-flex items-center justify-center min-h-[44px] text-blue-600 dark:text-blue-400 text-[13px] font-bold hover:underline cursor-pointer"
                   >
                     {news.ctaLabel || 'Saber mais'}
                   </button>
                 )}
               </article>
             );
           })}
        </div>

        {/* Indicators */}
        {secondaryNews.length > 1 && (
           <div className="flex items-center justify-center gap-1.5 mt-2">
             {secondaryNews.map((_, idx) => (
               <span 
                 key={idx} 
                 className={`h-1.5 rounded-full transition-all duration-300 ${activeSlide === idx ? 'w-4 bg-slate-400 dark:bg-slate-500' : 'w-1.5 bg-slate-200 dark:bg-white/10'}`} 
               />
             ))}
           </div>
        )}
      </div>
    );
  };

  const renderModal = () => (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        ref={modalRef}
      >
        {/* Backdrop */}
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           transition={{ duration: 0.3, ease: "easeOut" }}
           className="absolute inset-0 bg-black/55 backdrop-blur-md"
           onClick={handleClose}
        />

        {/* Modal Container */}
        <motion.div
           initial={{ opacity: 0, scale: 0.95, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.95, y: 20 }}
           transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
           className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[85vh] sm:max-w-[920px] flex flex-col overflow-hidden bg-white/95 dark:bg-[#0A0A0E]/90 sm:backdrop-blur-3xl sm:border border-slate-200/50 dark:border-white/10 shadow-[0_40px_80px_-16px_rgba(0,0,0,0.5)] dark:shadow-[0_40px_80px_-16px_rgba(0,0,0,0.9)] sm:rounded-[40px] isolate"
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-11 h-11 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors z-50 shadow-sm"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Ambient gradients */}
          <div className="absolute top-0 right-0 w-[80%] h-[80%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent md:blur-[60px] blur-[15px] pointer-events-none -z-10" />
          <div className="absolute bottom-0 left-0 w-[60%] h-[60%] bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent md:blur-[60px] blur-[15px] pointer-events-none -z-10" />

          {/* Dynamic Content Area */}
          <div className="flex flex-col flex-grow overflow-y-auto overflow-x-hidden p-6 sm:p-10 hide-scrollbar pt-16 sm:pt-12">
             {isFirstAccess ? (
               <>
                 <WelcomePresentation />
                 <CarouselSection />
               </>
             ) : (
               <>
                 {featuredNews ? <FeaturedNewsBlock news={featuredNews} /> : <WelcomePresentation />}
                 {featuredNews && (
                   <div className="mt-8 pt-8 border-t border-slate-200/50 dark:border-white/10">
                      <WelcomePresentation />
                   </div>
                 )}
                 <CarouselSection />
               </>
             )}
          </div>

          {/* Fixed Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-5 sm:px-10 sm:py-6 border-t border-slate-200/50 dark:border-white/[0.08] bg-white/95 dark:bg-[#0A0A0E]/95 z-10 shrink-0">
             
             {isFirstAccess ? (
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center w-5 h-5 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors border border-slate-300 dark:border-slate-600 bg-transparent group-hover:border-blue-500">
                    <input 
                      type="checkbox" 
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer m-0 p-0"
                      checked={dontShowWelcomeAgain}
                      onChange={(e) => setDontShowWelcomeAgain(e.target.checked)}
                    />
                    {dontShowWelcomeAgain && <div className="w-3 h-3 rounded-sm bg-blue-500 pointer-events-none" />}
                  </div>
                  <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors select-none">
                     Não mostrar novamente esta apresentação
                  </span>
                </label>
             ) : (
                <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                   {unseenNews.length > 0 ? `${unseenNews.length} novidade(s) não lida(s)` : 'Tudo atualizado!'}
                </span>
             )}

             <button
               onClick={handleClose}
               className="w-full sm:w-auto inline-flex items-center justify-center min-h-[44px] px-8 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold rounded-xl transition-all duration-300 shadow-md shadow-blue-500/20 dark:shadow-none whitespace-nowrap"
             >
               {isFirstAccess ? 'Começar a usar' : (unseenNews.length > 0 ? 'Fechar e marcar como lido' : 'Fechar')}
             </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  // Render using Portal to document.body to ensure it renders above everything else
  return createPortal(renderModal(), document.body);
};
