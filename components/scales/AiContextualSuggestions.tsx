import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { aiSuggestionService, AISongSuggestion } from '../../services/aiSuggestions';
import { PopulatedSong } from '../../types';
import Spinner from '../common/Spinner';
import { useAuth } from '../../contexts/AuthContext';

interface AiContextualSuggestionsProps {
    currentSongs: PopulatedSong[];
    librarySongs: PopulatedSong[];
    onAddSuggestion?: (suggestion: AISongSuggestion) => void;
    title?: string;
    compact?: boolean;
}

export const AiContextualSuggestions: React.FC<AiContextualSuggestionsProps> = ({ 
    currentSongs = [], 
    librarySongs = [], 
    onAddSuggestion,
    title = "Continuação Sugerida",
    compact = false
}) => {
    const [suggestions, setSuggestions] = useState<AISongSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const { effectiveOrganizationId } = useAuth();

    useEffect(() => {
        let isMounted = true;
        
        const loadSuggestions = async () => {
            if (!currentSongs || currentSongs.length === 0 || !effectiveOrganizationId) return;
            
            setLoading(true);
            try {
                // Throttle loading to make it feel more "silent" / background processed
                const result = await aiSuggestionService.getSuggestions(currentSongs, librarySongs, { id: effectiveOrganizationId });
                if (isMounted) {
                    setSuggestions(result);
                }
            } catch (err) {
                // Silent fail
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        // Delay the load slightly so it doesn't block main UI rendering
        const timeoutId = setTimeout(loadSuggestions, 1000);
        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [currentSongs, librarySongs, effectiveOrganizationId]);

    if (!currentSongs || currentSongs.length === 0 && suggestions.length === 0 && !loading) return null;

    return (
        <div className="w-full">
            <AnimatePresence>
                {loading && !compact && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="py-4 flex flex-col items-center justify-center opacity-50"
                    >
                        <Spinner size="sm" />
                    </motion.div>
                )}
            </AnimatePresence>

            {suggestions.length > 0 && (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className={`flex flex-col pt-6 pb-2 ${compact ? 'pt-2' : ''}`}
                >
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#a7a7a7] flex items-center gap-2 mb-4 px-2">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        {title}
                    </h4>
                    
                    <div className="flex flex-col gap-1">
                        {suggestions.map((suggestion, idx) => (
                            <motion.div 
                                key={idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.4, delay: idx * 0.1 }}
                                onClick={() => onAddSuggestion && onAddSuggestion(suggestion)}
                                className={`group flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors ${onAddSuggestion ? 'cursor-pointer' : ''}`}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[15px] font-semibold text-slate-900 dark:text-white truncate">{suggestion.title}</span>
                                        <span className="text-[13px] text-slate-500 dark:text-[#a7a7a7] truncate">{suggestion.artist}</span>
                                    </div>
                                </div>
                                <div className="mt-2 sm:mt-0 flex items-center gap-3 shrink-0">
                                    <span className="text-[12px] text-slate-500 dark:text-[#a7a7a7] italic hidden sm:block max-w-[200px] truncate">
                                        "{suggestion.reason}"
                                    </span>
                                    <span className="text-[11px] font-bold tracking-widest text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full">
                                        {suggestion.recommendedKey}
                                    </span>
                                    {onAddSuggestion && (
                                        <button className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-[#a7a7a7] hover:text-indigo-500 dark:hover:text-white transition-colors">
                                            Adicionar
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
};
