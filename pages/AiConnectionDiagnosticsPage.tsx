import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function AiConnectionDiagnosticsPage() {
  const { t } = useTranslation();
  const running = useRef(false);
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [code, setCode] = useState('');

  const check = async () => {
    if (running.current) return;
    running.current = true;
    setStatus('checking');
    setCode('');
    try {
      const { verifyMusicScaleAiConnection } = await import('../services/firebase');
      await verifyMusicScaleAiConnection();
      setStatus('success');
    } catch (error: unknown) {
      const candidate = (error as { code?: unknown } | null)?.code;
      // Never render/log raw exceptions: messages can contain credentials or input.
      setCode(typeof candidate === 'string' && /^appCheck\/[a-z-]+$/.test(candidate)
        ? candidate : 'AI_CONNECTION_CHECK_FAILED');
      setStatus('error');
    } finally {
      running.current = false;
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center">
      <section className="w-full max-w-lg rounded-2xl border border-slate-700 p-6 space-y-5">
        <p className="text-sm text-slate-400">MusicScale</p>
        <h1 className="text-xl font-semibold">{t('aiConnection.title', 'Verificar conexão da IA')}</h1>
        <p>{t('aiConnection.description', 'Este teste verifica a conexão segura deste navegador. Não exige login, não processa músicas e não confirma o salvamento.')}</p>
        <button type="button" onClick={check} disabled={status === 'checking'} aria-busy={status === 'checking'} className="w-full min-h-12 rounded-xl bg-indigo-600 px-4 py-3 font-semibold disabled:opacity-50">
          {status === 'checking' ? t('aiConnection.checking', 'Verificando…') : t('aiConnection.check', 'Verificar conexão')}
        </button>
        <div role="status" aria-live="polite">
          {status === 'success' && <p>{t('aiConnection.success', 'Conexão segura verificada. O processamento e o salvamento precisam ser testados com uma conta autenticada.')}</p>}
          {status === 'error' && <><p>{t('aiConnection.failure', 'Não foi possível verificar a conexão segura. Este código ajuda o suporte a investigar:')}</p><code>{code}</code></>}
        </div>
      </section>
    </main>
  );
}
