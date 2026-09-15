import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { EventAssignment, EventAssignmentResponse } from '../../types';
import { Can } from '../auth/Can';
import { Check, Clock, X, HelpCircle, UsersRound } from 'lucide-react';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useCapability } from '../../hooks/useCapability';

interface TeamStatusSummaryProps {
  musicScaleId: string;
  assignments: EventAssignment[];
}

const TeamStatusSummary: React.FC<TeamStatusSummaryProps> = ({
  musicScaleId,
  assignments
}) => {
  const { t, i18n } = useTranslation();
  const { hasCapability } = useCapability();

  const formatter = new Intl.ListFormat(i18n.language, { style: 'long', type: 'conjunction' });

  const [responses, setResponses] = useState<EventAssignmentResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const isEnabled = useFeatureFlag('musicscale.scaleResponsesV1');
  const canManageScales = hasCapability('musicscale.scales.manage');

  useEffect(() => {
    // The team-wide response summary is a manager-only view. Non-managers must
    // never subscribe to the full response collection because Firestore rules
    // intentionally allow them to read only their own response documents.
    if (!isEnabled || !canManageScales) {
       setResponses([]);
       setLoading(false);
       return;
    }

    setLoading(true);

    // Only active responses participate in the current team status. Historical
    // response revisions stay in Firestore for audit, but should not be read by
    // the live summary (or consume Rules evaluation budget).
    const responsesRef = collection(db, 'scales', musicScaleId, 'responses');
    const q = query(responsesRef, where('active', '==', true));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: EventAssignmentResponse[] = [];
      snapshot.forEach(doc => {
        fetched.push(doc.data() as EventAssignmentResponse);
      });
      setResponses(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to active team responses:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [musicScaleId, isEnabled, canManageScales]);

  if (!isEnabled || !canManageScales) return null;
  if (loading) {
    return (
      <div className="ms-panel overflow-hidden p-5 sm:p-6" aria-busy="true">
        <div className="flex animate-pulse items-center gap-3 motion-reduce:animate-none">
          <div className="h-10 w-10 rounded-[13px] bg-white/[0.06]" />
          <div className="space-y-2">
            <div className="h-3 w-28 rounded-full bg-white/[0.07]" />
            <div className="h-2.5 w-44 rounded-full bg-white/[0.045]" />
          </div>
        </div>
        <div className="mt-5 h-1.5 rounded-full bg-white/[0.055]" />
        <div className="mt-5 space-y-2">
          {[0, 1, 2].map(item => (
            <div key={item} className="h-[58px] animate-pulse rounded-[14px] border border-white/[0.05] bg-white/[0.025] motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    );
  }

  // Group by unique user.
  // The assignments prop has the canonical scheduled members.
  const activeAssignments = assignments.filter(a => a.active !== false);
  const userMap = new Map<string, {
    userId: string;
    functions: string[];
    status: string;
    reason: string | null;
  }>();

  activeAssignments.forEach(a => {
    if (!userMap.has(a.userId)) {
      userMap.set(a.userId, {
        userId: a.userId,
        functions: [],
        status: 'pending',
        reason: null
      });
    }
    const u = userMap.get(a.userId)!;
    if (a.functionName) {
      u.functions.push(a.functionName);
    }
  });

  // Apply current active response data.
  responses.forEach(r => {
    if (userMap.has(r.userId)) {
       const u = userMap.get(r.userId)!;
       u.status = r.status;
       u.reason = r.reason;
    }
  });

  const uniqueUsers = Array.from(userMap.values());

  const getStatusOrder = (status: string) => {
    switch(status) {
      case 'declined': return 1;
      case 'maybe': return 2;
      case 'pending': return 3;
      case 'accepted': return 4;
      default: return 5;
    }
  };

  uniqueUsers.sort((a, b) => getStatusOrder(a.status) - getStatusOrder(b.status));

  const counts = {
    accepted: uniqueUsers.filter(u => u.status === 'accepted').length,
    pending: uniqueUsers.filter(u => u.status === 'pending').length,
    maybe: uniqueUsers.filter(u => u.status === 'maybe').length,
    declined: uniqueUsers.filter(u => u.status === 'declined').length
  };

  if (uniqueUsers.length === 0) return null;

  const readinessPercent = Math.round((counts.accepted / uniqueUsers.length) * 100);

  const metricItems = [
    {
      key: 'accepted',
      count: counts.accepted,
      label: t('responses.leaderSummary.accepted', { count: counts.accepted, defaultValue: counts.accepted === 1 ? 'confirmado' : 'confirmados' }),
      classes: 'border-emerald-400/[0.16] bg-emerald-500/[0.065] text-emerald-300',
    },
    {
      key: 'pending',
      count: counts.pending,
      label: t('responses.leaderSummary.pending', { count: counts.pending, defaultValue: 'aguardando resposta' }),
      classes: 'border-white/[0.07] bg-white/[0.03] text-white/55',
    },
    {
      key: 'maybe',
      count: counts.maybe,
      label: t('responses.leaderSummary.maybe', { count: counts.maybe, defaultValue: counts.maybe === 1 ? 'ainda não sabe' : 'ainda não sabem' }),
      classes: 'border-amber-400/[0.17] bg-amber-500/[0.065] text-amber-200',
    },
    {
      key: 'declined',
      count: counts.declined,
      label: t('responses.leaderSummary.declined', { count: counts.declined, defaultValue: counts.declined === 1 ? 'não poderá' : 'não poderão' }),
      classes: 'border-red-400/[0.16] bg-red-500/[0.06] text-red-300',
    },
  ];

  return (
    <section className="ms-panel relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/35 to-transparent" />

      <div className="border-b border-white/[0.055] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-emerald-400/[0.14] bg-emerald-500/[0.065] text-emerald-300">
              <UsersRound className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold tracking-[-0.02em] text-white sm:text-[15px]">
                {t('responses.teamStatus', 'Situação da Equipe')}
              </h3>
              <p className="mt-1 text-[11px] font-medium text-white/38">
                {counts.accepted}/{uniqueUsers.length} · {t('responses.leaderSummary.accepted', { count: counts.accepted, defaultValue: counts.accepted === 1 ? 'confirmado' : 'confirmados' })}
              </p>
            </div>
          </div>

          <div className="flex items-baseline gap-1 self-start sm:self-auto">
            <span className="text-[24px] font-semibold tabular-nums tracking-[-0.04em] text-white">{readinessPercent}</span>
            <span className="text-[10px] font-bold text-white/32">%</span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div
            className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.055]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={readinessPercent}
            aria-label={`${counts.accepted}/${uniqueUsers.length}`}
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#4f8cff,#52d3a3)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${readinessPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {metricItems.map(item => (
            <div key={item.key} className={`rounded-[12px] border px-3 py-2.5 ${item.classes}`}>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[17px] font-semibold tabular-nums">{item.count}</span>
                <span className="line-clamp-1 text-[9px] font-bold uppercase tracking-[0.08em] opacity-75">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="divide-y divide-white/[0.045] px-2 py-2 sm:px-3">
        {uniqueUsers.map((u) => (
          <div key={u.userId} className="group flex items-center justify-between gap-3 rounded-[13px] px-3 py-3 transition-colors duration-200 hover:bg-white/[0.025] sm:px-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border
                ${u.status === 'accepted' ? 'border-emerald-400/[0.15] bg-emerald-500/[0.07] text-emerald-300' :
                  u.status === 'declined' ? 'border-red-400/[0.15] bg-red-500/[0.07] text-red-300' :
                  u.status === 'maybe' ? 'border-amber-400/[0.17] bg-amber-500/[0.07] text-amber-200' :
                  'border-white/[0.07] bg-white/[0.035] text-white/38'
                }`}
              >
                {u.status === 'accepted' ? <Check className="h-4 w-4" /> :
                 u.status === 'declined' ? <X className="h-4 w-4" /> :
                 u.status === 'maybe' ? <HelpCircle className="h-4 w-4" /> :
                 <Clock className="h-4 w-4" />
                }
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-white/78 sm:text-[13px]">
                  {formatter.format(u.functions)}
                </p>
                {u.status === 'declined' && u.reason && (
                  <Can I="musicscale.scales.manage">
                    <p className="mt-1 max-w-[230px] truncate text-[10.5px] italic text-red-300/65" title={u.reason}>
                      {u.reason}
                    </p>
                  </Can>
                )}
              </div>
            </div>

            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em]
              ${u.status === 'accepted' ? 'border-emerald-400/[0.14] bg-emerald-500/[0.06] text-emerald-300' :
                u.status === 'declined' ? 'border-red-400/[0.14] bg-red-500/[0.06] text-red-300' :
                u.status === 'maybe' ? 'border-amber-400/[0.16] bg-amber-500/[0.06] text-amber-200' :
                'border-white/[0.065] bg-white/[0.025] text-white/38'
              }`}
            >
              {u.status === 'accepted' ? t('responses.statusAccepted', 'Confirmado') :
               u.status === 'declined' ? t('responses.statusDeclined', 'Não poderá') :
               u.status === 'maybe' ? t('responses.statusMaybe', 'Ainda não sabe') :
               t('responses.statusPending', 'Aguardando')
              }
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TeamStatusSummary;