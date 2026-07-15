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
  plans: {
    title: "Planos e Limites do Ministério",
    subtitle: "Acompanhe e expanda a capacidade."
  }
};

const en = {
  plans: {
    title: "Plans and Limits",
    subtitle: "Monitor and expand capacity."
  }
};

const es = {
  plans: {
    title: "Planes y Límites",
    subtitle: "Monitorea y expande la capacidad."
  }
};

update('locales/pt.json', pt);
update('locales/en.json', en);
update('locales/es.json', es);
