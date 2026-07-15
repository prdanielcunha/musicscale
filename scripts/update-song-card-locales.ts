import fs from 'fs';

function update(file: string, data: any) {
  if (fs.existsSync(file)) {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(data)) {
        if (!json[key]) json[key] = {};
        Object.assign(json[key], value);
    }
    fs.writeFileSync(file, JSON.stringify(json, null, 2));
  }
}

const pt = {
  library: {
    in_repertoire: "No repertório",
    b_viva: "B. Viva",
    language_prefix: "Idioma:",
    import_verb: "Importar"
  }
};

const en = {
  library: {
    in_repertoire: "In repertoire",
    b_viva: "L. Library",
    language_prefix: "Language:",
    import_verb: "Import"
  }
};

const es = {
  library: {
    in_repertoire: "En repertorio",
    b_viva: "B. Viva",
    language_prefix: "Idioma:",
    import_verb: "Importar"
  }
};

update('locales/pt.json', pt);
update('locales/en.json', en);
update('locales/es.json', es);
