import React, { useEffect, useState } from 'react';

// This screen precedes i18next itself. Keep its tiny dictionary independent of
// application catalogs, Firebase and the private provider tree.
const copy = {
  pt: {
    loading: 'Abrindo MusicScale…',
    slow: 'Sua conexão está demorando. Continuamos carregando o aplicativo.',
    retry: 'Tentar novamente',
  },
  en: {
    loading: 'Opening MusicScale…',
    slow: 'Your connection is taking longer. We’re still loading the app.',
    retry: 'Try again',
  },
  es: {
    loading: 'Abriendo MusicScale…',
    slow: 'Tu conexión está tardando. Seguimos cargando la aplicación.',
    retry: 'Intentar de nuevo',
  },
};

function startupLanguage(): keyof typeof copy {
  let language = navigator.language;
  try {
    language = localStorage.getItem('millionsnest_i18n_lng') || language;
  } catch { /* Storage can be unavailable in private browsing. */ }
  const base = language?.toLowerCase().split('-')[0];
  return base === 'en' || base === 'es' ? base : 'pt';
}

export default function BootLoadingScreen() {
  const [slow, setSlow] = useState(false);
  const text = copy[startupLanguage()];

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 12000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div style={{ position: 'relative', textAlign: 'center', maxWidth: 320, padding: 24 }}>
      <svg className="animate-spin" style={{ width: 36, height: 36, color: '#6366f1', margin: '0 auto 20px' }} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <div role="status" aria-live="polite">
        <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{text.loading}</p>
        {slow && <p style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.6 }}>{text.slow}</p>}
      </div>
      {slow && (
        <button
          type="button"
          onPointerDown={event => event.stopPropagation()}
          onPointerUp={event => event.stopPropagation()}
          onTouchStart={event => event.stopPropagation()}
          onTouchEnd={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); window.location.reload(); }}
          style={{ marginTop: 16, minHeight: 44, padding: '10px 20px', borderRadius: 12, border: '1px solid #374151', background: '#111827', color: '#fff', cursor: 'pointer' }}
        >
          {text.retry}
        </button>
      )}
    </div>
  );
}
