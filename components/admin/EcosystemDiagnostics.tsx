import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, setDoc, collection, addDoc, query, where, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { UserSelector } from "./UserSelector";

export const OrgDiagnosisModal = ({ org, onClose, onRepaired }: { org: any, onClose: () => void, onRepaired: () => void }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [repairing, setRepairing] = useState(false);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [previewAction, setPreviewAction] = useState<any>(null);

  useEffect(() => { runDiagnostic(); }, [org]);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const results: any = { issues: [], status: "Saudável" };
      const orgRef = doc(db, "organizations", org.id);
      const orgSnap = await getDoc(orgRef);
      
      if (!orgSnap.exists()) {
        results.issues.push("Documento da organização ausente no Firestore.");
        results.status = "Crítico";
      } else {
        const data = orgSnap.data();
        if (!data.name) results.issues.push("Nome da organização não definido.");
        if (!data.slug) results.issues.push("Slug da organização não definido.");
        
        // Owner checks
        if (!data.ownerUserId) {
          results.issues.push("Dono (ownerUserId) não definido na organização.");
          if (results.status !== "Crítico") results.status = "Atenção";
        } else {
          // Check user doc
          const userSnap = await getDoc(doc(db, "users", data.ownerUserId));
          if (!userSnap.exists()) {
            results.issues.push("Usuário dono não encontrado em /users.");
            results.status = "Crítico";
          } else {
            const userData = userSnap.data();
            if (userData.organizationId !== org.id) {
              results.issues.push(`organizationId do dono aponta para '${userData.organizationId}', não para '${org.id}'.`);
              if (results.status !== "Crítico") results.status = "Atenção";
            }
          }
          // Check membership
          const memberSnap = await getDoc(doc(db, "organizations", org.id, "members", data.ownerUserId));
          if (!memberSnap.exists()) {
            results.issues.push("Dono não possui documento de membership.");
            if (results.status !== "Crítico") results.status = "Atenção";
          }
        }
        
        // Plan checks
        const plan = data.plan?.toLowerCase() || "";
        if (plan === "monthly" || plan === "yearly") {
          results.issues.push(`Plano configurado incorretamente como billingInterval ('${plan}').`);
          if (results.status !== "Crítico") results.status = "Reparável";
        }
        
        // Musicscale app check
        if (!data.apps?.musicscale?.status) {
           results.issues.push("Estrutura mínima do MusicScale ausente no tenant.");
        }
      }
      
      if (results.issues.length > 0 && results.status === "Saudável") {
          results.status = "Atenção";
      }

      setDiagnostic(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleShowFixPlanPreview = async () => {
    const orgSnap = await getDoc(doc(db, "organizations", org.id));
    const data = orgSnap.data();
    if (!data) return;
    
    const isMonthly = data.plan?.toLowerCase() === "monthly";
    const isYearly = data.plan?.toLowerCase() === "yearly";

    let realPlan = "starter";
    if (data.subscriptionPlan && !["monthly", "yearly"].includes(data.subscriptionPlan.toLowerCase())) {
        realPlan = data.subscriptionPlan.toLowerCase();
    } else if (data.apps?.musicscale?.plan && !["monthly", "yearly"].includes(data.apps.musicscale.plan.toLowerCase())) {
        realPlan = data.apps.musicscale.plan.toLowerCase();
    }

    setPreviewAction({
        type: "FIX_PLAN",
        title: "Normalizar Plano",
        changes: [
            `- plan: "${data.plan}" -> "${realPlan}"`,
            `- billingInterval: criado como "${isMonthly ? "monthly" : "yearly"}"`
        ],
        payload: {
            plan: realPlan,
            billingInterval: isMonthly ? "monthly" : "yearly",
            updatedAt: new Date().toISOString()
        }
    });
  };

  const handleShowLinkOwnerPreview = async (selectedUser: any) => {
    setShowUserSelector(false);
    
    let changes = [
        `ORG: ownerUserId -> "${selectedUser.id}"`,
        `ORG: ownerEmail -> "${selectedUser.email}"`,
        `ORG: updatedAt -> serverTimestamp()`,
        `MEMBERSHIP: Criar/atualizar role 'owner' para "${selectedUser.id}"`,
        `USER: organizationId -> "${org.id}"`
    ];

    if (org.ownerUserId) {
        changes.unshift(`⚠️ AVISO: Esta organização já tem um dono (${org.ownerUserId}). Ele será substituído.`);
    }

    if (selectedUser.organizationId && selectedUser.organizationId !== org.id) {
        changes.unshift(`⚠️ AVISO: Usuário já possui org principal (${selectedUser.organizationId}). O vínculo principal será alterado.`);
    }

    setPreviewAction({
        type: "LINK_OWNER",
        title: "Confirmar vínculo de dono",
        changes,
        payload: {
            targetUid: selectedUser.id,
            targetEmail: selectedUser.email,
            targetName: selectedUser.displayName || "",
            currentOrgId: selectedUser.organizationId
        }
    });
  };

  const handleShowCreateMusicScalePreview = async () => {
      setPreviewAction({
        type: "CREATE_MUSICSCALE",
        title: "Estrutura Mínima MusicScale",
        changes: [
            `ORG: apps.musicscale.status -> "active"`,
            `ORG: apps.musicscale.plan -> "<plan_atual>"`,
            `ORG: onboardingCompleted -> true`
        ]
      });
  };

  const handleShowRepairAllPreview = async () => {
    // Collect all fixes
    setPreviewAction({
        type: "REPAIR_ALL",
        title: "Reparar Tudo Automaticamente",
        changes: [
            `Normalizar plano comercial`,
            `Criar Estrutura Mínima MusicScale`,
            `Garantir timestamp de atualização`
        ]
    });
  };

  const applyPreviewAction = async () => {
      if (!previewAction) return;
      setRepairing(true);
      try {
          const batch = writeBatch(db);
          const orgRef = doc(db, "organizations", org.id);
          const timestamp = new Date().toISOString();

          let logDetails = "";

          if (previewAction.type === "FIX_PLAN") {
              batch.update(orgRef, previewAction.payload);
              logDetails = `Normalizou plano para ${previewAction.payload.plan}`;
          } 
          else if (previewAction.type === "LINK_OWNER") {
              throw new Error("OWNER_LINK_REQUIRES_MILLIONSNEST_HUB");
          }
          else if (previewAction.type === "CREATE_MUSICSCALE") {
              const orgSnap = await getDoc(orgRef);
              const plan = orgSnap.data()?.plan || "starter";
              batch.update(orgRef, {
                  "apps.musicscale": {
                      status: "active",
                      plan: plan,
                      installedAt: timestamp
                  },
                  onboardingCompleted: true,
                  updatedAt: timestamp,
                  repairedAt: timestamp,
                  repairedBy: user?.uid || ""
              });
              logDetails = `Criou estrutura mínima MusicScale.`;
          }
          else if (previewAction.type === "REPAIR_ALL") {
              const orgSnap = await getDoc(orgRef);
              const data = orgSnap.data() || {};
              
              // Normalize plan
              let realPlan = "starter";
              const isMonthly = data.plan?.toLowerCase() === "monthly";
              if (data.subscriptionPlan && !["monthly", "yearly"].includes(data.subscriptionPlan.toLowerCase())) {
                  realPlan = data.subscriptionPlan.toLowerCase();
              } else if (data.apps?.musicscale?.plan && !["monthly", "yearly"].includes(data.apps.musicscale.plan.toLowerCase())) {
                  realPlan = data.apps.musicscale.plan.toLowerCase();
              }
              
              // Apply all
              batch.update(orgRef, {
                  plan: realPlan,
                  billingInterval: isMonthly ? "monthly" : "yearly",
                  "apps.musicscale": {
                      status: "active",
                      plan: realPlan,
                      installedAt: timestamp
                  },
                  onboardingCompleted: true,
                  updatedAt: timestamp,
                  repairedAt: timestamp,
                  repairedBy: user?.uid || ""
              });
              logDetails = `Reparou todas as inconsistências não-destrutivas (Plano, MusicScale).`;
          }

          await batch.commit();
          
          await addDoc(collection(db, "system_audit_logs"), {
              action: `REPARO_ORG_${previewAction.type}`,
              actorUid: user?.uid,
              actorEmail: user?.email,
              targetOrganizationId: org.id,
              timestamp,
              details: logDetails
          });

          setPreviewAction(null);
          await runDiagnostic();
          onRepaired();
      } catch (e) {
          console.error(e);
          alert("Erro ao aplicar reparo.");
      } finally {
          setRepairing(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Diagnóstico de Organização</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white px-2">X</button>
        </div>
        
        <div className="mb-4">
            <h3 className="font-bold text-slate-300">{org.name || "Org Sem Nome"}</h3>
            <p className="text-xs text-slate-500 font-mono">{org.id}</p>
        </div>

        {loading ? (
           <p className="text-emerald-400 animate-pulse text-sm">Rodando testes de integridade do tenant...</p>
        ) : previewAction ? (
           <div className="space-y-4">
               <h4 className="text-white font-bold border-b border-slate-700 pb-2">Preview de Ação: {previewAction.title}</h4>
               <div className="bg-slate-950 p-4 rounded text-xs text-slate-300 font-mono space-y-2 border border-slate-800">
                    <p className="font-bold text-amber-500 mb-2">As seguintes alterações serão feitas no Firestore:</p>
                    <ul className="list-disc pl-4 space-y-1">
                       {previewAction.changes.map((chk: string, i: number) => <li key={i}>{chk}</li>)}
                    </ul>
               </div>
               <div className="flex gap-2 pt-4">
                   <button onClick={() => setPreviewAction(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded">Cancelar</button>
                   <button onClick={applyPreviewAction} disabled={repairing} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded">
                       {repairing ? "Aplicando..." : "Confirmar Reparo"}
                   </button>
               </div>
           </div>
        ) : diagnostic ? (
           <div className="space-y-4">
              <div className={`p-3 rounded border font-bold text-sm flex items-center justify-between ${diagnostic.status === "Saudável" ? "bg-emerald-900/30 text-emerald-400 border-emerald-800" : diagnostic.status === "Crítico" ? "bg-red-900/30 text-red-400 border-red-800" : "bg-amber-900/30 text-amber-400 border-amber-800"}`}>
                 <span>Status: {diagnostic.status}</span>
                 {diagnostic.status === "Saudável" && <span>💚</span>}
                 {diagnostic.status === "Atenção" && <span>⚠️</span>}
                 {(diagnostic.status === "Crítico" || diagnostic.status === "Reparável") && <span>🚨</span>}
              </div>
              
              {diagnostic.issues.length > 0 && (
                 <div className="bg-slate-950 p-4 rounded text-xs text-slate-300 font-mono space-y-2 border border-slate-800">
                    <p className="font-bold text-red-400 mb-2">Inconsistências Encontradas:</p>
                    <ul className="list-disc pl-4 space-y-1">
                       {diagnostic.issues.map((issue: string, i: number) => <li key={i}>{issue}</li>)}
                    </ul>
                 </div>
              )}

              {diagnostic.issues.length === 0 && (
                  <p className="text-emerald-500 text-sm font-medium">Nenhum problema estrutural encontrado no tenant.</p>
              )}

              <div className="pt-4 border-t border-slate-800 space-y-3">
                 <h4 className="text-white font-bold text-sm">Ações de Reparo Avançadas</h4>
                 
                 {diagnostic.issues.some((i: string) => i.includes("Plano configurado incorretamente")) && (
                     <button onClick={handleShowFixPlanPreview} className="w-full bg-indigo-600/30 border border-indigo-600 hover:bg-indigo-600 text-indigo-300 hover:text-white font-bold py-2 rounded text-sm transition-colors text-left px-4 flex justify-between">
                        <span>Normalizar Plano (Corrige MONTHLY)</span>
                        <span>&rarr;</span>
                     </button>
                 )}

                 {diagnostic.issues.some((i: string) => i.includes("Dono (ownerUserId) não definido")) && (
                     <div className="relative">
                         <button onClick={() => setShowUserSelector(true)} className="w-full bg-amber-600/30 border border-amber-600 hover:bg-amber-600 text-amber-300 hover:text-white font-bold py-2 rounded text-sm transition-colors text-left px-4 flex justify-between">
                            <span>Selecionar dono da organização</span>
                            <span>&rarr;</span>
                         </button>
                         {showUserSelector && (
                             <div className="mt-2 relative z-50">
                                 <UserSelector 
                                    onSelect={handleShowLinkOwnerPreview} 
                                    onCancel={() => setShowUserSelector(false)} 
                                 />
                             </div>
                         )}
                     </div>
                 )}

                 {diagnostic.issues.some((i: string) => i.includes("Estrutura mínima do MusicScale ausente")) && (
                     <button onClick={handleShowCreateMusicScalePreview} className="w-full bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-bold py-2 rounded text-sm transition-colors text-left px-4 flex justify-between">
                        <span>Criar Estrutura Mínima MusicScale</span>
                        <span>&rarr;</span>
                     </button>
                 )}

                 {diagnostic.issues.length > 0 && !diagnostic.issues.some((i: string) => i.includes("Dono (ownerUserId) não definido")) && (
                     <button onClick={handleShowRepairAllPreview} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded text-sm transition-colors text-center px-4 mt-2 border border-indigo-500">
                        Reparar Tudo Automaticamente
                     </button>
                 )}
              </div>
           </div>
        ) : null}
      </div>
    </div>
  );
};

export const UserDiagnosisModal = ({ userObj, onClose, onRepaired }: { userObj: any, onClose: () => void, onRepaired: () => void }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [diagnostic, setDiagnostic] = useState<any>(null);
    const [previewAction, setPreviewAction] = useState<any>(null);
    const [repairing, setRepairing] = useState(false);
  
    useEffect(() => { runDiagnostic(); }, [userObj]);
  
    const runDiagnostic = async () => {
      setLoading(true);
      try {
        const results: any = { issues: [], status: "Saudável" };
        const userRef = doc(db, "users", userObj.id);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          results.issues.push("Documento do usuário ausente no Firestore.");
          results.status = "Crítico";
        } else {
          const data = userSnap.data();
          if (!data.organizationId) {
             results.issues.push("Usuário não possui organizationId.");
             if (data.products?.includes("musicscale") || data.role === "buyer" || data.systemRole === "owner") {
                 results.issues.push("Usuário tem produtos vinculados, mas está órfão de tenant.");
                 results.status = "Crítico";
             } else {
                 results.status = "Atenção";
             }
          } else {
             // check if org exists
             const orgSnap = await getDoc(doc(db, "organizations", data.organizationId));
             if (!orgSnap.exists()) {
                 results.issues.push(`organizationId aponta para tenant inexistente (${data.organizationId}).`);
                 results.status = "Crítico";
             }
          }
        }
        
        if (results.issues.length > 0 && results.status === "Saudável") {
            results.status = "Atenção";
        }
  
        setDiagnostic(results);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    const handleShowCreateOrgPreview = () => {
        setPreviewAction({
            type: "CREATE_ORG",
            title: "Criar Organização para Comprador/Usuário",
            changes: [
                `Cria documento em /organizations com nome provisório`,
                `Registra ownerUserId: "${userObj.id}"`,
                `Cria membership 'owner' em org/members`,
                `Atualiza user.organizationId para a nova org`,
                `Libera MusicScale Status: "active"`
            ]
        });
    };

    const applyPreviewAction = async () => {
        if (!previewAction) return;
        setRepairing(true);
        try {
            const batch = writeBatch(db);
            const timestamp = new Date().toISOString();
  
            if (previewAction.type === "CREATE_ORG") {
                throw new Error("ORGANIZATION_CREATION_REQUIRES_MILLIONSNEST_HUB");
            }
  
            setPreviewAction(null);
            await runDiagnostic();
            onRepaired();
        } catch (e) {
            console.error(e);
            alert("Erro ao aplicar reparo.");
        } finally {
            setRepairing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Diagnóstico de Usuário</h2>
              <button onClick={onClose} className="text-slate-400 hover:text-white px-2">X</button>
            </div>
            
            <div className="mb-4">
                <h3 className="font-bold text-slate-300">{userObj.displayName || "Sem Nome"}</h3>
                <p className="text-xs text-slate-500 font-mono">{userObj.email} | {userObj.id}</p>
            </div>
    
            {loading ? (
               <p className="text-emerald-400 animate-pulse text-sm">Rodando testes no usuário...</p>
            ) : previewAction ? (
               <div className="space-y-4">
                   <h4 className="text-white font-bold border-b border-slate-700 pb-2">Preview de Ação: {previewAction.title}</h4>
                   <div className="bg-slate-950 p-4 rounded text-xs text-slate-300 font-mono space-y-2 border border-slate-800">
                        <ul className="list-disc pl-4 space-y-1">
                           {previewAction.changes.map((chk: string, i: number) => <li key={i}>{chk}</li>)}
                        </ul>
                   </div>
                   <div className="flex gap-2 pt-4">
                       <button onClick={() => setPreviewAction(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded">Cancelar</button>
                       <button onClick={applyPreviewAction} disabled={repairing} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded">
                           {repairing ? "Aplicando..." : "Confirmar Criação"}
                       </button>
                   </div>
               </div>
            ) : diagnostic ? (
               <div className="space-y-4">
                  <div className={`p-3 rounded border font-bold text-sm flex items-center justify-between ${diagnostic.status === "Saudável" ? "bg-emerald-900/30 text-emerald-400 border-emerald-800" : diagnostic.status === "Crítico" ? "bg-red-900/30 text-red-400 border-red-800" : "bg-amber-900/30 text-amber-400 border-amber-800"}`}>
                     <span>Status: {diagnostic.status}</span>
                  </div>
                  
                  {diagnostic.issues.length > 0 && (
                     <div className="bg-slate-950 p-4 rounded text-xs text-slate-300 font-mono space-y-2 border border-slate-800">
                        <ul className="list-disc pl-4 space-y-1">
                           {diagnostic.issues.map((issue: string, i: number) => <li key={i}>{issue}</li>)}
                        </ul>
                     </div>
                  )}
    
                  <div className="pt-4 border-t border-slate-800 space-y-3">                     
                     {diagnostic.issues.some((i: string) => i.includes("usuário órfão") || i.includes("não possui organizationId")) && (
                         <button onClick={handleShowCreateOrgPreview} className="w-full bg-emerald-600/30 border border-emerald-600 hover:bg-emerald-600 text-emerald-300 hover:text-white font-bold py-2 rounded text-sm transition-colors text-left px-4 flex justify-between">
                            <span>Criar Organização Pessoal (Tenant)</span>
                            <span>&rarr;</span>
                         </button>
                     )}
                  </div>
               </div>
            ) : null}
          </div>
        </div>
      );
};
