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
  markAllAsRead: "Mark all as read",
  markAsRead: "Mark as read",
});

addTranslations('locales/es.json', {
  markAllAsRead: "Marcar todas como leídas",
  markAsRead: "Marcar como leída",
});

addTranslations('locales/pt.json', {
  markAllAsRead: "Marcar todas como lidas",
  markAsRead: "Marcar como lida",
});

console.log("Mark as read translations updated!");
