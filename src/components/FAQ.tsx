import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import pt from '../packages/i18n/locales/pt';

export const FAQ: React.FC = () => {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqItems = [
    {
      qKey: 'landing:faq_q1',
      aKey: 'landing:faq_a1',
      defaultQ: 'Como funciona o teste gratuito de 7 dias?',
      defaultA: 'Você pode utilizar todos os recursos do plano escolhido durante 7 dias sem qualquer cobrança. Caso decida não continuar, pode cancelar a qualquer momento.'
    },
    {
      qKey: 'landing:faq_q2',
      aKey: 'landing:faq_a2',
      defaultQ: 'Como faço para convidar meus músicos e voluntários?',
      defaultA: 'Dentro do seu painel administrativo, basta acessar a aba de integrantes e enviar convites por e-mail ou link de acesso para sua equipe.'
    },
    {
      qKey: 'landing:faq_q3',
      aKey: 'landing:faq_a3',
      defaultQ: 'Posso alterar meu plano posteriormente?',
      defaultA: 'Sim! Você pode fazer upgrade ou downgrade de plano a qualquer momento diretamente na central de assinatura.'
    },
    {
      qKey: 'landing:faq_q4',
      aKey: 'landing:faq_a4',
      defaultQ: 'Quais formas de pagamento são aceitas?',
      defaultA: 'Aceitamos cartões de crédito das principais bandeiras e PIX na contratação de planos anuais.'
    },
    {
      qKey: 'landing:faq_q5',
      aKey: 'landing:faq_a5',
      defaultQ: pt.landing.faq_q5,
      defaultA: pt.landing.faq_a5
    }
  ];

  const toggleIndex = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-3xl font-bold text-white tracking-tight">Perguntas Frequentes</h2>
        <p className="text-zinc-400 text-sm sm:text-base">Tire suas dúvidas sobre o funcionamento do MusicScale.</p>
      </div>

      <div className="space-y-4">
        {faqItems.map((item, index) => {
          const question = t(item.qKey, t(item.qKey.replace(':', '.'), item.defaultQ));
          const answer = t(item.aKey, t(item.aKey.replace(':', '.'), item.defaultA));
          const isOpen = openIndex === index;

          return (
            <div
              key={index}
              className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden transition-colors"
            >
              <button
                onClick={() => toggleIndex(index)}
                className="w-full py-4 px-6 text-left flex items-center justify-between font-semibold text-white hover:text-amber-400 transition-colors"
              >
                <span>{question}</span>
                <span className="text-amber-400 text-xl font-bold transition-transform duration-200" style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}>
                  +
                </span>
              </button>
              {isOpen && (
                <div className="px-6 pb-5 pt-1 text-sm text-zinc-300 border-t border-zinc-800/50 leading-relaxed">
                  {answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FAQ;
