import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookOpenIcon } from "../components/icons/BookOpenIcon";
import Spinner from "../components/common/Spinner";
import { curationService } from "../services/curationService";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

import { CandidateDetailsModal } from '../components/curation/CandidateDetailsModal';
import { OrganizationScannerModal } from '../components/curation/OrganizationScannerModal';
import { InboxAnalysisModal } from '../components/curation/InboxAnalysisModal';
import { ImportCandidatesModal } from '../components/curation/ImportCandidatesModal';

export default function CurationPage() {
  const { isCurationAdmin, user } = useAuth();
  const { candidateId } = useParams<{ candidateId?: string }>();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // Reprocess state
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [inboxCount, setInboxCount] = useState<number>(0);

  const fetchInboxCount = async () => {
     try {
         const token = await user?.getIdToken();
         if (!token) return;
         const res = await fetch('/api/admin/inbox-count', {
             headers: { 'Authorization': `Bearer ${token}` }
         });
         if (res.ok) {
             const data = await res.json();
             setInboxCount(data.count || 0);
         }
     } catch (e) {}
  };

  const fetchCandidates = async (isLoadMore = false) => {
    if (!isLoadMore) {
        setLoading(true);
        setError(null);
    }
    
    try {
      const filters: any = {
           limitMsgs: 20,
           lastDoc: isLoadMore && lastDoc ? lastDoc : undefined
      };

      if (filter === 'all') {
           filters.status = 'all';
      } else if (filter === 'pending_review') {
           filters.status = 'pending_review';
      } else if (filter === 'likely_unique') {
           filters.classification = 'likely_unique';
      } else if (filter === 'possible_duplicate') {
           filters.classification = 'possible_duplicate';
      } else if (filter === 'matched_existing') {
           filters.classification = 'matched_existing';
      } else if (filter === 'insufficient_data') {
           filters.classification = 'insufficient_data';
      } else if (filter === 'processing_failed') {
           filters.status = 'processing_failed';
      }

      const res = await curationService.fetchCandidates(filters);

      if (isLoadMore) {
          setCandidates(prev => [...prev, ...res.candidates]);
      } else {
          setCandidates(res.candidates);
      }
      
      setLastDoc(res.lastDoc as any);
      setHasMore(res.hasMore);
    } catch (err: any) {
      console.error("Error fetching candidates", err);
      // Extrair link do erro se existir
      const linkMatch = typeof err?.message === 'string' ? err.message.match(/(https:\/\/console\.firebase\.google\.com[^\s]+)/) : null;
      if (linkMatch) {
          setError(`Falta de índice no Firestore. Clique para criar: ${linkMatch[1]}`);
      } else if (err?.message?.includes("index")) {
          setError("Falta de índice no banco de dados para este filtro. Ajuste no Firebase console.");
      } else {
          setError(err?.message || "Erro ao carregar candidatas.");
      }
    } finally {
      setLoading(false);
    }
  };

  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTarget, setImportTarget] = useState<'selected' | 'all'>('selected');

  useEffect(() => {
    setSelectedCandidateIds([]);
    setLastDoc(null);
    setCandidates([]);
    fetchCandidates(false);
    if (isCurationAdmin) {
       fetchInboxCount();
    }
  }, [filter, isCurationAdmin, user]);

  useEffect(() => {
    if (candidateId) {
      openDetails(candidateId);
    }
  }, [candidateId]);

  const openDetails = (id: string) => {
      setSelectedCandidateId(id);
  };

  const closeDetails = () => {
      setSelectedCandidateId(null);
      if (candidateId) {
          navigate('/curation');
      }
  };

  return (
    <div className="space-y-6 animate-fade-in relative max-w-5xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Curadoria da Biblioteca
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Analise e processe as músicas submetidas pelas organizações.
        </p>

        {isCurationAdmin && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button 
              onClick={() => setShowAnalysisModal(true)}
              className="px-4 py-2 bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-sm font-semibold rounded-lg hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors shadow-sm"
              disabled={loading}
            >
              Analisar novas músicas {inboxCount > 0 ? `(${inboxCount})` : ''}
            </button>
            <button 
              onClick={async () => {
                if (window.confirm("Isso reprocessará candidatos (isso pode demorar). Deseja continuar?")) {
                  try {
                    setLoading(true);
                    const token = await user?.getIdToken();
                    if (!token) throw new Error("Sessão inválida. Entre novamente para continuar.");
                    const res = await fetch('/api/admin/reanalyze-candidates', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const dat = await res.json();
                    if (dat.success) {
                      alert(`Reanálise concluída! ${dat.result.reanalyzed} candidatas processadas.`);
                      fetchCandidates();
                    } else {
                      alert(`Erro: ${dat.error}`);
                    }
                  } catch(e: any) {
                    alert(e.message);
                  } finally {
                    setLoading(false);
                  }
                }
              }}
              className="px-4 py-2 bg-amber-600/10 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500 text-sm font-semibold rounded-lg hover:bg-amber-600/20 transition-colors shadow-sm"
              disabled={loading}
            >
              Reanalisar classificações
            </button>
            <button 
              onClick={() => setShowScannerModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition-colors shadow-sm"
            >
              Varrer repertório de uma organização
            </button>
            <button 
              onClick={async () => {
                if (window.confirm("Isso reprocessará todas as músicas da Biblioteca Viva para garantir a normalização. Deseja continuar?")) {
                  try {
                    setLoading(true);
                    const token = await user?.getIdToken();
                    if (!token) throw new Error("Sessão inválida. Entre novamente para continuar.");
                    const res = await fetch('/api/admin/backfill-global-titles', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const dat = await res.json();
                    if (dat.success) {
                      alert(`Backfill concluído! ${dat.result.updated} atualizadas de ${dat.result.processed} verificadas.`);
                    } else {
                      alert(`Erro: ${dat.error}`);
                    }
                  } catch(e: any) {
                    alert(e.message);
                  } finally {
                    setLoading(false);
                  }
                }
              }}
              className="px-4 py-2 bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-500 text-sm font-semibold rounded-lg hover:bg-emerald-600/20 transition-colors shadow-sm"
              disabled={loading}
            >
              Corrigir Antigas
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
         <div className="flex bg-white dark:bg-[#1A1A1A] p-1 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-x-auto w-full sm:w-auto">
             {["all", "pending_review", "likely_unique", "possible_duplicate", "matched_existing", "insufficient_data", "processing_failed"].map(f => (
                 <button 
                     key={f}
                     onClick={() => setFilter(f)}
                     className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === f ? "bg-primary text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5"}`}
                 >
                     {f === "all" ? "Todas" : 
                      f === "pending_review" ? "Aguardando Revisão" : 
                      f === "likely_unique" ? "Provável Inédita" :
                      f === "matched_existing" ? "Match Existente" :
                      f === "insufficient_data" ? "Dados Insuficientes" :
                      f === "processing_failed" ? "Falha no processamento" : "Possível Duplicada"}
                 </button>
             ))}
         </div>
      </div>

      {filter === 'likely_unique' && !loading && (
          <div className="bg-white dark:bg-[#1A1D24] p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 scale-in">
              <div className="flex flex-wrap gap-2 items-center">
                  <button 
                      onClick={() => {
                          const pageIds = candidates.map(c => c.candidateId);
                          const newSelection = [...new Set([...selectedCandidateIds, ...pageIds])];
                          setSelectedCandidateIds(newSelection);
                      }}
                      className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors border border-transparent dark:border-white/5"
                  >
                      Selecionar página
                  </button>
                  <button 
                      onClick={() => {
                           setSelectedCandidateIds([]);
                      }}
                      className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors"
                  >
                      Limpar seleção
                  </button>
                  <span className="text-sm font-medium text-slate-500 ml-2">
                       {selectedCandidateIds.length} selecionadas
                  </span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                  <button 
                      onClick={() => {
                          if (selectedCandidateIds.length === 0) return;
                          setImportTarget('selected');
                          setShowImportModal(true);
                      }}
                      disabled={selectedCandidateIds.length === 0}
                      className="px-4 py-2 text-sm font-bold text-white bg-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 rounded-xl transition-all shadow-sm"
                  >
                      Importar selecionadas
                  </button>
                  <button 
                      onClick={() => {
                          setImportTarget('all');
                          setShowImportModal(true);
                      }}
                      className="px-4 py-2 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-all shadow-sm"
                  >
                      Importar todas as elegíveis
                  </button>
              </div>
          </div>
      )}

      {error ? (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
              <p className="text-red-600 dark:text-red-400 font-medium">
                {error.includes("http") ? (
                  <>
                    Falta de índice no Firestore. <a href={error.split("criar: ")[1]} target="_blank" rel="noopener noreferrer" className="underline font-bold text-red-700 dark:text-red-300">Clique aqui para criar no Console</a>.
                  </>
                ) : (
                  error
                )}
              </p>
              <button onClick={() => fetchCandidates()} className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm">Tentar Novamente</button>
          </div>
      ) : loading && !candidates.length ? (
          <div className="flex justify-center p-12">
              <Spinner size="lg" />
          </div>
      ) : candidates.length === 0 ? (
          <div className="bg-white/50 dark:bg-[#1A1A1A]/50 border border-slate-200 dark:border-white/10 p-12 rounded-3xl flex flex-col items-center text-center">
              <BookOpenIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhuma candidata</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  Não encontramos nenhuma música enviada para curadoria com este filtro.
              </p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {candidates.map(candidate => {
                  const statusLabel = candidate.status === 'approved' ? 'Aprovada' :
                                      candidate.status === 'linked' ? 'Vinculada' :
                                      candidate.classification === 'matched_existing' ? 'Match existente' :
                                      candidate.classification === 'likely_unique' ? 'Provável inédita' :
                                      candidate.classification === 'possible_duplicate' ? 'Possível duplicada' :
                                      candidate.classification === 'insufficient_data' ? 'Dados insuficientes' :
                                      candidate.status === 'processing_failed' ? 'Falha' :
                                      candidate.status === 'pending_review' ? 'Aguardando revisão' :
                                      candidate.classification;

                  const isSelected = selectedCandidateIds.includes(candidate.candidateId);
                  const isSelectable = filter === 'likely_unique' && candidate.classification === 'likely_unique';

                  return (
                  <div key={candidate.candidateId} className={`relative bg-white dark:bg-[#1A1A1A] border ${isSelected ? 'border-primary ring-1 ring-primary' : 'border-slate-200 dark:border-white/10'} rounded-2xl p-5 hover:border-primary/50 transition-colors shadow-sm flex flex-col justify-between group`}>
                      {isSelectable && (
                          <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                              <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={(e) => {
                                      if (e.target.checked) {
                                          setSelectedCandidateIds(prev => [...prev, candidate.candidateId]);
                                      } else {
                                          setSelectedCandidateIds(prev => prev.filter(id => id !== candidate.candidateId));
                                      }
                                  }}
                                  className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                              />
                          </div>
                      )}
                      <div className="cursor-pointer" onClick={() => openDetails(candidate.candidateId)}>
                          <div className={`flex justify-between items-start mb-3 ${isSelectable ? 'pr-8' : ''}`}>
                              <div className="space-y-1 w-full">
                                  <h3 className="font-bold text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors line-clamp-1 flex items-center gap-2">
                                      <span>{candidate.title}</span>
                                      {candidate.errorMsg && <span className="text-[10px] text-red-500 font-normal px-2 bg-red-50 dark:bg-white/5 rounded" title={candidate.errorMsg}>{candidate.errorMsg}</span>}
                                  </h3>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{candidate.artist}</p>
                              </div>
                          </div>
                          <div>
                              <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${['matched_existing', 'linked', 'approved'].includes(candidate.classification) || ['approved', 'linked'].includes(candidate.status) ? 'bg-green-500/10 text-green-500' : candidate.classification === 'possible_duplicate' || candidate.status === 'processing_failed' ? 'bg-amber-500/10 text-amber-500' : candidate.classification === 'likely_unique' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'}`}>
                                 {statusLabel}
                              </span>
                          </div>
                      </div>

                      <div className="space-y-3 cursor-pointer" onClick={() => openDetails(candidate.candidateId)}>
                          {/* Tags: Tom, BPM, Idioma */}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                             {candidate.analysisSummary?.metrics?.mostCommonKey && (
                                 <span className="bg-white/[0.04] border border-white/10 rounded px-2 py-0.5 text-[10px] font-mono text-slate-400">Tom: {candidate.analysisSummary.metrics.mostCommonKey}</span>
                             )}
                             {candidate.analysisSummary?.metrics?.avgBpm > 0 && (
                                 <span className="bg-white/[0.04] border border-white/10 rounded px-2 py-0.5 text-[10px] font-mono text-slate-400">BPM: {Math.round(candidate.analysisSummary.metrics.avgBpm)}</span>
                             )}
                          </div>
                          
                          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap pt-3 border-t border-slate-100 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400">
                              <div>
                                  <span className="font-medium text-slate-700 dark:text-slate-300">{candidate.occurrenceCount || 1}</span>
                                  <span className="ml-1 opacity-80">ocorrências / {candidate.organizationCount || 1} orgs</span>
                              </div>
                              <div className="flex-1">
                                  <span className="opacity-80">
                                      Descoberta em {candidate.firstDiscoveredAt 
                                        ? new Date(candidate.firstDiscoveredAt).toLocaleDateString()
                                        : 'Recente'}</span>
                              </div>
                              {candidate.analysisSummary?.exactMatchScore > 0 && (
                                   <div className="text-primary font-bold">
                                      Score: {(candidate.analysisSummary.exactMatchScore * 100).toFixed(0)}%
                                   </div>
                              )}
                              {candidate.analysisSummary?.warningCodes?.length > 0 && (
                                  <div className="text-amber-500 flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                      <span className="font-medium">Busca Limitada</span>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
                  );
              })}
          </div>
      )}

      {hasMore && candidates.length > 0 && !loading && (
          <div className="flex justify-center pt-4">
              <button 
                  onClick={() => fetchCandidates(true)}
                  className="px-6 py-2.5 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
               >
                  Carregar Mais
              </button>
          </div>
      )}
      
      {loading && candidates.length > 0 && (
          <div className="flex justify-center p-4">
              <Spinner size="md" />
          </div>
      )}

      {/* Details Modal */}
      {selectedCandidateId && (
         <CandidateDetailsModal 
            candidateId={selectedCandidateId} 
            onClose={closeDetails} 
            onApproveSuccess={(id) => {
                setCandidates(prev => prev.map(c => c.candidateId === id ? { ...c, status: 'approved' } : c));
            }}
            onLinkSuccess={(id) => {
                setCandidates(prev => prev.map(c => c.candidateId === id ? { ...c, status: 'linked' } : c));
            }}
            onRejectSuccess={(id) => {
                setCandidates(prev => prev.map(c => c.candidateId === id ? { ...c, status: 'rejected' } : c));
            }}
         />
      )}

      {showScannerModal && (
          <OrganizationScannerModal onClose={() => {
              setShowScannerModal(false);
              fetchInboxCount();
          }} />
      )}

      {showAnalysisModal && (
          <InboxAnalysisModal 
              initialInboxCount={inboxCount}
              onClose={() => {
                  setShowAnalysisModal(false);
                  fetchInboxCount();
                  fetchCandidates(false); // Refresh candidates after analysis
              }} 
          />
      )}

      {showImportModal && (
          <ImportCandidatesModal
              target={importTarget}
              selectedCandidateIds={selectedCandidateIds}
              onClose={() => setShowImportModal(false)}
              onSuccess={() => {
                  setShowImportModal(false);
                  setSelectedCandidateIds([]);
                  fetchCandidates(false);
              }}
          />
      )}
    </div>
  );
}