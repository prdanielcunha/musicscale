import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useEcosystem } from '../../contexts/EcosystemContext';
import { motion } from 'motion/react';
import Spinner from '../common/Spinner';

interface Props {
    onClose: () => void;
}

export function OrganizationScannerModal({ onClose }: Props) {
    const { user } = useAuth();
    const { context: ecoContext } = useEcosystem();
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [approxCount, setApproxCount] = useState<number | null>(null);
    const [loadingCount, setLoadingCount] = useState(false);
    
    const [isScanning, setIsScanning] = useState(false);
    const [stats, setStats] = useState({
        examined: 0,
        na_caixa: 0,
        ja_na_caixa: 0,
        inedita: 0,
        duplicada: 0,
        match_existente: 0,
        dados_insuficientes: 0,
        ignorada: 0,
        erro: 0
    });
    const [results, setResults] = useState<any[]>([]);
    const [filter, setFilter] = useState('all');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
                     console.warn("Direct Firestore client-side query failed: ", e);
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
                         console.warn("API load failed in fetchOrgs: ", e);
                     }
                 }

                 // 3. Fallback to user's localized available organizations (Ecosystem Context)
                 if (!success && ecoContext?.organizationsAvailable && ecoContext.organizationsAvailable.length > 0) {
                     orgsData = [...ecoContext.organizationsAvailable];
                 }
                 
                 // Filter for ecosystem (musicscale app active or present) whenever possible
                 const ecosystemOrgs = orgsData.filter((org: any) => {
                     if (org.apps?.musicscale?.active === false) return false;
                     return org.apps?.musicscale || org.title || org.name; // Basic validity
                 });
                 
                 setOrganizations(ecosystemOrgs);
             } catch (e) {
                 console.error("Failed to fetch organizations: ", e);
             }
        };
        fetchOrgs();
    }, [user, ecoContext]);

    useEffect(() => {
        if (!selectedOrgId) {
            setApproxCount(null);
            return;
        }
        const checkCount = async () => {
            setLoadingCount(true);
            try {
                const { collection, getCountFromServer, query, where } = await import('firebase/firestore');
                const { db } = await import('../../services/firebase');
                const countSnap = await getCountFromServer(query(collection(db, 'songs'), where('organizationId', '==', selectedOrgId)));
                setApproxCount(countSnap.data().count);
            } catch (e) {
                console.error("Client side count failed", e);
                try {
                     const token = await user?.getIdToken();
                     const res = await fetch('/api/admin/organization-songs-count', {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                         body: JSON.stringify({ organizationId: selectedOrgId })
                     });
                     if (res.ok) {
                         const data = await res.json();
                         setApproxCount(data.count);
                     }
                 } catch (be) {
                     console.error("Backend count failed", be);
                 }
             } finally {
                 setLoadingCount(false);
             }
        };
        checkCount();
    }, [selectedOrgId, user]);

    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAnalyzeNow = async () => {
        if (isAnalyzing || stats.na_caixa === 0) return;
        setIsAnalyzing(true);
        setErrorMessage(null);

        let remaining = stats.na_caixa;
        try {
            const token = await user?.getIdToken();
            while (remaining > 0) {
               const batchSize = Math.min(remaining, 10);
               const res = await fetch('/api/admin/analyze-inbox', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                   body: JSON.stringify({ limit: batchSize, organizationId: selectedOrgId })
               });

               if (!res.ok) {
                   const errData = await res.json().catch(() => ({}));
                   console.error("Analyze chunk failed:", errData);
                   setErrorMessage(errData.error || errData.details || "A análise falhou ao processar um lote.");
                   break;
               }

               const data = await res.json();
               if (data.results && data.results.results !== undefined) {
                   // Correct for payload structure mapping from backend
               }

               const analyzeResults = (data.results?.results || []).map((r: any) => {
                   let c = 'erro';
                   if (r.analysisOutcome === 'likely_unique') c = 'inedita';
                   else if (r.analysisOutcome === 'possible_duplicate') c = 'duplicada';
                   else if (r.analysisOutcome === 'matched_existing') c = 'match_existente';
                   else if (r.analysisOutcome === 'insufficient_data') c = 'dados_insuficientes';
                   else if (r.analysisOutcome === 'ignored') c = 'ignorada';
                   return { ...r, classification: c };
               });
               
               if (analyzeResults.length === 0) {
                   if (remaining === stats.na_caixa) {
                       setErrorMessage("Nenhuma entrada pendente encontrada para esta organização.");
                   }
                   break;
               }

               remaining -= analyzeResults.length;
               
               setStats(prev => {
                   const s = { ...prev };
                   analyzeResults.forEach((r: any) => {
                        s.na_caixa = Math.max(0, s.na_caixa - 1);
                        const key = r.classification;
                        if (s[key as keyof typeof s] !== undefined) {
                            (s as any)[key]++;
                        } else {
                            (s as any)[key] = 1;
                        }
                   });
                   return s;
               });

               setResults(prev => {
                   const map = new Map(prev.map(p => [p.sourceSongId, p]));
                   analyzeResults.forEach((r: any) => {
                       map.set(r.sourceSongId, { ...((map.get(r.sourceSongId) as any) || {}), ...r });
                   });
                   return Array.from(map.values());
               });

               if (analyzeResults.length === 0) break;
            }
        } catch(e: any) {
            console.error(e);
            setErrorMessage(e.message || "Erro na conexão ou análise.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleScan = async () => {
        if (!selectedOrgId || isScanning) return;
        setIsScanning(true);
        setErrorMessage(null);
        setStats({
            examined: 0,
            na_caixa: 0,
            ja_na_caixa: 0,
            inedita: 0,
            duplicada: 0,
            match_existente: 0,
            dados_insuficientes: 0,
            ignorada: 0,
            erro: 0
        });
        setResults([]);

        let currentCursor: string | null = null;
        let hasMore = true;

        try {
            const token = await user?.getIdToken();

            while (hasMore) {
                const res = await fetch('/api/admin/scan-organization-repertoire', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ organizationId: selectedOrgId, limit: 30, lastId: currentCursor })
                });
                
                if (!res.ok) {
                     const errData = await res.json().catch(() => ({}));
                     console.error("Scan chunk failed:", errData);
                     setErrorMessage(errData.error || errData.details || "A varredura falhou ao processar um lote de músicas no servidor.");
                     break;
                }
                
                const data = await res.json();
                const newResults = (data.results || []).map((r: any) => {
                    let c = 'erro';
                    if (r.scanOutcome === 'queued') c = 'na_caixa';
                    else if (r.scanOutcome === 'already_queued') c = 'ja_na_caixa';
                    else if (r.scanOutcome === 'ignored') c = 'ignorada';
                    return { ...r, classification: c };
                });
                
                setResults(prev => [...prev, ...newResults]);
                
                setStats(prev => {
                    const next = { ...prev };
                    next.examined += newResults.length;
                    for (const r of newResults) {
                         if (next[r.classification as keyof typeof next] !== undefined) {
                             next[r.classification as keyof typeof next]++;
                         } else {
                             next.erro++;
                         }
                    }
                    return next;
                });

                hasMore = data.hasMore;
                currentCursor = data.nextCursor;
            }

        } catch (e: any) {
            console.error("Error during scan string:", e);
            setErrorMessage(e?.message || "Erro de conexão de rede ao realizar a varredura.");
        } finally {
            setIsScanning(false);
        }
    };

    const sortOrder = { erro: 1, dados_insuficientes: 2, inedita: 3, duplicada: 4, match_existente: 5, na_caixa: 6, ja_na_caixa: 7, ignorada: 8 };
    const displayResults = results
        .filter(r => filter === 'all' || r.classification === filter)
        .sort((a, b) => {
             const orderA = sortOrder[a.classification as keyof typeof sortOrder] || 99;
             const orderB = sortOrder[b.classification as keyof typeof sortOrder] || 99;
             if (orderA !== orderB) return orderA - orderB;
             return (a.title || '').localeCompare(b.title || '');
        });

    const getClassificationLabel = (c: string) => {
        switch(c) {
            case 'na_caixa': return 'Enviada à Caixa de Entrada';
            case 'ja_na_caixa': return 'Já estava na Caixa';
            case 'ignorada': return 'Ignorada';
            case 'erro': return 'Erro';
            case 'inedita': return 'Provável Inédita';
            case 'duplicada': return 'Possível Duplicada';
            case 'match_existente': return 'Match Encontrado';
            case 'dados_insuficientes': return 'Dados Insuficientes';
            default: return c;
        }
    };

    const getClassificationColor = (c: string) => {
        switch(c) {
            case 'na_caixa': return 'text-blue-500 bg-blue-500/10';
            case 'ja_na_caixa': return 'text-blue-400 bg-blue-400/10';
            case 'ignorada': return 'text-slate-500 bg-slate-500/10';
            case 'erro': return 'text-red-500 bg-red-500/10';
            case 'inedita': return 'text-indigo-500 bg-indigo-500/10';
            case 'duplicada': return 'text-amber-500 bg-amber-500/10';
            case 'match_existente': return 'text-green-500 bg-green-500/10';
            case 'dados_insuficientes': return 'text-orange-500 bg-orange-500/10';
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
                        <h2 className="text-xl font-bold font-sans text-slate-900 dark:text-white">Varredura de Repertório</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Análise automática do repositório local e integração com a Biblioteca Viva.
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        disabled={isScanning}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
                    <div className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="flex-1 w-full relative">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                Organização Alvo
                            </label>
                            <select 
                                value={selectedOrgId}
                                onChange={(e) => setSelectedOrgId(e.target.value)}
                                disabled={isScanning}
                                className="w-full h-10 px-3 bg-white dark:bg-[#0A0A0C] border border-slate-300 dark:border-white/10 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                            >
                                <option value="" disabled>Selecione uma organization...</option>
                                {organizations.map((org: any) => (
                                    <option key={org.id} value={org.id}>{org.name || org.id}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="w-full sm:w-auto">
                            <button
                                onClick={handleScan}
                                disabled={!selectedOrgId || isScanning || approxCount === 0}
                                className="w-full h-10 px-6 bg-primary text-white rounded-lg font-medium text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                            >
                                {isScanning ? (
                                    <>
                                        <Spinner size="sm" />
                                        <span>Varrendo...</span>
                                    </>
                                ) : (
                                    'Iniciar Varredura'
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                        {loadingCount ? (
                            <span className="flex items-center gap-2"><Spinner size="sm" /> Calculando volume...</span>
                        ) : selectedOrgId ? (
                            <span>Aproximadamente <strong>{approxCount}</strong> músicas locais estimadas.</span>
                        ) : (
                            <span>Selecione para estimar o volume de músicas locas.</span>
                        )}
                    </div>
                </div>

                {errorMessage && (
                    <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm flex items-start gap-2 animate-in slide-in-from-top-2">
                        <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <span className="font-semibold block mb-0.5">Erro no processamento</span>
                            {errorMessage}
                        </div>
                    </div>
                )}

                {/* CTA Analyze */}
                {!isScanning && stats.na_caixa > 0 && (
                     <div className="p-4 flex-col sm:flex-row gap-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
                         <div className="text-sm text-blue-800 dark:text-blue-300 text-center sm:text-left">
                             Há <span className="font-bold">{stats.na_caixa} músicas</span> na fila aguardando curadoria.
                         </div>
                         <button 
                             onClick={handleAnalyzeNow}
                             disabled={isAnalyzing}
                             className="px-6 py-2.5 w-full sm:w-auto bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 active:scale-[0.98] shadow-sm transition-all"
                         >
                             {isAnalyzing ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" /> Analisando...</span> : `Analisar agora ${stats.na_caixa} músicas`}
                         </button>
                     </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-slate-200 dark:bg-white/10 border-b border-slate-200 dark:border-white/10">
                    <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                        <div className="text-2xl font-semibold text-slate-900 dark:text-white">{stats.examined}</div>
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">Examinadas</div>
                    </div>
                    {stats.na_caixa > 0 && (
                        <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                            <div className="text-2xl font-semibold text-blue-500">{stats.na_caixa}</div>
                            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">Na Caixa</div>
                        </div>
                    )}
                    {stats.ja_na_caixa > 0 && (
                        <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                            <div className="text-2xl font-semibold text-blue-400">{stats.ja_na_caixa}</div>
                            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">Já na Caixa</div>
                        </div>
                    )}
                    {(stats.inedita > 0 || stats.duplicada > 0 || stats.match_existente > 0) && (
                        <>
                            <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                                <div className="text-2xl font-semibold text-indigo-500">{stats.inedita}</div>
                                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">Inéditas</div>
                            </div>
                            <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                                <div className="text-2xl font-semibold text-amber-500">{stats.duplicada}</div>
                                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">Duplicadas</div>
                            </div>
                            <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                                <div className="text-2xl font-semibold text-green-500">{stats.match_existente}</div>
                                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">Matches</div>
                            </div>
                        </>
                    )}
                    {stats.dados_insuficientes > 0 && (
                        <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                            <div className="text-2xl font-semibold text-orange-500">{stats.dados_insuficientes}</div>
                            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">Insuficientes</div>
                        </div>
                    )}
                    <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                        <div className="text-2xl font-semibold text-slate-400">{stats.ignorada}</div>
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">Ignoradas</div>
                    </div>
                    <div className="bg-white dark:bg-[#1A1D24] p-4 text-center">
                        <div className="text-2xl font-semibold text-red-500">{stats.erro}</div>
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-1">Erros</div>
                    </div>
                </div>

                {/* Progress Bar during scan */}
                {isScanning && approxCount !== null && approxCount > 0 && (
                    <div className="h-1 bg-slate-100 dark:bg-white/5 w-full">
                        <div 
                            className="h-full bg-primary transition-all duration-300 ease-out"
                            style={{ width: `${Math.min(100, (stats.examined / approxCount) * 100)}%` }}
                        />
                    </div>
                )}

                {/* Filters */}
                <div className="flex gap-2 p-4 border-b border-slate-200 dark:border-white/10 overflow-x-auto hide-scrollbar bg-slate-50 dark:bg-white/[0.02]">
                    {[
                        { id: 'all', label: 'Todas' },
                        { id: 'inedita', label: 'Inéditas' },
                        { id: 'duplicada', label: 'Duplicadas' },
                        { id: 'match_existente', label: 'Matches' },
                        { id: 'dados_insuficientes', label: 'Dados Insuficientes' },
                        { id: 'na_caixa', label: 'Na Caixa' },
                        { id: 'ja_na_caixa', label: 'Já na Caixa' },
                        { id: 'ignorada', label: 'Ignoradas' },
                        { id: 'erro', label: 'Erros' }
                    ]
                    .filter(f => f.id === 'all' || (stats[f.id as keyof typeof stats] !== undefined && stats[f.id as keyof typeof stats] > 0))
                    .map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`flex items-center justify-center px-5 h-[44px] rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                                filter === f.id 
                                    ? 'bg-primary text-white shadow-sm' 
                                    : 'bg-white dark:bg-[#1A1D24] text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                             }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-4 pb-28 sm:pb-6 space-y-2 bg-slate-50 dark:bg-[#0A0A0C]">
                    {displayResults.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 py-12">
                            {isScanning ? (
                                <Spinner size="md" className="mb-4" />
                            ) : (
                                <svg className="w-12 h-12 mb-3 opacity-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
                            )}
                            <p className="text-sm">Nenhum resultado para exibir no momento.</p>
                        </div>
                    ) : (
                        displayResults.map((r, i) => (
                            <div key={`${r.id}-${i}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-[#1A1D24] rounded-xl border border-slate-200 dark:border-white/10 gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="truncate">{r.title}</span>
                                    </div>
                                    {r.artist && (
                                        <div className="text-xs text-slate-500 mt-1 truncate">
                                            {r.artist}
                                        </div>
                                    )}
                                    {r.errorMsg && (
                                        <div className="text-[11px] text-red-500 font-medium truncate mt-1" title={r.errorMsg}>
                                            Erro: {r.errorMsg}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className={`px-2.5 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${getClassificationColor(r.classification)}`}>
                                        {getClassificationLabel(r.classification)}
                                    </div>
                                    {r.candidateId && (
                                        <a href={`/curation/${r.candidateId}`} target="_blank" rel="noreferrer" className="flex items-center justify-center h-8 px-3 rounded text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0">
                                            Revisar ↗
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
