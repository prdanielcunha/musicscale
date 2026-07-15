import React, { useEffect, useState } from 'react';
import { useSearchParams, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getInviteByToken, acceptInvite, Invite } from '../services/inviteService';
import Spinner from '../components/common/Spinner';
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('invite');
  const { user, loading: authLoading } = useAuth();
  const [inviteData, setInviteData] = useState<Invite | null>(null);
  const [status, setStatus] = useState<'loading' | 'invalid' | 'ready' | 'processing'>('loading');
  const [errorObj, setErrorObj] = useState<string | null>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    if (token) {
      // Save it locally just in case
      sessionStorage.setItem('pendingInviteToken', token);
    }
  }, [token]);

  useEffect(() => {
    async function loadInvite() {
      if (!token) {
        setStatus('invalid');
        setErrorObj('Token de convite não encontrado.');
        return;
      }
      
      const sessionToken = sessionStorage.getItem('pendingInviteToken') || token;

      try {
        const data = await getInviteByToken(sessionToken);
        if (!data || data.status !== 'pending') {
          setStatus('invalid');
          setErrorObj('Este convite inválido, revogado ou já foi utilizado.');
          return;
        }

        if (data.expiresAt && data.expiresAt.toDate && data.expiresAt.toDate() < new Date()) {
          setStatus('invalid');
          setErrorObj('Este convite expirou.');
          return;
        }

        setInviteData(data);
        setStatus('ready');

      } catch (err) {
        setStatus('invalid');
        setErrorObj('Erro ao processar o convite.');
      }
    }

    if (token) {
      loadInvite();
    }
  }, [token]);

  const handleAccept = async () => {
    if (!user) return;
    setStatus('processing');
    try {
      const res = await acceptInvite(user, token!);
      if (res.success) {
        sessionStorage.removeItem('pendingInviteToken');
        showToast('Convite aceito com sucesso!', 'success');
        // A reload is helpful to re-fetch all user profiles and orgs in auth context
        window.location.href = '/';
      } else {
        setStatus('invalid');
        setErrorObj(res.message);
      }
    } catch (e) {
       setStatus('invalid');
       setErrorObj('Ocorreu um erro interno ao processar.');
    }
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="flex bg-[#0a0a0b] dark:bg-[#050505] h-[100dvh] w-full justify-center items-center flex-col relative z-50">
        <Spinner size="lg" />
      </div>
    );
  }

  // Not logged in -> redirect to login with intent
  if (!user && status === 'ready') {
    return <Navigate to={`/login?redirect=${encodeURIComponent(`/join?invite=${token}`)}`} replace />;
  }

  if (status === 'invalid') {
    return (
      <div className="flex bg-[#0a0a0b] dark:bg-[#050505] h-[100dvh] w-full justify-center items-center flex-col p-6 z-50 absolute inset-0">
         <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-black/5 dark:border-white/10 rounded-2xl shadow-xl p-8 text-center animate-fade-in-up">
            <div className="flex justify-center mb-6">
               <img src="/LogoIcon.png" alt="Logo" className="w-16 h-16 object-contain" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-sans tracking-tight text-slate-800 dark:text-white mb-2">
              Convite Indisponível
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 whitespace-pre-wrap leading-relaxed text-sm">
              {errorObj || "Este convite não está mais disponível ou expirou. Peça um novo link ao responsável."}
            </p>
            <button
               onClick={() => navigate('/')}
               className="h-11 w-full bg-slate-900 dark:bg-white text-white dark:text-black font-semibold rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-slate-900/20 dark:shadow-white/20"
            >
               Ir para o Início
            </button>
         </div>
      </div>
    );
  }

  if (status === 'ready' || status === 'processing') {
    return (
      <div className="flex bg-[#0a0a0b] dark:bg-[#050505] h-[100dvh] w-full justify-center items-center flex-col p-6 z-50 absolute inset-0">
         <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-black/5 dark:border-white/10 rounded-2xl shadow-xl p-8 text-center animate-fade-in-up">
            <div className="flex justify-center mb-6">
               <img src="/LogoIcon.png" alt="Logo" className="w-16 h-16 object-contain" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-sans tracking-tight text-slate-800 dark:text-white mb-2">
              Você foi convidado(a)
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed text-sm">
              O administrador <strong className="text-slate-800 dark:text-gray-200">{inviteData?.createdByName || 'da equipe'}</strong> convidou você para fazer parte de <strong className="text-slate-800 dark:text-gray-200">{inviteData?.organizationName || 'uma organização'}</strong> no MusicScale.
            </p>
            <button
               onClick={handleAccept}
               disabled={status === 'processing'}
               className="h-11 w-full bg-slate-900 dark:bg-white text-white dark:text-black font-semibold rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-slate-900/20 dark:shadow-white/20 flex items-center justify-center gap-2"
            >
               {status === 'processing' ? <Spinner size="sm" /> : 'Aceitar Convite'}
            </button>
         </div>
      </div>
    );
  }

  return null;
}
