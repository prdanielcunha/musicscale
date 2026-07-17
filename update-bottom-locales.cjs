const fs = require('fs');

const addNavKeys = (file, translations) => {
  const content = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  if (!content.nav) content.nav = {};
  if (!content.nav.bottom) content.nav.bottom = {};
  
  Object.assign(content.nav.bottom, translations);
  
  fs.writeFileSync(file, JSON.stringify(content, null, 2));
};

addNavKeys('locales/pt.json', {
  dashboard: "Painel",
  songs: "Músicas",
  scales: "Escalas",
  library: "Biblioteca",
  account: "Conta"
});

addNavKeys('locales/en.json', {
  dashboard: "Dashboard",
  songs: "Songs",
  scales: "Scales",
  library: "Library",
  account: "Account"
});

addNavKeys('locales/es.json', {
  dashboard: "Panel",
  songs: "Canciones",
  scales: "Escalas",
  library: "Biblioteca",
  account: "Cuenta"
});

console.log("Translations updated");
