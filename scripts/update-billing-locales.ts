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
    member: "membro",
    members: "membros",
    songs: "músicas",
    song: "música",
    current_plan: "Plano atual",
  },
  dashboard: {
    songs_pl: "{{count}} músicas",
    song_sg: "{{count}} música"
  }
};

const en = {
  billing: {
    member: "member",
    members: "members",
    songs: "songs",
    song: "song",
    current_plan: "Current plan",
  },
  dashboard: {
    songs_pl: "{{count}} songs",
    song_sg: "{{count}} song"
  }
};

const es = {
  billing: {
    member: "miembro",
    members: "miembros",
    songs: "canciones",
    song: "canción",
    current_plan: "Plan actual",
  },
  dashboard: {
    songs_pl: "{{count}} canciones",
    song_sg: "{{count}} canción"
  }
};

update('locales/pt.json', pt);
update('locales/en.json', en);
update('locales/es.json', es);
