import React from 'react';
import { ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NESTTUNER_MODULE_URL = 'https://nesttuner.millionsnest.com/embed/nesttuner-element.v0.4.0-beta.0.js';

let embedModulePromise: Promise<unknown> | null = null;

const loadNestTunerModule = () => {
  if (!embedModulePromise) {
    embedModulePromise = import(/* @vite-ignore */ NESTTUNER_MODULE_URL);
  }
  return embedModulePromise;
};

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
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const elementRef = React.useRef<HTMLElement | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    loadNestTunerModule()
      .then(() => {
        if (!cancelled) setStatus('ready');
      })
      .catch(() => {
        embedModulePromise = null;
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  React.useEffect(() => {
    if (status !== 'ready' || !containerRef.current) return;

    const element = document.createElement('nest-tuner');
    element.setAttribute('locale', locale);
    element.style.display = 'block';
    element.style.width = '100%';
    element.style.minWidth = '0';

    const handleBack = () => navigate('/stage-tools');
    element.addEventListener('nesttuner-back', handleBack);
    containerRef.current.replaceChildren(element);
    elementRef.current = element;

    return () => {
      element.removeEventListener('nesttuner-back', handleBack);
      element.remove();
      if (elementRef.current === element) elementRef.current = null;
    };
  }, [status, navigate]);

  React.useEffect(() => {
    elementRef.current?.setAttribute('locale', locale);
  }, [locale]);

  if (status === 'error') {
    const externalUrl = `https://nesttuner.millionsnest.com/${publicPathFor(locale)}/`;
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
    <div className="relative min-h-[70dvh] w-full min-w-0">
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex min-h-[60dvh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#101014]/92 px-4 py-3 text-sm text-white/52 shadow-xl">
            <LoaderCircle className="h-4 w-4 animate-spin text-violet-300" aria-hidden="true" />
            {t('stage_tools.tuner_loading')}
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full min-w-0" aria-busy={status === 'loading'} />
    </div>
  );
};

export default NestTunerEmbed;
