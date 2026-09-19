import React, { useEffect, useMemo, useState, forwardRef, useImperativeHandle, useRef } from "react";
import { UserProfile, Instrument, BandMember, PopulatedBandScale, PopulatedScale } from "../../types";
import Button from "../common/Button";
import { UserIcon } from "../icons/UserIcon";
import { XCircleIcon } from "../icons/XCircleIcon";
import { PlusCircleIcon } from "../icons/PlusCircleIcon";
import { AlertTriangleIcon } from "../icons/AlertTriangleIcon";
import { UsersIcon } from "../icons/UsersIcon";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import {
  evaluateServeGuardBatch,
  type ServeGuardEvaluation,
} from "../../services/serveGuardService";

interface BandBuilderProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  instrumentsByCat: { name: string; instruments: Instrument[] }[];
  allUsers: UserProfile[];
  populatedBandScales: PopulatedBandScale[];
  musicScales?: PopulatedScale[];
}

export interface BandBuilderHandle {
  focusFirstInstrument(signal?: AbortSignal): Promise<boolean>;
}

const BandBuilder = forwardRef<BandBuilderHandle, BandBuilderProps>(({
  formData,
  setFormData,
  instrumentsByCat,
  allUsers,
  populatedBandScales,
  musicScales,
}, ref) => {
  const { t } = useTranslation();
  const { user, organization } = useAuth();
  const [selectedInstruments, setSelectedInstruments] = useState<Instrument[]>([]);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [mobileTab, setMobileTab] = useState<"functions" | "formation">("functions");
  const [serveGuardByUserId, setServeGuardByUserId] = useState<Record<string, ServeGuardEvaluation>>({});
  const [isServeGuardLoading, setServeGuardLoading] = useState(false);
  const [serveGuardUnavailable, setServeGuardUnavailable] = useState(false);
  const [pendingServeGuardOverride, setPendingServeGuardOverride] = useState<{
    userId: string;
    instrumentId: string;
  } | null>(null);
  const firstInstrumentRef = useRef<HTMLButtonElement>(null);

  useImperativeHandle(ref, () => ({
    focusFirstInstrument: async (signal?: AbortSignal): Promise<boolean> => {
       if (signal?.aborted) return false;
       if (!firstInstrumentRef.current) return false;
       
       if (firstInstrumentRef.current.offsetParent === null) {
          setMobileTab('functions');
          await new Promise<void>((resolve, reject) => {
             let rafId: number;
             const onAbort = () => {
                cancelAnimationFrame(rafId);
                reject(new Error('Aborted'));
             };
             if (signal?.aborted) return reject(new Error('Aborted'));
             signal?.addEventListener('abort', onAbort);
             rafId = requestAnimationFrame(() => {
                signal?.removeEventListener('abort', onAbort);
                resolve();
             });
          }).catch(() => {});
          if (signal?.aborted) return false;
          
          await new Promise<void>((resolve, reject) => {
             let rafId: number;
             const onAbort = () => {
                cancelAnimationFrame(rafId);
                reject(new Error('Aborted'));
             };
             if (signal?.aborted) return reject(new Error('Aborted'));
             signal?.addEventListener('abort', onAbort);
             rafId = requestAnimationFrame(() => {
                signal?.removeEventListener('abort', onAbort);
                resolve();
             });
          }).catch(() => {});
          if (signal?.aborted) return false;
       }
       
       if (firstInstrumentRef.current) {
          firstInstrumentRef.current.focus();
          if (firstInstrumentRef.current.scrollIntoView) {
             const rect = firstInstrumentRef.current.getBoundingClientRect();
             const isVisible = (
                 rect.top >= 0 &&
                 rect.left >= 0 &&
                 rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                 rect.right <= (window.innerWidth || document.documentElement.clientWidth)
             );
             if (!isVisible) {
               firstInstrumentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
             }
          }
          return true;
       }
       return false;
    }
  }));

  const commitAssignment = (userId: string, instrumentId: string) => {
    const currentAssignments = formData.assignments || [];
    if (currentAssignments.some((a: BandMember) => a.userId === userId)) {
      return;
    }
    setFormData((prev: any) => ({
      ...prev,
      assignments: [...(prev.assignments || []), { userId, instrumentId }],
    }));
    setPendingServeGuardOverride(current =>
      current?.userId === userId ? null : current,
    );
  };

  const requestAssignment = (userId: string, instrumentId: string) => {
    const evaluation = serveGuardByUserId[userId];

    if (evaluation?.requiresExplicitOverride) {
      setPendingServeGuardOverride({ userId, instrumentId });
      return;
    }

    commitAssignment(userId, instrumentId);
  };

  const removeAssignment = (userId: string, instrumentId: string) => {
    setFormData((prev: any) => ({
      ...prev,
      assignments: (prev.assignments || []).filter(
        (a: BandMember) => !(a.userId === userId && a.instrumentId === instrumentId)
      ),
    }));
  };

  const currentAssignments: BandMember[] = formData.assignments || [];
  const assignedUserIds = new Set(currentAssignments.map((a) => a.userId));

  // Determine conflicts for the selected date
  const conflictsByUserId = useMemo(() => {
    const conflicts = new Map<string, PopulatedBandScale[]>();
    
    let resolvedDate = formData.date;
    if (!resolvedDate && formData.musicScaleId && musicScales) {
        const ms = musicScales.find(s => s.id === formData.musicScaleId);
        if (ms) resolvedDate = ms.date;
    }
    
    if (!resolvedDate || !populatedBandScales) return conflicts;

    const currentScaleId = formData.id; // Could be undefined for new scales

    for (const scale of populatedBandScales) {
      let scaleResolvedDate = scale.date;
      if (!scaleResolvedDate && scale.musicScaleId && musicScales) {
         const scaleMs = musicScales.find(s => s.id === scale.musicScaleId);
         if (scaleMs) scaleResolvedDate = scaleMs.date;
      }
      if (scaleResolvedDate === resolvedDate && scale.id !== currentScaleId && scale.id !== "CLONE") {
        for (const assignment of scale.assignments) {
          const userConflicts = conflicts.get(assignment.userId) || [];
          userConflicts.push(scale);
          conflicts.set(assignment.userId, userConflicts);
        }
      }
    }
    return conflicts;
  }, [formData.date, formData.musicScaleId, formData.id, populatedBandScales, musicScales]);

  const resolvedServeGuardDate = useMemo(() => {
    if (typeof formData.date === "string" && formData.date) {
      return formData.date;
    }

    if (formData.musicScaleId && musicScales) {
      return musicScales.find(scale => scale.id === formData.musicScaleId)?.date || "";
    }

    return "";
  }, [formData.date, formData.musicScaleId, musicScales]);

  useEffect(() => {
    let cancelled = false;

    if (
      !user ||
      !organization?.id ||
      !resolvedServeGuardDate ||
      allUsers.length === 0
    ) {
      setServeGuardByUserId({});
      setServeGuardUnavailable(false);
      setServeGuardLoading(false);
      return;
    }

    const userIds = Array.from(
      new Set(allUsers.map(member => member.uid).filter(Boolean)),
    );

    if (userIds.length === 0) {
      setServeGuardByUserId({});
      return;
    }

    const chunks: string[][] = [];
    for (let index = 0; index < userIds.length; index += 100) {
      chunks.push(userIds.slice(index, index + 100));
    }

    setPendingServeGuardOverride(null);
    setServeGuardLoading(true);
    setServeGuardUnavailable(false);

    void Promise.allSettled(
      chunks.map(chunk =>
        evaluateServeGuardBatch(user, organization.id, {
          userIds: chunk,
          candidateDate: resolvedServeGuardDate,
          excludeScaleId:
            typeof formData.id === "string" &&
            formData.id &&
            formData.id !== "CLONE"
              ? formData.id
              : null,
        }),
      ),
    )
      .then(results => {
        if (cancelled) return;

        const next: Record<string, ServeGuardEvaluation> = {};
        let rejectedCount = 0;

        for (const result of results) {
          if (result.status === "rejected") {
            rejectedCount += 1;
            continue;
          }

          result.value.evaluations.forEach(evaluation => {
            next[evaluation.userId] = evaluation;
          });
        }

        setServeGuardByUserId(next);
        setServeGuardUnavailable(rejectedCount > 0);
      })
      .finally(() => {
        if (!cancelled) setServeGuardLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    user,
    organization?.id,
    resolvedServeGuardDate,
    formData.id,
    allUsers,
  ]);

  // Available users for selected instruments
  const { compatibleUsers, otherUsers } = useMemo(() => {
    if (selectedInstruments.length === 0) return { compatibleUsers: [], otherUsers: [] };

    const compatible: UserProfile[] = [];
    const others: UserProfile[] = [];

    // instrumentId matcher
    const instIds = selectedInstruments.map(i => i.id);

    allUsers.forEach((user) => {
      // Check specialty
      let hasSpecialty = user.specialtyIds?.some(id => instIds.includes(id)) || false;
      
      // Fallback: Check if user role implies the selected instrument
      if (!hasSpecialty) {
         const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
         const roleStrs = [
             user.musicscaleRole,
             user.role,
             user.organizationRole,
             user.ministryFunction,
             user.displayName,
             user.email
         ].filter(Boolean).map(s => normalize(s as string));
         
         if (roleStrs.length > 0) {
             hasSpecialty = selectedInstruments.some(inst => {
                 const instName = normalize(inst.name);
                 return roleStrs.some(r => {
                     if (r.includes(instName) || instName.includes(r)) return true;
                     // Fuzzy matches for Portuguese instruments/roles
                     if (instName.includes('bateria') && r.includes('baterista')) return true;
                     if (instName.includes('baixo') && r.includes('baixista')) return true;
                     if (instName.includes('teclado') && r.includes('tecladista')) return true;
                     if (instName.includes('guitarra') && r.includes('guitarrista')) return true;
                     if (instName.includes('violao') && r.includes('violonista')) return true;
                     if (instName.includes('piano') && r.includes('pianista')) return true;
                     if (instName.includes('vocal') && (r.includes('cantor') || r.includes('back'))) return true;
                     if (instName.includes('ministro') && r.includes('lider')) return true;
                     if (instName.includes('lider') && r.includes('ministro')) return true;
                     return false;
                 });
             });
         }
      }

      if (hasSpecialty) {
        compatible.push(user);
      } else {
        others.push(user);
      }
    });

    return { compatibleUsers: compatible, otherUsers: others };
  }, [selectedInstruments, allUsers]);

  const allInstrumentsMap = useMemo(() => {
    const map = new Map<string, string>();
    instrumentsByCat.forEach(cat => {
      cat.instruments.forEach(inst => map.set(inst.id, inst.name));
    });
    return map;
  }, [instrumentsByCat]);

  const renderUserCard = (u: UserProfile, isCompatible: boolean) => {
    const isAdded = assignedUserIds.has(u.uid);
    const conflicts = conflictsByUserId.get(u.uid);
    const serveGuard = serveGuardByUserId[u.uid];
    const isServeGuardOverridePending =
      pendingServeGuardOverride?.userId === u.uid;

    const userSpecialties = u.specialtyIds
      ?.map(id => allInstrumentsMap.get(id))
      .filter(Boolean)
      .join(" • ") || "Sem função principal";

    return (
      <div
        key={u.uid}
        className={`flex flex-col p-3 rounded-xl border transition-all duration-200 ${
          isAdded
            ? "border-primary/50 bg-primary/5 opacity-60"
            : "border-slate-200 dark:border-white/5 bg-white dark:bg-[#1C1C1E] hover:border-primary/30"
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
            {u.photoURL ? (
              <img src={u.photoURL} alt={u.displayName || ""} className="w-full h-full object-cover" />
            ) : (
               <UserIcon className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-slate-800 dark:text-gray-100 truncate">
              {u.displayName || u.email}
            </h4>
            <div className="text-[11px] text-slate-500 truncate mt-0.5" title={userSpecialties}>
              {userSpecialties}
            </div>
          </div>
        </div>

        {/* Badges / Status */}
        <div className="flex flex-wrap gap-1 mb-3">
          {isAdded && (
            <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
              {t('bandScaleModal.alreadyAdded')}
            </span>
          )}
          {conflicts && conflicts.length > 0 && (
            <span className="text-[10px] bg-amber-500/10 text-amber-500 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
              <AlertTriangleIcon className="w-3 h-3" /> {t('bandScaleModal.conflictWarning')} {new Date((formData.date || resolvedServeGuardDate) + "T00:00:00").toLocaleDateString()}
            </span>
          )}
          {!isCompatible && !isAdded && (
            <span className="text-[10px] bg-slate-100 dark:bg-white/5 text-slate-500 font-medium px-1.5 py-0.5 rounded">
              {t('bandScaleModal.noSpecialtyWarning')}
            </span>
          )}
          {serveGuard &&
            serveGuard.primarySignal !== "clear" &&
            serveGuard.primarySignal !== "preference_not_configured" && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                  serveGuard.requiresExplicitOverride
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                }`}
              >
                <AlertTriangleIcon className="w-3 h-3" />
                {t(`bandScaleModal.serveGuard.status.${serveGuard.primarySignal}`)}
              </span>
            )}
        </div>

        {serveGuard &&
          serveGuard.primarySignal !== "clear" &&
          serveGuard.primarySignal !== "preference_not_configured" && (
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/5 dark:bg-black/20">
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                {t("bandScaleModal.serveGuard.projectedLoad", {
                  week: serveGuard.scheduledLoad.week.projected,
                  weekLimit:
                    serveGuard.scheduledLoad.week.limit ??
                    t("bandScaleModal.serveGuard.noLimit"),
                  month: serveGuard.scheduledLoad.month.projected,
                  monthLimit:
                    serveGuard.scheduledLoad.month.limit ??
                    t("bandScaleModal.serveGuard.noLimit"),
                })}
              </p>
            </div>
          )}

        {isServeGuardOverridePending && !isAdded && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-[11px] font-semibold leading-relaxed text-amber-800 dark:text-amber-300">
              {t("bandScaleModal.serveGuard.overridePrompt")}
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => {
                  if (!pendingServeGuardOverride) return;
                  commitAssignment(
                    pendingServeGuardOverride.userId,
                    pendingServeGuardOverride.instrumentId,
                  );
                }}
              >
                {t("bandScaleModal.serveGuard.addAnyway")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setPendingServeGuardOverride(null)}
              >
                {t("bandScaleModal.serveGuard.cancel")}
              </Button>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-auto pt-2">
          {selectedInstruments.length > 0 && !isAdded ? (
            selectedInstruments.length === 1 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full text-xs font-semibold py-1.5"
                onClick={() => requestAssignment(u.uid, selectedInstruments[0].id)}
                data-testid={`add-assignment-${u.uid}-${selectedInstruments[0].id}`}
              >
                {t('bandScaleModal.addAs')} {selectedInstruments[0].name}
              </Button>
            ) : (
              <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-black/20 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                 <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Atribuir Função:</span>
                 <div className="flex flex-wrap gap-1.5">
                   {selectedInstruments.map(inst => {
                     let isSpecialty = u.specialtyIds?.includes(inst.id) || false;
                     if (!isSpecialty) {
                         const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                         const roleStrs = [
                             u.musicscaleRole,
                             u.role,
                             u.organizationRole,
                             u.ministryFunction,
                             u.displayName,
                             u.email
                         ].filter(Boolean).map(s => normalize(s as string));
                         
                         const instName = normalize(inst.name);
                         isSpecialty = roleStrs.some(r => {
                             if (r.includes(instName) || instName.includes(r)) return true;
                             if (instName.includes('bateria') && r.includes('baterista')) return true;
                             if (instName.includes('baixo') && r.includes('baixista')) return true;
                             if (instName.includes('teclado') && r.includes('tecladista')) return true;
                             if (instName.includes('guitarra') && r.includes('guitarrista')) return true;
                             if (instName.includes('violao') && r.includes('violonista')) return true;
                             if (instName.includes('piano') && r.includes('pianista')) return true;
                             if (instName.includes('vocal') && (r.includes('cantor') || r.includes('back'))) return true;
                             if (instName.includes('ministro') && r.includes('lider')) return true;
                             if (instName.includes('lider') && r.includes('ministro')) return true;
                             return false;
                         });
                     }
                     
                     return (
                       <button
                         key={inst.id}
                         type="button"
                         className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                           isSpecialty 
                             ? "bg-primary text-white hover:bg-primary/90 shadow-sm" 
                             : "bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10"
                         }`}
                         onClick={() => requestAssignment(u.uid, inst.id)}
                         data-testid={`add-assignment-${u.uid}-${inst.id}`}
                       >
                         {inst.name}
                       </button>
                     );
                   })}
                 </div>
              </div>
            )
          ) : (
            <Button
              type="button"
              variant={isAdded ? "ghost" : "secondary"}
              size="sm"
              className={`w-full text-xs font-semibold py-1.5 ${isAdded ? "opacity-50" : ""}`}
              disabled={isAdded}
            >
              {isAdded ? t('bandScaleModal.alreadyAdded') : t('bandScaleModal.add')}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col -mx-4 px-4 sm:mx-0 sm:px-0">
      {/* Mobile Tabs */}
      <div className="lg:hidden flex rounded-xl bg-slate-100 dark:bg-white/5 p-1 mb-4 flex-shrink-0">
        <button 
          type="button" 
          onClick={() => setMobileTab("functions")} 
          className={`flex-1 py-2 text-[13px] font-bold tracking-wide rounded-lg transition-all ${mobileTab === 'functions' ? 'bg-white dark:bg-[#2A2A2C] shadow-sm text-slate-800 dark:text-white' : 'text-slate-500'}`}
        >
          {t('bandScaleModal.chooseFunction')}
        </button>
        <button 
          type="button" 
          onClick={() => setMobileTab("formation")} 
          className={`flex-1 py-2 text-[13px] font-bold tracking-wide rounded-lg transition-all flex items-center justify-center gap-1.5 ${mobileTab === 'formation' ? 'bg-white dark:bg-[#2A2A2C] shadow-sm text-slate-800 dark:text-white' : 'text-slate-500'}`}
        >
          {t('scaleModal.stepFormation')} {currentAssignments.length > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${mobileTab === 'formation' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'}`}>{currentAssignments.length}</span>}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Roles / Categories */}
        <div className={`flex-col gap-6 w-full lg:w-[33%] ${mobileTab === 'functions' ? 'flex' : 'hidden lg:flex'}`}>
          {allUsers.length <= 1 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
              <h4 className="text-[13px] font-bold text-amber-800 dark:text-amber-400 mb-1">
                Poucos integrantes
              </h4>
              <p className="text-[12px] text-amber-700/80 dark:text-amber-500/80 mb-3">
                Convide sua equipe para conseguir montar escalas mais completas.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" className="text-[11px] h-7 px-3 bg-white dark:bg-black/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/20" onClick={() => window.open('/users', '_self')}>
                  Convidar Equipe
                </Button>
              </div>
            </div>
          )}

          {instrumentsByCat.map((cat) => (
            <div key={cat.name} className="space-y-3">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {cat.name}
              </h4>
              <div className="flex flex-wrap gap-2">
                {cat.instruments.map((inst, index) => {
                  const addedCount = currentAssignments.filter((a) => a.instrumentId === inst.id).length;
                  const isSelected = selectedInstruments.some(i => i.id === inst.id);
                  const isFirst = cat.name === instrumentsByCat[0].name && index === 0;

                  return (
                    <button
                      key={inst.id}
                      ref={isFirst ? firstInstrumentRef : undefined}
                      type="button"
                      onClick={() => {
                        setSelectedInstruments(prev => {
                           if (prev.find(i => i.id === inst.id)) {
                             return prev.filter(i => i.id !== inst.id);
                           }
                           return [...prev, inst];
                        });
                      }}
                      className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] font-semibold transition-all duration-200 ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-slate-200 dark:border-white/10 bg-white dark:bg-[#1C1C1E] text-slate-700 dark:text-gray-300 hover:border-primary/50"
                      }`}
                      data-testid={`select-instrument-${inst.id}`}
                    >
                      {inst.name}
                      {addedCount > 0 && (
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] text-slate-600 dark:text-slate-400">
                          {addedCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: People / Selected Formation */}
        <div className={`flex-col bg-slate-50 border border-slate-200 dark:border-white/5 dark:bg-[#151516] rounded-2xl p-5 w-full lg:w-[67%] ${mobileTab === 'formation' ? 'flex' : 'hidden lg:flex'}`}>
          {serveGuardUnavailable && selectedInstruments.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              {t("bandScaleModal.serveGuard.unavailable")}
            </div>
          )}
          {isServeGuardLoading && selectedInstruments.length > 0 && (
            <div className="mb-4 flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              {t("bandScaleModal.serveGuard.checking")}
            </div>
          )}
          {selectedInstruments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="w-16 h-16 bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 flex items-center justify-center mb-4">
                <UsersIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-gray-200 mb-1">
                {t('bandScaleModal.emptyFormationTitle')}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mb-6">
                {t('bandScaleModal.emptyFormationDescription')}
              </p>

              {/* Show Assigned Formation Preview when no instrument is selected */}
              {currentAssignments.length > 0 ? (
                <div className="w-full text-left bg-white dark:bg-[#1C1C1E] rounded-xl border border-slate-200 dark:border-white/5 p-4 shadow-sm space-y-4">
                  {instrumentsByCat.map((cat) => {
                    const instMap = new Map(cat.instruments.map((i) => [i.id, i.name]));
                    const assignmentsInCat = currentAssignments.filter((a) => instMap.has(a.instrumentId));

                    if (assignmentsInCat.length === 0) return null;

                    return (
                      <div key={cat.name} className="space-y-2">
                        <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {cat.name}
                        </h5>
                        <div className="space-y-1.5">
                          {assignmentsInCat.map((a, i) => {
                            const user = allUsers.find((u) => u.uid === a.userId);
                            const instName = instMap.get(a.instrumentId);
                            if (!user) return null;

                            return (
                              <div
                                key={i}
                                className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-black/20 rounded-lg border border-slate-100 dark:border-white/5"
                              >
                                <div className="flex items-center gap-3">
                                  {user.photoURL ? (
                                    <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                                      <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                                    </div>
                                  )}
                                  <div>
                                    <div className="text-[13px] font-semibold text-slate-800 dark:text-gray-100 leading-tight">
                                      {user.displayName}
                                    </div>
                                    <div className="text-[11px] text-slate-500">{instName}</div>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="!p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                  onClick={() => removeAssignment(a.userId, a.instrumentId)}
                                  data-testid={`remove-assignment-${a.userId}-${a.instrumentId}`}
                                  title="Remover"
                                >
                                  <XCircleIcon className="w-4 h-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 px-6 border border-dashed rounded-xl border-slate-200 dark:border-white/5">
                   <p className="text-[12px] font-medium text-slate-500">{t('bandScaleModal.emptyFormationTitle')}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedInstruments([])}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors mr-2 p-1 bg-white dark:bg-white/5 rounded-md border border-slate-200 dark:border-white/5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedInstruments.map(i => i.name).join(', ')}
                  </h3>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAllMembers(!showAllMembers)}
                    className="text-[11px] font-semibold text-primary hover:bg-primary/5"
                >
                    {showAllMembers ? t('bandScaleModal.hideIncompatible', 'Ocultar incompatíveis') : t('bandScaleModal.showAllMembers', 'Mostrar todos')}
                </Button>
              </div>

              {compatibleUsers.length === 0 && !showAllMembers ? (
                <div className="text-center py-10 px-4 bg-white dark:bg-[#1C1C1E] border border-dashed border-slate-200 dark:border-white/10 rounded-2xl mt-4">
                  <UserIcon className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <h4 className="text-[14px] font-semibold text-slate-700 dark:text-gray-200 mb-1">
                    {t('bandScaleModal.noMembersFound', 'Nenhum integrante encontrado')}
                  </h4>
                  <p className="text-[12px] text-slate-500 max-w-sm mx-auto mb-4">
                    {t('bandScaleModal.noSpecialtyDesc', 'Parece que ninguém possui a especialidade de {{instrument}}.', { instrument: selectedInstruments.map(i => i.name).join(', ') })}
                  </p>
                  <Button type="button" variant="secondary" onClick={() => setShowAllMembers(true)} className="text-[13px]">
                     {t('bandScaleModal.showAllMembers', 'Mostrar todos')}
                  </Button>
                </div>
              ) : (
                <div className="pr-2">
                  {compatibleUsers.length > 0 && (
                     <div className="mb-6">
                        <h5 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3 px-1 sticky top-0 bg-slate-50 dark:bg-[#151516] pb-2 z-10">{t('bandScaleModal.availablePeople')}</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           {compatibleUsers.map(u => renderUserCard(u, true))}
                        </div>
                     </div>
                  )}

                  {showAllMembers && otherUsers.length > 0 && (
                     <div>
                        <h5 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3 px-1 sticky top-0 bg-slate-50 dark:bg-[#151516] pb-2 z-10 mt-6 pt-2 border-t border-slate-200 dark:border-white/5">{t('bandScaleModal.otherMembers')}</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           {otherUsers.map(u => renderUserCard(u, false))}
                        </div>
                     </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default BandBuilder;
