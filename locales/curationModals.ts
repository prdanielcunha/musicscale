export const curationModalTranslations = {
  pt: {
    common: {
      cancel: "Cancelar",
      confirm: "Confirmar",
      dismiss: "Dispensar",
      unknown: "Desconhecido",
      unknownSong: "Música Desconhecida",
      notInformed: "Não informado",
      notInformedFemale: "Não informada",
      unavailableDate: "Data indisponível",
      hiddenId: "ID oculto",
      error: "Erro",
      review: "Revisar ↗",
      openInCuration: "Abrir na Curadoria ↗",
      processingError: "Erro no processamento",
      all: "Todas",
      errors: "Erros",
      ignored: "Ignoradas",
      duplicates: "Duplicadas",
      matches: "Matches",
      insufficient: "Insuficientes"
    },
    candidate: {
      loadError: "Falha ao carregar os detalhes. Tente novamente.",
      approveUnknownError: "Erro desconhecido ao aprovar.",
      moderatedFallback: "A correspondência é apenas moderada. Confirme abaixo se deseja prosseguir.",
      linkUnknownError: "Erro desconhecido ao vincular.",
      rejectReasonRequired: "Selecione um motivo para rejeição.",
      rejectUnknownError: "Erro desconhecido ao rejeitar candidata.",
      title: "Detalhes da Candidata",
      rejectCandidate: "Rejeitar Candidata",
      approveAsNew: "Aprovar como Nova",
      status: {
        pending_review: "Aguardando revisão",
        likely_unique: "Provável inédita",
        possible_duplicate: "Possível duplicada",
        matched_existing: "Match existente",
        insufficient_data: "Dados insuficientes",
        processing_failed: "Falha no processamento",
        approved: "Aprovada",
        linked: "Vinculada",
        rejected: "Rejeitada",
        pending: "Pendente"
      },
      reason: {
        exact_title_artist: "Título e artista idênticos",
        high_similarity: "Alta similaridade pelo nome",
        manual_link: "Vinculado manualmente",
        needs_review: "Revisão necessária",
        no_matches: "Nenhuma correspondência"
      },
      warning: {
        MISSING_TITLE: "Título ausente",
        MISSING_ARTIST: "Artista ausente",
        TOO_MANY_MATCHES: "Muitas correspondências"
      },
      approveDialog: {
        title: "Aprovar Candidata",
        description: "Você está prestes a adicionar {{title}} ({{artist}}) ao Acervo Oficial da Biblioteca Viva.",
        baseOccurrence: "Ocorrência Base Selecionada",
        firstAvailable: "Primeira Disponível"
      },
      linkDialog: {
        title: "Vincular Candidata",
        description: "Você está prestes a fundir {{title}} com uma música já existente na Biblioteca Viva.",
        moderatedTitle: "Atenção: Correspondência Moderada",
        moderatedDescription: "Ao confirmar, você atesta que revisou manualmente o conteúdo e confirmou se tratar da mesma obra.",
        forceLink: "Forçar Vínculo"
      },
      rejectDialog: {
        title: "Rejeitar Candidata",
        description: "Você está prestes a descartar {{title}}. A candidata sairá da fila ativa, mas manterá o histórico.",
        reasonLabel: "Motivo (Obrigatório)",
        selectReason: "Selecione um motivo...",
        reasons: {
          duplicate_candidate: "Candidata Duplicada",
          invalid_content: "Conteúdo Inválido/Estragado",
          insufficient_content: "Conteúdo Insuficiente",
          medley_or_compilation: "Medley ou Compilação (Não Suportado)",
          not_a_song: "Não é uma Música",
          policy_violation: "Violação de Política",
          other: "Outro"
        },
        privateNote: "Nota Privada (Opcional)",
        privateNotePlaceholder: "Detalhes adicionais para histórico interno...",
        errorTitle: "Erro ao rejeitar:",
        reject: "Rejeitar"
      },
      notFound: "Candidata não encontrada.",
      tabs: {
        overview: "Visão Geral",
        chords: "Cifra",
        lyrics: "Letra",
        matches: "Correspondências",
        occurrences: "Ocorrências ({{count}})",
        history: "Histórico"
      },
      overview: {
        status: "Status",
        discoveredAt: "Descoberta em",
        occurrences: "Ocorrências",
        organizations: "Organizações",
        musicalInfo: "Informações Musicais",
        rhythm: "Ritmo",
        currentKey: "Tom Atual",
        originalKey: "Tom Original",
        language: "Idioma",
        tags: "Tags",
        warnings: "Avisos da Avaliação",
        mainMatchReason: "Motivo do Match Principal",
        processingError: "Erro de Processamento"
      },
      empty: {
        chords: "Nenhuma cifra disponível na visualização da candidata.",
        lyrics: "Nenhuma letra disponível nesta ocorrência.",
        matches: "Nenhuma correspondência relevante analisada.",
        occurrences: "Nenhuma ocorrência encontrada.",
        history: "Nenhum evento registrado."
      },
      match: {
        confidence: "CONFIANÇA:",
        linkThis: "Vincular a esta música"
      },
      occurrence: {
        app_creation: "Criação no App",
        system_scan: "Varredura Sistêmica",
        migration: "Migração",
        unknown: "Origem Desconhecida",
        withChords: "Com Cifra",
        withoutChords: "Sem Cifra",
        withLyrics: "Com Letra",
        withoutLyrics: "Sem Letra"
      },
      history: {
        occurrence_added: "Ocorrência Adicionada",
        created: "Candidata Criada",
        approved: "Aprovada",
        rejected: "Rejeitada",
        linked: "Vinculada",
        systemEvent: "Evento do Sistema",
        reason: "Motivo: {{reason}}",
        privateNote: "Nota Privada:"
      }
    },
    import: {
      verifyFailure: "Falha ao verificar candidatas",
      preVerifyError: "Erro ao pré-verificar: {{error}}",
      batchError: "Erro durante importação em lote.",
      title: "Importação para Biblioteca Viva",
      verifying: "Verificando elegibilidade...",
      verifyingAll: "Comparando todas as elegíveis contra a Biblioteca global atualizada.",
      verifyingSelected: "Comparando {{count}} selecionadas contra a Biblioteca global atualizada.",
      filters: {
        ready: "Prontas",
        exists: "Já existem",
        duplicate: "Duplicadas",
        insufficient: "Insuficientes",
        errors: "Erros/Inválidas"
      },
      state: {
        ready_to_import: "Pronta para importar",
        already_exists: "Já existe",
        possible_duplicate: "Possível duplicada",
        insufficient_data: "Dados insuficientes",
        invalid_candidate: "Candidata inválida",
        error: "Erro"
      },
      matchFound: "Correspondência encontrada:",
      stats: {
        ready: "Prontas",
        exists: "Já Existem",
        duplicate: "Duplicadas",
        invalid: "Inválidas/Outros"
      },
      importing: "Importando...",
      progress: "{{current}} de {{total}} inseridas",
      completed: "Importação Concluída",
      completedCount: "{{count}} músicas inseridas com sucesso.",
      closeRefresh: "Fechar e Atualizar Lista",
      importCount: "Importar {{count}} Músicas"
    },
    inbox: {
      batchError: "A análise falhou ao processar um lote.",
      connectionError: "Erro na conexão ou análise.",
      title: "Análise de Caixa de Entrada",
      subtitle: "Processando músicas pendentes para curadoria.",
      preparing: "Preparando análise...",
      completed: "Análise concluída",
      progress: "Processadas: {{processed}} / Restante: {{queued}}",
      metrics: {
        processed: "Processadas",
        unique: "Inéditas",
        duplicate: "Duplicadas",
        matches: "Matches",
        ignored: "Ignoradas",
        errors: "Erros"
      },
      filters: {
        unique: "Prováveis Inéditas",
        duplicate: "Possíveis Duplicadas",
        matches: "Matches Existentes",
        ignored: "Ignoradas",
        errors: "Erros"
      },
      classification: {
        ignored: "Ignorada",
        error: "Erro",
        likely_unique: "Provável inédita",
        possible_duplicate: "Possível duplicada",
        matched_existing: "Match existente"
      },
      empty: "Nenhum resultado para exibir no momento."
    },
    scanner: {
      analyzeBatchError: "A análise falhou ao processar um lote.",
      noPending: "Nenhuma entrada pendente encontrada para esta organização.",
      analyzeConnectionError: "Erro na conexão ou análise.",
      scanBatchError: "A varredura falhou ao processar um lote de músicas no servidor.",
      scanConnectionError: "Erro de conexão de rede ao realizar a varredura.",
      title: "Varredura de Repertório",
      subtitle: "Análise automática do repositório local e integração com a Biblioteca Viva.",
      targetOrganization: "Organização Alvo",
      selectOrganization: "Selecione uma organização...",
      scanning: "Varrendo...",
      start: "Iniciar Varredura",
      calculating: "Calculando volume...",
      approximateCount: "Aproximadamente {{count}} músicas locais estimadas.",
      selectToEstimate: "Selecione para estimar o volume de músicas locais.",
      queueMessage: "Há {{count}} músicas na fila aguardando curadoria.",
      analyzing: "Analisando...",
      analyzeNow: "Analisar agora {{count}} músicas",
      metrics: {
        examined: "Examinadas",
        queued: "Na Caixa",
        alreadyQueued: "Já na Caixa",
        unique: "Inéditas",
        duplicate: "Duplicadas",
        matches: "Matches",
        insufficient: "Insuficientes",
        ignored: "Ignoradas",
        errors: "Erros"
      },
      filters: {
        unique: "Inéditas",
        duplicate: "Duplicadas",
        matches: "Matches",
        insufficient: "Dados Insuficientes",
        queued: "Na Caixa",
        alreadyQueued: "Já na Caixa",
        ignored: "Ignoradas",
        errors: "Erros"
      },
      classification: {
        na_caixa: "Enviada à Caixa de Entrada",
        ja_na_caixa: "Já estava na Caixa",
        ignorada: "Ignorada",
        erro: "Erro",
        inedita: "Provável Inédita",
        duplicada: "Possível Duplicada",
        match_existente: "Match Encontrado",
        dados_insuficientes: "Dados Insuficientes"
      },
      empty: "Nenhum resultado para exibir no momento.",
      resultError: "Erro: {{error}}"
    }
  },
  en: {
    common: {
      cancel: "Cancel",
      confirm: "Confirm",
      dismiss: "Dismiss",
      unknown: "Unknown",
      unknownSong: "Unknown Song",
      notInformed: "Not provided",
      notInformedFemale: "Not provided",
      unavailableDate: "Date unavailable",
      hiddenId: "Hidden ID",
      error: "Error",
      review: "Review ↗",
      openInCuration: "Open in Curation ↗",
      processingError: "Processing error",
      all: "All",
      errors: "Errors",
      ignored: "Ignored",
      duplicates: "Duplicates",
      matches: "Matches",
      insufficient: "Insufficient"
    },
    candidate: {
      loadError: "Failed to load details. Try again.",
      approveUnknownError: "Unknown error while approving.",
      moderatedFallback: "This is only a moderate match. Confirm below if you want to continue.",
      linkUnknownError: "Unknown error while linking.",
      rejectReasonRequired: "Select a rejection reason.",
      rejectUnknownError: "Unknown error while rejecting the candidate.",
      title: "Candidate Details",
      rejectCandidate: "Reject Candidate",
      approveAsNew: "Approve as New",
      status: {
        pending_review: "Awaiting review",
        likely_unique: "Likely unique",
        possible_duplicate: "Possible duplicate",
        matched_existing: "Existing match",
        insufficient_data: "Insufficient data",
        processing_failed: "Processing failed",
        approved: "Approved",
        linked: "Linked",
        rejected: "Rejected",
        pending: "Pending"
      },
      reason: {
        exact_title_artist: "Identical title and artist",
        high_similarity: "High title similarity",
        manual_link: "Linked manually",
        needs_review: "Review required",
        no_matches: "No matches"
      },
      warning: {
        MISSING_TITLE: "Missing title",
        MISSING_ARTIST: "Missing artist",
        TOO_MANY_MATCHES: "Too many matches"
      },
      approveDialog: {
        title: "Approve Candidate",
        description: "You are about to add {{title}} ({{artist}}) to the official Live Library collection.",
        baseOccurrence: "Selected Base Occurrence",
        firstAvailable: "First Available"
      },
      linkDialog: {
        title: "Link Candidate",
        description: "You are about to merge {{title}} with a song that already exists in the Live Library.",
        moderatedTitle: "Attention: Moderate Match",
        moderatedDescription: "By confirming, you certify that you manually reviewed the content and confirmed it is the same work.",
        forceLink: "Force Link"
      },
      rejectDialog: {
        title: "Reject Candidate",
        description: "You are about to discard {{title}}. The candidate will leave the active queue but keep its history.",
        reasonLabel: "Reason (Required)",
        selectReason: "Select a reason...",
        reasons: {
          duplicate_candidate: "Duplicate Candidate",
          invalid_content: "Invalid/Corrupted Content",
          insufficient_content: "Insufficient Content",
          medley_or_compilation: "Medley or Compilation (Unsupported)",
          not_a_song: "Not a Song",
          policy_violation: "Policy Violation",
          other: "Other"
        },
        privateNote: "Private Note (Optional)",
        privateNotePlaceholder: "Additional details for the internal history...",
        errorTitle: "Error while rejecting:",
        reject: "Reject"
      },
      notFound: "Candidate not found.",
      tabs: {
        overview: "Overview",
        chords: "Chords",
        lyrics: "Lyrics",
        matches: "Matches",
        occurrences: "Occurrences ({{count}})",
        history: "History"
      },
      overview: {
        status: "Status",
        discoveredAt: "Discovered on",
        occurrences: "Occurrences",
        organizations: "Organizations",
        musicalInfo: "Musical Information",
        rhythm: "Time Signature",
        currentKey: "Current Key",
        originalKey: "Original Key",
        language: "Language",
        tags: "Tags",
        warnings: "Review Warnings",
        mainMatchReason: "Primary Match Reason",
        processingError: "Processing Error"
      },
      empty: {
        chords: "No chords are available in this candidate view.",
        lyrics: "No lyrics are available in this occurrence.",
        matches: "No relevant matches were analyzed.",
        occurrences: "No occurrences found.",
        history: "No events recorded."
      },
      match: {
        confidence: "CONFIDENCE:",
        linkThis: "Link to this song"
      },
      occurrence: {
        app_creation: "Created in App",
        system_scan: "System Scan",
        migration: "Migration",
        unknown: "Unknown Origin",
        withChords: "With Chords",
        withoutChords: "Without Chords",
        withLyrics: "With Lyrics",
        withoutLyrics: "Without Lyrics"
      },
      history: {
        occurrence_added: "Occurrence Added",
        created: "Candidate Created",
        approved: "Approved",
        rejected: "Rejected",
        linked: "Linked",
        systemEvent: "System Event",
        reason: "Reason: {{reason}}",
        privateNote: "Private Note:"
      }
    },
    import: {
      verifyFailure: "Failed to verify candidates",
      preVerifyError: "Pre-verification error: {{error}}",
      batchError: "Error during bulk import.",
      title: "Import to Live Library",
      verifying: "Checking eligibility...",
      verifyingAll: "Comparing all eligible candidates against the latest global Library.",
      verifyingSelected: "Comparing {{count}} selected candidates against the latest global Library.",
      filters: {
        ready: "Ready",
        exists: "Already exist",
        duplicate: "Duplicates",
        insufficient: "Insufficient",
        errors: "Errors/Invalid"
      },
      state: {
        ready_to_import: "Ready to import",
        already_exists: "Already exists",
        possible_duplicate: "Possible duplicate",
        insufficient_data: "Insufficient data",
        invalid_candidate: "Invalid candidate",
        error: "Error"
      },
      matchFound: "Match found:",
      stats: {
        ready: "Ready",
        exists: "Already Exist",
        duplicate: "Duplicates",
        invalid: "Invalid/Other"
      },
      importing: "Importing...",
      progress: "{{current}} of {{total}} inserted",
      completed: "Import Complete",
      completedCount: "{{count}} songs imported successfully.",
      closeRefresh: "Close and Refresh List",
      importCount: "Import {{count}} Songs"
    },
    inbox: {
      batchError: "The analysis failed while processing a batch.",
      connectionError: "Connection or analysis error.",
      title: "Inbox Analysis",
      subtitle: "Processing songs pending curation.",
      preparing: "Preparing analysis...",
      completed: "Analysis complete",
      progress: "Processed: {{processed}} / Remaining: {{queued}}",
      metrics: {
        processed: "Processed",
        unique: "Unique",
        duplicate: "Duplicates",
        matches: "Matches",
        ignored: "Ignored",
        errors: "Errors"
      },
      filters: {
        unique: "Likely Unique",
        duplicate: "Possible Duplicates",
        matches: "Existing Matches",
        ignored: "Ignored",
        errors: "Errors"
      },
      classification: {
        ignored: "Ignored",
        error: "Error",
        likely_unique: "Likely unique",
        possible_duplicate: "Possible duplicate",
        matched_existing: "Existing match"
      },
      empty: "No results to display right now."
    },
    scanner: {
      analyzeBatchError: "The analysis failed while processing a batch.",
      noPending: "No pending entries were found for this organization.",
      analyzeConnectionError: "Connection or analysis error.",
      scanBatchError: "The scan failed while processing a song batch on the server.",
      scanConnectionError: "Network connection error while scanning.",
      title: "Repertoire Scan",
      subtitle: "Automatic analysis of the local repertoire and integration with the Live Library.",
      targetOrganization: "Target Organization",
      selectOrganization: "Select an organization...",
      scanning: "Scanning...",
      start: "Start Scan",
      calculating: "Calculating volume...",
      approximateCount: "Approximately {{count}} local songs estimated.",
      selectToEstimate: "Select an organization to estimate the local song volume.",
      queueMessage: "There are {{count}} songs in the queue awaiting curation.",
      analyzing: "Analyzing...",
      analyzeNow: "Analyze {{count}} songs now",
      metrics: {
        examined: "Examined",
        queued: "In Inbox",
        alreadyQueued: "Already in Inbox",
        unique: "Unique",
        duplicate: "Duplicates",
        matches: "Matches",
        insufficient: "Insufficient",
        ignored: "Ignored",
        errors: "Errors"
      },
      filters: {
        unique: "Unique",
        duplicate: "Duplicates",
        matches: "Matches",
        insufficient: "Insufficient Data",
        queued: "In Inbox",
        alreadyQueued: "Already in Inbox",
        ignored: "Ignored",
        errors: "Errors"
      },
      classification: {
        na_caixa: "Sent to Inbox",
        ja_na_caixa: "Already in Inbox",
        ignorada: "Ignored",
        erro: "Error",
        inedita: "Likely Unique",
        duplicada: "Possible Duplicate",
        match_existente: "Match Found",
        dados_insuficientes: "Insufficient Data"
      },
      empty: "No results to display right now.",
      resultError: "Error: {{error}}"
    }
  },
  es: {
    common: {
      cancel: "Cancelar",
      confirm: "Confirmar",
      dismiss: "Descartar",
      unknown: "Desconocido",
      unknownSong: "Canción Desconocida",
      notInformed: "No informado",
      notInformedFemale: "No informada",
      unavailableDate: "Fecha no disponible",
      hiddenId: "ID oculto",
      error: "Error",
      review: "Revisar ↗",
      openInCuration: "Abrir en Curaduría ↗",
      processingError: "Error de procesamiento",
      all: "Todas",
      errors: "Errores",
      ignored: "Ignoradas",
      duplicates: "Duplicadas",
      matches: "Coincidencias",
      insufficient: "Insuficientes"
    },
    candidate: {
      loadError: "No se pudieron cargar los detalles. Inténtalo de nuevo.",
      approveUnknownError: "Error desconocido al aprobar.",
      moderatedFallback: "La coincidencia es solo moderada. Confirma abajo si deseas continuar.",
      linkUnknownError: "Error desconocido al vincular.",
      rejectReasonRequired: "Selecciona un motivo de rechazo.",
      rejectUnknownError: "Error desconocido al rechazar la candidata.",
      title: "Detalles de la Candidata",
      rejectCandidate: "Rechazar Candidata",
      approveAsNew: "Aprobar como Nueva",
      status: {
        pending_review: "Pendiente de revisión",
        likely_unique: "Probablemente inédita",
        possible_duplicate: "Posible duplicada",
        matched_existing: "Coincidencia existente",
        insufficient_data: "Datos insuficientes",
        processing_failed: "Error de procesamiento",
        approved: "Aprobada",
        linked: "Vinculada",
        rejected: "Rechazada",
        pending: "Pendiente"
      },
      reason: {
        exact_title_artist: "Título y artista idénticos",
        high_similarity: "Alta similitud de nombre",
        manual_link: "Vinculada manualmente",
        needs_review: "Revisión necesaria",
        no_matches: "Sin coincidencias"
      },
      warning: {
        MISSING_TITLE: "Falta el título",
        MISSING_ARTIST: "Falta el artista",
        TOO_MANY_MATCHES: "Demasiadas coincidencias"
      },
      approveDialog: {
        title: "Aprobar Candidata",
        description: "Estás a punto de añadir {{title}} ({{artist}}) al catálogo oficial de la Biblioteca Viva.",
        baseOccurrence: "Ocurrencia Base Seleccionada",
        firstAvailable: "Primera Disponible"
      },
      linkDialog: {
        title: "Vincular Candidata",
        description: "Estás a punto de fusionar {{title}} con una canción ya existente en la Biblioteca Viva.",
        moderatedTitle: "Atención: Coincidencia Moderada",
        moderatedDescription: "Al confirmar, declaras que revisaste manualmente el contenido y confirmaste que se trata de la misma obra.",
        forceLink: "Forzar Vínculo"
      },
      rejectDialog: {
        title: "Rechazar Candidata",
        description: "Estás a punto de descartar {{title}}. La candidata saldrá de la cola activa, pero conservará su historial.",
        reasonLabel: "Motivo (Obligatorio)",
        selectReason: "Selecciona un motivo...",
        reasons: {
          duplicate_candidate: "Candidata Duplicada",
          invalid_content: "Contenido Inválido/Dañado",
          insufficient_content: "Contenido Insuficiente",
          medley_or_compilation: "Medley o Compilación (No Compatible)",
          not_a_song: "No es una Canción",
          policy_violation: "Violación de Política",
          other: "Otro"
        },
        privateNote: "Nota Privada (Opcional)",
        privateNotePlaceholder: "Detalles adicionales para el historial interno...",
        errorTitle: "Error al rechazar:",
        reject: "Rechazar"
      },
      notFound: "Candidata no encontrada.",
      tabs: {
        overview: "Resumen",
        chords: "Acordes",
        lyrics: "Letra",
        matches: "Coincidencias",
        occurrences: "Ocurrencias ({{count}})",
        history: "Historial"
      },
      overview: {
        status: "Estado",
        discoveredAt: "Descubierta el",
        occurrences: "Ocurrencias",
        organizations: "Organizaciones",
        musicalInfo: "Información Musical",
        rhythm: "Compás",
        currentKey: "Tono Actual",
        originalKey: "Tono Original",
        language: "Idioma",
        tags: "Etiquetas",
        warnings: "Avisos de la Evaluación",
        mainMatchReason: "Motivo de la Coincidencia Principal",
        processingError: "Error de Procesamiento"
      },
      empty: {
        chords: "No hay acordes disponibles en la vista de esta candidata.",
        lyrics: "No hay letra disponible en esta ocurrencia.",
        matches: "No se analizaron coincidencias relevantes.",
        occurrences: "No se encontraron ocurrencias.",
        history: "No hay eventos registrados."
      },
      match: {
        confidence: "CONFIANZA:",
        linkThis: "Vincular a esta canción"
      },
      occurrence: {
        app_creation: "Creación en la App",
        system_scan: "Escaneo del Sistema",
        migration: "Migración",
        unknown: "Origen Desconocido",
        withChords: "Con Acordes",
        withoutChords: "Sin Acordes",
        withLyrics: "Con Letra",
        withoutLyrics: "Sin Letra"
      },
      history: {
        occurrence_added: "Ocurrencia Añadida",
        created: "Candidata Creada",
        approved: "Aprobada",
        rejected: "Rechazada",
        linked: "Vinculada",
        systemEvent: "Evento del Sistema",
        reason: "Motivo: {{reason}}",
        privateNote: "Nota Privada:"
      }
    },
    import: {
      verifyFailure: "No se pudieron verificar las candidatas",
      preVerifyError: "Error de verificación previa: {{error}}",
      batchError: "Error durante la importación por lotes.",
      title: "Importación a Biblioteca Viva",
      verifying: "Verificando elegibilidad...",
      verifyingAll: "Comparando todas las elegibles con la Biblioteca global actualizada.",
      verifyingSelected: "Comparando {{count}} seleccionadas con la Biblioteca global actualizada.",
      filters: {
        ready: "Listas",
        exists: "Ya existen",
        duplicate: "Duplicadas",
        insufficient: "Insuficientes",
        errors: "Errores/Inválidas"
      },
      state: {
        ready_to_import: "Lista para importar",
        already_exists: "Ya existe",
        possible_duplicate: "Posible duplicada",
        insufficient_data: "Datos insuficientes",
        invalid_candidate: "Candidata inválida",
        error: "Error"
      },
      matchFound: "Coincidencia encontrada:",
      stats: {
        ready: "Listas",
        exists: "Ya Existen",
        duplicate: "Duplicadas",
        invalid: "Inválidas/Otras"
      },
      importing: "Importando...",
      progress: "{{current}} de {{total}} insertadas",
      completed: "Importación Completada",
      completedCount: "{{count}} canciones insertadas correctamente.",
      closeRefresh: "Cerrar y Actualizar Lista",
      importCount: "Importar {{count}} Canciones"
    },
    inbox: {
      batchError: "El análisis falló al procesar un lote.",
      connectionError: "Error de conexión o análisis.",
      title: "Análisis de Bandeja de Entrada",
      subtitle: "Procesando canciones pendientes de curaduría.",
      preparing: "Preparando análisis...",
      completed: "Análisis completado",
      progress: "Procesadas: {{processed}} / Restantes: {{queued}}",
      metrics: {
        processed: "Procesadas",
        unique: "Inéditas",
        duplicate: "Duplicadas",
        matches: "Coincidencias",
        ignored: "Ignoradas",
        errors: "Errores"
      },
      filters: {
        unique: "Probablemente Inéditas",
        duplicate: "Posibles Duplicadas",
        matches: "Coincidencias Existentes",
        ignored: "Ignoradas",
        errors: "Errores"
      },
      classification: {
        ignored: "Ignorada",
        error: "Error",
        likely_unique: "Probablemente inédita",
        possible_duplicate: "Posible duplicada",
        matched_existing: "Coincidencia existente"
      },
      empty: "No hay resultados para mostrar en este momento."
    },
    scanner: {
      analyzeBatchError: "El análisis falló al procesar un lote.",
      noPending: "No se encontraron entradas pendientes para esta organización.",
      analyzeConnectionError: "Error de conexión o análisis.",
      scanBatchError: "El escaneo falló al procesar un lote de canciones en el servidor.",
      scanConnectionError: "Error de conexión de red durante el escaneo.",
      title: "Escaneo de Repertorio",
      subtitle: "Análisis automático del repertorio local e integración con la Biblioteca Viva.",
      targetOrganization: "Organización Objetivo",
      selectOrganization: "Selecciona una organización...",
      scanning: "Escaneando...",
      start: "Iniciar Escaneo",
      calculating: "Calculando volumen...",
      approximateCount: "Aproximadamente {{count}} canciones locales estimadas.",
      selectToEstimate: "Selecciona una organización para estimar el volumen de canciones locales.",
      queueMessage: "Hay {{count}} canciones en la cola esperando curaduría.",
      analyzing: "Analizando...",
      analyzeNow: "Analizar ahora {{count}} canciones",
      metrics: {
        examined: "Examinadas",
        queued: "En Bandeja",
        alreadyQueued: "Ya en Bandeja",
        unique: "Inéditas",
        duplicate: "Duplicadas",
        matches: "Coincidencias",
        insufficient: "Insuficientes",
        ignored: "Ignoradas",
        errors: "Errores"
      },
      filters: {
        unique: "Inéditas",
        duplicate: "Duplicadas",
        matches: "Coincidencias",
        insufficient: "Datos Insuficientes",
        queued: "En Bandeja",
        alreadyQueued: "Ya en Bandeja",
        ignored: "Ignoradas",
        errors: "Errores"
      },
      classification: {
        na_caixa: "Enviada a la Bandeja de Entrada",
        ja_na_caixa: "Ya estaba en la Bandeja",
        ignorada: "Ignorada",
        erro: "Error",
        inedita: "Probablemente Inédita",
        duplicada: "Posible Duplicada",
        match_existente: "Coincidencia Encontrada",
        dados_insuficientes: "Datos Insuficientes"
      },
      empty: "No hay resultados para mostrar en este momento.",
      resultError: "Error: {{error}}"
    }
  }
} as const;
