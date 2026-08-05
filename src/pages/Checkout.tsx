import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import pt from '../packages/i18n/locales/pt';

interface CheckoutProps {
  planName?: string;
  price?: string;
  billingCycle?: 'monthly' | 'yearly';
  activeOrganizationId?: string;
  onConfirmCheckout?: () => void;
}

export const Checkout: React.FC<CheckoutProps> = ({
  planName = 'Advanced',
  price = 'R$ 69,90 / mês',
  billingCycle = 'yearly',
  activeOrganizationId = 'org_default',
  onConfirmCheckout,
}) => {
  const { t } = useTranslation();
  const [couponCode, setCouponCode] = useState('');

  const scopeTitle = t('checkout:subscription_scope_title', t('checkout.subscription_scope_title', pt.checkout.subscription_scope_title));
  const scopeDesc = t('checkout:subscription_scope_desc', t('checkout.subscription_scope_desc', pt.checkout.subscription_scope_desc));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Coluna 1: Informações de Pagamento */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <h2 className="text-xl font-bold text-white">Dados da Organização</h2>
          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">ID da Organização</label>
              <input
                type="text"
                readOnly
                value={activeOrganizationId}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Cupom de Desconto</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="DIGITE SEU CUPOM"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onConfirmCheckout}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl shadow-lg shadow-amber-500/10 transition-colors mt-4"
          >
            Ir para Pagamento Seguro
          </button>
        </div>

        {/* Coluna 2: Resumo da Assinatura */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Resumo da Assinatura</h2>

            {/* Bloco Informativo Compacto de Escopo da Assinatura */}
            <div className="bg-zinc-950/80 border border-amber-500/20 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                  {scopeTitle}
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-normal">
                {scopeDesc}
              </p>
            </div>

            {/* Lista de Itens do Resumo */}
            <div className="border-t border-zinc-800/80 pt-4 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Plano Selecionado</span>
                <span className="font-semibold text-white">{planName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Ciclo de Cobrança</span>
                <span className="font-semibold text-white capitalize">{billingCycle === 'yearly' ? 'Anual' : 'Mensal'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Período de Teste</span>
                <span className="font-semibold text-emerald-400">7 Dias Grátis</span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-800/80 pt-4 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-base font-bold text-white">Total</span>
              <span className="text-2xl font-extrabold text-amber-400">{price}</span>
            </div>
            <p className="text-[11px] text-zinc-500 text-right">
              Cobrança iniciada somente após os 7 dias de teste grátis.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Checkout;
