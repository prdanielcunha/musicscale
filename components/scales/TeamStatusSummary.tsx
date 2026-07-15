import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { EventAssignment, EventAssignmentResponse } from '../../types';
import Spinner from '../common/Spinner';
import { Can } from '../auth/Can';
import { Check, Clock, X, HelpCircle } from 'lucide-react';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

interface TeamStatusSummaryProps {
  musicScaleId: string;
  assignments: EventAssignment[];
}

const TeamStatusSummary: React.FC<TeamStatusSummaryProps> = ({
  musicScaleId,
  assignments
}) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  
  const formatter = new Intl.ListFormat(i18n.language, { style: 'long', type: 'conjunction' });
  
  const [responses, setResponses] = useState<EventAssignmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isEnabled = useFeatureFlag('musicscale.scaleResponsesV1');

  useEffect(() => {
    if (!isEnabled) {
       setLoading(false);
       return;
    }
    
    // Fetch all responses for this scale
    const responsesRef = collection(db, 'scales', musicScaleId, 'responses');
    const q = query(responsesRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: EventAssignmentResponse[] = [];
      snapshot.forEach(doc => {
        fetched.push(doc.data() as EventAssignmentResponse);
      });
      setResponses(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to all responses:", error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [musicScaleId, isEnabled]);

  if (!isEnabled) return null;
  if (loading) return <div className="flex justify-center p-4"><Spinner className="w-5 h-5 text-slate-500" /></div>;

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

  // Apply response data
  responses.forEach(r => {
    if (r.active !== false && userMap.has(r.userId)) {
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

  return (
    <div className="bg-[#121214]/60 backdrop-blur-[32px] border border-white/[0.05] p-5 rounded-2xl space-y-4">
       <h3 className="text-sm font-bold text-white uppercase tracking-wider">
         {t('responses.teamStatus', 'Situação da Equipe')}
       </h3>
       
       <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
         <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-emerald-400">{counts.accepted}</span>
            <span className="text-[10px] uppercase font-bold text-emerald-500 mt-1 text-center">
              {t('responses.leaderSummary.accepted', { count: counts.accepted, defaultValue: counts.accepted === 1 ? 'confirmado' : 'confirmados' })}
            </span>
         </div>
         <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-3 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-slate-300">{counts.pending}</span>
            <span className="text-[10px] uppercase font-bold text-slate-400 mt-1 text-center">
              {t('responses.leaderSummary.pending', { count: counts.pending, defaultValue: 'aguardando resposta' })}
            </span>
         </div>
         <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-amber-400">{counts.maybe}</span>
            <span className="text-[10px] uppercase font-bold text-amber-500 mt-1 text-center">
              {t('responses.leaderSummary.maybe', { count: counts.maybe, defaultValue: counts.maybe === 1 ? 'ainda não sabe' : 'ainda não sabem' })}
            </span>
         </div>
         <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-red-400">{counts.declined}</span>
            <span className="text-[10px] uppercase font-bold text-red-500 mt-1 text-center">
              {t('responses.leaderSummary.declined', { count: counts.declined, defaultValue: counts.declined === 1 ? 'não poderá' : 'não poderão' })}
            </span>
         </div>
       </div>

       <div className="space-y-2">
         {uniqueUsers.map((u, i) => (
           <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
             <div className="flex items-center gap-3">
               <div className={`w-8 h-8 rounded-full flex items-center justify-center
                 ${u.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' :
                   u.status === 'declined' ? 'bg-red-500/20 text-red-400' :
                   u.status === 'maybe' ? 'bg-amber-500/20 text-amber-400' :
                   'bg-slate-500/20 text-slate-400'
                 }`}
               >
                 {u.status === 'accepted' ? <Check className="w-4 h-4" /> :
                  u.status === 'declined' ? <X className="w-4 h-4" /> :
                  u.status === 'maybe' ? <HelpCircle className="w-4 h-4" /> :
                  <Clock className="w-4 h-4" />
                 }
               </div>
               <div>
                  <p className="text-sm font-medium text-slate-200">
                    {/* Realistically, we need user's name here.
                        Since assignments don't store user names by default (unless populated),
                        we might need to rely on the fact that these are just roles, 
                        or we need to map userId to user name using the users repository.
                        For now, we'll display the roles.
                    */}
                    {formatter.format(u.functions)}
                  </p>
                  {u.status === 'declined' && u.reason && (
                    <Can I="musicscale.scales.manage">
                      <p className="text-xs text-red-400/80 mt-0.5 italic max-w-[200px] truncate" title={u.reason}>
                        {u.reason}
                      </p>
                    </Can>
                  )}
               </div>
             </div>
             
             <div className="text-right">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded
                   ${u.status === 'accepted' ? 'text-emerald-400 bg-emerald-500/10' :
                     u.status === 'declined' ? 'text-red-400 bg-red-500/10' :
                     u.status === 'maybe' ? 'text-amber-400 bg-amber-500/10' :
                     'text-slate-400 bg-slate-500/10'
                   }`}
                >
                  {u.status === 'accepted' ? t('responses.statusAccepted', 'Confirmado') :
                   u.status === 'declined' ? t('responses.statusDeclined', 'Não poderá') :
                   u.status === 'maybe' ? t('responses.statusMaybe', 'Ainda não sabe') :
                   t('responses.statusPending', 'Aguardando')
                  }
                </span>
             </div>
           </div>
         ))}
       </div>
    </div>
  );
};

export default TeamStatusSummary;
