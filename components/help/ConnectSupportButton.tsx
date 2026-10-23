import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Public support remains available when login, entitlement or the app API is failing. */
export default function ConnectSupportButton() {
  const { i18n } = useTranslation();
  const id = useId();
  const [topic, setTopic] = useState('help');
  const locale = i18n.language.startsWith('en') ? 'en-US' : i18n.language.startsWith('es') ? 'es-ES' : 'pt-BR';
  const copy = {
    'pt-BR': { label: 'Como podemos ajudar?', action: 'Conversar no WhatsApp oficial', hint: 'Toque em Enviar no WhatsApp para iniciar o atendimento.', topics: ['Ajuda para usar', 'Algo não funcionou', 'Entrar na minha conta', 'Assinatura e cobrança', 'Conhecer os planos', 'Outro assunto'] },
    'en-US': { label: 'How can we help?', action: 'Chat on official WhatsApp', hint: 'Tap Send in WhatsApp to start the conversation.', topics: ['Help using the app', 'Something went wrong', 'Sign in to my account', 'Subscription and billing', 'Explore plans', 'Something else'] },
    'es-ES': { label: '¿Cómo podemos ayudarte?', action: 'Hablar por WhatsApp oficial', hint: 'Pulsa Enviar en WhatsApp para iniciar la conversación.', topics: ['Ayuda para usar', 'Algo no funcionó', 'Entrar en mi cuenta', 'Suscripción y cobros', 'Conocer los planes', 'Otro asunto'] },
  }[locale];
  const url = new URL('https://connect.millionsnest.com/api/core/support/contact');
  url.search = new URLSearchParams({ product: 'musicscale', source: 'app', topic, locale, open: '1' }).toString();
  return <div className="mb-5 space-y-3">
    <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200">{copy.label}</label>
    <select id={id} value={topic} onChange={event => setTopic(event.target.value)} className="w-full min-h-[48px] rounded-xl bg-slate-100 px-3 py-3 text-slate-900 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-primary">
      {['help', 'error', 'access', 'billing', 'sales', 'other'].map((value, index) => <option key={value} value={value}>{copy.topics[index]}</option>)}
    </select>
    <a href={url.toString()} target="_blank" rel="noopener noreferrer" className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-center font-semibold text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2">{copy.action}</a>
    <p className="text-xs text-slate-500 dark:text-slate-400">{copy.hint}</p>
  </div>;
}
