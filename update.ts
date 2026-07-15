import fs from 'fs';

const addTranslations = (file, newKeys) => {
  const content = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!content.notifications) {
    content.notifications = {};
  }
  Object.assign(content.notifications, newKeys);
  fs.writeFileSync(file, JSON.stringify(content, null, 2));
};

// English
addTranslations('locales/en.json', {
  detailTitle: "Notification Details",
  sentAt: "Sent at",
  scaleInfo: "Scale Information",
  dateAndTime: "Date and Time",
  atTime: "at",
  location: "Location",
  notInformed: "Not informed",
  observations: "Observations",
  addToCalendarText: "Add to your calendar:",
  viewFullScale: "View Full Scale",
  emptyTitle: "Empty Inbox",
  emptyMessage: "You haven't received any notifications yet. New scales and updates will appear here.",
  assignedGeneral: "You have been scheduled!",
  assignedToPlay: "You have been scheduled to play {{functions}}",
  scaleUpdated: "Music Scale Updated",
  eventOnDate: "At the event on {{date}}{{time}}.",
  newScalePublished: "A new music scale has been published."
});

// Spanish
addTranslations('locales/es.json', {
  detailTitle: "Detalles de Notificación",
  sentAt: "Enviado en",
  scaleInfo: "Información de la Escala",
  dateAndTime: "Fecha y Hora",
  atTime: "a las",
  location: "Ubicación",
  notInformed: "No informado",
  observations: "Observaciones",
  addToCalendarText: "Añadir a tu calendario:",
  viewFullScale: "Ver Escala Completa",
  emptyTitle: "Bandeja de entrada vacía",
  emptyMessage: "Aún no has recibido notificaciones. Las nuevas escalas y actualizaciones aparecerán aquí.",
  assignedGeneral: "¡Has sido programado!",
  assignedToPlay: "Has sido programado para tocar {{functions}}",
  scaleUpdated: "Escala Musical Actualizada",
  eventOnDate: "En el evento del día {{date}}{{time}}.",
  newScalePublished: "Se ha publicado una nueva escala musical."
});

// Portuguese
addTranslations('locales/pt.json', {
  detailTitle: "Detalhes da Notificação",
  sentAt: "Enviada em",
  scaleInfo: "Informações da Escala",
  dateAndTime: "Data e Hora",
  atTime: "às",
  location: "Local",
  notInformed: "Não informado",
  observations: "Observações",
  addToCalendarText: "Adicione à sua agenda:",
  viewFullScale: "Ver Escala Completa",
  emptyTitle: "Caixa de entrada vazia",
  emptyMessage: "Você ainda não recebeu nenhuma notificação. Novas escalas e atualizações aparecerão aqui.",
  assignedGeneral: "Você foi escalado!",
  assignedToPlay: "Você foi escalado para tocar {{functions}}",
  scaleUpdated: "Escala de Músicas Atualizada",
  eventOnDate: "No evento do dia {{date}}{{time}}.",
  newScalePublished: "Uma nova escala de música foi publicada."
});

console.log("Translations updated!");
