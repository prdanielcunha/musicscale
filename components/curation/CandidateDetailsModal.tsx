import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import Spinner from '../common/Spinner';
import { curationService, NormalizedReviewLog, CandidateViewModel } from '../../services/curationService';
import { ChordsRenderer, parseChordsAndLyrics, lightThemeColors, darkThemeColors } from '../songs/ChordsRenderer';

interface CandidateDetailsModalProps {
    candidateId: string | null;
    onClose: () => void;
    onApproveSuccess?: (candidateId: string) => void;
    onLinkSuccess?: (candidateId: string) => void;
    onRejectSuccess?: (candidateId: string) => void;
}

export const CandidateDetailsModal: React.FC<CandidateDetailsModalProps> = ({ candidateId, onClose, onApproveSuccess, onLinkSuccess, onRejectSuccess }) => {
    const { t, i18n } = useTranslation();
    const [details, setDetails] = useState<CandidateViewModel | null>(null);
    const [occurrences, setOccurrences] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [history, setHistory] = useState<NormalizedReviewLog[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'chords' | 'lyrics' | 'matches' | 'occurrences' | 'history'>('overview');

    const [isApproving, setIsApproving] = useState(false);
    const [approveError, setApproveError] = useState<string | null>(null);
    const [approveSuccess, setApproveSuccess] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [isLinking, setIsLinking] = useState(false);
    const [linkError, setLinkError] = useState<string | null>(null);
    const [linkSuccess, setLinkSuccess] = useState(false);
    const [showLinkConfirm, setShowLinkConfirm] = useState(false);
    const [selectedGlobalSongId, setSelectedGlobalSongId] = useState<string | null>(null);
    const [forceModeratedMatch, setForceModeratedMatch] = useState(false);

    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectError, setRejectError] = useState<string | null>(null);
    const [rejectSuccess, setRejectSuccess] = useState(false);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);
    const [rejectReasonCode, setRejectReasonCode] = useState<string>('');
    const [rejectNote, setRejectNote] = useState<string>('');

    const language = i18n.resolvedLanguage || i18n.language || 'pt';
    const dateLocale = language.startsWith('en') ? 'en-US' : language.startsWith('es') ? 'es-ES' : 'pt-BR';

    useEffect(() => {
        // Bloqueia o scroll de fundo quando montado
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    useEffect(() => {
        if (!candidateId) return;

        let isMounted = true;
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [det, occs, mtchs, hist] = await Promise.all([
                    curationService.fetchCandidateDetails(candidateId),
                    curationService.fetchOccurrences(candidateId),
                    curationService.fetchMatches(candidateId),
                    curationService.fetchReviewLogs(candidateId)
                ]);
                
                if (isMounted) {
                    setDetails(det);
                    setOccurrences(occs);
                    setMatches(mtchs);
                    setHistory(hist);
                }
            } catch(e: any) {
                if (isMounted) setError(t('curation.modals.candidate.loadError'));
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchData();

        return () => { isMounted = false; };
    }, [candidateId, t]);

    const activeOccurrence = useMemo(() => {
        return occurrences.length > 0 ? occurrences[0].snapshot : null;
    }, [occurrences]);

    const activeOccurrenceId = useMemo(() => {
        return occurrences.length > 0 ? occurrences[0].id : null;
    }, [occurrences]);

    const parsedChords = useMemo(() => {
        const chords = details?.snapshot?.chords || activeOccurrence?.chords;
        if (!chords) return [];
        return parseChordsAndLyrics(chords);
    }, [details?.snapshot?.chords, activeOccurrence?.chords]);

    if (!candidateId) return null;

    const translateClassification = (cls: string) => {
        const known = ['pending', 'pending_review', 'likely_unique', 'possible_duplicate', 'matched_existing', 'insufficient_data', 'processing_failed', 'approved', 'linked', 'rejected'];
        return known.includes(cls) ? t(`curation.modals.candidate.status.${cls}`) : cls;
    };

    const translateReason = (reason: string) => {
        const known = ['exact_title_artist', 'high_similarity', 'manual_link', 'needs_review', 'no_matches'];
        return known.includes(reason) ? t(`curation.modals.candidate.reason.${reason}`) : reason;
    };

    const translateWarning = (warning: string) => {
        const known = ['MISSING_TITLE', 'MISSING_ARTIST', 'TOO_MANY_MATCHES'];
        return known.includes(warning) ? t(`curation.modals.candidate.warning.${warning}`) : warning;
    };

    const translateStatus = (status: string) => translateClassification(status);

    const handleApprove = async () => {
        if (!activeOccurrenceId) return;
        setIsApproving(true);
        setApproveError(null);
        
        try {
            const idempotencyKey = `approve_${candidateId}_${Date.now()}`;
            await curationService.approveAsNew(candidateId!, activeOccurrenceId, idempotencyKey);
            setApproveSuccess(true);
            setDetails(prev => prev ? { ...prev, status: 'approved' } : null);
            if (onApproveSuccess) onApproveSuccess(candidateId!);
        } catch (e: any) {
            setApproveError(e.message || t('curation.modals.candidate.approveUnknownError'));
        } finally {
            setIsApproving(false);
            setShowConfirm(false);
        }
    };

    const handleLink = async () => {
        if (!selectedGlobalSongId) return;
        setIsLinking(true);
        setLinkError(null);
        
        try {
            const idempotencyKey = `link_${candidateId}_${selectedGlobalSongId}_${Date.now()}`;
            await curationService.linkToExisting(candidateId!, selectedGlobalSongId, idempotencyKey, forceModeratedMatch);
            setLinkSuccess(true);
            setDetails(prev => prev ? { ...prev, status: 'linked' } : null);
            if (onLinkSuccess) onLinkSuccess(candidateId!);
            setShowLinkConfirm(false);
        } catch (e: any) {
             if (e.requiresConfirmation) {
                 setForceModeratedMatch(true);
                 setLinkError(e.message || t('curation.modals.candidate.moderatedFallback'));
             } else {
                 setLinkError(e.message || t('curation.modals.candidate.linkUnknownError'));
             }
        } finally {
            setIsLinking(false);
        }
    };

    const handleReject = async () => {
        if (!rejectReasonCode) {
            setRejectError(t('curation.modals.candidate.rejectReasonRequired'));
            return;
        }
        setIsRejecting(true);
        setRejectError(null);

        try {
            const idempotencyKey = `reject_${candidateId}_${Date.now()}`;
            await curationService.rejectCandidate(candidateId!, rejectReasonCode, rejectNote, idempotencyKey);
            setRejectSuccess(true);
            setDetails(prev => prev ? { ...prev, status: 'rejected' } : null);
            if (onRejectSuccess) onRejectSuccess(candidateId!);
            setShowRejectConfirm(false);
        } catch (e: any) {
             setRejectError(e.message || t('curation.modals.candidate.rejectUnknownError'));
        } finally {
            setIsRejecting(false);
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[10000] flex justify-end bg-black/60 backdrop-blur-sm sm:p-4 mt-[env(safe-area-inset-top)]">
            <motion.div 
               initial={{ x: 100, opacity: 0 }}
               animate={{ x: 0, opacity: 1 }}
               exit={{ x: 100, opacity: 0 }}
               className="bg-white dark:bg-[#0A0A0C] w-full max-w-3xl h-full shadow-2xl flex flex-col sm:rounded-2xl overflow-hidden relative"
            >
                <div className="sticky top-0 z-10 bg-white dark:bg-[#0A0A0C] flex flex-col px-6 py-4 border-b border-slate-100 dark:border-white/5">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-bold">{t('curation.modals.candidate.title')}</h2>
                        
                        <button onClick={onClose} className="p-2 w-11 h-11 flex items-center justify-center bg-slate-100/50 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-full transition-colors z-[10001]">
                            <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                         {['pending', 'pending_review', 'likely_unique', 'possible_duplicate', 'matched_existing', 'processing_failed'].includes(details?.status || '') && !approveSuccess && !linkSuccess && !rejectSuccess && (
                              <button 
                                onClick={() => setShowRejectConfirm(true)}
                                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-4 py-1.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                              >
                                {t('curation.modals.candidate.rejectCandidate')}
                              </button>
                         )}
                         {['pending', 'pending_review', 'likely_unique'].includes(details?.status || '') && !approveSuccess && !linkSuccess && !rejectSuccess && (
                              <button 
                                onClick={() => setShowConfirm(true)}
                                className="bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95"
                              >
                                {t('curation.modals.candidate.approveAsNew')}
                              </button>
                         )}
                         {details?.status === 'rejected' && (
                              <span className="text-red-500 font-bold text-sm bg-red-500/10 px-3 py-1.5 rounded-xl">
                                  {t('curation.modals.candidate.status.rejected')}
                              </span>
                         )}
                         {details?.status === 'linked' && (
                              <span className="text-blue-500 font-bold text-sm bg-blue-500/10 px-3 py-1.5 rounded-xl">
                                  {t('curation.modals.candidate.status.linked')}
                              </span>
                         )}
                         {(details?.status === 'approved' || approveSuccess) && (
                              <span className="text-green-500 font-bold text-sm bg-green-500/10 px-3 py-1.5 rounded-xl">
                                  {t('curation.modals.candidate.status.approved')}
                              </span>
                         )}
                    </div>
                </div>
                
                {approveError && (
                    <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
                        <p className="text-red-500 text-sm font-bold">{approveError}</p>
                        <button onClick={() => setApproveError(null)} className="text-red-500 hover:text-red-600 font-bold text-xs uppercase tracking-wider">{t('curation.modals.common.dismiss')}</button>
                    </div>
                )}

                {linkError && (
                    <div className="mx-6 mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
                        <p className="text-amber-600 dark:text-amber-500 text-sm font-bold">{linkError}</p>
                        <button onClick={() => setLinkError(null)} className="text-amber-600 dark:text-amber-500 hover:text-amber-700 font-bold text-xs uppercase tracking-wider">{t('curation.modals.common.dismiss')}</button>
                    </div>
                )}

                {showConfirm && (
                    <div className="absolute inset-0 z-50 bg-white/90 dark:bg-[#0A0A0C]/90 backdrop-blur-md flex flex-col justify-center items-center p-6 text-center animate-fade-in">
                         <div className="max-w-md w-full bg-white dark:bg-[#1A1A1A] p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-white/10">
                              <h3 className="text-xl font-bold mb-2">{t('curation.modals.candidate.approveDialog.title')}</h3>
                              <p className="text-slate-500 text-sm mb-6">
                                {t('curation.modals.candidate.approveDialog.description', { title: `"${details?.title || ''}"`, artist: details?.artist || t('curation.modals.common.unknown') })}
                              </p>
                              
                              <div className="bg-slate-50 dark:bg-black/30 p-4 rounded-xl mb-6 text-left border border-slate-100 dark:border-white/5">
                                 <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">{t('curation.modals.candidate.approveDialog.baseOccurrence')}</p>
                                 <p className="text-sm font-medium">{activeOccurrenceId || t('curation.modals.candidate.approveDialog.firstAvailable')}</p>
                              </div>

                              <div className="flex gap-3 w-full">
                                  <button 
                                     onClick={() => setShowConfirm(false)}
                                     disabled={isApproving}
                                     className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
                                  >
                                      {t('curation.modals.common.cancel')}
                                  </button>
                                  <button 
                                     onClick={handleApprove}
                                     disabled={isApproving}
                                     className="flex-1 py-3 font-bold text-white bg-green-500 hover:bg-green-600 rounded-xl transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                                  >
                                      {isApproving ? <Spinner size="sm" /> : t('curation.modals.common.confirm')}
                                  </button>
                              </div>
                         </div>
                    </div>
                )}

                {showLinkConfirm && (
                    <div className="absolute inset-0 z-50 bg-white/90 dark:bg-[#0A0A0C]/90 backdrop-blur-md flex flex-col justify-center items-center p-6 text-center animate-fade-in">
                         <div className="max-w-md w-full bg-white dark:bg-[#1A1A1A] p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-white/10">
                              <h3 className="text-xl font-bold mb-2">{t('curation.modals.candidate.linkDialog.title')}</h3>
                              <p className="text-slate-500 text-sm mb-6">
                                {t('curation.modals.candidate.linkDialog.description', { title: `"${details?.title || ''}"` })}
                              </p>
                              
                              {forceModeratedMatch && (
                                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mb-6 text-left">
                                    <p className="text-sm text-amber-600 font-bold">{t('curation.modals.candidate.linkDialog.moderatedTitle')}</p>
                                    <p className="text-xs text-amber-700/80 mt-1">{t('curation.modals.candidate.linkDialog.moderatedDescription')}</p>
                                </div>
                              )}

                              <div className="flex gap-3 w-full">
                                  <button 
                                     onClick={() => { setShowLinkConfirm(false); setForceModeratedMatch(false); setLinkError(null); }}
                                     disabled={isLinking}
                                     className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
                                  >
                                      {t('curation.modals.common.cancel')}
                                  </button>
                                  <button 
                                     onClick={handleLink}
                                     disabled={isLinking}
                                     className="flex-1 py-3 font-bold text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                                  >
                                      {isLinking ? <Spinner size="sm" /> : (forceModeratedMatch ? t('curation.modals.candidate.linkDialog.forceLink') : t('curation.modals.common.confirm'))}
                                  </button>
                              </div>
                         </div>
                    </div>
                )}
                
                {showRejectConfirm && (
                    <div className="absolute inset-0 z-50 bg-white/90 dark:bg-[#0A0A0C]/90 backdrop-blur-md flex flex-col justify-center items-center p-6 text-center animate-fade-in overflow-y-auto">
                         <div className="max-w-md w-full bg-white dark:bg-[#1A1A1A] p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-white/10 text-left my-auto">
                              <h3 className="text-xl font-bold mb-2">{t('curation.modals.candidate.rejectDialog.title')}</h3>
                              <p className="text-slate-500 text-sm mb-6 font-medium">
                                {t('curation.modals.candidate.rejectDialog.description', { title: `"${details?.title || ''}"` })}
                              </p>
                              
                              <div className="mb-4">
                                  <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">{t('curation.modals.candidate.rejectDialog.reasonLabel')}</label>
                                  <select 
                                      value={rejectReasonCode}
                                      onChange={(e) => setRejectReasonCode(e.target.value)}
                                      className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                      disabled={isRejecting}
                                  >
                                      <option value="" disabled>{t('curation.modals.candidate.rejectDialog.selectReason')}</option>
                                      <option value="duplicate_candidate">{t('curation.modals.candidate.rejectDialog.reasons.duplicate_candidate')}</option>
                                      <option value="invalid_content">{t('curation.modals.candidate.rejectDialog.reasons.invalid_content')}</option>
                                      <option value="insufficient_content">{t('curation.modals.candidate.rejectDialog.reasons.insufficient_content')}</option>
                                      <option value="medley_or_compilation">{t('curation.modals.candidate.rejectDialog.reasons.medley_or_compilation')}</option>
                                      <option value="not_a_song">{t('curation.modals.candidate.rejectDialog.reasons.not_a_song')}</option>
                                      <option value="policy_violation">{t('curation.modals.candidate.rejectDialog.reasons.policy_violation')}</option>
                                      <option value="other">{t('curation.modals.candidate.rejectDialog.reasons.other')}</option>
                                  </select>
                              </div>

                              <div className="mb-6">
                                  <div className="flex justify-between items-center mb-2">
                                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">{t('curation.modals.candidate.rejectDialog.privateNote')}</label>
                                      <span className={`text-xs font-mono mb-0 ${rejectNote.length > 500 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                          {rejectNote.length}/500
                                      </span>
                                  </div>
                                  <textarea 
                                      value={rejectNote}
                                      onChange={(e) => setRejectNote(e.target.value)}
                                      maxLength={500}
                                      placeholder={t('curation.modals.candidate.rejectDialog.privateNotePlaceholder')}
                                      className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 outline-none h-24 resize-none"
                                      disabled={isRejecting}
                                  ></textarea>
                              </div>

                              {rejectError && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex flex-col gap-2">
                                    <p className="text-red-600 dark:text-red-500 text-sm font-bold">{t('curation.modals.candidate.rejectDialog.errorTitle')}</p>
                                    <p className="text-red-600/80 dark:text-red-400/80 text-sm">{rejectError}</p>
                                </div>
                              )}

                              <div className="flex gap-3 w-full">
                                  <button 
                                     onClick={() => { setShowRejectConfirm(false); setRejectError(null); }}
                                     disabled={isRejecting}
                                     className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
                                  >
                                      {t('curation.modals.common.cancel')}
                                  </button>
                                  <button 
                                     onClick={handleReject}
                                     disabled={isRejecting || !rejectReasonCode || rejectNote.length > 500}
                                     className="flex-1 py-3 font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                                  >
                                      {isRejecting ? <Spinner size="sm" /> : t('curation.modals.candidate.rejectDialog.reject')}
                                  </button>
                              </div>
                         </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex-1 flex justify-center items-center">
                        <Spinner size="lg" />
                    </div>
                ) : error ? (
                    <div className="flex-1 flex flex-col justify-center items-center space-y-4 p-8 text-center bg-red-500/5">
                        <p className="text-red-500 font-bold">{error}</p>
                    </div>
                ) : !details ? (
                    <div className="flex-1 flex justify-center items-center text-slate-500">
                        {t('curation.modals.candidate.notFound')}
                    </div>
                ) : (
                    <div className="flex flex-col flex-1 gap-0 mb-safe h-full hide-scrollbar">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] shrink-0">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-2xl font-bold flex items-center gap-3">
                                        <span>{details.title}</span>
                                        {details.errorMsg && <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-xs uppercase" title={details.errorMsg}>{t('curation.modals.common.error')}</span>}
                                    </h3>
                                    <p className="text-slate-500">{details.artist}</p>
                                </div>
                                <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-current ${['matched_existing', 'linked', 'approved'].includes(details.classification) || ['approved', 'linked'].includes(details.status) ? 'bg-green-500/10 text-green-500' : details.classification === 'possible_duplicate' || details.status === 'processing_failed' ? 'bg-amber-500/10 text-amber-500' : details.classification === 'likely_unique' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'}`}>
                                    {translateClassification(details.classification)}
                                </span>
                            </div>

                            <div className="flex space-x-1 overflow-x-auto hide-scrollbar">
                                {[
                                    { id: 'overview', label: t('curation.modals.candidate.tabs.overview') },
                                    { id: 'chords', label: t('curation.modals.candidate.tabs.chords') },
                                    { id: 'lyrics', label: t('curation.modals.candidate.tabs.lyrics') },
                                    { id: 'matches', label: t('curation.modals.candidate.tabs.matches') },
                                    { id: 'occurrences', label: t('curation.modals.candidate.tabs.occurrences', { count: occurrences.length }) },
                                    { id: 'history', label: t('curation.modals.candidate.tabs.history') }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`px-4 py-2 text-sm font-bold rounded-xl whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-white dark:bg-[#1A1A1A] text-primary shadow-sm border border-slate-200 dark:border-white/10' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0A0A0C] shrink">
                            {activeTab === 'overview' && (
                                <div className="p-6 space-y-6 animate-fade-in">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-slate-50 dark:bg-white/[0.03] rounded-2xl p-4 border border-slate-100 dark:border-white/5">
                                            <p className="text-xs uppercase font-bold text-slate-400 mb-1">{t('curation.modals.candidate.overview.status')}</p>
                                            <p className="font-semibold text-sm truncate">{translateStatus(details.status)}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-white/[0.03] rounded-2xl p-4 border border-slate-100 dark:border-white/5">
                                            <p className="text-xs uppercase font-bold text-slate-400 mb-1">{t('curation.modals.candidate.overview.discoveredAt')}</p>
                                            <p className="font-semibold text-sm truncate">{details.firstDiscoveredAt ? new Date(details.firstDiscoveredAt).toLocaleDateString(dateLocale) : t('curation.modals.common.notInformed')}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-white/[0.03] rounded-2xl p-4 border border-slate-100 dark:border-white/5">
                                            <p className="text-xs uppercase font-bold text-slate-400 mb-1">{t('curation.modals.candidate.overview.occurrences')}</p>
                                            <p className="font-semibold text-sm truncate">{details.occurrenceCount || occurrences.length}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-white/[0.03] rounded-2xl p-4 border border-slate-100 dark:border-white/5">
                                            <p className="text-xs uppercase font-bold text-slate-400 mb-1">{t('curation.modals.candidate.overview.organizations')}</p>
                                            <p className="font-semibold text-sm truncate">{details.organizationCount || Array.from(new Set(occurrences.map(o => o.snapshot?.organizationId).filter(o => o))).length || 1}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-50 dark:bg-white/[0.03] rounded-3xl p-6 border border-slate-100 dark:border-white/5">
                                        <h3 className="font-bold text-lg mb-4">{t('curation.modals.candidate.overview.musicalInfo')}</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-2">
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">BPM</p>
                                                <p className="font-bold">{details.snapshot?.bpm || details.analysisSummary?.metrics?.avgBpm ? Math.round(details.snapshot?.bpm || details.analysisSummary?.metrics?.avgBpm) : t('curation.modals.common.notInformed')}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">{t('curation.modals.candidate.overview.rhythm')}</p>
                                                <p className="font-bold">{details.snapshot?.timeSignature || t('curation.modals.common.notInformed')}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">{t('curation.modals.candidate.overview.currentKey')}</p>
                                                <p className="font-bold">{details.snapshot?.key || details.analysisSummary?.metrics?.mostCommonKey || t('curation.modals.common.notInformed')}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium">{t('curation.modals.candidate.overview.originalKey')}</p>
                                                <p className="font-bold">{details.snapshot?.originalKey || t('curation.modals.common.notInformed')}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-xs text-slate-500 font-medium">{t('curation.modals.candidate.overview.language')}</p>
                                                <p className="font-bold">{details.snapshot?.language || t('curation.modals.common.notInformed')}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-xs text-slate-500 font-medium">{t('curation.modals.candidate.overview.tags')}</p>
                                                <p className="font-bold">{details.snapshot?.tags?.join(', ') || t('curation.modals.common.notInformed')}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {details.analysisSummary?.warningCodes?.length > 0 && (
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
                                            <h4 className="text-amber-500 font-bold text-sm mb-3 flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                {t('curation.modals.candidate.overview.warnings')}
                                            </h4>
                                            <ul className="space-y-1 text-sm text-amber-500/80 font-medium">
                                                {details.analysisSummary.warningCodes.map((w: string) => <li key={w}>• {translateWarning(w)}</li>)}
                                            </ul>
                                        </div>
                                    )}

                                    {details.analysisSummary?.matchDetails?.reason && (
                                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-5">
                                           <h4 className="text-blue-500 dark:text-blue-400 font-bold text-sm mb-2">{t('curation.modals.candidate.overview.mainMatchReason')}</h4>
                                           <p className="text-slate-600 dark:text-slate-400 text-sm">{translateReason(details.analysisSummary.matchDetails.reason)}</p>
                                        </div>
                                    )}
                                    
                                    {details.errorMsg && (
                                        <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-5">
                                           <h4 className="text-red-500 font-bold text-sm mb-2">{t('curation.modals.candidate.overview.processingError')}</h4>
                                           <p className="text-red-600/80 dark:text-red-400/80 text-sm">{details.errorMsg}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'chords' && (
                                <div className="p-6 animate-fade-in font-sans">
                                    {parsedChords.length > 0 ? (
                                        <div style={{ fontSize: '18px', lineHeight: 1.55 }}>
                                            <ChordsRenderer 
                                                parsedContent={parsedChords}
                                                transpose={0}
                                                activeChordsColor={darkThemeColors.chords[0]}
                                                activeLyricsColor={darkThemeColors.lyrics[0]}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                            <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                                            <p className="font-medium">{t('curation.modals.candidate.empty.chords')}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'lyrics' && (
                                <div className="p-6 animate-fade-in text-left">
                                    {details.snapshot?.lyrics || activeOccurrence?.lyrics ? (
                                        <div 
                                          className="whitespace-pre-wrap font-sans text-slate-800 dark:text-white/95 font-semibold tracking-tight leading-[1.8]"
                                          style={{ fontSize: "18px" }}
                                        >
                                          {details.snapshot?.lyrics || activeOccurrence?.lyrics}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                            <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6h16M4 12h16M4 18h7" /></svg>
                                            <p className="font-medium">{t('curation.modals.candidate.empty.lyrics')}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'matches' && (
                                <div className="p-6 space-y-4 animate-fade-in">
                                    {matches.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 font-medium">{t('curation.modals.candidate.empty.matches')}</div>
                                    ) : (
                                        matches.map(m => (
                                            <div key={m.id} className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 flex flex-col gap-3">
                                               <div className="flex justify-between items-start gap-4">
                                                   <div className="flex-1">
                                                       {m.__globalSongDetails ? (
                                                            <>
                                                                <h4 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">
                                                                    {m.__globalSongDetails.title}
                                                                </h4>
                                                                <p className="text-sm text-slate-500 mt-1">
                                                                    {m.__globalSongDetails.artist || t('curation.modals.common.unknown')}
                                                                </p>
                                                            </>
                                                       ) : (
                                                            <h4 className="font-bold text-lg text-slate-900 dark:text-white opacity-50">
                                                                {t('curation.modals.common.unknownSong')}
                                                            </h4>
                                                       )}
                                                       
                                                       <div className="flex flex-col mt-4">
                                                            <span className="text-xs text-slate-500 tracking-wide">
                                                                {t('curation.modals.candidate.match.confidence')} <span className="font-bold text-slate-700 dark:text-slate-300 ml-1">{Math.round((m.score || 0)*100)}%</span>
                                                            </span>
                                                            <p className="font-medium text-xs text-slate-600 dark:text-slate-400 mt-1.5">{translateReason(m.reason || t('curation.modals.common.unknown'))}</p>
                                                       </div>
                                                   </div>
                                                   <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-black/40 px-2 py-1 rounded-md shrink-0">
                                                       {m.globalSongId || t('curation.modals.common.hiddenId')}
                                                   </span>
                                               </div>
                                               {['pending_review', 'possible_duplicate', 'matched_existing', 'likely_unique'].includes(details?.status || '') && m.globalSongId && !linkSuccess && (
                                                   <button 
                                                      onClick={() => {
                                                          setSelectedGlobalSongId(m.globalSongId);
                                                          setShowLinkConfirm(true);
                                                      }}
                                                      className="self-end mt-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/30 px-5 py-2 rounded-xl text-sm font-bold transition-all"
                                                   >
                                                      {t('curation.modals.candidate.match.linkThis')}
                                                   </button>
                                               )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'occurrences' && (
                                <div className="p-6 space-y-4 animate-fade-in">
                                    {occurrences.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 font-medium">{t('curation.modals.candidate.empty.occurrences')}</div>
                                    ) : (
                                        occurrences.map(o => (
                                            <div key={o.id} className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 space-y-3 shadow-sm">
                                               <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="font-bold text-base">{o.__organizationName || t('curation.modals.common.unknown')}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{o.snapshot?.title} — {o.snapshot?.artist}</p>
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-400 shrink-0">
                                                        {o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleDateString(dateLocale) : t('curation.modals.common.notInformedFemale')}
                                                    </span>
                                               </div>
                                               
                                               <div className="flex flex-wrap gap-2 mb-3">
                                                   <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-white/5 dark:text-slate-400 px-2.5 py-1 rounded-md uppercase tracking-wide">
                                                       {o.discovery?.origin === 'app_creation' ? t('curation.modals.candidate.occurrence.app_creation') : 
                                                        o.discovery?.origin === 'system_scan' ? t('curation.modals.candidate.occurrence.system_scan') : 
                                                        o.discovery?.origin === 'migration' ? t('curation.modals.candidate.occurrence.migration') : t('curation.modals.candidate.occurrence.unknown')}
                                                   </span>
                                               </div>

                                               <div className="flex gap-4 border-t border-slate-100 dark:border-white/5 pt-3">
                                                   <span className="text-sm flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${o.snapshot?.chords ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></span> {o.snapshot?.chords ? t('curation.modals.candidate.occurrence.withChords') : t('curation.modals.candidate.occurrence.withoutChords')}</span>
                                                   <span className="text-sm flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${o.snapshot?.lyrics ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}></span> {o.snapshot?.lyrics ? t('curation.modals.candidate.occurrence.withLyrics') : t('curation.modals.candidate.occurrence.withoutLyrics')}</span>
                                               </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div className="p-6 space-y-4 animate-fade-in relative z-0">
                                    {history.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 font-medium">{t('curation.modals.candidate.empty.history')}</div>
                                    ) : (
                                        history.map(h => {
                                            const eventName = h.eventType === 'occurrence_added' ? t('curation.modals.candidate.history.occurrence_added') :
                                                              h.eventType === 'created' ? t('curation.modals.candidate.history.created') :
                                                              h.action === 'approved' ? t('curation.modals.candidate.history.approved') :
                                                              h.action === 'rejected' ? t('curation.modals.candidate.history.rejected') :
                                                              h.action === 'linked' ? t('curation.modals.candidate.history.linked') :
                                                              h.eventType || h.action || t('curation.modals.candidate.history.systemEvent');
                                            
                                            const timeDisplay = h.timestampMillis ? new Date(h.timestampMillis).toLocaleString(dateLocale) : t('curation.modals.common.unavailableDate');
                                            
                                            return (
                                                <div key={h.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                                                   <div className="flex justify-between items-center mb-1">
                                                       <span className="font-bold text-sm uppercase tracking-wide">{eventName}</span>
                                                       <span className="text-xs text-slate-400">{timeDisplay}</span>
                                                   </div>
                                                   {h.reasonCode && (
                                                       <p className="text-xs text-slate-500 font-medium mb-1">{t('curation.modals.candidate.history.reason', { reason: h.reasonCode })}</p>
                                                   )}
                                                   {h.privateNote && (
                                                       <div className="mt-2 p-3 bg-slate-100 dark:bg-black/20 rounded-xl text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/5">
                                                            <span className="font-bold block mb-1">{t('curation.modals.candidate.history.privateNote')}</span>
                                                            <p className="italic">"{h.privateNote}"</p>
                                                       </div>
                                                   )}
                                                   {!h.reasonCode && !h.privateNote && h.details && (
                                                       <p className="text-xs text-slate-500 mt-1">{h.details}</p>
                                                   )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );

    return createPortal(modalContent, document.body);
};