import fs from 'fs';

const addTranslations = (file, newKeys) => {
  const content = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!content.notifications) {
    content.notifications = {};
  }
  Object.assign(content.notifications, newKeys);
  fs.writeFileSync(file, JSON.stringify(content, null, 2));
};

addTranslations('locales/en.json', {
  unreadCountMsg: "You have {{count}} unread notification",
  unreadCountMsg_plural: "You have {{count}} unread notifications",
  noNewNotifications: "No new notifications",
  assignedGeneral: "You have been scheduled!"
});

addTranslations('locales/es.json', {
  unreadCountMsg: "Tienes {{count}} notificación no leída",
  unreadCountMsg_plural: "Tienes {{count}} notificaciones no leídas",
  noNewNotifications: "No hay notificaciones nuevas",
  assignedGeneral: "¡Has sido programado!"
});

addTranslations('locales/pt.json', {
  unreadCountMsg: "Você tem {{count}} notificação não lida",
  unreadCountMsg_plural: "Você tem {{count}} notificações não lidas",
  noNewNotifications: "Nenhuma notificação nova",
  assignedGeneral: "Você foi escalado!"
});

console.log("Header translations updated!");
