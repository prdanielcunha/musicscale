import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import { Loader2, Search, Building2, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";
import { collection, query, getDocs, limit, where, writeBatch, doc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";
import type { GlobalSong } from "../../types";

interface AdminCrossOrgImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  songsToImport: GlobalSong[];
  onSuccess: () => void;
}

export const AdminCrossOrgImportModal: React.FC<AdminCrossOrgImportModalProps> = ({
  isOpen,
  onClose,
  songsToImport,
  onSuccess
}) => {
  const { user, userProfile } = useAuth();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);
  
  const [isPrechecking, setIsPrechecking] = useState(false);
  const [duplicates, setDuplicates] = useState<{ id: string, title: string, artist?: string }[]>([]);
  const [allowDuplicatesOption, setAllowDuplicatesOption] = useState<boolean>(false);

  const [isConfirming, setIsConfirming] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number, skipped: number, message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedOrg(null);
      setIsConfirming(false);
      setIsPrechecking(false);
      setDuplicates([]);
      setAllowDuplicatesOption(false);
      setResult(null);
      setError(null);
      fetchOrganizations();
    }
  }, [isOpen]);

  const fetchOrganizations = async () => {
    setLoading(true);
    let success = false;
    
    try {
      const { collection, getDocs, limit, query } = await import('firebase/firestore');
      const { db } = await import('../../services/firebase');
      const orgsSnap = await getDocs(query(collection(db, "organizations"), limit(200)));
      if (!orgsSnap.empty) {
        setOrganizations(orgsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        success = true;
      }
    } catch (directErr) {
      console.warn("Frontend client-side organizations fetch failed", directErr);
    }

    if (!success) {
      try {
        const token = await user?.getIdToken();
        const response = await fetch("/api/admin/organizations", {
          headers: {
              "Authorization": `Bearer ${token}`
          }
        });
        if (response.ok) {
           const data = await response.json();
           setOrganizations(data.organizations || []);
        }
      } catch (e) {
        console.error("Failed to load orgs", e);
      }
    }

    setLoading(false);
  };

  const filteredOrgs = organizations.filter(org => {
     if (!searchTerm) return true;
     const term = searchTerm.toLowerCase();
     return org.name?.toLowerCase().includes(term) || 
            org.id?.toLowerCase().includes(term) || 
            org.ownerEmail?.toLowerCase().includes(term);
  });

  const handleProceedToConfirm = async () => {
    if (!selectedOrg) return;
    setIsPrechecking(true);
    setError(null);
    try {
      const { collection, query, where, getDocs } = await import("firebase/firestore");
      const { db } = await import("../../services/firebase");
      const songsRef = collection(db, "songs");
      const q = query(songsRef, where("organizationId", "==", selectedOrg.id));
      const snapshot = await getDocs(q);
      
      const existingIds = new Set(snapshot.docs.map(doc => doc.data().originGlobalSongId).filter(id => !!id));
      const foundDuplicates = songsToImport.filter(s => existingIds.has(s.id)).map(s => ({ id: s.id, title: s.title, artist: s.artist }));
      setDuplicates(foundDuplicates);
      setAllowDuplicatesOption(false);
      setIsConfirming(true);
    } catch (clientErr) {
        console.warn("Client side duplicate check failed, using backend", clientErr);
        try {
            const token = await user?.getIdToken();
            const response = await fetch("/api/admin/musicscale/library/import-to-organization", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                targetOrganizationId: selectedOrg.id,
                globalSongIds: songsToImport.map(s => s.id),
                checkOnly: true
              })
            });

            const data = await response.json();
            if (response.ok && data.success) {
              setDuplicates(data.duplicates || []);
              setAllowDuplicatesOption(false);
              setIsConfirming(true);
            } else {
              setError(data.error || "Erro ao verificar duplicidade das músicas.");
            }
          } catch (e) {
            console.error(e);
            setError("Erro ao se conectar com o servidor para realizar a pré-verificação.");
          }
      } finally {
      setIsPrechecking(false);
    }
  };

  const performClientSideImport = async () => {
    try {
      try {
        const token = await user?.getIdToken();
        const response = await fetch("/api/admin/musicscale/library/import-to-organization", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            targetOrganizationId: selectedOrg.id,
            globalSongIds: songsToImport.map(s => s.id),
            allowDuplicates: allowDuplicatesOption
          })
        });

        const data = await response.json();
        if (response.ok && data.success) {
          setResult({
            imported: data.importedCount,
            skipped: data.skippedCount,
            message: "Importação concluída com sucesso via API."
          });
          return;
        }
      } catch(apiErr) {
          console.warn("API direct import failed, falling back to Client-SDK batch writes", apiErr);
      }

      // fallback to client SDK
      const { collection, getDocs, query, where, writeBatch, doc, serverTimestamp, increment } = await import("firebase/firestore");
      const { db } = await import("../../services/firebase");
      
      const songsRef = collection(db, "songs");
      const q = query(songsRef, where("organizationId", "==", selectedOrg.id));
      const snapshot = await getDocs(q);
      
      const existingIds = new Set(snapshot.docs.map(doc => doc.data().originGlobalSongId).filter(id => !!id));

      let songsToLoad = [];
      let skippedCount = 0;

      if (allowDuplicatesOption) {
        songsToLoad = songsToImport;
      } else {
        songsToLoad = songsToImport.filter(s => !existingIds.has(s.id));
        skippedCount = songsToImport.length - songsToLoad.length;
      }

      if (songsToLoad.length === 0) {
        setResult({
          imported: 0,
          skipped: skippedCount,
          message: "Todas as músicas selecionadas já existem nesta organização."
        });
        return;
      }

      const batch = writeBatch(db);

      songsToLoad.forEach(globalSong => {
        const newSongRef = doc(collection(db, "songs"));
        batch.set(newSongRef, {
          title: globalSong.title,
          artist: globalSong.artist || "",
          key: globalSong.key || "",
          bpm: globalSong.bpm || 0,
          status: "active",
          tagIds: [],
          lyrics: globalSong.lyrics || "",
          chords: globalSong.chords || "",
          chordsUrl: globalSong.chordsUrl || "",
          videoUrl: globalSong.videoUrl || "",
          language: globalSong.language || "pt",
          organizationId: selectedOrg.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastPlayed: null,
          createdBy: {
            uid: user?.uid || "",
            displayName: "Admin do Ecossistema",
            photoURL: user?.photoURL || null,
          },
          originGlobalSongId: globalSong.id,
          importedBy: user?.uid || "",
          importedBySystemRole: 'admin',
          importedByAdminCrossOrg: true,
          usageConsumed: false,
          source: "admin_cross_org_library_import_client",
        });

        const globalSongRef = doc(db, "globalSongs", globalSong.id);
        batch.update(globalSongRef, { importCount: increment(1) });
      });

      const masterAuditRef = doc(collection(db, "audit_logs"));
      batch.set(masterAuditRef, {
        action: "musicscale.library.import_to_organization",
        actorUid: user?.uid || "",
        actorEmail: user?.email || "",
        targetOrganizationId: selectedOrg.id,
        targetOrganizationName: selectedOrg.name || "Desconhecida",
        globalSongIds: songsToLoad.map(s => s.id),
        importedCount: songsToLoad.length,
        skippedCount,
        failedCount: 0,
        consumedUsage: false,
        source: "admin_cross_org_library_import_client",
        createdAt: serverTimestamp()
      });

      await batch.commit();

      setResult({
        imported: songsToLoad.length,
        skipped: skippedCount,
        message: "Importação concluída com sucesso diretamente pelo Client-SDK de Administrador."
      });

    } catch (err: any) {
      console.error("API & Client Fallback import failed:", err);
      setError(err.message || "Erro na importação: verifique o console.");
    }
  };

  const handleImport = async () => {
    if (!selectedOrg) return;
    setIsImporting(true);
    setError(null);
    try {
        await performClientSideImport();
    } catch (e: any) {
        console.error(e);
        setError("Erro na importação: " + (e.message || String(e)));
    } finally {
        setIsImporting(false);
    }
  };

  if (result) {
      return (
          <Modal isOpen={isOpen} onClose={onClose}>
             <div className="p-6 bg-white dark:bg-[#111111] max-w-lg mx-auto rounded-3xl border border-black/5 dark:border-white/5 font-sans relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full" />
                
                <div className="relative z-10 text-center space-y-6 pt-4 pb-2">
                    <div className="mx-auto w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Importação Concluída</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            {result.imported} {result.imported === 1 ? 'música foi injetada' : 'músicas foram injetadas'} na organização <strong className="text-emerald-500">{selectedOrg?.name}</strong>.
                        </p>
                        {result.skipped > 0 && (
                            <p className="text-amber-500 text-sm font-medium mt-2">
                                {result.skipped} {result.skipped === 1 ? 'foi ignorada' : 'foram ignoradas'} por já existirem no repertório destino.
                            </p>
                        )}
                    </div>
                    
                    <button 
                       onClick={onSuccess}
                       className="mt-6 w-full py-4 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold tracking-wider uppercase text-sm hover:-translate-y-0.5 transition-all"
                    >
                       Fechar
                    </button>
                </div>
             </div>
          </Modal>
      );
  }

  if (isConfirming && selectedOrg) {
     return (
         <Modal isOpen={isOpen} onClose={onClose}>
             <div className="p-6 bg-white dark:bg-[#111111] max-w-lg mx-auto rounded-3xl border border-black/5 dark:border-white/5 font-sans relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-3xl rounded-full" />
                
                <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Confirmar Ação Administrativa</h2>
                            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest mt-1">Cross-Org Import</p>
                        </div>
                    </div>
                    
                    <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                        <p>
                            Você está prestes a transferir <strong>{songsToImport.length} música(s)</strong> do acervo global diretamente para a seguinte organização:
                        </p>
                        <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                            <div className="font-medium text-slate-900 dark:text-white text-base truncate">{selectedOrg.name}</div>
                            <div className="text-xs text-slate-400 font-mono mt-1">ID: {selectedOrg.id}</div>
                            {selectedOrg.plan && <div className="text-[10px] uppercase font-bold text-blue-500 mt-2">Plano: {selectedOrg.plan}</div>}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed border-l-2 border-emerald-500 pl-3">
                            Esta é uma operação sistêmica segura. O limite de importação mensal desta organização cliente <strong>NÃO</strong> será consumido e nenhuma cobrança ou flag cross-tenant visível será ativada, exceto um registro interno de log de auditoria.
                        </p>
                    </div>

                    {/* Duplicates Section */}
                    {duplicates.length > 0 ? (
                        <div className="bg-amber-500/10 dark:bg-amber-500/5 p-5 rounded-2xl border border-amber-500/20 space-y-4">
                            <div className="flex items-start gap-2.5 text-amber-600 dark:text-amber-400">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-bold text-sm">Músicas já existentes na organização ({duplicates.length})</div>
                                    <p className="text-xs text-amber-500/80 leading-snug mt-0.5">
                                        As seguintes de suas músicas selecionadas já constam no repertório de <strong>{selectedOrg.name}</strong>:
                                    </p>
                                </div>
                            </div>
                            
                            <div className="max-h-24 overflow-y-auto pr-1 space-y-1 bg-amber-500/5 dark:bg-black/20 p-2.5 rounded-xl border border-amber-500/10 font-mono text-[11px] text-amber-700 dark:text-amber-300">
                                {duplicates.map(song => (
                                    <div key={song.id} className="flex justify-between gap-1 border-b border-amber-500/10 pb-1 last:border-none last:pb-0">
                                        <span className="truncate font-semibold">{song.title}</span>
                                        {song.artist && <span className="opacity-60 truncate text-[10px] shrink-0 font-sans">{song.artist}</span>}
                                    </div>
                                ))}
                            </div>

                            <div className="pt-2 space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Opção de Importação:</label>
                                
                                <div className="grid grid-cols-1 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAllowDuplicatesOption(false)}
                                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${!allowDuplicatesOption ? 'bg-amber-500/20 border-amber-500/50 text-amber-900 dark:text-amber-200 shadow-sm' : 'bg-transparent border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-900'}`}
                                    >
                                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${!allowDuplicatesOption ? 'border-amber-500 text-amber-500' : 'border-slate-400'}`}>
                                            {!allowDuplicatesOption && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold">Pular músicas repetidas (Recomendado)</div>
                                            <p className="text-[10px] opacity-80 mt-0.5">Importa apenas as músicas inéditas. Evita poluir o repertório.</p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setAllowDuplicatesOption(true)}
                                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${allowDuplicatesOption ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-900 dark:text-indigo-200 shadow-sm' : 'bg-transparent border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-900'}`}
                                    >
                                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${allowDuplicatesOption ? 'border-indigo-500 text-indigo-500' : 'border-slate-400'}`}>
                                            {allowDuplicatesOption && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold">Importar duplicadas mesmo assim</div>
                                            <p className="text-[10px] opacity-80 mt-0.5 font-sans">Força a importação de tudo, criando novas cópias independentes.</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-emerald-500/10 dark:bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                            <div>
                                <span className="font-bold">Nenhuma música repetida:</span> Todas as {songsToImport.length} músicas selecionadas são novas no repertório desta organização de destino!
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2 animate-fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button 
                           onClick={() => {
                               setIsConfirming(false);
                               setDuplicates([]);
                           }}
                           className="flex-1 py-4 font-bold text-sm rounded-xl text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-400 transition-colors"
                        >
                            Voltar
                        </button>
                        <button 
                           onClick={handleImport}
                           disabled={isImporting}
                           className="flex flex-[2] items-center justify-center gap-2 py-4 rounded-xl bg-amber-500 text-white font-bold tracking-wide text-sm shadow-xl shadow-amber-500/10 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                        >
                           {isImporting ? <Loader2 className="w-5 h-5 animate-spin"/> : "Injetar Músicas"}
                        </button>
                    </div>
                </div>
             </div>
         </Modal>
     );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
        <div className="p-0 bg-white dark:bg-[#111111] max-w-2xl mx-auto rounded-[32px] font-sans flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-6 shrink-0 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Importar para Organização</h2>
                        <p className="text-xs text-slate-500 font-medium">{songsToImport.length} música(s) selecionada(s)</p>
                    </div>
                </div>
                
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                       type="text" 
                       placeholder="Buscar por nome, id, email..."
                       className="w-full bg-slate-50 dark:bg-[#1A1A1C] border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-indigo-500"
                       value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
                {loading ? (
                    <div className="flex items-center justify-center py-12 text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : filteredOrgs.length > 0 ? (
                    <div className="space-y-1">
                        {filteredOrgs.map(org => (
                            <button
                                key={org.id}
                                onClick={() => setSelectedOrg(org)}
                                className={`w-full text-left p-4 rounded-2xl transition-all border ${selectedOrg?.id === org.id ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500/30' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className={`font-bold ${selectedOrg?.id === org.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                                            {org.name}
                                        </div>
                                        <div className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2">
                                            {org.id}
                                        </div>
                                        {org.ownerEmail && (
                                            <div className="text-xs text-slate-500 mt-1">{org.ownerEmail}</div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {org.plan ? (
                                            <span className="text-[10px] uppercase font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
                                                {org.plan}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Starter</span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="py-12 text-center text-slate-500 text-sm">
                        Nenhuma organização encontrada.
                        {/* Fallback manual se a API não retornar ou admin não tiver fetch */}
                        <div className="mt-8 px-6 text-left">
                           <p className="text-xs font-bold uppercase mb-2">Entrada Manual (Fallback)</p>
                           <input 
                              type="text" 
                              placeholder="targetOrganizationId" 
                              className="w-full bg-slate-100 dark:bg-zinc-800 rounded-xl p-3 text-xs mb-2 outline-none focus:ring-1 ring-blue-500"
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                      setSelectedOrg({ id: e.currentTarget.value, name: "Org ID inserido manualmente", plan: "unknown" });
                                  }
                              }}
                           />
                           <p className="text-[10px] text-slate-400">Pressione Enter para selecionar.</p>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="px-6 pt-4">
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2 animate-fade-in">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                        <span>{error}</span>
                    </div>
                </div>
            )}
            
            <div className="shrink-0 p-6 border-t border-black/5 dark:border-white/5 flex gap-3">
                <button 
                    disabled={isPrechecking}
                    onClick={onClose}
                    className="py-3 px-6 rounded-xl text-slate-500 font-bold text-sm bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 disabled:opacity-50"
                >
                    Cancelar
                </button>
                <button 
                    disabled={!selectedOrg || isPrechecking}
                    onClick={handleProceedToConfirm}
                    className="flex-1 py-3 px-6 rounded-xl text-white font-bold text-sm bg-black hover:bg-indigo-600 dark:bg-white dark:text-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isPrechecking ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Verificando Duplicadas...
                        </>
                    ) : (
                        "Prosseguir com Selecionada"
                    )}
                </button>
            </div>
        </div>
    </Modal>
  );
}
