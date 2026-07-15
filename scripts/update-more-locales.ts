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
    loading: "Carregando...",
    load_more: "Carregar mais músicas",
    local_search_hint: "Exibindo resultados locais rápidos. Limpe a busca e clique em 'Carregar mais' para ampliar a base."
  }
};

const en = {
  library: {
    loading: "Loading...",
    load_more: "Load more songs",
    local_search_hint: "Showing fast local results. Clear the search and click 'Load more' to expand."
  }
};

const es = {
  library: {
    loading: "Cargando...",
    load_more: "Cargar más canciones",
    local_search_hint: "Mostrando resultados locales rápidos. Borre la búsqueda y haga clic en 'Cargar más' para ampliar."
  }
};

update('locales/pt.json', pt);
update('locales/en.json', en);
update('locales/es.json', es);
