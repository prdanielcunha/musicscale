import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'motion/react';
import Spinner from '../common/Spinner';

interface Props {
    onClose: () => void;
    initialInboxCount: number;
}

export function InboxAnalysisModal({ onClose, initialInboxCount }: Props) {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [stats, setStats] = useState({
        processed: 0,
        queued: initialInboxCount,
        likely_unique: 0,
        possible_duplicate: 0,
        matched_existing: 0,
        ignored: 0,
        error: 0
    });
    const [results, setResults] = useState<any[]>([]);
    const [filter, setFilter] = useState('all');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Auto-start analysis
    useEffect(() => {
        if (!user || stats.queued === 0 || isAnalyzing) return;
        handleAnalyzeNow();
    }, [user]);

    const handleAnalyzeNow = async () => {
        if (isAnalyzing || stats.queued === 0) return;
        setIsAnalyzing(true);
        setErrorMessage(null);

        let remaining = stats.queued;
        try {
            const token = await user?.getIdToken();
            while (remaining > 0) {
               const batchSize = Math.min(remaining, 10);
               const res = await fetch('/api/admin/analyze-inbox', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                   body: JSON.stringify({ limit: batchSize })
               });

               if (!res.ok) {
                   const errData = await res.json().catch(() => ({}));
                   setErrorMessage(errData.error || errData.details || t('curation.modals.inbox.batchError'));
                   break;
               }

               const data = await res.json();
               const analyzeResults: any[] = data.results || [];
               
               remaining -= analyzeResults.length;
               
               setStats(prev => {
                   const s = { ...prev };
                   s.processed += analyzeResults.length;
                   analyzeResults.forEach((r: any) => {
                        s.queued = Math.max(0, s.queued - 1);
                        const key = r.classification;
                        if (s[key as keyof typeof s] !== undefined) {
                            (s as any)[key]++;
                        } else {
                            (s as any).error++;
                        }
                   });
                   return s;
               });

               setResults(prev => {
                   const map = new Map(prev.map(p => [p.id || p.inboxId || p.title, p]));
                   analyzeResults.forEach((r: any) => {
                       map.set(r.title, { ...((map.get(r.title) as any) || {}), ...r });
                   });
                   return Array.from(map.values());
               });

               if (analyzeResults.length === 0) break;
            }
        } catch(e: any) {
            setErrorMessage(e.message || t('curation.modals.inbox.connectionError'));
        } finally {
            setIsAnalyzing(false);
        }
    };

    const displayResults = results.filter(r => filter === 'all' || r.classification === filter);

    const getClassificationLabel = (c: string) => {
        const known = ['ignored', 'error', 'likely_unique', 'possible_duplicate', 'matched_existing'];
        return known.includes(c) ? t(`curation.modals.inbox.classification.${c}`) : c;
    };

    const getClassificationColor = (c: string) => {
        switch(c) {
            case 'likely_unique': return 'text-indigo-500 bg-indigo-500/10';
            case 'possible_duplicate': return 'text-amber-500 bg-amber-500/10';
            case 'matched_existing': return 'text-green-500 bg-green-500/10';
            case 'ignored': return 'text-slate-500 bg-slate-500/10';
            case 'error': return 'text-red-500 bg-red-500/10';
            default: return 'text-slate-500 bg-slate-500/10';
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-[#1A1D24] rounded-2xl shadow-xl w-full max-w-4xl max-h-[82vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-white/10"
            >
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10">
                    <div>
                        <h2 className="text-xl font-bold font-sans text-slate-900 dark:text-white">{t('curation.modals.inbox.title')}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {t('curation.modals.inbox.subtitle')}
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        disabled={isAnalyzing}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {errorMessage && (
                    <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm flex items-start gap-2 animate-in slide-in-from-top-2">
                        <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <span className="font-semibold block mb-0.5">{t('curation.modals.common.processingError')}</span>
                            {errorMessage}
                        </div>
                    </div>
                )}

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                        {isAnalyzing ? (
                            <span className="flex items-center gap-2"><Spinner size="sm" /> {t('curation.modals.inbox.preparing')}</span>
                        ) : (
                            <span className="font-bold">{t('curation.modals.inbox.completed')}</span>
                        )}
                    </div>
                    {isAnalyzing && (
                        <div className="text-sm font-medium text-blue-700 dark:text-blue-200">
                            {t('curation.modals.inbox.progress', { processed: stats.processed, queued: stats.queued })}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-slate-200 dark:bg-white/10 border-b border-slate-200 dark:border-white/10">
                    <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                        <div className="text-2xl font-semibold text-slate-900 dark:text-white">{stats.processed}</div>
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">{t('curation.modals.inbox.metrics.processed')}</div>
                    </div>
                    <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                        <div className="text-2xl font-semibold text-indigo-500">{stats.likely_unique}</div>
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">{t('curation.modals.inbox.metrics.unique')}</div>
                    </div>
                    <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                        <div className="text-2xl font-semibold text-amber-500">{stats.possible_duplicate}</div>
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">{t('curation.modals.inbox.metrics.duplicate')}</div>
                    </div>
                    <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                        <div className="text-2xl font-semibold text-green-500">{stats.matched_existing}</div>
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">{t('curation.modals.inbox.metrics.matches')}</div>
                    </div>
                    <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                        <div className="text-2xl font-semibold text-slate-400">{stats.ignored}</div>
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">{t('curation.modals.inbox.metrics.ignored')}</div>
                    </div>
                    <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                        <div className="text-2xl font-semibold text-red-500">{stats.error}</div>
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">{t('curation.modals.inbox.metrics.errors')}</div>
                    </div>
                </div>

                {isAnalyzing && initialInboxCount > 0 && (
                    <div className="h-1 bg-slate-100 dark:bg-white/5 w-full">
                        <div 
                            className="h-full bg-primary transition-all duration-300 ease-out"
                            style={{ width: `${Math.min(100, (stats.processed / initialInboxCount) * 100)}%` }}
                        />
                    </div>
                )}

                <div className="flex gap-2 p-4 border-b border-slate-200 dark:border-white/10 overflow-x-auto hide-scrollbar bg-slate-50 dark:bg-white/[0.02]">
                    {[
                        { id: 'all', label: t('curation.modals.common.all') },
                        { id: 'likely_unique', label: t('curation.modals.inbox.filters.unique') },
                        { id: 'possible_duplicate', label: t('curation.modals.inbox.filters.duplicate') },
                        { id: 'matched_existing', label: t('curation.modals.inbox.filters.matches') },
                        { id: 'ignored', label: t('curation.modals.inbox.filters.ignored') },
                        { id: 'error', label: t('curation.modals.inbox.filters.errors') }
                    ]
                    .filter(f => f.id === 'all' || (stats[f.id as keyof typeof stats] !== undefined && stats[f.id as keyof typeof stats] > 0))
                    .map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                                filter === f.id 
                                    ? 'bg-primary text-white' 
                                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
                             }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 pb-28 sm:pb-6 space-y-2 bg-slate-50 dark:bg-[#0A0A0C]">
                    {displayResults.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 py-12">
                            {isAnalyzing ? (
                                <Spinner size="md" className="mb-4" />
                            ) : (
                                <svg className="w-12 h-12 mb-3 opacity-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
                            )}
                            <p className="text-sm">{t('curation.modals.inbox.empty')}</p>
                        </div>
                    ) : (
                        displayResults.map((r, i) => (
                            <div key={`${r.candidateId || r.inboxId}-${i}`} className="flex items-center justify-between p-3 bg-white dark:bg-[#1A1D24] rounded-xl border border-slate-200 dark:border-white/10">
                                <div>
                                    <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                        <span>{r.title}</span>
                                        {r.errorMsg && <span className="text-[10px] text-red-500 font-normal truncate max-w-xs" title={r.errorMsg}>({r.errorMsg})</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${getClassificationColor(r.classification)}`}>
                                        {getClassificationLabel(r.classification)}
                                    </div>
                                    {r.candidateId && (
                                        <a href={`/curation/${r.candidateId}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                                            {t('curation.modals.common.openInCuration')}
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </motion.div>
        </div>
    );
}