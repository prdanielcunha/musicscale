import React from 'react';
import { useTranslation } from 'react-i18next';
import pt from '../packages/i18n/locales/pt';

interface FlagshipProps {
  onStartTrial?: () => void;
  onExplore?: () => void;
}

export const Flagship: React.FC<FlagshipProps> = ({ onStartTrial, onExplore }) => {
  const { t } = useTranslation();

  const scopeBadge = t('landing:subscription_scope_badge', t('landing.subscription_scope_badge', pt.landing.subscription_scope_badge));
  const scopeDesc = t('landing:subscription_scope_desc', t('landing.subscription_scope_desc', pt.landing.subscription_scope_desc));

  return (
    <div className="w-full max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center space-y-6">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
          MusicScale
        </h1>
        <p className="text-lg sm:text-xl text-zinc-300 max-w-3xl mx-auto leading-relaxed">
          A plataforma completa de gestão ministerial de louvor e escalas musicais.
        </p>

        {/* Bloco Comercial Compacto e Premium de Escopo de Assinatura */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 sm:p-6 max-w-2xl mx-auto shadow-xl backdrop-blur-sm transition-all hover:border-amber-500/30">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            {scopeBadge}
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed font-medium">
            {scopeDesc}
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={onStartTrial}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/10"
          >
            Começar Teste Grátis
          </button>
          {onExplore && (
            <button
              onClick={onExplore}
              aria-label="Saiba Mais"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors border border-zinc-700"
            >
              Saiba Mais
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Flagship;
