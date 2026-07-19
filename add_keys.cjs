const fs = require('fs');

const keys = {
  pt: {
    discardChangesTitle: "Descartar alterações?",
    discardChangesDescription: "Você fez alterações nesta escala que ainda não foram salvas.",
    discardAndExit: "Descartar e sair",
    keepEditing: "Continuar editando",
    unsavedChanges: "Alterações não salvas",
    selectedSongsCount: "{{count}} músicas selecionadas",
    selectedSongsCount_one: "1 música selecionada",
    selectedSongsCount_zero: "0 músicas selecionadas",
    noSongsSelected: "Nenhuma música selecionada",
    noSongsSelectedDescription: "Escolha músicas da biblioteca para montar o repertório.",
    viewSetlist: "Ver repertório",
    repertoireTab: "Repertório",
    submittingCannotClose: "Aguarde o envio concluir.",
    selectedSongsPreviewMore: "{{songs}} +{{more}}"
  },
  en: {
    discardChangesTitle: "Discard changes?",
    discardChangesDescription: "You have unsaved changes in this scale.",
    discardAndExit: "Discard and exit",
    keepEditing: "Keep editing",
    unsavedChanges: "Unsaved changes",
    selectedSongsCount: "{{count}} songs selected",
    selectedSongsCount_one: "1 song selected",
    selectedSongsCount_zero: "0 songs selected",
    noSongsSelected: "No songs selected",
    noSongsSelectedDescription: "Choose songs from the library to build the repertoire.",
    viewSetlist: "View repertoire",
    repertoireTab: "Repertoire",
    submittingCannotClose: "Please wait for submission to complete.",
    selectedSongsPreviewMore: "{{songs}} +{{more}}"
  },
  es: {
    discardChangesTitle: "¿Descartar cambios?",
    discardChangesDescription: "Tienes cambios sin guardar en esta escala.",
    discardAndExit: "Descartar y salir",
    keepEditing: "Seguir editando",
    unsavedChanges: "Cambios no guardados",
    selectedSongsCount: "{{count}} canciones seleccionadas",
    selectedSongsCount_one: "1 canción seleccionada",
    selectedSongsCount_zero: "0 canciones seleccionadas",
    noSongsSelected: "Ninguna canción seleccionada",
    noSongsSelectedDescription: "Elige canciones de la biblioteca para armar el repertorio.",
    viewSetlist: "Ver repertorio",
    repertoireTab: "Repertorio",
    submittingCannotClose: "Espera a que finalice el envío.",
    selectedSongsPreviewMore: "{{songs}} +{{more}}"
  }
};

['pt', 'en', 'es'].forEach(lang => {
  const path = `./locales/${lang}.json`;
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  
  if (!data.scaleModal.cancel) {
    data.scaleModal.cancel = keys[lang].cancel || (lang === 'en' ? 'Cancel' : 'Cancelar');
  }
  
  Object.assign(data.scaleModal, keys[lang]);
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log(`Updated ${lang}.json`);
});
