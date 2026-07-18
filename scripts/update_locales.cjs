const fs = require('fs');
const path = require('path');

const firstValueKeys = {
  pt: {
    title: "Prepare seu primeiro culto",
    subtitle: "Vamos organizar repertório, escala e publicação em poucos passos.",
    progress: "{{current}} de {{total}} etapas essenciais concluídas",
    milestoneRepertoire: "Repertório",
    milestoneFirstScale: "Primeira escala",
    milestoneTeam: "Equipe",
    milestonePublish: "Publicação",
    statusCompleted: "Concluído",
    statusCurrent: "Atual",
    statusPending: "Pendente",
    statusOptional: "Opcional",
    repertoireTitle: "Prepare seu repertório",
    repertoireDescription: "Escolha músicas prontas ou crie a primeira música do seu ministério.",
    starterPackAction: "Escolher repertório inicial",
    starterPackHelper: "Até 10 músicas iniciais prontas para começar.",
    manualAction: "Criar manualmente",
    aiAction: "Importar com IA",
    libraryAction: "Biblioteca Viva",
    firstScaleTitle: "Crie sua primeira escala",
    firstScaleDescription: "Defina data, horário e repertório. O MusicScale já prepara Culto e Local Principal para facilitar o início.",
    createScaleAction: "Criar primeira escala",
    publishTitle: "Sua primeira escala está quase pronta",
    publishDescription: "Revise as informações e publique quando estiver tudo certo.",
    continueDraftAction: "Continuar primeira escala",
    addTeamAction: "Adicionar equipe",
    teamOptionalHelper: "Você também pode publicar agora e adicionar a equipe depois."
  },
  en: {
    title: "Prepare your first service",
    subtitle: "Let's organize repertoire, schedule and publish in a few steps.",
    progress: "{{current}} of {{total}} essential steps completed",
    milestoneRepertoire: "Repertoire",
    milestoneFirstScale: "First Schedule",
    milestoneTeam: "Team",
    milestonePublish: "Publish",
    statusCompleted: "Completed",
    statusCurrent: "Current",
    statusPending: "Pending",
    statusOptional: "Optional",
    repertoireTitle: "Prepare your repertoire",
    repertoireDescription: "Choose ready-made songs or create your ministry's first song.",
    starterPackAction: "Choose starter repertoire",
    starterPackHelper: "Up to 10 starter songs ready to go.",
    manualAction: "Create manually",
    aiAction: "Import with AI",
    libraryAction: "Living Library",
    firstScaleTitle: "Create your first schedule",
    firstScaleDescription: "Set date, time, and repertoire. MusicScale pre-fills Service and Main Location to make it easy.",
    createScaleAction: "Create first schedule",
    publishTitle: "Your first schedule is almost ready",
    publishDescription: "Review the information and publish when everything is set.",
    continueDraftAction: "Continue first schedule",
    addTeamAction: "Add team",
    teamOptionalHelper: "You can also publish now and add the team later."
  },
  es: {
    title: "Prepara tu primer culto",
    subtitle: "Organicemos repertorio, programación y publicación en pocos pasos.",
    progress: "{{current}} de {{total}} pasos esenciales completados",
    milestoneRepertoire: "Repertorio",
    milestoneFirstScale: "Primera programación",
    milestoneTeam: "Equipo",
    milestonePublish: "Publicación",
    statusCompleted: "Completado",
    statusCurrent: "Actual",
    statusPending: "Pendiente",
    statusOptional: "Opcional",
    repertoireTitle: "Prepara tu repertorio",
    repertoireDescription: "Elige canciones listas o crea la primera canción de tu ministerio.",
    starterPackAction: "Elegir repertorio inicial",
    starterPackHelper: "Hasta 10 canciones iniciales listas para usar.",
    manualAction: "Crear manualmente",
    aiAction: "Importar con IA",
    libraryAction: "Biblioteca Viva",
    firstScaleTitle: "Crea tu primera programación",
    firstScaleDescription: "Establece fecha, hora y repertorio. MusicScale ya prepara Culto y Ubicación Principal para facilitar el inicio.",
    createScaleAction: "Crear primera programación",
    publishTitle: "Tu primera programación está casi lista",
    publishDescription: "Revisa la información y publica cuando todo esté listo.",
    continueDraftAction: "Continuar primera programación",
    addTeamAction: "Agregar equipo",
    teamOptionalHelper: "También puedes publicar ahora y agregar el equipo más tarde."
  }
};

const locales = ['pt', 'en', 'es'];

locales.forEach(locale => {
  const filePath = path.join(__dirname, `../locales/${locale}.json`);
  if (fs.existsSync(filePath)) {
    let content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    content.firstValueJourney = firstValueKeys[locale];
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    console.log(`Updated ${locale}.json`);
  }
});
