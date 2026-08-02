const fs = require('fs');
const path = require('path');

function updateLocale(file, lang) {
  const p = path.join('locales', file);
  if (!fs.existsSync(p)) return;
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  
  if (!data.library) data.library = {};
  
  if (lang === 'pt') {
    data.library.in_lyrics = "Na letra:";
    data.library.key_short = "Tom";
  } else if (lang === 'en') {
    data.library.in_lyrics = "In lyrics:";
    data.library.key_short = "Key";
  } else if (lang === 'es') {
    data.library.in_lyrics = "En la letra:";
    data.library.key_short = "Tono";
  }
  
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  console.log("Updated " + p);
}

updateLocale('pt.json', 'pt');
updateLocale('en.json', 'en');
updateLocale('es.json', 'es');
