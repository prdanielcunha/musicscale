import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Spinner from '../common/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

interface ImportCandidatesModalProps {
    onClose: () => void;
    target: 'selected' | 'all';
    selectedCandidateIds: string[];
    onSuccess: () => void;
}

interface VerificationResult {
    candidateId: string;
    title: string;
    artist: string;
    sourceOrganizationName: string;
    state: 'ready_to_import' | 'already_exists' | 'possible_duplicate' | 'insufficient_data' | 'invalid_candidate' | 'error';
    matchedGlobalSong?: {
        id: string;
        title: string;
        artist: string;
    };
    reason: string;
}

export function ImportCandidatesModal({ onClose, target, selectedCandidateIds, onSuccess }: ImportCandidatesModalProps) {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [step, setStep] = useState<'verifying' | 'summary' | 'importing' | 'completed'>('verifying');
    const [results, setResults] = useState<VerificationResult[]>([]);
    const [stats, setStats] = useState({
         ready: 0,
         exists: 0,
         duplicate: 0,
         insufficient: 0,
         invalid: 0,
         errors: 0
    });
    
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [importResults, setImportResults] = useState<{ id: string; status: string }[]>([]);
    const [filter, setFilter] = useState<'all' | 'ready_to_import' | 'already_exists' | 'possible_duplicate' | 'insufficient_data' | 'error'>('all');

    useEffect(() => {
        const verify = async () => {
            try {
                const token = await user?.getIdToken();
                const res = await fetch('/api/admin/pre-verify-import', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ target, candidateIds: selectedCandidateIds })
                });

                if (!res.ok) {
                    throw new Error(t('curation.modals.import.verifyFailure'));
                }

                const data = await res.json();
                const vResults: VerificationResult[] = data.results || [];
                setResults(vResults);
                
                let r = 0, e = 0, d = 0, i = 0, iv = 0, err = 0;
                vResults.forEach(res => {
                     if (res.state === 'ready_to_import') r++;
                     else if (res.state === 'already_exists') e++;
                     else if (res.state === 'possible_duplicate') d++;
                     else if (res.state === 'insufficient_data') i++;
                     else if (res.state === 'invalid_candidate') iv++;
                     else err++;
                });

                setStats({ ready: r, exists: e, duplicate: d, insufficient: i, invalid: iv, errors: err });
                setStep('summary');

            } catch (err) {
                console.error(err);
                alert(t('curation.modals.import.preVerifyError', { error: String(err) }));
                onClose();
            }
        };

        verify();
    }, []);

    const handleImport = async () => {
        const readyItems = results.filter(r => r.state === 'ready_to_import');
        if (!readyItems.length) return;

        setStep('importing');
        setProgress({ current: 0, total: readyItems.length });

        const batchSize = 3; // Keep small to avoid timeouts and race conditions easily
        const newImportResults: any[] = [];
        
        try {
            const token = await user?.getIdToken();
            for (let i = 0; i < readyItems.length; i += batchSize) {
                const batch = readyItems.slice(i, i + batchSize).map(r => r.candidateId);

                const res = await fetch('/api/admin/bulk-import-candidates', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ candidateIds: batch })
                });

                if (res.ok) {
                    const data = await res.json();
                    newImportResults.push(...(data.results || []));
                }

                setProgress({ current: Math.min(i + batchSize, readyItems.length), total: readyItems.length });
            }

            setImportResults(newImportResults);
            setStep('completed');
        } catch (e) {
            console.error(e);
            alert(t('curation.modals.import.batchError'));
            setStep('completed');
        }
    };

    const getStateLabel = (state: VerificationResult['state']) =>
        t(`curation.modals.import.state.${state}`);

    const renderVerificationList = () => {
        const filtered = results.filter(r => {
             if (filter === 'all') return true;
             if (filter === 'error' && (r.state === 'invalid_candidate' || r.state === 'error')) return true;
             return r.state === filter;
        });

        return (
            <div className="mt-6 flex flex-col h-[50vh] min-h-[300px]">
                <div className="flex gap-2 overflow-x-auto pb-3 shrink-0 scrollbar-thin">
                    {[
                        { id: 'all', label: t('curation.modals.common.all'), count: results.length },
                        { id: 'ready_to_import', label: t('curation.modals.import.filters.ready'), count: stats.ready, color: 'text-green-600 bg-green-50' },
                        { id: 'already_exists', label: t('curation.modals.import.filters.exists'), count: stats.exists, color: 'text-indigo-600 bg-indigo-50' },
                        { id: 'possible_duplicate', label: t('curation.modals.import.filters.duplicate'), count: stats.duplicate, color: 'text-amber-600 bg-amber-50' },
                        { id: 'insufficient_data', label: t('curation.modals.import.filters.insufficient'), count: stats.insufficient, color: 'text-orange-600 bg-orange-50' },
                        { id: 'error', label: t('curation.modals.import.filters.errors'), count: stats.errors + stats.invalid, color: 'text-red-600 bg-red-50' }
                    ].filter(f => f.count > 0 || f.id === 'all').map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id as any)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${filter === f.id ? (f.id === 'all' ? 'bg-slate-800 text-white' : f.color?.replace('50', '600').replace('600', 'white')) : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} `}
                        >
                            {f.label} 
                            <span className="bg-black/10 dark:bg-white/10 px-1.5 rounded-md text-[11px]">{f.count}</span>
                        </button>
                    ))}
                </div>

                <div className="overflow-y-auto pr-2 space-y-2 mt-2">
                    {filtered.map(r => (
                        <div key={r.candidateId} className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-3 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white leading-tight">{r.title}</h4>
                                    <p className="text-xs text-slate-500">{r.artist}</p>
                                    {r.sourceOrganizationName && <p className="text-[10px] text-slate-400 mt-0.5">{r.sourceOrganizationName}</p>}
                                </div>
                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                                    r.state === 'ready_to_import' ? 'bg-green-100 text-green-700' :
                                    r.state === 'already_exists' ? 'bg-indigo-100 text-indigo-700' :
                                    r.state === 'possible_duplicate' ? 'bg-amber-100 text-amber-700' :
                                    r.state === 'insufficient_data' ? 'bg-orange-100 text-orange-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                    {getStateLabel(r.state)}
                                </span>
                            </div>
                            
                            {r.matchedGlobalSong && (
                                <div className="text-xs text-slate-600 dark:text-slate-400 bg-black/5 dark:bg-white/5 rounded p-2 flex justify-between items-center">
                                    <div>
                                        <span className="font-semibold block mb-0.5">{t('curation.modals.import.matchFound')}</span>
                                        {r.matchedGlobalSong.title} — {r.matchedGlobalSong.artist}
                                    </div>
                                </div>
                            )}
                            
                            <p className="text-[11px] text-slate-400 font-mono">{r.reason}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={step === 'importing' ? undefined : onClose} />
            <div className="bg-white dark:bg-[#1A1D24] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative z-10 animate-fade-in flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {t('curation.modals.import.title')}
                    </h2>
                    {step !== 'importing' && step !== 'completed' && (
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                </div>

                <div className="p-6 overflow-hidden flex flex-col min-h-0 relative">
                    {step === 'verifying' && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Spinner size="lg" className="mb-4" />
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t('curation.modals.import.verifying')}</h3>
                            <p className="text-slate-500 mt-2 text-sm max-w-sm">
                                {target === 'all'
                                    ? t('curation.modals.import.verifyingAll')
                                    : t('curation.modals.import.verifyingSelected', { count: selectedCandidateIds.length })}
                            </p>
                        </div>
                    )}

                    {step === 'summary' && (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-green-50 dark:bg-green-500/10 p-3 rounded-xl border border-green-100 dark:border-green-500/20 text-center">
                                     <div className="text-2xl font-bold text-green-600">{stats.ready}</div>
                                     <div className="text-xs font-semibold text-green-700 uppercase mt-1">{t('curation.modals.import.stats.ready')}</div>
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20 text-center">
                                     <div className="text-2xl font-bold text-indigo-600">{stats.exists}</div>
                                     <div className="text-xs font-semibold text-indigo-700 uppercase mt-1">{t('curation.modals.import.stats.exists')}</div>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-100 dark:border-amber-500/20 text-center">
                                     <div className="text-2xl font-bold text-amber-600">{stats.duplicate}</div>
                                     <div className="text-xs font-semibold text-amber-700 uppercase mt-1">{t('curation.modals.import.stats.duplicate')}</div>
                                </div>
                                <div className="bg-red-50 dark:bg-red-500/10 p-3 rounded-xl border border-red-100 dark:border-red-500/20 text-center">
                                     <div className="text-2xl font-bold text-red-600">{stats.errors + stats.invalid + stats.insufficient}</div>
                                     <div className="text-xs font-semibold text-red-700 uppercase mt-1">{t('curation.modals.import.stats.invalid')}</div>
                                </div>
                            </div>
                            
                            {renderVerificationList()}
                        </>
                    )}

                    {step === 'importing' && (
                         <div className="flex flex-col items-center justify-center py-12 text-center">
                             <Spinner size="lg" className="mb-4" />
                             <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t('curation.modals.import.importing')}</h3>
                             <p className="text-slate-500 my-2 text-sm">{t('curation.modals.import.progress', progress)}</p>
                             <div className="w-full max-w-sm h-2 bg-slate-100 rounded-full overflow-hidden mt-4">
                                 <div className="h-full bg-primary transition-all duration-300" style={{ width: `${Math.max(5, (progress.current / progress.total) * 100)}%` }} />
                             </div>
                         </div>
                    )}

                    {step === 'completed' && (
                        <div className="flex flex-col items-center justify-center py-8 text-center bg-green-50 dark:bg-green-500/5 rounded-2xl">
                            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                            <h3 className="text-2xl font-bold text-green-700 dark:text-green-400">{t('curation.modals.import.completed')}</h3>
                            <p className="text-green-600/80 mt-2">
                                {t('curation.modals.import.completedCount', { count: importResults.filter(r => r.status === 'imported').length })}
                            </p>
                            <div className="mt-8">
                                <button onClick={() => { onClose(); onSuccess(); }} className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-sm transition-all focus:ring-4 focus:ring-green-500/20 active:scale-95">
                                    {t('curation.modals.import.closeRefresh')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {step === 'summary' && (
                    <div className="p-6 border-t border-slate-100 dark:border-white/10 flex justify-end gap-3 shrink-0 bg-slate-50 dark:bg-white/[0.02]">
                        <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                            {t('curation.modals.common.cancel')}
                        </button>
                        <button 
                            onClick={handleImport}
                            disabled={stats.ready === 0}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 rounded-xl transition-all shadow-sm active:scale-[0.98]"
                        >
                            {t('curation.modals.import.importCount', { count: stats.ready })}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}