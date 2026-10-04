import React from 'react';
import { ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NESTTUNER_HOSTING_ORIGIN = 'https://mn-nesttuner-555464791734.web.app';
const NESTTUNER_PUBLIC_ORIGIN = 'https://nesttuner.millionsnest.com';
const NESTTUNER_CONSUMER = 'musicscale-0.10.4-beta.0';

const resolveLocale = (language?: string) => {
  const normalized = (language || 'pt-BR').toLowerCase();
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('en')) return 'en';
  return 'pt-BR';
};

const publicPathFor = (locale: string) => {
  if (locale === 'es') return 'es';
  if (locale === 'en') return 'en';
  return 'pt';
};

const NestTunerEmbed: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = resolveLocale(i18n.resolvedLanguage || i18n.language);
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = React.useState(0);

  const localePath = publicPathFor(locale);
  const frameUrl = React.useMemo(() => {
    const url = new URL(`/${localePath}/`, NESTTUNER_HOSTING_ORIGIN);
    url.searchParams.set('embed', 'musicscale');
    url.searchParams.set('consumer', NESTTUNER_CONSUMER);
    url.searchParams.set('attempt', String(attempt));
    return url.toString();
  }, [localePath, attempt]);

  React.useEffect(() => {
    setStatus('loading');

    const timer = window.setTimeout(() => {
      setStatus((current) => current === 'loading' ? 'error' : current);
    }, 15000);

    return () => window.clearTimeout(timer);
  }, [frameUrl]);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== NESTTUNER_HOSTING_ORIGIN) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === 'nesttuner:navigate-back') navigate('/stage-tools');
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [navigate]);

  if (status === 'error') {
    const externalUrl = `${NESTTUNER_PUBLIC_ORIGIN}/${localePath}/`;
    return (
      <div className="mx-auto flex min-h-[62dvh] w-full max-w-2xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-[28px] border border-white/[0.08] bg-[#0d0d11]/95 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-300/[0.07] text-violet-200">
            <RefreshCw className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-white">{t('stage_tools.tuner_error_title')}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/48">{t('stage_tools.tuner_error_description')}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="min-h-11 rounded-xl bg-white px-5 text-sm font-bold text-black transition hover:bg-white/90"
            >
              {t('stage_tools.tuner_retry')}
            </button>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-5 text-sm font-semibold text-white/76 transition hover:bg-white/[0.06]"
            >
              {t('stage_tools.tuner_open_external')}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full min-w-0 overflow-hidden rounded-[22px] bg-[#090c12] sm:rounded-[26px]">
      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 z-10 flex min-h-[60dvh] items-center justify-center bg-[#090c12]">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#101014]/92 px-4 py-3 text-sm text-white/52 shadow-xl">
            <LoaderCircle className="h-4 w-4 animate-spin text-violet-300" aria-hidden="true" />
            {t('stage_tools.tuner_loading')}
          </div>
        </div>
      )}

      <iframe
        key={frameUrl}
        ref={frameRef}
        src={frameUrl}
        title="NestTuner"
        className="block h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] min-h-[640px] w-full border-0 bg-[#090c12] sm:h-[calc(100dvh-2rem)]"
        allow="microphone; autoplay; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
      />
    </div>
  );
};

export default NestTunerEmbed;
