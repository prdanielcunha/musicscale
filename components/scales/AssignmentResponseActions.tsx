import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../contexts/ApiContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { EventAssignment, EventAssignmentResponse } from '../../types';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import Modal from '../common/Modal';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { CheckCircle2, HelpCircle, XCircle, RefreshCw } from 'lucide-react';

interface AssignmentResponseActionsProps {
  musicScaleId: string;
  assignments: EventAssignment[]; // Only the assignments for the current user
  eventStart?: Date; // To check if event has started
  compact?: boolean;
}

const AssignmentResponseActions: React.FC<AssignmentResponseActionsProps> = ({
  musicScaleId,
  assignments,
  eventStart,
  compact = false
}) => {
  const { user } = useAuth();
  const api = useApi();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  
  const [responses, setResponses] = useState<EventAssignmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingStatus, setSubmittingStatus] = useState<string | null>(null);
  
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  
  const [isChanging, setIsChanging] = useState(false);
  const isEnabled = useFeatureFlag('musicscale.scaleResponsesV1');

  // Real-time listener for user's responses
  useEffect(() => {
    if (!user || !isEnabled) {
       setLoading(false);
       return;
    }
    
    // We only want to listen to responses belonging to the user for this scale
    const responsesRef = collection(db, 'scales', musicScaleId, 'responses');
    const q = query(responsesRef, where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: EventAssignmentResponse[] = [];
      snapshot.forEach(doc => {
        fetched.push(doc.data() as EventAssignmentResponse);
      });
      setResponses(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to responses:", error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [musicScaleId, user?.uid, isEnabled]);

  const currentResponse = responses.length > 0 ? responses[0] : null;
  const currentStatus = currentResponse?.status || 'pending';

  // Effect to reset isChanging when status updates from server
  useEffect(() => {
     setIsChanging(false);
  }, [currentStatus]);

  if (!isEnabled) return null;
  if (loading) return <div className="flex justify-center p-4"><Spinner className="w-5 h-5 text-slate-500" /></div>;

  // Since user responds once for all their assignments in this scale, they should all have the same status
  const currentReason = currentResponse?.reason || '';

  const hasEventStarted = eventStart && new Date() > eventStart;
  
  const handleRespond = async (status: 'accepted' | 'maybe' | 'declined', reason: string | null = null) => {
    if (submittingStatus || hasEventStarted) return;
    
    setSubmittingStatus(status);
    const idempotencyKey = crypto.randomUUID();
    
    try {
      await api.musicScaleResponses.respondOwn(
        musicScaleId,
        { status, reason },
        idempotencyKey
      );
      
      // Toast message
      if (status === 'accepted') {
        toast({ title: t('responses.acceptedSuccess', 'Presença confirmada') });
      } else if (status === 'maybe') {
        toast({ title: t('responses.maybeSuccess', 'Resposta atualizada') });
      } else if (status === 'declined') {
        toast({ title: t('responses.declinedSuccess', 'Indisponibilidade informada ao líder') });
      }
      
      if (status === 'declined') {
        setIsDeclineModalOpen(false);
      }
    } catch (error: any) {
      let description = error.messageKey 
        ? t(error.messageKey, error.message)
        : t('scaleResponses.errors.generic', 'Não foi possível registrar sua resposta. Tente novamente.');
        
      if (error.correlationId) {
         description += `\n\n${t('common.code', 'Código:')} ${error.correlationId}`;
      }
        
      toast({ 
        title: t('common.error', 'Erro'), 
        description,
        type: "error" 
      });
    } finally {
      setSubmittingStatus(null);
    }
  };

  const functionNames = Array.from(new Set(assignments.map(a => a.functionName).filter(Boolean))) as string[];
  const formatter = new Intl.ListFormat(i18n.language, { style: 'long', type: 'conjunction' });
  const functionText = functionNames.length > 0 
    ? formatter.format(functionNames)
    : t('responses.yourFunction', 'sua função');

  const renderButtons = (showOnlyChange = false) => {
    if (hasEventStarted) {
      return (
        <p className="text-xs text-slate-500 mt-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
          {t('responses.eventStartedWarning', 'O horário deste evento já começou e a resposta não pode mais ser alterada.')}
        </p>
      );
    }

    if (showOnlyChange) {
      return (
        <button 
           onClick={() => {
              // This is a UI trick to show all buttons again. We don't actually change status yet.
           }}
           disabled={submittingStatus !== null}
           className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium transition-colors bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 mt-1"
        >
           <RefreshCw className="w-4 h-4 text-slate-400" />
           {t('responses.changeResponse', 'Alterar resposta')}
        </button>
      );
    }

    return (
      <div className={`grid ${compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'} gap-3 mt-5`}>
        <button 
          onClick={() => handleRespond('accepted')}
          disabled={submittingStatus !== null}
          className={`relative overflow-hidden group flex items-center justify-center gap-2 h-11 px-4 text-sm font-medium rounded-xl transition-all duration-200 border ${
            currentStatus === 'accepted' 
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400'
          }`}
        >
          {submittingStatus === 'accepted' ? <Spinner className="w-4 h-4" /> : <CheckCircle2 className={`w-4 h-4 ${currentStatus === 'accepted' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-emerald-400 transition-colors'}`} />}
          <span>{t('responses.actionConfirm', 'Confirmo')}</span>
        </button>
        
        <button 
          onClick={() => handleRespond('maybe')}
          disabled={submittingStatus !== null}
          className={`relative overflow-hidden group flex items-center justify-center gap-2 h-11 px-4 text-sm font-medium rounded-xl transition-all duration-200 border ${
            currentStatus === 'maybe' 
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400'
          }`}
        >
          {submittingStatus === 'maybe' ? <Spinner className="w-4 h-4" /> : <HelpCircle className={`w-4 h-4 ${currentStatus === 'maybe' ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-400 transition-colors'}`} />}
          <span>{t('responses.actionMaybe', 'Ainda não sei')}</span>
        </button>
        
        <button 
          onClick={() => setIsDeclineModalOpen(true)}
          disabled={submittingStatus !== null}
          className={`relative overflow-hidden group flex items-center justify-center gap-2 h-11 px-4 text-sm font-medium rounded-xl transition-all duration-200 border ${
            currentStatus === 'declined' 
              ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
          }`}
        >
          {submittingStatus === 'declined' ? <Spinner className="w-4 h-4" /> : <XCircle className={`w-4 h-4 ${currentStatus === 'declined' ? 'text-red-400' : 'text-slate-400 group-hover:text-red-400 transition-colors'}`} />}
          <span>{t('responses.actionDecline', 'Não poderei')}</span>
        </button>
      </div>
    );
  };
  
  const renderChangeButtons = () => {
      if (hasEventStarted) {
        return (
          <p className="text-xs text-slate-500 mt-4 bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
            {t('responses.eventStartedWarning', 'O horário deste evento já começou e a resposta não pode mais ser alterada.')}
          </p>
        );
      }
      
      if (isChanging) {
          return renderButtons();
      }
      
      return (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5">
            {currentStatus === 'declined' && (
               <button 
                 onClick={() => handleRespond('accepted')}
                 disabled={submittingStatus !== null}
                 className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium transition-colors bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/20"
               >
                 {submittingStatus === 'accepted' ? <Spinner className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                 {t('responses.nowICan', 'Agora posso participar')}
               </button>
            )}
            <button 
               onClick={() => setIsChanging(true)}
               disabled={submittingStatus !== null}
               className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium transition-colors bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border border-white/10"
            >
               <RefreshCw className="w-4 h-4 text-slate-400" />
               {t('responses.changeResponse', 'Alterar resposta')}
            </button>
          </div>
      );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
      currentStatus === 'accepted' 
        ? 'border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.03)]' 
        : currentStatus === 'declined' 
          ? 'border-red-500/20 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.03)]' 
          : currentStatus === 'maybe' 
            ? 'border-amber-500/20 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.03)]' 
            : 'border-white/10 bg-white/[0.03] shadow-sm hover:border-white/20 hover:bg-white/[0.04]'
    } p-5 sm:p-6 my-4`}>
      
      {currentStatus === 'pending' && (
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
             </div>
             <div>
                <h4 className="font-medium text-slate-200">{t('responses.titlePending', 'Confirme sua participação')}</h4>
                <p className="text-sm text-slate-400 mt-0.5">
                  {t('responses.descPending', 'Você está escalado para {{functions}} neste evento.', { functions: functionText })}
                </p>
             </div>
          </div>
          {renderButtons()}
        </div>
      )}

      {currentStatus === 'accepted' && (
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
             </div>
             <div>
                <h4 className="font-medium text-emerald-400">{t('responses.titleAccepted', 'Presença confirmada')}</h4>
                <p className="text-sm text-emerald-400/70 mt-0.5">
                  {t('responses.descAccepted', 'Você confirmou sua participação como {{functions}}.', { functions: functionText })}
                </p>
             </div>
          </div>
          {renderChangeButtons()}
        </div>
      )}

      {currentStatus === 'maybe' && (
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <HelpCircle className="w-5 h-5 text-amber-400" />
             </div>
             <div>
                <h4 className="font-medium text-amber-400">{t('responses.titleMaybe', 'Você ainda não confirmou')}</h4>
                <p className="text-sm text-amber-400/70 mt-0.5">
                  {t('responses.descMaybe', 'Avise o líder assim que tiver certeza.')}
                </p>
             </div>
          </div>
          {renderChangeButtons()}
        </div>
      )}

      {currentStatus === 'declined' && (
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                <XCircle className="w-5 h-5 text-red-400" />
             </div>
             <div>
                <h4 className="font-medium text-red-400">{t('responses.titleDeclined', 'Você informou que não poderá participar')}</h4>
                {currentReason ? (
                   <p className="text-sm text-red-400/70 mt-0.5 italic">
                      {t('responses.reasonGiven', 'Motivo informado:')} {currentReason}
                   </p>
                ) : (
                   <p className="text-sm text-red-400/70 mt-0.5">
                      Você não participará deste evento.
                   </p>
                )}
             </div>
          </div>
          {renderChangeButtons()}
        </div>
      )}

      <Modal
        isOpen={isDeclineModalOpen}
        onClose={() => {
            setIsDeclineModalOpen(false);
            setDeclineReason('');
        }}
        title={t('responses.declineModalTitle', 'Você não poderá participar?')}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            {t('responses.declineModalDesc', 'Você pode informar um motivo para ajudar o líder a reorganizar a equipe. O preenchimento é opcional.')}
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">
              {t('responses.optionalReason', 'Motivo opcional')}
            </label>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value.substring(0, 300))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              rows={3}
              maxLength={300}
            />
            <div className="flex justify-end text-xs text-slate-500">
              {declineReason.length}/300
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsDeclineModalOpen(false)}>
              {t('common.back', 'Voltar')}
            </Button>
            <Button 
               variant="destructive"
               disabled={submittingStatus !== null}
               onClick={() => handleRespond('declined', declineReason)}
            >
              {submittingStatus === 'declined' && <Spinner className="w-4 h-4 mr-2" />}
              {t('responses.confirmDecline', 'Confirmar indisponibilidade')}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default AssignmentResponseActions;
