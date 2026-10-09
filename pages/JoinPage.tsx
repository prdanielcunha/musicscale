import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { acceptInvite } from '../services/inviteService';
import Spinner from '../components/common/Spinner';
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';

export default function JoinPage() {
  const [params] = useSearchParams();
  const { organizationId } = useParams<{ organizationId?: string }>();
  const location = useLocation();
  const token = params.get('token') || params.get('invite');
  const { user, loading } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  if (loading) return <div className="flex h-[100dvh] items-center justify-center bg-[#050505]"><Spinner size="lg" /></div>;
  if (!token) return <Navigate to="/" replace />;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  const handleAccept = async () => {
    setProcessing(true); setError(null);
    try {
      const result = await acceptInvite(await user.getIdToken(true), token, organizationId);
      if (!result.success) throw new Error(result.message);
      sessionStorage.removeItem('pendingInviteToken');
      showToast(t('join.accepted', 'Convite aceito com sucesso!'), 'success');
      window.location.replace('/');
    } catch (e: any) {
      const reason = String(e?.message || '');
      const lang = String(i18n.language || 'pt').toLowerCase();
      const localized = lang.startsWith('en') ? {
        login: 'Your session needs to be refreshed. Sign in and try again.',
        email: 'This invitation belongs to a different email address.',
        generic: 'We could not accept your invitation. Please try again.'
      } : lang.startsWith('es') ? {
        login: 'Tu sesión debe actualizarse. Inicia sesión y vuelve a intentarlo.',
        email: 'Esta invitación pertenece a otra dirección de correo.',
        generic: 'No pudimos aceptar tu invitación. Inténtalo de nuevo.'
      } : {
        login: 'Sua sessão precisa ser atualizada. Entre novamente e tente aceitar o convite.',
        email: 'Este convite pertence a outro endereço de e-mail.',
        generic: 'Não foi possível aceitar o convite. Tente novamente.'
      };
      setError(
        ['UNAUTHORIZED', 'UNAUTHENTICATED', 'INVALID_ID_TOKEN'].includes(reason)
          ? localized.login
          : reason === 'INVITE_IDENTITY_MISMATCH'
            ? localized.email
            : localized.generic
      );
      setProcessing(false);
    }
  };

  return <div className="flex bg-[#050505] min-h-[100dvh] items-center justify-center p-6">
    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-8 text-center">
      <img src="/LogoIcon.png" alt="MusicScale" className="mx-auto mb-6 h-16 w-16 object-contain" />
      <h1 className="mb-2 text-2xl font-bold dark:text-white">{t('join.title', 'Você foi convidado(a)')}</h1>
      <p className="mb-8 text-sm text-slate-500">{t('join.generic_invitation', 'Você recebeu um convite para entrar no MusicScale.')}</p>
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
      <button onClick={handleAccept} disabled={processing} className="flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 font-semibold text-white disabled:opacity-50">
        {processing ? <Spinner size="sm" /> : t('join.accept', 'Aceitar convite')}
      </button>
      <button onClick={() => navigate('/')} className="mt-3 text-sm text-slate-500">{t('common.cancel_btn', 'Cancelar')}</button>
    </div>
  </div>;
}
