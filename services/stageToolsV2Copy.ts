export interface StageToolsV2Copy {
  pad: {
    audioOnDevice: string;
    ready: string;
    playing: string;
    disabled: string;
    play: string;
    stop: string;
    preset: string;
    volume: string;
    individual: string;
    following: string;
    presets: Record<'worship' | 'warm' | 'air' | 'deep' | 'custom', string>;
    customTitle: string;
    customEmpty: string;
    importAudio: string;
    replaceAudio: string;
    removeAudio: string;
    baseKey: string;
    fileTooLarge: string;
    unsupportedFile: string;
    audioBlocked: string;
    customMissing: string;
    localOnly: string;
  };
  offline: {
    eyebrow: string;
    title: string;
    description: string;
    chooseScale: string;
    nextScale: string;
    noUpcomingScale: string;
    downloadScale: string;
    updateScale: string;
    library: string;
    libraryDescription: string;
    downloadLibrary: string;
    updateLibrary: string;
    available: string;
    songs: string;
    reused: string;
    downloaded: string;
    storage: string;
    preparing: string;
    selectScale: string;
    safetyNote: string;
  };
}

const PT: StageToolsV2Copy = {
  pad: {
    audioOnDevice: 'Áudio do Pad neste aparelho',
    ready: 'Pronto para tocar neste aparelho',
    playing: 'Pad tocando neste aparelho',
    disabled: 'Este aparelho não reproduzirá o Pad',
    play: 'Tocar Pad',
    stop: 'Parar Pad',
    preset: 'Som do Pad',
    volume: 'Volume',
    individual: 'Controle individual',
    following: 'Seguindo a condução',
    presets: { worship: 'Worship', warm: 'Warm', air: 'Air', deep: 'Deep', custom: 'Meu Pad' },
    customTitle: 'Meu Pad',
    customEmpty: 'Use um áudio seu em MP3, M4A, WAV ou AAC. Ele fica salvo somente neste aparelho.',
    importAudio: 'Adicionar meu Pad',
    replaceAudio: 'Trocar áudio',
    removeAudio: 'Remover',
    baseKey: 'Tom original do áudio',
    fileTooLarge: 'O arquivo precisa ter até 32 MB.',
    unsupportedFile: 'Formato de áudio não suportado neste aparelho.',
    audioBlocked: 'O navegador não liberou o áudio. Toque novamente em Tocar Pad.',
    customMissing: 'Adicione um áudio em Meu Pad antes de tocar.',
    localOnly: 'Seu áudio não é enviado para a nuvem.',
  },
  offline: {
    eyebrow: 'Offline',
    title: 'Recursos Offline',
    description: 'Prepare cifras, letras e escalas antes do culto. O MusicScale reaproveita o que já estiver baixado.',
    chooseScale: 'Escolher uma escala',
    nextScale: 'Próxima escala',
    noUpcomingScale: 'Nenhuma próxima escala encontrada.',
    downloadScale: 'Baixar escala',
    updateScale: 'Atualizar escala',
    library: 'Biblioteca inteira',
    libraryDescription: 'Baixa todo o repertório desta organização. Escalas futuras reutilizam essas músicas sem baixar de novo.',
    downloadLibrary: 'Baixar biblioteca',
    updateLibrary: 'Atualizar biblioteca',
    available: 'Disponível offline',
    songs: 'músicas',
    reused: 'já estavam disponíveis',
    downloaded: 'novos recursos salvos',
    storage: 'armazenamento usado pelo site',
    preparing: 'Preparando…',
    selectScale: 'Selecione uma escala',
    safetyNote: 'Downloads ficam neste aparelho e continuam isolados por usuário e organização.',
  },
};

const EN: StageToolsV2Copy = {
  pad: {
    audioOnDevice: 'Pad audio on this device',
    ready: 'Ready to play on this device',
    playing: 'Pad playing on this device',
    disabled: 'This device will not play the Pad',
    play: 'Play Pad',
    stop: 'Stop Pad',
    preset: 'Pad sound',
    volume: 'Volume',
    individual: 'Individual control',
    following: 'Following conductor',
    presets: { worship: 'Worship', warm: 'Warm', air: 'Air', deep: 'Deep', custom: 'My Pad' },
    customTitle: 'My Pad',
    customEmpty: 'Use your own MP3, M4A, WAV or AAC audio. It stays only on this device.',
    importAudio: 'Add my Pad',
    replaceAudio: 'Replace audio',
    removeAudio: 'Remove',
    baseKey: 'Original audio key',
    fileTooLarge: 'The file must be 32 MB or smaller.',
    unsupportedFile: 'This audio format is not supported on this device.',
    audioBlocked: 'The browser did not unlock audio. Tap Play Pad again.',
    customMissing: 'Add audio under My Pad before playing.',
    localOnly: 'Your audio is not uploaded to the cloud.',
  },
  offline: {
    eyebrow: 'Offline',
    title: 'Offline Resources',
    description: 'Prepare charts, lyrics and schedules before service. MusicScale reuses anything already downloaded.',
    chooseScale: 'Choose a schedule',
    nextScale: 'Next schedule',
    noUpcomingScale: 'No upcoming schedule found.',
    downloadScale: 'Download schedule',
    updateScale: 'Update schedule',
    library: 'Entire library',
    libraryDescription: 'Downloads this organization’s full repertoire. Future schedules reuse those songs without downloading them again.',
    downloadLibrary: 'Download library',
    updateLibrary: 'Update library',
    available: 'Available offline',
    songs: 'songs',
    reused: 'already available',
    downloaded: 'new resources saved',
    storage: 'storage used by the site',
    preparing: 'Preparing…',
    selectScale: 'Select a schedule',
    safetyNote: 'Downloads stay on this device and remain isolated by user and organization.',
  },
};

const ES: StageToolsV2Copy = {
  pad: {
    audioOnDevice: 'Audio del Pad en este dispositivo',
    ready: 'Listo para reproducir en este dispositivo',
    playing: 'Pad reproduciéndose en este dispositivo',
    disabled: 'Este dispositivo no reproducirá el Pad',
    play: 'Reproducir Pad',
    stop: 'Detener Pad',
    preset: 'Sonido del Pad',
    volume: 'Volumen',
    individual: 'Control individual',
    following: 'Siguiendo la dirección',
    presets: { worship: 'Worship', warm: 'Warm', air: 'Air', deep: 'Deep', custom: 'Mi Pad' },
    customTitle: 'Mi Pad',
    customEmpty: 'Usa tu propio audio MP3, M4A, WAV o AAC. Se guarda solo en este dispositivo.',
    importAudio: 'Agregar mi Pad',
    replaceAudio: 'Cambiar audio',
    removeAudio: 'Eliminar',
    baseKey: 'Tono original del audio',
    fileTooLarge: 'El archivo debe tener como máximo 32 MB.',
    unsupportedFile: 'Este formato de audio no es compatible con este dispositivo.',
    audioBlocked: 'El navegador no habilitó el audio. Toca Reproducir Pad de nuevo.',
    customMissing: 'Agrega un audio en Mi Pad antes de reproducir.',
    localOnly: 'Tu audio no se sube a la nube.',
  },
  offline: {
    eyebrow: 'Offline',
    title: 'Recursos Offline',
    description: 'Prepara acordes, letras y escalas antes del culto. MusicScale reutiliza lo que ya esté descargado.',
    chooseScale: 'Elegir una escala',
    nextScale: 'Próxima escala',
    noUpcomingScale: 'No se encontró una próxima escala.',
    downloadScale: 'Descargar escala',
    updateScale: 'Actualizar escala',
    library: 'Biblioteca completa',
    libraryDescription: 'Descarga todo el repertorio de esta organización. Las próximas escalas reutilizan esas canciones sin descargarlas otra vez.',
    downloadLibrary: 'Descargar biblioteca',
    updateLibrary: 'Actualizar biblioteca',
    available: 'Disponible offline',
    songs: 'canciones',
    reused: 'ya estaban disponibles',
    downloaded: 'nuevos recursos guardados',
    storage: 'almacenamiento usado por el sitio',
    preparing: 'Preparando…',
    selectScale: 'Selecciona una escala',
    safetyNote: 'Las descargas quedan en este dispositivo y permanecen aisladas por usuario y organización.',
  },
};

export function getStageToolsV2Copy(language?: string | null): StageToolsV2Copy {
  const normalized = String(language || 'pt').toLowerCase();
  if (normalized.startsWith('en')) return EN;
  if (normalized.startsWith('es')) return ES;
  return PT;
}
