const fs = require('fs');
let content = fs.readFileSync('pages/DashboardPage.tsx', 'utf8');

// 1. Contextual greeting logic
const greetingLogic = `
  const locale = i18n.resolvedLanguage || i18n.language || 'pt-BR';
  const getContextualGreeting = () => {
    const today = new Date();
    const todayWeekday = today.toLocaleDateString(locale, { weekday: 'long' });
    const capitalizedTodayWeekday = todayWeekday.charAt(0).toUpperCase() + todayWeekday.slice(1);
    
    let title = t('dashboard.greeting', { name: firstName });
    let subtitle = t('dashboard.subtitle', 'Veja o que precisa da sua atenção hoje.');

    if (experience.mode === 'assigned-event' && experience.event) {
      const eventDateStr = experience.event.date;
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      
      if (eventDateStr === todayStr) {
         title = \`Hoje é dia de servir, \${firstName}.\`;
         subtitle = 'Confira rapidamente seu repertório.';
      } else {
         const target = new Date(eventDateStr + 'T12:00:00');
         const tomorrow = new Date(today);
         tomorrow.setDate(tomorrow.getDate() + 1);
         const tomorrowStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');

         if (eventDateStr === tomorrowStr) {
           title = \`Tudo pronto para amanhã, \${firstName}.\`;
           subtitle = 'Você servirá no próximo culto.';
         } else {
           const weekday = target.toLocaleDateString(locale, { weekday: 'long' });
           const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
           title = \`Bom \${capitalized}, \${firstName}.\`;
           subtitle = \`Sua escala para \${weekday} está pronta.\`;
         }
      }
    } else if (experience.mode === 'leader-attention' || experience.mode === 'leader-prepared') {
      const eventDateStr = experience.event?.date;
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      
      if (eventDateStr === todayStr) {
         title = \`Bom dia, \${firstName}.\`;
         subtitle = 'Acompanhe a escala de hoje.';
      } else {
         title = \`Bom \${capitalizedTodayWeekday}, \${firstName}.\`;
         subtitle = 'Há escalas que precisam da sua atenção.';
      }
    } else if (experience.mode === 'continue-draft') {
      title = \`Olá, \${firstName}.\`;
      subtitle = 'Você tem um rascunho de escala para terminar.';
    }

    return { title, subtitle };
  };

  const { title: contextualTitle, subtitle: contextualSubtitle } = getContextualGreeting();
`;

// Insert after `const firstName = user?.displayName?.split(' ')[0] || '';`
content = content.replace(
  /const firstName = user\?.displayName\?.split\(' '\)\[0\] \|\| '';/,
  "const firstName = user?.displayName?.split(' ')[0] || '';\n" + greetingLogic
);

// Replace JSX greeting
content = content.replace(
  /\{t\('dashboard\.greeting', \{ name: firstName \}\)\}/,
  '{contextualTitle}'
);
content = content.replace(
  /\{t\('dashboard\.subtitle'\)\}/,
  '{contextualSubtitle}'
);

// Reduce padding in container: `py-6 sm:py-10 space-y-6` -> `py-4 sm:py-6 space-y-4`
content = content.replace(
  /<div className="relative isolate max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 animate-fade-in touch-manipulation">/,
  '<div className="relative isolate max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 animate-fade-in touch-manipulation">'
);

fs.writeFileSync('pages/DashboardPage.tsx', content);
