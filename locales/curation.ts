export const curationTranslations = {
  pt: {
    title: "Curadoria da Biblioteca",
    subtitle: "Analise e processe as músicas submetidas pelas organizações.",
    admin: {
      analyzeNew: "Analisar novas músicas",
      reanalyze: "Reanalisar classificações",
      scanOrganization: "Varrer repertório de uma organização",
      fixOld: "Corrigir Antigas",
      confirmReanalyze: "Isso reprocessará candidatos (isso pode demorar). Deseja continuar?",
      confirmBackfill: "Isso reprocessará todas as músicas da Biblioteca Viva para garantir a normalização. Deseja continuar?",
      invalidSession: "Sessão inválida. Entre novamente para continuar.",
      reanalysisSuccess: "Reanálise concluída! {{count}} candidatas processadas.",
      backfillSuccess: "Backfill concluído! {{updated}} atualizadas de {{processed}} verificadas.",
      errorPrefix: "Erro: {{error}}"
    },
    filters: {
      all: "Todas",
      pending_review: "Aguardando Revisão",
      likely_unique: "Provável Inédita",
      possible_duplicate: "Possível Duplicada",
      matched_existing: "Match Existente",
      insufficient_data: "Dados Insuficientes",
      processing_failed: "Falha no processamento"
    },
    bulk: {
      selectPage: "Selecionar página",
      clearSelection: "Limpar seleção",
      selected_one: "{{count}} selecionada",
      selected_other: "{{count}} selecionadas",
      importSelected: "Importar selecionadas",
      importAllEligible: "Importar todas as elegíveis"
    },
    errors: {
      firestoreIndexWithLink: "Falta de índice no Firestore.",
      firestoreIndex: "Falta de índice no banco de dados para este filtro. Ajuste no Firebase console.",
      loadCandidates: "Erro ao carregar candidatas.",
      createIndexLink: "Clique aqui para criar no Console",
      retry: "Tentar Novamente"
    },
    empty: {
      title: "Nenhuma candidata",
      description: "Não encontramos nenhuma música enviada para curadoria com este filtro."
    },
    status: {
      approved: "Aprovada",
      linked: "Vinculada",
      matched_existing: "Match existente",
      likely_unique: "Provável inédita",
      possible_duplicate: "Possível duplicada",
      insufficient_data: "Dados insuficientes",
      processing_failed: "Falha",
      pending_review: "Aguardando revisão"
    },
    card: {
      key: "Tom",
      occurrenceSummary_one: "{{occurrences}} ocorrência / {{organizations}} org",
      occurrenceSummary_other: "{{occurrences}} ocorrências / {{organizations}} orgs",
      discoveredOn: "Descoberta em {{date}}",
      recent: "Recente",
      score: "Score: {{score}}%",
      limitedSearch: "Busca Limitada"
    },
    loadMore: "Carregar Mais"
  },
  en: {
    title: "Library Curation",
    subtitle: "Review and process songs submitted by organizations.",
    admin: {
      analyzeNew: "Analyze new songs",
      reanalyze: "Reanalyze classifications",
      scanOrganization: "Scan an organization's repertoire",
      fixOld: "Fix older entries",
      confirmReanalyze: "This will reprocess candidates and may take a while. Do you want to continue?",
      confirmBackfill: "This will reprocess all Live Library songs to ensure normalization. Do you want to continue?",
      invalidSession: "Invalid session. Sign in again to continue.",
      reanalysisSuccess: "Reanalysis complete! {{count}} candidates processed.",
      backfillSuccess: "Backfill complete! {{updated}} updated out of {{processed}} checked.",
      errorPrefix: "Error: {{error}}"
    },
    filters: {
      all: "All",
      pending_review: "Awaiting Review",
      likely_unique: "Likely Unique",
      possible_duplicate: "Possible Duplicate",
      matched_existing: "Existing Match",
      insufficient_data: "Insufficient Data",
      processing_failed: "Processing Failed"
    },
    bulk: {
      selectPage: "Select page",
      clearSelection: "Clear selection",
      selected_one: "{{count}} selected",
      selected_other: "{{count}} selected",
      importSelected: "Import selected",
      importAllEligible: "Import all eligible"
    },
    errors: {
      firestoreIndexWithLink: "A Firestore index is missing.",
      firestoreIndex: "A database index is missing for this filter. Update it in the Firebase console.",
      loadCandidates: "Could not load candidates.",
      createIndexLink: "Click here to create it in the Console",
      retry: "Try Again"
    },
    empty: {
      title: "No candidates",
      description: "No songs submitted for curation match this filter."
    },
    status: {
      approved: "Approved",
      linked: "Linked",
      matched_existing: "Existing match",
      likely_unique: "Likely unique",
      possible_duplicate: "Possible duplicate",
      insufficient_data: "Insufficient data",
      processing_failed: "Failed",
      pending_review: "Awaiting review"
    },
    card: {
      key: "Key",
      occurrenceSummary_one: "{{occurrences}} occurrence / {{organizations}} org",
      occurrenceSummary_other: "{{occurrences}} occurrences / {{organizations}} orgs",
      discoveredOn: "Discovered on {{date}}",
      recent: "Recent",
      score: "Score: {{score}}%",
      limitedSearch: "Limited Search"
    },
    loadMore: "Load More"
  },
  es: {
    title: "Curaduría de la Biblioteca",
    subtitle: "Analiza y procesa las canciones enviadas por las organizaciones.",
    admin: {
      analyzeNew: "Analizar canciones nuevas",
      reanalyze: "Reanalizar clasificaciones",
      scanOrganization: "Revisar el repertorio de una organización",
      fixOld: "Corregir antiguas",
      confirmReanalyze: "Esto volverá a procesar candidatos y puede tardar. ¿Deseas continuar?",
      confirmBackfill: "Esto volverá a procesar todas las canciones de la Biblioteca Viva para garantizar su normalización. ¿Deseas continuar?",
      invalidSession: "Sesión no válida. Inicia sesión nuevamente para continuar.",
      reanalysisSuccess: "¡Reanálisis completado! {{count}} candidatas procesadas.",
      backfillSuccess: "¡Backfill completado! {{updated}} actualizadas de {{processed}} verificadas.",
      errorPrefix: "Error: {{error}}"
    },
    filters: {
      all: "Todas",
      pending_review: "Pendientes de Revisión",
      likely_unique: "Probablemente Inédita",
      possible_duplicate: "Posible Duplicada",
      matched_existing: "Coincidencia Existente",
      insufficient_data: "Datos Insuficientes",
      processing_failed: "Error de procesamiento"
    },
    bulk: {
      selectPage: "Seleccionar página",
      clearSelection: "Limpiar selección",
      selected_one: "{{count}} seleccionada",
      selected_other: "{{count}} seleccionadas",
      importSelected: "Importar seleccionadas",
      importAllEligible: "Importar todas las elegibles"
    },
    errors: {
      firestoreIndexWithLink: "Falta un índice de Firestore.",
      firestoreIndex: "Falta un índice de base de datos para este filtro. Ajústalo en la consola de Firebase.",
      loadCandidates: "No se pudieron cargar las candidatas.",
      createIndexLink: "Haz clic aquí para crearlo en la Consola",
      retry: "Intentar de Nuevo"
    },
    empty: {
      title: "Ninguna candidata",
      description: "No encontramos canciones enviadas a curaduría que coincidan con este filtro."
    },
    status: {
      approved: "Aprobada",
      linked: "Vinculada",
      matched_existing: "Coincidencia existente",
      likely_unique: "Probablemente inédita",
      possible_duplicate: "Posible duplicada",
      insufficient_data: "Datos insuficientes",
      processing_failed: "Error",
      pending_review: "Pendiente de revisión"
    },
    card: {
      key: "Tono",
      occurrenceSummary_one: "{{occurrences}} aparición / {{organizations}} org",
      occurrenceSummary_other: "{{occurrences}} apariciones / {{organizations}} orgs",
      discoveredOn: "Descubierta el {{date}}",
      recent: "Reciente",
      score: "Puntuación: {{score}}%",
      limitedSearch: "Búsqueda Limitada"
    },
    loadMore: "Cargar Más"
  }
} as const;
