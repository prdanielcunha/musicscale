const fs = require('fs');

const addNavKeys = (file, translations) => {
  const content = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  if (!content.nav) {
    content.nav = {};
  }
  
  Object.assign(content.nav, translations);
  
  fs.writeFileSync(file, JSON.stringify(content, null, 2));
};

addNavKeys('locales/pt.json', {
  section_primary: "Principal",
  section_admin: "Administração",
  help: "Ajuda",
  degraded_title: "Algumas opções estão temporariamente indisponíveis.",
  degraded_warning: "Atenção",
  degraded_retry: "Tentar novamente",
  degraded_details: "Ver detalhes",
  local_session: "Sessão Local"
});

addNavKeys('locales/en.json', {
  section_primary: "Main",
  section_admin: "Administration",
  help: "Help",
  degraded_title: "Some options are temporarily unavailable.",
  degraded_warning: "Warning",
  degraded_retry: "Try again",
  degraded_details: "See details",
  local_session: "Local Session"
});

addNavKeys('locales/es.json', {
  section_primary: "Principal",
  section_admin: "Administración",
  help: "Ayuda",
  degraded_title: "Algunas opciones no están disponibles temporalmente.",
  degraded_warning: "Atención",
  degraded_retry: "Intentar de nuevo",
  degraded_details: "Ver detalles",
  local_session: "Sesión Local"
});

console.log("Translations updated");
