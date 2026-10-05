import React from 'react';
import { ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NESTTUNER_PUBLIC_ORIGIN = 'https://nesttuner.millionsnest.com';
const NESTTUNER_EMBED_VERSION = '0.6.5-beta.0';
const NESTTUNER_ELEMENT = 'nest-tuner';
const NESTTUNER_MODULE_URL =
  `${NESTTUNER_PUBLIC_ORIGIN}/embed/nesttuner-element.v${NESTTUNER_EMBED_VERSION}.js`;

let nestTunerModulePromise: Promise<void> | null = null;

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

const ensureNestTunerElement = () => {
  if (customElements.get(NESTTUNER_ELEMENT)) return Promise.resolve();
  if (nestTunerModulePromise) return nestTunerModulePromise;

  nestTunerModulePromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-nesttuner-version="${NESTTUNER_EMBED_VERSION}"]`
    );

    const waitForDefinition = () => {
      customElements.whenDefined(NESTTUNER_ELEMENT).then(() => resolve()).catch(reject);
    };

    if (existing) {
      if (customElements.get(NESTTUNER_ELEMENT)) {
        resolve();
        return;
      }
      existing.addEventListener('load', waitForDefinition, { once: true });
      existing.addEventListener('error', () => reject(new Error('NestTuner module failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.src = NESTTUNER_MODULE_URL;
    script.dataset.nesttunerVersion = NESTTUNER_EMBED_VERSION;
    script.addEventListener('load', waitForDefinition, { once: true });
    script.addEventListener('error', () => {
      script.remove();
      reject(new Error('NestTuner module failed to load.'));
    }, { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    nestTunerModulePromise = null;
    throw error;
  });

  return nestTunerModulePromise;
};

const NestTunerEmbed: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = resolveLocale(i18n.resolvedLanguage || i18n.language);
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const tunerRef = React.useRef<HTMLElement | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const tuner = document.createElement(NESTTUNER_ELEMENT);
    tuner.setAttribute('locale', locale);
    tuner.style.display = 'block';
    tuner.style.width = '100%';
    tuner.style.minWidth = '0';

    const handleBack = () => navigate('/stage-tools');
    tuner.addEventListener('nesttuner-back', handleBack);
    mount.replaceChildren(tuner);
    tunerRef.current = tuner;

    return () => {
      tuner.removeEventListener('nesttuner-back', handleBack);
      tuner.remove();
      if (tunerRef.current === tuner) tunerRef.current = null;
    };
  }, [navigate]);

  React.useEffect(() => {
    tunerRef.current?.setAttribute('locale', locale);
  }, [locale]);

  React.useEffect(() => {
    let active = true;
    setStatus('loading');

    const timeout = window.setTimeout(() => {
      if (active) setStatus('error');
    }, 15000);

    void ensureNestTunerElement()
      .then(() => {
        if (!active) return;
        window.clearTimeout(timeout);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(timeout);
        setStatus('error');
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [attempt]);

  const externalUrl = `${NESTTUNER_PUBLIC_ORIGIN}/${publicPathFor(locale)}/`;

  if (status === 'error') {
    return (
      <div className="flex min-h-[58dvh] w-full items-center justify-center px-5 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-300/[0.07] text-violet-200">
            <RefreshCw className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-white">{t('stage_tools.tuner_error_title')}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/48">{t('stage_tools.tuner_error_description')}</p>
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
    <div className="relative w-full min-w-0">
      <div ref={mountRef} className="w-full min-w-0" />

      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex min-h-[56dvh] items-center justify-center bg-[var(--color-background)]/92 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-sm text-white/52">
            <LoaderCircle className="h-4 w-4 animate-spin text-violet-300" aria-hidden="true" />
            {t('stage_tools.tuner_loading')}
          </div>
        </div>
      )}
    </div>
  );
};

export default NestTunerEmbed;
