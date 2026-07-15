import fs from 'fs';

const addTranslations = (file, newKeys) => {
  const content = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!content.common) {
    content.common = {};
  }
  Object.assign(content.common, newKeys);
  fs.writeFileSync(file, JSON.stringify(content, null, 2));
};

addTranslations('locales/en.json', {
  close: "Close",
  error: "Error",
  unknownError: "An unknown error occurred.",
  permissionDenied: "Permission denied. Check your role in the organization.",
  errorSavingSong: "Error saving song",
  details: "Details",
  correlation: "Correlation",
  errorSaving: "Error saving",
  errorDeleting: "Error deleting",
  errorCloning: "Error cloning",
  deleted: "Deleted",
  scalesDeletedSuccess: "scale(s) deleted successfully.",
  errorDeletingScales: "An error occurred while deleting scales.",
  errorCreatingScale: "Error creating scale"
});

addTranslations('locales/es.json', {
  close: "Cerrar",
  error: "Error",
  unknownError: "Ocurrió un error desconocido.",
  permissionDenied: "Permiso denegado. Compruebe su rol en la organización.",
  errorSavingSong: "Error al guardar la canción",
  details: "Detalles",
  correlation: "Correlación",
  errorSaving: "Error al guardar",
  errorDeleting: "Error al eliminar",
  errorCloning: "Error al clonar",
  deleted: "Eliminado",
  scalesDeletedSuccess: "escala(s) eliminada(s) con éxito.",
  errorDeletingScales: "Ocurrió un error al eliminar escalas.",
  errorCreatingScale: "Error al crear la escala"
});

addTranslations('locales/pt.json', {
  close: "Fechar",
  error: "Erro",
  unknownError: "Ocorreu um erro desconhecido.",
  permissionDenied: "Sem permissão. Verifique seu papel na organização.",
  errorSavingSong: "Erro ao salvar música",
  details: "Detalhes",
  correlation: "Correlação",
  errorSaving: "Erro ao salvar",
  errorDeleting: "Erro ao excluir",
  errorCloning: "Erro ao clonar",
  deleted: "Excluído",
  scalesDeletedSuccess: "escala(s) excluída(s) com sucesso.",
  errorDeletingScales: "Ocorreu um erro ao excluir as escalas.",
  errorCreatingScale: "Erro ao criar escala"
});

console.log("Common translations updated!");
