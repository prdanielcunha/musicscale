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
  acceptedSuccess: "Presence confirmed",
  maybeSuccess: "Response updated",
  declinedSuccess: "Unavailability reported to leader",
  yourFunction: "your role",
  eventStartedWarning: "This event has already started and the response cannot be changed.",
  changeResponse: "Change response",
  actionConfirm: "I confirm",
  actionMaybe: "Not sure yet",
  actionDecline: "I can't",
  nowICan: "Now I can participate",
  titlePending: "Confirm your participation",
  descPending: "You are scheduled for {{functions}} in this event.",
  titleAccepted: "Presence confirmed",
  descAccepted: "You have confirmed your participation as {{functions}}.",
  titleMaybe: "You haven't confirmed yet",
  descMaybe: "Let the leader know as soon as you are sure.",
  titleDeclined: "You informed that you cannot participate",
  reasonGiven: "Reason provided:",
  declineModalTitle: "Can't you participate?",
  declineModalDesc: "You can provide a reason to help the leader reorganize the team. This is optional.",
  optionalReason: "Optional reason",
  confirmDecline: "Confirm unavailability"
});

addTranslations('locales/es.json', {
  acceptedSuccess: "Presencia confirmada",
  maybeSuccess: "Respuesta actualizada",
  declinedSuccess: "Indisponibilidad informada al líder",
  yourFunction: "tu función",
  eventStartedWarning: "Este evento ya ha comenzado y la respuesta no se puede cambiar.",
  changeResponse: "Cambiar respuesta",
  actionConfirm: "Confirmo",
  actionMaybe: "Todavía no lo sé",
  actionDecline: "No podré",
  nowICan: "Ahora puedo participar",
  titlePending: "Confirma tu participación",
  descPending: "Estás programado para {{functions}} en este evento.",
  titleAccepted: "Presencia confirmada",
  descAccepted: "Has confirmado tu participación como {{functions}}.",
  titleMaybe: "Aún no has confirmado",
  descMaybe: "Avísale al líder en cuanto estés seguro.",
  titleDeclined: "Informaste que no podrás participar",
  reasonGiven: "Motivo informado:",
  declineModalTitle: "¿No podrás participar?",
  declineModalDesc: "Puedes proporcionar un motivo para ayudar al líder a reorganizar el equipo. Esto es opcional.",
  optionalReason: "Motivo opcional",
  confirmDecline: "Confirmar indisponibilidad"
});

addTranslations('locales/pt.json', {
  acceptedSuccess: "Presença confirmada",
  maybeSuccess: "Resposta atualizada",
  declinedSuccess: "Indisponibilidade informada ao líder",
  yourFunction: "sua função",
  eventStartedWarning: "O horário deste evento já começou e a resposta não pode mais ser alterada.",
  changeResponse: "Alterar resposta",
  actionConfirm: "Confirmo",
  actionMaybe: "Ainda não sei",
  actionDecline: "Não poderei",
  nowICan: "Agora posso participar",
  titlePending: "Confirme sua participação",
  descPending: "Você está escalado para {{functions}} neste evento.",
  titleAccepted: "Presença confirmada",
  descAccepted: "Você confirmou sua participação como {{functions}}.",
  titleMaybe: "Você ainda não confirmou",
  descMaybe: "Avise o líder assim que tiver certeza.",
  titleDeclined: "Você informou que não poderá participar",
  reasonGiven: "Motivo informado:",
  declineModalTitle: "Você não poderá participar?",
  declineModalDesc: "Você pode informar um motivo para ajudar o líder a reorganizar a equipe. O preenchimento é opcional.",
  optionalReason: "Motivo opcional",
  confirmDecline: "Confirmar indisponibilidade"
});

console.log("Responses translations updated!");
