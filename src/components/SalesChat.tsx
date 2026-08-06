import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import pt from '../packages/i18n/locales/pt';

interface SalesChatProps {
  isOpen?: boolean;
  onClose?: () => void;
  whatsappNumber?: string;
}

export const SalesChat: React.FC<SalesChatProps> = ({
  isOpen = true,
  onClose,
  whatsappNumber = '5511999999999',
}) => {
  const { t } = useTranslation();
  const [selectedCategory] = useState<string | null>('plans');
  const [messages, setMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string }>>([
    {
      sender: 'bot',
      text: 'Olá! Sou o assistente comercial do MusicScale. Como posso ajudar seu ministério hoje?'
    }
  ]);

  const commonQuestions = [
    {
      id: 'scope_subscription',
      category: 'plans',
      qKey: 'landing:faq_q5',
      aKey: 'landing:faq_a5',
      question: t('landing:faq_q5', t('landing.faq_q5', pt.landing.faq_q5)),
      answer: t('landing:faq_a5', t('landing.faq_a5', pt.landing.faq_a5))
    },
    {
      id: 'trial_info',
      category: 'plans',
      qKey: 'landing:faq_q1',
      aKey: 'landing:faq_a1',
      question: 'Como funciona o teste grátis?',
      answer: 'Você tem 7 dias de acesso completo sem compromisso.'
    },
    {
      id: 'invite_members',
      category: 'team',
      qKey: 'landing:faq_q2',
      aKey: 'landing:faq_a2',
      question: 'Como convidar a equipe?',
      answer: 'Você pode enviar convites ilimitados dentro do limite do plano escolhido.'
    }
  ];

  const handleSelectQuestion = (q: typeof commonQuestions[0]) => {
    setMessages((prev) => [
      ...prev,
      { sender: 'user', text: q.question },
      { sender: 'bot', text: q.answer }
    ]);
  };

  const handleOpenWhatsApp = () => {
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá, gostaria de tirar dúvidas sobre o MusicScale.')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-[360px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden text-zinc-100 font-sans">
      <div className="bg-zinc-800/90 px-4 py-3 border-b border-zinc-700/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-sm text-white">Atendimento Comercial</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Fechar chat"
            className="text-zinc-400 hover:text-white text-lg font-bold px-2 py-0.5 rounded hover:bg-zinc-700/50"
          >
            ✕
          </button>
        )}
      </div>

      <div className="p-4 h-80 overflow-y-auto space-y-3 bg-zinc-950/50">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-amber-500 text-zinc-950 font-medium rounded-br-none'
                  : 'bg-zinc-800 text-zinc-200 border border-zinc-700/60 rounded-bl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-zinc-900 border-t border-zinc-800 space-y-2">
        <div className="text-xs text-zinc-400 font-medium px-1">Perguntas Frequentes:</div>
        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
          {commonQuestions
            .filter((q) => !selectedCategory || q.category === selectedCategory)
            .map((q) => (
              <button
                key={q.id}
                onClick={() => handleSelectQuestion(q)}
                className="w-full text-left text-xs bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 px-3 py-2 rounded-lg border border-zinc-700/50 transition-colors truncate"
              >
                {q.question}
              </button>
            ))}
        </div>

        <button
          onClick={handleOpenWhatsApp}
          className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow"
        >
          <span>Falar no WhatsApp</span>
        </button>
      </div>
    </div>
  );
};

export default SalesChat;
