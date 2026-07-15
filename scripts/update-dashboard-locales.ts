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
  dashboard: {
    at_time: "às",
    team_count: "{{count}} escalado",
    team_count_plural: "{{count}} escalados",
  }
};

const en = {
  dashboard: {
    at_time: "at",
    team_count: "{{count}} scheduled",
    team_count_plural: "{{count}} scheduled",
  }
};

const es = {
  dashboard: {
    at_time: "a las",
    team_count: "{{count}} programado",
    team_count_plural: "{{count}} programados",
  }
};

update('locales/pt.json', pt);
update('locales/en.json', en);
update('locales/es.json', es);
