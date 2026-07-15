import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { VideoIcon } from '../icons/VideoIcon';
import { PlayIcon } from '../icons/PlayIcon';

interface RehearsalReferenceCardProps {
  videoUrl: string;
}

export const RehearsalReferenceCard: React.FC<RehearsalReferenceCardProps> = ({ videoUrl }) => {
  const [isEmbedded, setIsEmbedded] = useState(false);

  if (!videoUrl) return null;

  // Attempt to extract YouTube ID
  function getYoutubeId(url: string) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  const youtubeId = getYoutubeId(videoUrl);

  return (
    <div className="flex flex-col mb-4 overflow-hidden rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" onClick={() => setIsEmbedded(!isEmbedded)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
            <VideoIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex flex-col min-w-0">
            <h4 className="text-[13px] font-bold text-slate-800 dark:text-white truncate">
              Referência de Ensaio
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {youtubeId ? 'YouTube' : 'Link Externo'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            {!youtubeId && (
                <a 
                    href={videoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="h-8 px-3 rounded-full bg-slate-200 dark:bg-white/10 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                    Abrir
                </a>
            )}
            {youtubeId && (
                <button
                    className={`h-8 px-3 rounded-full flex items-center gap-1.5 transition-colors text-[11px] font-bold uppercase tracking-widest ${isEmbedded ? 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/70' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                    {isEmbedded ? 'Fechar' : 'Ouvir'}
                    {!isEmbedded && <PlayIcon className="w-3.5 h-3.5" />}
                </button>
            )}
        </div>
      </div>

      <AnimatePresence>
        {isEmbedded && youtubeId && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="aspect-video w-full bg-black">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&modestbranding=1&rel=0`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
