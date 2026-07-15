import fs from 'fs';

const addTranslations = (file, newKeys) => {
  const content = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!content.responses) {
    content.responses = {};
  }
  Object.assign(content.responses, newKeys);
  fs.writeFileSync(file, JSON.stringify(content, null, 2));
};

addTranslations('locales/en.json', {
  teamStatus: "Team Status",
  countAccepted: "Confirmed",
  countPending: "Waiting",
  countMaybe: "Not sure",
  countDeclined: "Can't",
  statusAccepted: "Confirmed",
  statusDeclined: "Declined",
  statusMaybe: "Maybe",
  statusPending: "Pending"
});

addTranslations('locales/es.json', {
  teamStatus: "Situación del equipo",
  countAccepted: "Confirmados",
  countPending: "Esperando",
  countMaybe: "No saben",
  countDeclined: "No podrán",
  statusAccepted: "Confirmado",
  statusDeclined: "Declinado",
  statusMaybe: "Tal vez",
  statusPending: "Pendiente"
});

addTranslations('locales/pt.json', {
  teamStatus: "Situação da Equipe",
  countAccepted: "Confirmados",
  countPending: "Aguardando",
  countMaybe: "Ainda não sabem",
  countDeclined: "Não poderão",
  statusAccepted: "Confirmado",
  statusDeclined: "Não poderá",
  statusMaybe: "Ainda não sabe",
  statusPending: "Aguardando"
});

console.log("Responses summary translations updated!");
