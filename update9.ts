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
  "leaderSummary.accepted_one": "confirmed",
  "leaderSummary.accepted_other": "confirmed",
  "leaderSummary.pending_one": "awaiting a response",
  "leaderSummary.pending_other": "awaiting a response",
  "leaderSummary.maybe_one": "unsure",
  "leaderSummary.maybe_other": "unsure",
  "leaderSummary.declined_one": "can't attend",
  "leaderSummary.declined_other": "can't attend"
});

addTranslations('locales/es.json', {
  "leaderSummary.accepted_one": "confirmado",
  "leaderSummary.accepted_other": "confirmados",
  "leaderSummary.pending_one": "esperando respuesta",
  "leaderSummary.pending_other": "esperando respuesta",
  "leaderSummary.maybe_one": "aún no sabe",
  "leaderSummary.maybe_other": "aún no saben",
  "leaderSummary.declined_one": "no podrá asistir",
  "leaderSummary.declined_other": "no podrán asistir"
});

addTranslations('locales/pt.json', {
  "leaderSummary.accepted_one": "confirmado",
  "leaderSummary.accepted_other": "confirmados",
  "leaderSummary.pending_one": "aguardando resposta",
  "leaderSummary.pending_other": "aguardando resposta",
  "leaderSummary.maybe_one": "ainda não sabe",
  "leaderSummary.maybe_other": "ainda não sabem",
  "leaderSummary.declined_one": "não poderá",
  "leaderSummary.declined_other": "não poderão"
});

addTranslations('locales/en.json', {
  "scaleResponses.errors.generic": "An error occurred while updating your response.",
  "scaleResponses.errors.idempotencyConflict": "Idempotency conflict: the same key was used with a different payload.",
  "scaleResponses.errors.notFound": "Scale not found.",
  "scaleResponses.errors.permissionDenied": "Access denied.",
  "scaleResponses.errors.notPublished": "Scale is not published.",
  "scaleResponses.errors.eventStarted": "This event has already started and the response can no longer be changed.",
  "scaleResponses.errors.notAssigned": "You are not scheduled for this event."
});

addTranslations('locales/pt.json', {
  "scaleResponses.errors.generic": "Ocorreu um erro ao atualizar sua resposta.",
  "scaleResponses.errors.idempotencyConflict": "Conflito de idempotência: a mesma chave foi usada com um payload diferente.",
  "scaleResponses.errors.notFound": "Escala não encontrada.",
  "scaleResponses.errors.permissionDenied": "Acesso negado.",
  "scaleResponses.errors.notPublished": "A escala não está publicada.",
  "scaleResponses.errors.eventStarted": "O horário deste evento já começou e a resposta não pode mais ser alterada.",
  "scaleResponses.errors.notAssigned": "Você não está escalado neste evento."
});

addTranslations('locales/es.json', {
  "scaleResponses.errors.generic": "Ocurrió un error al actualizar tu respuesta.",
  "scaleResponses.errors.idempotencyConflict": "Conflicto de idempotencia: se utilizó la misma clave con un payload diferente.",
  "scaleResponses.errors.notFound": "Escala no encontrada.",
  "scaleResponses.errors.permissionDenied": "Acceso denegado.",
  "scaleResponses.errors.notPublished": "La escala no está publicada.",
  "scaleResponses.errors.eventStarted": "Este evento ya comenzó y la respuesta ya no puede cambiarse.",
  "scaleResponses.errors.notAssigned": "No estás programado para este evento."
});

console.log("Translation counts added!");
