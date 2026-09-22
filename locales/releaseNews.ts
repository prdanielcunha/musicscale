export const releaseNewsTranslations = {
  pt: {
    label: 'Novidades',
    currentVersion: 'Versão instalada',
    view: 'Conhecer novidades',
    later: 'Dispensar aviso',
    close: 'Fechar',
    how: 'Como funciona',
    badge: 'Novidade relevante',
    stageToolsBeta02: {
      title: 'O palco ganhou seu próprio espaço.',
      description: 'Pad e metrônomo agora ficam disponíveis sem abrir uma cifra, com áudio decidido localmente em cada aparelho.',
      stageTools: {
        title: 'Ferramentas de Palco',
        body: 'Pad e metrônomo reunidos em um espaço dedicado, pronto para ensaio, passagem de som e culto.',
        how: 'Abra Ferramentas de Palco pelo menu e use cada ferramenta de forma independente do repertório.',
      },
      deviceAudio: {
        title: 'Áudio por dispositivo',
        body: 'Cada celular, tablet ou computador decide se aquele aparelho será uma saída do Pad.',
        how: 'Ative “Reproduzir o Pad neste dispositivo” no aparelho desejado. O som só começa depois que você tocar em Play.',
      },
      updates: {
        title: 'Atualizações mais claras',
        body: 'Recursos importantes ficam em destaque e correções pequenas passam a viver em uma seção discreta.',
        how: 'Abra Novidades sempre que quiser rever os destaques e expanda as correções somente quando precisar.',
      },
      refinements: {
        summary: 'Leia mais — correções e refinamentos',
        title: 'Correções e refinamentos',
        items: [
          { date: '15/09', text: 'Reutilização de formações de banda vinculadas ficou mais segura.' },
          { date: '15/09', text: 'Importação de cifras recebeu normalização mais robusta de seções e formatação.' },
          { date: '15/09', text: 'Fluxos de salvamento e autorização receberam ajustes de estabilidade.' },
        ],
      },
    },
    stageToolsBeta03: {
      title: 'O palco ficou pronto para funcionar de verdade.',
      description: 'Ferramentas de Palco agora se adaptam melhor ao celular, ganham Pads mais ricos e permitem preparar repertório para uso offline.',
      stageTools: {
        title: 'Palco no celular',
        body: 'O layout foi reconstruído para respeitar a largura do aparelho, áreas seguras e navegação inferior, sem controles escondidos fora da tela.',
        how: 'Abra Ferramentas de Palco no celular: controles, tons e ações permanecem dentro da tela e com alvos de toque claros.',
      },
      deviceAudio: {
        title: 'Pad V2 e Meu Pad',
        body: 'Worship, Warm, Air e Deep trazem texturas locais mais ricas. Você também pode usar seu próprio áudio de Pad neste aparelho.',
        how: 'Escolha um preset ou Meu Pad, defina o tom e toque. O áudio pessoal permanece local no dispositivo e não exige uma API paga.',
      },
      updates: {
        title: 'Recursos offline',
        body: 'Prepare a próxima escala, uma escala específica ou a biblioteca inteira para tocar mesmo quando a internet estiver ruim.',
        how: 'Baixe o pacote que precisa. Se a biblioteca já estiver disponível offline, o MusicScale reaproveita essas músicas nas escalas em vez de duplicá-las.',
      },
      refinements: {
        summary: 'Leia mais — correções e refinamentos',
        title: 'Correções e refinamentos',
        items: [
          { date: '17/09', text: 'Overflow horizontal e áreas de toque das Ferramentas de Palco foram corrigidos para telas móveis.' },
          { date: '17/09', text: 'Downloads de biblioteca e escalas agora compartilham o mesmo repertório local com deduplicação por versão.' },
          { date: '17/09', text: 'Cache offline e Pads pessoais permanecem isolados por usuário, organização e dispositivo.' },
        ],
      },
    },
    intelligentPartsBeta04: {
      title: 'Cada músico agora enxerga o que realmente precisa tocar.',
      description: 'O MusicScale ganhou Partes Inteligentes, foco pela função real da escala e navegação contextual dentro do Performance Mode.',
      stageTools: {
        title: 'Partes Inteligentes',
        body: 'Solos, riffs, instrumentais e outras partes técnicas passam a nascer da própria cifra canônica, sem criar cópias separadas da música.',
        how: 'Abra Partes na música para ver os trechos detectados, transpor conteúdo harmônico quando for seguro e manter tablaturas com a digitação original.',
      },
      deviceAudio: {
        title: 'Meu Foco por escala',
        body: 'O MusicScale usa a função atribuída naquele culto para priorizar as partes realmente relevantes para cada músico.',
        how: 'Se você estiver escalado na guitarra, baixo, teclado ou outro instrumento compatível, Meu Foco aparece primeiro; Todas continua disponível a qualquer momento.',
      },
      updates: {
        title: 'Performance contextual',
        body: 'O Performance Mode agora destaca suas partes e permite saltar diretamente para elas sem esconder a cifra completa.',
        how: 'Use Meu Foco no navegador de seções para ir aos seus trechos. Cabeçalhos personalizados seguros são reconhecidos sem confundir acordes ChordPro.',
      },
      refinements: {
        summary: 'Leia mais — correções e refinamentos',
        title: 'Correções e refinamentos',
        items: [
          { date: '18/09', text: 'Partes e Performance agora compartilham o mesmo parser canônico de seções.' },
          { date: '18/09', text: 'Tablaturas preservam a digitação original e acordes continuam transponíveis quando apropriado.' },
          { date: '18/09', text: 'Reconhecimento de seções recebeu proteção contra falsos positivos em ChordPro, tom, capo e marcadores numéricos.' },
        ],
      },
    },
    personalPreparationBeta05: {
      title: 'Seu preparo ficou mais pessoal — e o repertório mais seguro.',
      description: 'O MusicScale agora mostra o que você precisa praticar na próxima escala e trata músicas duplicadas com uma decisão clara antes de salvar.',
      stageTools: {
        title: 'Praticar meu foco',
        body: 'O Dashboard usa sua função real na escala para destacar somente as músicas e partes que precisam da sua atenção, preservando a ordem do repertório.',
        how: 'Abra sua próxima escala pelo Dashboard e toque em “Praticar meu foco” para começar pela primeira música que tem uma parte relevante para você.',
      },
      deviceAudio: {
        title: 'Duplicatas sob controle',
        body: 'Ao criar ou importar uma música já existente, o MusicScale mostra a correspondência antes de salvar e deixa você escolher entre cancelar, criar uma nova cópia ou substituir a existente.',
        how: 'Revise a música encontrada e escolha a ação desejada. A substituição exige uma confirmação adicional antes de alterar qualquer conteúdo.',
      },
      updates: {
        title: 'Substituição sem quebrar escalas',
        body: 'Quando você substitui uma música, o mesmo ID e os vínculos com escalas existentes são preservados, enquanto os novos dados musicais assumem o lugar da versão anterior.',
        how: 'Título, artista, tom, BPM, letra, cifra, seções, solos, partes, tabs e metadados são atualizados juntos; dados antigos de arranjo que não existem na nova versão são limpos.',
      },
      refinements: {
        summary: 'Leia mais — correções e refinamentos',
        title: 'Correções e refinamentos',
        items: [
          { date: '18/09', text: 'Criação manual e importação por IA agora compartilham o mesmo fluxo de decisão para músicas semelhantes.' },
          { date: '18/09', text: 'A substituição preserva identidade, vínculos e histórico operacional da música, com atualização auditável do conteúdo.' },
          { date: '18/09', text: 'O preparo pessoal reutiliza as Partes Inteligentes e a função atribuída na escala, sem inventar um foco técnico para quem não possui parte compatível.' },
        ],
      },
    },
    fixedBandWorkflowBeta07: {
      title: 'Escala fixa agora é formação — e o evento fica onde deve ficar.',
      description: 'Escalas Fixas da Banda agora guardam somente nome, integrantes e funções. Data, horário, culto, local, notificações e presença pertencem à Escala de Músicas.',
      stageTools: {
        title: 'Formação fixa de verdade',
        body: 'Cadastre a equipe uma vez com nome, integrantes e funções, sem transformar a formação em um evento.',
        how: 'Abra Escalas da Banda para criar a formação fixa. Ao montar uma Escala de Músicas, selecione essa formação no passo Banda.',
      },
      deviceAudio: {
        title: 'Cada culto define seu próprio contexto',
        body: 'A Escala de Músicas define data, horário, culto e local. A formação escolhida é copiada internamente para preservar o histórico daquele evento.',
        how: 'Escolha a formação na Escala de Músicas. Presença, notificações e histórico continuam ligados ao evento real, não ao modelo fixo.',
      },
      updates: {
        title: 'Criação mais simples e coerente',
        body: 'Criar uma nova escala da banda agora abre diretamente o cadastro de formação fixa, sem pedir data, horário, culto ou local.',
        how: 'Dê um nome à formação, escolha integrantes e funções e pronto. O contexto do evento será definido quando essa formação for usada em uma Escala de Músicas.',
      },
      refinements: {
        summary: 'Leia mais — correções e refinamentos',
        title: 'Correções e refinamentos',
        items: [
          { date: '20/09', text: 'Novas Escalas da Banda passam a ser somente formações fixas e reutilizáveis.' },
          { date: '20/09', text: 'Data, horário, culto e local foram removidos do conceito de Escala Fixa da Banda.' },
          { date: '19/09', text: 'Registros antigos de Escala da Banda continuam compatíveis sem contaminar o novo fluxo.' },
        ],
      },
    },
  },
  en: {
    label: 'What’s new',
    currentVersion: 'Installed version',
    view: 'Explore what’s new',
    later: 'Dismiss announcement',
    close: 'Close',
    how: 'How it works',
    badge: 'Meaningful update',
    stageToolsBeta02: {
      title: 'The stage now has its own workspace.',
      description: 'Pad and metronome are available without opening a chord chart, with audio controlled locally on each device.',
      stageTools: {
        title: 'Stage Tools',
        body: 'Pad and metronome now live together in a dedicated space for rehearsal, soundcheck and worship.',
        how: 'Open Stage Tools from the menu and use either tool independently from the repertoire.',
      },
      deviceAudio: {
        title: 'Per-device audio',
        body: 'Each phone, tablet or computer decides whether that device will output the Pad.',
        how: 'Enable “Play the Pad on this device” on the device you want. Audio still starts only after you press Play.',
      },
      updates: {
        title: 'Clearer updates',
        body: 'Important features stay prominent while small fixes move into a quieter details section.',
        how: 'Open What’s new whenever you want to revisit highlights and expand fixes only when you need them.',
      },
      refinements: {
        summary: 'Read more — fixes and refinements',
        title: 'Fixes and refinements',
        items: [
          { date: 'Sep 15', text: 'Reusing linked band formations is now safer.' },
          { date: 'Sep 15', text: 'Chord imports received more robust section and formatting normalization.' },
          { date: 'Sep 15', text: 'Save and authorization flows received reliability refinements.' },
        ],
      },
    },
    stageToolsBeta03: {
      title: 'The stage is now ready for real-world use.',
      description: 'Stage Tools now fit mobile screens properly, deliver richer Pads and let teams prepare repertoire for offline use.',
      stageTools: {
        title: 'Stage-ready mobile layout',
        body: 'The layout now respects device width, safe areas and bottom navigation so controls no longer disappear beyond the viewport.',
        how: 'Open Stage Tools on a phone: controls, keys and actions stay within the screen with clear touch targets.',
      },
      deviceAudio: {
        title: 'Pad V2 and My Pad',
        body: 'Worship, Warm, Air and Deep provide richer local textures. You can also use your own Pad audio on this device.',
        how: 'Choose a preset or My Pad, select the key and play. Personal audio stays local to the device and needs no paid API.',
      },
      updates: {
        title: 'Offline resources',
        body: 'Prepare the next schedule, a specific schedule or the entire library so worship resources remain available on poor connections.',
        how: 'Download only what you need. If the library is already offline, MusicScale reuses those songs in schedules instead of storing duplicates.',
      },
      refinements: {
        summary: 'Read more — fixes and refinements',
        title: 'Fixes and refinements',
        items: [
          { date: 'Sep 17', text: 'Horizontal overflow and Stage Tools touch targets were corrected for mobile screens.' },
          { date: 'Sep 17', text: 'Library and schedule downloads now share the same local repertoire with revision-aware deduplication.' },
          { date: 'Sep 17', text: 'Offline cache and personal Pads stay isolated by user, organization and device.' },
        ],
      },
    },
    intelligentPartsBeta04: {
      title: 'Every musician now sees what they actually need to play.',
      description: 'MusicScale now brings Intelligent Parts, assignment-aware focus and contextual navigation directly into Performance Mode.',
      stageTools: {
        title: 'Intelligent Parts',
        body: 'Solos, riffs, instrumentals and other technical parts are derived from the canonical chart instead of creating separate copies of the song.',
        how: 'Open Parts on a song to review detected sections, transpose harmonic content when safe and keep tablature fingering exactly as written.',
      },
      deviceAudio: {
        title: 'My Focus for each set',
        body: 'MusicScale uses the role assigned for that specific service to prioritize the parts that matter to each musician.',
        how: 'If you are assigned to guitar, bass, keys or another supported instrument, My Focus opens first; All remains available at any time.',
      },
      updates: {
        title: 'Contextual Performance',
        body: 'Performance Mode now highlights your parts and lets you jump directly to them without hiding the complete chart.',
        how: 'Use My Focus in the section rail to jump to your sections. Safe custom headings are supported without mistaking ChordPro chords for sections.',
      },
      refinements: {
        summary: 'Read more — fixes and refinements',
        title: 'Fixes and refinements',
        items: [
          { date: 'Sep 18', text: 'Parts and Performance now share the same canonical section parser.' },
          { date: 'Sep 18', text: 'Tablature keeps original fingering while harmonic content remains transposable when appropriate.' },
          { date: 'Sep 18', text: 'Section recognition now guards against false positives from ChordPro, key, capo and numeric markers.' },
        ],
      },
    },
    personalPreparationBeta05: {
      title: 'Preparation is now more personal — and the repertoire is safer.',
      description: 'MusicScale now shows what you need to practice for the next schedule and handles duplicate songs with a clear decision before saving.',
      stageTools: {
        title: 'Practice my focus',
        body: 'The Dashboard uses your actual assignment in the schedule to highlight only the songs and parts that need your attention, while preserving setlist order.',
        how: 'Open your next schedule from the Dashboard and choose “Practice my focus” to start with the first song that contains a relevant part for you.',
      },
      deviceAudio: {
        title: 'Duplicates under control',
        body: 'When creating or importing a song that already exists, MusicScale shows the match before saving and lets you cancel, create a new copy or replace the existing song.',
        how: 'Review the matched song and choose the action you want. Replacement requires an additional confirmation before any content is changed.',
      },
      updates: {
        title: 'Replace without breaking schedules',
        body: 'When you replace a song, the same ID and existing schedule links are preserved while the new musical data replaces the previous version.',
        how: 'Title, artist, key, BPM, lyrics, chords, sections, solos, parts, tabs and metadata are updated together; stale arrangement data that is absent from the new version is cleared.',
      },
      refinements: {
        summary: 'Read more — fixes and refinements',
        title: 'Fixes and refinements',
        items: [
          { date: 'Sep 18', text: 'Manual creation and AI import now share the same decision flow for similar songs.' },
          { date: 'Sep 18', text: 'Replacement preserves song identity, links and operational history while applying an auditable content update.' },
          { date: 'Sep 18', text: 'Personal preparation reuses Intelligent Parts and the actual schedule assignment without inventing a technical focus for unsupported roles.' },
        ],
      },
    },
    fixedBandWorkflowBeta07: {
      title: 'A fixed band is now a formation — while the event stays where it belongs.',
      description: 'Fixed Band Scales now store only a name, members and roles. Date, time, event type, location, notifications and attendance belong to the Music Scale.',
      stageTools: {
        title: 'A true fixed formation',
        body: 'Create the team once with a name, members and roles, without turning the formation itself into an event.',
        how: 'Open Band Scales to create the fixed formation. When building a Music Scale, select that formation in the Band step.',
      },
      deviceAudio: {
        title: 'Each service defines its own context',
        body: 'The Music Scale defines date, time, event type and location. The selected formation is copied internally so that event history remains stable.',
        how: 'Choose the formation in the Music Scale. Attendance, notifications and history remain tied to the real event, not to the reusable template.',
      },
      updates: {
        title: 'Simpler, coherent creation',
        body: 'Creating a new band scale now opens the fixed-formation editor directly, without asking for date, time, event type or location.',
        how: 'Name the formation, choose members and roles, and you are done. Event context is defined later when the formation is used by a Music Scale.',
      },
      refinements: {
        summary: 'Read more — fixes and refinements',
        title: 'Fixes and refinements',
        items: [
          { date: 'Sep 20', text: 'New Band Scales are now reusable fixed formations only.' },
          { date: 'Sep 20', text: 'Date, time, event type and location were removed from the Fixed Band Scale concept.' },
          { date: 'Sep 19', text: 'Legacy event-specific Band Scales remain compatible without leaking into the new creation flow.' },
        ],
      },
    },
  },
  es: {
    label: 'Novedades',
    currentVersion: 'Versión instalada',
    view: 'Conocer novedades',
    later: 'Descartar aviso',
    close: 'Cerrar',
    how: 'Cómo funciona',
    badge: 'Novedad relevante',
    stageToolsBeta02: {
      title: 'El escenario ahora tiene su propio espacio.',
      description: 'Pad y metrónomo están disponibles sin abrir una cifra, con el audio controlado localmente en cada dispositivo.',
      stageTools: {
        title: 'Herramientas de Escenario',
        body: 'Pad y metrónomo reunidos en un espacio dedicado para ensayo, prueba de sonido y culto.',
        how: 'Abre Herramientas de Escenario desde el menú y usa cada herramienta de forma independiente del repertorio.',
      },
      deviceAudio: {
        title: 'Audio por dispositivo',
        body: 'Cada teléfono, tableta u ordenador decide si ese dispositivo reproducirá el Pad.',
        how: 'Activa “Reproducir el Pad en este dispositivo” en el equipo deseado. El audio solo comienza cuando presionas Play.',
      },
      updates: {
        title: 'Actualizaciones más claras',
        body: 'Las funciones importantes quedan destacadas y las pequeñas correcciones pasan a una sección más discreta.',
        how: 'Abre Novedades cuando quieras revisar los destacados y expande las correcciones solo cuando las necesites.',
      },
      refinements: {
        summary: 'Leer más — correcciones y refinamientos',
        title: 'Correcciones y refinamientos',
        items: [
          { date: '15/09', text: 'La reutilización de formaciones de banda vinculadas ahora es más segura.' },
          { date: '15/09', text: 'La importación de acordes recibió una normalización más robusta de secciones y formato.' },
          { date: '15/09', text: 'Los flujos de guardado y autorización recibieron ajustes de estabilidad.' },
        ],
      },
    },
    stageToolsBeta03: {
      title: 'El escenario ahora está listo para el uso real.',
      description: 'Herramientas de Escenario ahora se adapta mejor al móvil, ofrece Pads más ricos y permite preparar repertorio para usar sin conexión.',
      stageTools: {
        title: 'Escenario en el móvil',
        body: 'El diseño respeta el ancho del dispositivo, las áreas seguras y la navegación inferior para que ningún control quede fuera de la pantalla.',
        how: 'Abre Herramientas de Escenario en el móvil: controles, tonos y acciones permanecen visibles con áreas de toque claras.',
      },
      deviceAudio: {
        title: 'Pad V2 y Mi Pad',
        body: 'Worship, Warm, Air y Deep ofrecen texturas locales más ricas. También puedes usar tu propio audio de Pad en este dispositivo.',
        how: 'Elige un preset o Mi Pad, selecciona el tono y reproduce. El audio personal queda local en el dispositivo y no necesita una API de pago.',
      },
      updates: {
        title: 'Recursos sin conexión',
        body: 'Prepara la próxima escala, una escala específica o la biblioteca completa para seguir tocando con una conexión deficiente.',
        how: 'Descarga solo lo necesario. Si la biblioteca ya está disponible sin conexión, MusicScale reutiliza esas canciones en las escalas sin duplicarlas.',
      },
      refinements: {
        summary: 'Leer más — correcciones y refinamientos',
        title: 'Correcciones y refinamientos',
        items: [
          { date: '17/09', text: 'Se corrigieron el desbordamiento horizontal y las áreas de toque de Herramientas de Escenario en móviles.' },
          { date: '17/09', text: 'Las descargas de biblioteca y escalas comparten el mismo repertorio local con deduplicación por revisión.' },
          { date: '17/09', text: 'La caché sin conexión y los Pads personales quedan aislados por usuario, organización y dispositivo.' },
        ],
      },
    },
    intelligentPartsBeta04: {
      title: 'Cada músico ahora ve lo que realmente necesita tocar.',
      description: 'MusicScale incorpora Partes Inteligentes, foco según la función real de la escala y navegación contextual dentro del Modo Performance.',
      stageTools: {
        title: 'Partes Inteligentes',
        body: 'Solos, riffs, instrumentales y otras partes técnicas nacen de la cifra canónica, sin crear copias separadas de la canción.',
        how: 'Abre Partes en la canción para revisar los fragmentos detectados, transponer contenido armónico cuando sea seguro y conservar la digitación original de las tablaturas.',
      },
      deviceAudio: {
        title: 'Mi Foco por escala',
        body: 'MusicScale usa la función asignada en ese culto para priorizar las partes realmente relevantes para cada músico.',
        how: 'Si estás asignado a guitarra, bajo, teclado u otro instrumento compatible, Mi Foco aparece primero; Todas sigue disponible en cualquier momento.',
      },
      updates: {
        title: 'Performance contextual',
        body: 'El Modo Performance ahora destaca tus partes y permite saltar directamente a ellas sin ocultar la cifra completa.',
        how: 'Usa Mi Foco en el navegador de secciones para ir a tus fragmentos. Los encabezados personalizados seguros se reconocen sin confundir acordes ChordPro.',
      },
      refinements: {
        summary: 'Leer más — correcciones y refinamientos',
        title: 'Correcciones y refinamientos',
        items: [
          { date: '18/09', text: 'Partes y Performance ahora comparten el mismo parser canónico de secciones.' },
          { date: '18/09', text: 'Las tablaturas conservan la digitación original y el contenido armónico sigue siendo transponible cuando corresponde.' },
          { date: '18/09', text: 'El reconocimiento de secciones evita falsos positivos de ChordPro, tono, capo y marcadores numéricos.' },
        ],
      },
    },
    personalPreparationBeta05: {
      title: 'Tu preparación ahora es más personal — y el repertorio más seguro.',
      description: 'MusicScale ahora muestra lo que necesitas practicar para la próxima escala y trata las canciones duplicadas con una decisión clara antes de guardar.',
      stageTools: {
        title: 'Practicar mi foco',
        body: 'El Dashboard usa tu función real en la escala para destacar solo las canciones y partes que necesitan tu atención, conservando el orden del repertorio.',
        how: 'Abre tu próxima escala desde el Dashboard y elige “Practicar mi foco” para comenzar por la primera canción que tenga una parte relevante para ti.',
      },
      deviceAudio: {
        title: 'Duplicados bajo control',
        body: 'Al crear o importar una canción que ya existe, MusicScale muestra la coincidencia antes de guardar y permite cancelar, crear una copia nueva o sustituir la existente.',
        how: 'Revisa la canción encontrada y elige la acción deseada. La sustitución exige una confirmación adicional antes de cambiar cualquier contenido.',
      },
      updates: {
        title: 'Sustituir sin romper escalas',
        body: 'Cuando sustituyes una canción, se conservan el mismo ID y los vínculos con las escalas existentes, mientras los nuevos datos musicales reemplazan la versión anterior.',
        how: 'Título, artista, tono, BPM, letra, acordes, secciones, solos, partes, tabs y metadatos se actualizan juntos; los datos antiguos de arreglo que no existan en la nueva versión se eliminan.',
      },
      refinements: {
        summary: 'Leer más — correcciones y refinamientos',
        title: 'Correcciones y refinamientos',
        items: [
          { date: '18/09', text: 'La creación manual y la importación con IA ahora comparten el mismo flujo de decisión para canciones similares.' },
          { date: '18/09', text: 'La sustitución conserva identidad, vínculos e historial operativo de la canción con una actualización auditable del contenido.' },
          { date: '18/09', text: 'La preparación personal reutiliza Partes Inteligentes y la función asignada en la escala sin inventar un foco técnico para roles no compatibles.' },
        ],
      },
    },
    fixedBandWorkflowBeta07: {
      title: 'La escala fija ahora es una formación — y el evento queda donde corresponde.',
      description: 'Las Escalas Fijas de Banda ahora guardan solo nombre, integrantes y funciones. Fecha, hora, tipo de evento, lugar, notificaciones y asistencia pertenecen a la Escala Musical.',
      stageTools: {
        title: 'Una formación fija de verdad',
        body: 'Crea el equipo una vez con nombre, integrantes y funciones, sin convertir la formación en un evento.',
        how: 'Abre Escalas de la Banda para crear la formación fija. Al preparar una Escala Musical, selecciona esa formación en el paso Banda.',
      },
      deviceAudio: {
        title: 'Cada culto define su propio contexto',
        body: 'La Escala Musical define fecha, hora, tipo de evento y lugar. La formación elegida se copia internamente para preservar el historial de ese evento.',
        how: 'Elige la formación en la Escala Musical. La asistencia, las notificaciones y el historial siguen ligados al evento real, no al modelo fijo.',
      },
      updates: {
        title: 'Creación más simple y coherente',
        body: 'Crear una nueva escala de banda ahora abre directamente el editor de formación fija, sin pedir fecha, hora, tipo de evento o lugar.',
        how: 'Ponle un nombre a la formación, elige integrantes y funciones y listo. El contexto del evento se define después, cuando esa formación se usa en una Escala Musical.',
      },
      refinements: {
        summary: 'Leer más — correcciones y refinamientos',
        title: 'Correcciones y refinamientos',
        items: [
          { date: '20/09', text: 'Las nuevas Escalas de Banda pasan a ser únicamente formaciones fijas y reutilizables.' },
          { date: '20/09', text: 'Fecha, hora, tipo de evento y lugar fueron eliminados del concepto de Escala Fija de Banda.' },
          { date: '19/09', text: 'Los registros antiguos de Escala de Banda siguen siendo compatibles sin contaminar el nuevo flujo.' },
        ],
      },
    },
  },
} as const;
