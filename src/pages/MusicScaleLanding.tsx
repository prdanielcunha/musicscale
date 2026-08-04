import React from 'react';
import { useTranslation } from 'react-i18next';
import pt from '../packages/i18n/locales/pt';
import Flagship from '../components/Flagship';
import Pricing from '../components/Pricing';
import FAQ from '../components/FAQ';

interface MusicScaleLandingProps {
  onLaunch?: () => void;
  onStartTrial?: () => void;
  isLoading?: boolean;
}

export const MusicScaleLanding: React.FC<MusicScaleLandingProps> = ({
  onLaunch,
  onStartTrial,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  const scopeBadge = t('musicscale:subscription_scope_badge', t('musicscale.subscription_scope_badge', pt.musicscale.subscription_scope_badge));
  const scopeDesc = t('musicscale:subscription_scope_desc', t('musicscale.subscription_scope_desc', pt.musicscale.subscription_scope_desc));

  const handleLaunch = () => {
    if (onLaunch) onLaunch();
  };

  const handleStartTrial = () => {
    if (onStartTrial) onStartTrial();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <header className="border-b border-zinc-800/80 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-bold text-zinc-950 text-lg shadow-md">
            MS
          </div>
          <span className="font-bold text-xl tracking-tight text-white">MusicScale</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleLaunch}
            disabled={isLoading}
            className="px-5 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            Acessar Plataforma
          </button>
          <button
            onClick={handleStartTrial}
            disabled={isLoading}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors shadow-md shadow-amber-500/10"
          >
            Testar Grátis
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        <section className="text-center space-y-6">
          <Flagship onStartTrial={handleStartTrial} onExplore={handleLaunch} />

          {/* Destaque Comercial Curto e Visível */}
          <div className="max-w-2xl mx-auto bg-zinc-900/90 border border-amber-500/20 rounded-xl p-4 sm:p-5 text-center shadow-lg">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
              {scopeBadge}
            </span>
            <p className="text-sm text-zinc-300 font-medium leading-relaxed">
              {scopeDesc}
            </p>
          </div>

          {/* Benefits list */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 text-left">
            <div className="p-6 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl">
              <h3 className="font-semibold text-lg text-white mb-2">Gestão de Escalas</h3>
              <p className="text-sm text-zinc-400">Organize escalas de louvor com facilidade, confirmação de presença e notificações automatizadas.</p>
            </div>
            <div className="p-6 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl">
              <h3 className="font-semibold text-lg text-white mb-2">Repertório & Cifras</h3>
              <p className="text-sm text-zinc-400">Acesse a Biblioteca Viva com cifras fiéis, transposição de tom e estruturas completas.</p>
            </div>
            <div className="p-6 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl">
              <h3 className="font-semibold text-lg text-white mb-2">Equipe Unificada</h3>
              <p className="text-sm text-zinc-400">Convide músicos e voluntários do seu ministério sem taxas individuais por integrante.</p>
            </div>
          </div>
        </section>

        <section id="pricing">
          <Pricing onSelectPlan={handleStartTrial} />
        </section>

        <section id="faq">
          <FAQ />
        </section>
      </main>

      <footer className="border-t border-zinc-800/80 py-8 text-center text-xs text-zinc-500">
        MillionsNest Ecosystem &copy; {new Date().getFullYear()} MusicScale. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default MusicScaleLanding;
