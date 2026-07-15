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
  billing: {
    spots_left: "{{count}} vaga restante",
    spots_left_plural: "{{count}} vagas restantes",
    users_in_plan: "{{used}} de {{limit}} usuários no plano"
  }
};

const en = {
  billing: {
    spots_left: "{{count}} spot left",
    spots_left_plural: "{{count}} spots left",
    users_in_plan: "{{used}} of {{limit}} users in plan"
  }
};

const es = {
  billing: {
    spots_left: "{{count}} espacio restante",
    spots_left_plural: "{{count}} espacios restantes",
    users_in_plan: "{{used}} de {{limit}} usuarios en el plan"
  }
};

update('locales/pt.json', pt);
update('locales/en.json', en);
update('locales/es.json', es);
