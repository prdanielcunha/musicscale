import fs from 'fs';

const addTranslations = (file, newKeys) => {
  const content = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!content.calendar) {
    content.calendar = {};
  }
  Object.assign(content.calendar, newKeys);
  fs.writeFileSync(file, JSON.stringify(content, null, 2));
};

addTranslations('locales/en.json', {
  addToCalendar: "Add to Calendar",
  googleCalendar: "Google Calendar",
  appleOutlookCalendar: "Apple / Outlook Calendar (.ics)",
  staticExportNote: "Static export (will not automatically sync future changes)"
});

addTranslations('locales/es.json', {
  addToCalendar: "Añadir al Calendario",
  googleCalendar: "Google Calendar",
  appleOutlookCalendar: "Calendario Apple / Outlook (.ics)",
  staticExportNote: "Exportación estática (no sincroniza cambios futuros automáticamente)"
});

addTranslations('locales/pt.json', {
  addToCalendar: "Adicionar à Agenda",
  googleCalendar: "Google Agenda",
  appleOutlookCalendar: "Calendario Apple / Outlook (.ics)",
  staticExportNote: "Exportação estática (não sincroniza mudanças futuras automaticamente)"
});

console.log("Calendar translations updated!");
