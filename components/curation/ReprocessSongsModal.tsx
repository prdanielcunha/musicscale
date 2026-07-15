import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useEcosystem } from '../../contexts/EcosystemContext';
import Spinner from '../common/Spinner';

interface SongForReprocessing {
    id: string;
    title: string;
    artist: string;
    organizationName: string;
    organizationId: string;
    createdAt: any;
    status: 'unprocessed' | 'processed' | 'ignored' | 'failed';
}

interface Props {
    onClose: () => void;
}

export function ReprocessSongsModal({ onClose }: Props) {
    const { user } = useAuth();
    const { context: ecoContext } = useEcosystem();
    const [songs, setSongs] = useState<SongForReprocessing[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('unprocessed');
    const [organizationId, setOrganizationId] = useState('all');
    const [hasMore, setHasMore] = useState(true);
    const [cursors, setCursors] = useState<{ lastId: string | null, lastCreatedAt: any | null, lastTitle: string | null }>({ lastId: null, lastCreatedAt: null, lastTitle: null });
    const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
    const [reprocessingStates, setReprocessingStates] = useState<Record<string, { type: 'loading' | 'success' | 'error', msg: string }>>({});
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);

    useEffect(() => {
        const fetchOrgs = async () => {
             if (!user) return;
             try {
                 let orgsData: any[] = [];
                 let success = false;

                 // 1. Try direct Firestore client query (only works if permissions allow, e.g. for System Admins)
                 try {
                     const { collection, getDocs, limit, query } = await import('firebase/firestore');
                     const { db } = await import('../../services/firebase');
                     const orgsSnap = await getDocs(query(collection(db, "organizations"), limit(200)));
                     if (!orgsSnap.empty) {
                         orgsData = orgsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                         success = true;
                     }
                 } catch (e) {
                     console.warn("Client fallback failed", e);
                 }

                 // 2. Try API endpoint (handles full server-side permission bypass)
                 if (!success) {
                     try {
                         const token = await user.getIdToken();
                         const res = await fetch('/api/admin/organizations', {
                             headers: { 'Authorization': `Bearer ${token}` }
                         });
                         if (res.ok) {
                             const data = await res.json();
                             orgsData = Array.isArray(data) ? data : (data.organizations || []);
                             if (orgsData.length > 0) {
                                 success = true;
                             }
                         }
                     } catch (e) {
                         console.warn("API fallback failed in fetchOrgs: ", e);
                     }
                 }

                 // 3. Fallback to user's localized available organizations (Ecosystem Context)
                 if (!success && ecoContext?.organizationsAvailable && ecoContext.organizationsAvailable.length > 0) {
                     orgsData = [...ecoContext.organizationsAvailable];
                 }
                 
                 // Filter for ecosystem (musicscale app active or present) whenever possible
                 const ecosystemOrgs = orgsData.filter((org: any) => {
                     if (org.apps?.musicscale?.active === false) return false;
                     return org.apps?.musicscale || org.title || org.name;
                 });
                 setOrganizations(ecosystemOrgs);
             } catch (e) {
                 console.error("Failed to fetch organizations: ", e);
             }
        };
        fetchOrgs();
    }, [user, ecoContext]);

    const fetchSongs = async (isLoadMore = false) => {
        if (!user) return;
        
        if (!isLoadMore) {
            setSongs([]);
            setSelectedSongIds(new Set());
            setCursors({ lastId: null, lastCreatedAt: null, lastTitle: null });
        }
        
        setLoading(true);
        try {
            const token = await user.getIdToken();
            const legacyOnly = statusFilter === 'legacy';
            const reqStatus = legacyOnly ? undefined : (statusFilter !== 'all' ? statusFilter : undefined);
            
            const bodyContext: any = {
                limit: 10,
                search: search.trim() || undefined,
                statusFilter: reqStatus,
                organizationId: organizationId !== 'all' ? organizationId : undefined,
                legacyOnly: legacyOnly
            };
            if (isLoadMore && cursors.lastId) {
                bodyContext.lastId = cursors.lastId;
                if (bodyContext.search) {
                     bodyContext.lastTitle = cursors.lastTitle;
                } else if (!legacyOnly) {
                     bodyContext.lastCreatedAt = cursors.lastCreatedAt;
                }
            }

            const res = await fetch('/api/admin/songs-for-reprocessing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(bodyContext)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao carregar');

            if (isLoadMore) {
                setSongs(prev => {
                    // prevent duplicates
                    const existingIds = new Set(prev.map(s => s.id));
                    const newSongs = data.songs.filter((s: any) => !existingIds.has(s.id));
                    return [...prev, ...newSongs];
                });
            } else {
                setSongs(data.songs);
                setSelectedSongIds(new Set());
            }
            setHasMore(data.hasMore);
            setCursors({ lastId: data.lastId, lastCreatedAt: data.lastCreatedAt, lastTitle: data.lastTitle });
        } catch (e: any) {
             console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const t = setTimeout(() => {
            fetchSongs(false);
        }, 300);
        return () => clearTimeout(t);
    }, [statusFilter, search, organizationId]);

    const handleReprocess = async (songId: string) => {
        if (!user) return false;
        
        // Prevent double click
        if (reprocessingStates[songId]?.type === 'loading') return false;

        setReprocessingStates(prev => ({ ...prev, [songId]: { type: 'loading', msg: 'Processando...' } }));
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/curation/reprocess-song", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ songId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro desconhecido");
            
            let mappedOutcome = 'Falha';
            const rawOutcome = data.outcome; 
            if (rawOutcome === 'processed') mappedOutcome = 'Processada';
            else if (rawOutcome === 'already_processed') mappedOutcome = 'Já processada';
            else if (rawOutcome === 'ignored') mappedOutcome = 'Ignorada';
            else if (rawOutcome === 'not_found') mappedOutcome = 'Não encontrada';

            setReprocessingStates(prev => ({ 
                ...prev, 
                [songId]: { type: rawOutcome === 'failed' || rawOutcome === 'not_found' ? 'error' : 'success', msg: mappedOutcome } 
            }));
            
            setSongs(prev => {
                if (statusFilter === 'unprocessed' && (rawOutcome === 'processed' || rawOutcome === 'already_processed' || rawOutcome === 'ignored' || rawOutcome === 'not_found')) {
                     return prev.filter(s => s.id !== songId);
                }
                return prev.map(s => s.id === songId ? { 
                     ...s, 
                     status: mappedOutcome
                } : s);
            });
            
            setSelectedSongIds(prev => {
                if (!prev.has(songId)) return prev;
                const n = new Set(prev);
                n.delete(songId);
                return n;
            });

            return true;
        } catch (err: any) {
            setReprocessingStates(prev => ({ ...prev, [songId]: { type: 'error', msg: 'Falha' } }));
            return false;
        }
    };

    const handleReprocessSelected = async () => {
        if (isBatchProcessing) return;
        setIsBatchProcessing(true);
        const idsToProcess = Array.from(selectedSongIds).filter(id => !reprocessingStates[id] || reprocessingStates[id].type !== 'loading');
        
        // Process up to 3 concurrently
        const concurrency = 3;
        for (let i = 0; i < idsToProcess.length; i += concurrency) {
             const chunk = (idsToProcess as string[]).slice(i, i + concurrency);
             await Promise.all(chunk.map(id => handleReprocess(id)));
        }
        setIsBatchProcessing(false);
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedSongIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedSongIds(next);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#1A1A1A] w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-black/20 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Reprocessar Músicas Locais</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white">✕</button>
                </div>
                
                <div className="p-4 flex flex-col gap-4 border-b border-slate-200 dark:border-white/10 shrink-0">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                            type="text"
                            placeholder="Buscar título..."
                            className="px-3 py-2 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <select
                            className="px-3 py-2 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                            value={organizationId}
                            onChange={e => setOrganizationId(e.target.value)}
                        >
                            <option value="all">Todas as Músicas</option>
                            {organizations.map(org => (
                                <option key={org.id} value={org.id}>{org.name || org.title || org.id}</option>
                            ))}
                        </select>
                        <select
                            className="px-3 py-2 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="unprocessed">Precisam de processamento</option>
                            <option value="failed">Falha no processamento</option>
                            <option value="processed">Já processadas</option>
                            <option value="ignored">Ignoradas</option>
                            <option value="all">Todas as situações</option>
                            <option value="legacy">Músicas antigas (Sem data)</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 dark:bg-[#202020] p-3 rounded-xl border border-slate-200 dark:border-white/10 pt-2 pb-2 mt-1">
                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox"
                                className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                checked={songs.length > 0 && selectedSongIds.size === songs.length}
                                disabled={songs.length === 0}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setSelectedSongIds(new Set(songs.map(s => s.id)));
                                    } else {
                                        setSelectedSongIds(new Set());
                                    }
                                }}
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {selectedSongIds.size > 0 ? `${selectedSongIds.size} selecionadas` : 'Selecionar itens desta página'}
                            </span>
                        </div>
                        {selectedSongIds.size > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSelectedSongIds(new Set())}
                                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-medium transition-colors"
                                >
                                    Limpar Seleção
                                </button>
                                <button 
                                    onClick={handleReprocessSelected}
                                    disabled={isBatchProcessing}
                                    className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg disabled:opacity-50 hover:bg-primary/90 transition-colors"
                                >
                                    {isBatchProcessing ? 'Processando...' : 'Reprocessar Lote'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {songs.map(song => (
                        <div key={song.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-primary/50 transition-colors gap-3 group">
                            <div className="flex items-start sm:items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 mt-1 sm:mt-0 rounded border-slate-300 text-primary focus:ring-primary flex-shrink-0"
                                    checked={selectedSongIds.has(song.id)}
                                    onChange={() => toggleSelect(song.id)}
                                />
                                <div className="space-y-0.5">
                                    <div className="font-semibold text-slate-900 dark:text-white">
                                         {song.title} <span className="font-normal opacity-70">— {song.artist || 'Desconhecido'}</span> <span className="font-normal opacity-50">— {song.organizationName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-[10px] text-slate-400 font-mono tracking-wide cursor-text selection:bg-primary/20" title="Song ID">
                                            {song.id}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            {song.createdAt?._seconds || song.createdAt?.seconds ? new Date((song.createdAt._seconds || song.createdAt.seconds) * 1000).toLocaleDateString() : 'Sem Data'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 pl-8 sm:pl-0">
                                <span className={`text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-full ${
                                    song.status === 'unprocessed' ? 'bg-orange-500/10 text-orange-500' :
                                    song.status === 'processed' ? 'bg-green-500/10 text-green-500' :
                                    song.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                                    'bg-slate-500/10 text-slate-500'
                                }`}>
                                    {song.status === 'unprocessed' ? 'Aguardando' : song.status}
                                </span>
                                
                                {reprocessingStates[song.id] ? (
                                    <div className={`text-xs w-28 text-right font-medium ${reprocessingStates[song.id].type === 'error' ? 'text-red-500' : reprocessingStates[song.id].type === 'loading' ? 'text-orange-500' : 'text-green-500'}`}>
                                        {reprocessingStates[song.id].msg}
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => handleReprocess(song.id)}
                                        className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                                    >
                                        Reprocessar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex justify-center p-4"><Spinner size="md" /></div>
                    )}
                    
                    {!loading && songs.length === 0 && (
                        <div className="text-center py-10 text-slate-500">Nenhuma música encontrada com esse filtro.</div>
                    )}

                    {hasMore && !loading && (
                        <button 
                            onClick={() => fetchSongs(true)}
                            className="w-full py-3 text-sm text-primary font-medium hover:bg-primary/5 rounded-xl transition-colors"
                        >
                            Carregar mais...
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
