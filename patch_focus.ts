import fs from 'fs';

const path = 'components/dashboard/HomeFocusCard.tsx';
let code = fs.readFileSync(path, 'utf8');

const originalGetRelative = `  const getRelativeLabelElements = (dateStr: string) => {
    if (!dateStr) return { fixed: t('dashboard.focus.nextEvent', 'Próximo evento'), relative: null };
    const todayStr = getLocalDateKey();
    if (dateStr === todayStr) {
      return {
        fixed: t('dashboard.focus.nextEvent', 'Próximo evento'),
        relative: t('dashboard.focus.today', 'Hoje')
      };
    }`;

const newGetRelative = `  const getRelativeLabelElements = (targetEvent: HomeEventSummary) => {
    const dateStr = targetEvent.date;
    if (!dateStr) return { fixed: t('dashboard.focus.nextEvent', 'Próximo evento'), relative: null };
    const todayStr = getLocalDateKey();
    if (dateStr === todayStr) {
      if (targetEvent.eventTemporalState === 'in-progress') {
        return {
          fixed: t('dashboard.focus.nextEvent', 'Próximo evento'),
          relative: t('dashboard.focus.inProgress', 'Em andamento')
        };
      }
      return {
        fixed: t('dashboard.focus.nextEvent', 'Próximo evento'),
        relative: t('dashboard.focus.today', 'Hoje')
      };
    }`;

code = code.replace(originalGetRelative, newGetRelative);

const originalCall = `    const { fixed, relative } = getRelativeLabelElements(targetEvent.date);`;
const newCall = `    const { fixed, relative } = getRelativeLabelElements(targetEvent);`;
code = code.replace(originalCall, newCall);

fs.writeFileSync(path, code);
console.log('patched focus');
