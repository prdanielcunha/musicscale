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
    currentPlan: "Plano atual",
    liveLibraryBlocked: "Biblioteca Viva Fechada",
    lifetimeAccess: "Acesso Vitalício"
  }
};

const en = {
  billing: {
    member: "member",
    members: "members",
    songs: "songs",
    song: "song",
    currentPlan: "Current Plan",
    liveLibraryBlocked: "Living Library Blocked",
    lifetimeAccess: "Lifetime Access"
  }
};

const es = {
  billing: {
    member: "miembro",
    members: "miembros",
    songs: "canciones",
    song: "canción",
    currentPlan: "Plan actual",
    liveLibraryBlocked: "Biblioteca Viva Bloqueada",
    lifetimeAccess: "Acceso Vitalicio"
  }
};

update('locales/pt.json', pt);
update('locales/en.json', en);
update('locales/es.json', es);
