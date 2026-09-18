import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

const resources = {
  pt: { translation: {
    brand: 'MusicScale Live',
    studio: 'Studio',
    live: 'Live',
    pastor: 'Pastor',
    conductor: 'Conductor',
    signIn: 'Entrar com Google',
    signOut: 'Sair',
    sameEcosystem: 'Mesmo ecossistema MillionsNest',
    organization: 'Organização',
    nextService: 'Próximo culto',
    noService: 'Nenhuma escala futura encontrada',
    songs: 'músicas',
    foundation: 'Foundation',
    providerAgnostic: 'Provider-agnostic',
    lanFirst: 'LAN-first',
    offlineReady: 'Offline-ready',
    health: 'Saúde do sistema',
    node: 'Live Node',
    cloud: 'Cloud Sync',
    providers: 'Providers',
    pending: 'Aguardando',
    connected: 'Conectado',
    readOnlyBridge: 'Bridge MusicScale em modo leitura',
    loading: 'Carregando contexto...',
    chooseMode: 'Superfícies preparadas',
    now: 'Agora',
    timeline: 'Roteiro',
    bible: 'Bíblia',
    media: 'Mídia',
    requests: 'Requests'
  }},
  en: { translation: {
    brand: 'MusicScale Live', studio: 'Studio', live: 'Live', pastor: 'Pastor', conductor: 'Conductor',
    signIn: 'Sign in with Google', signOut: 'Sign out', sameEcosystem: 'Same MillionsNest ecosystem',
    organization: 'Organization', nextService: 'Next service', noService: 'No upcoming schedule found',
    songs: 'songs', foundation: 'Foundation', providerAgnostic: 'Provider-agnostic', lanFirst: 'LAN-first',
    offlineReady: 'Offline-ready', health: 'System health', node: 'Live Node', cloud: 'Cloud Sync',
    providers: 'Providers', pending: 'Pending', connected: 'Connected', readOnlyBridge: 'MusicScale read-only bridge',
    loading: 'Loading context...', chooseMode: 'Prepared surfaces', now: 'Now', timeline: 'Run of Show',
    bible: 'Bible', media: 'Media', requests: 'Requests'
  }},
  es: { translation: {
    brand: 'MusicScale Live', studio: 'Studio', live: 'Live', pastor: 'Pastor', conductor: 'Conductor',
    signIn: 'Entrar con Google', signOut: 'Salir', sameEcosystem: 'Mismo ecosistema MillionsNest',
    organization: 'Organización', nextService: 'Próximo culto', noService: 'No se encontró una escala futura',
    songs: 'canciones', foundation: 'Foundation', providerAgnostic: 'Provider-agnostic', lanFirst: 'LAN-first',
    offlineReady: 'Offline-ready', health: 'Salud del sistema', node: 'Live Node', cloud: 'Cloud Sync',
    providers: 'Providers', pending: 'Pendiente', connected: 'Conectado', readOnlyBridge: 'Bridge MusicScale en modo lectura',
    loading: 'Cargando contexto...', chooseMode: 'Superficies preparadas', now: 'Ahora', timeline: 'Guion',
    bible: 'Biblia', media: 'Media', requests: 'Requests'
  }}
};

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources,
  fallbackLng: 'pt',
  interpolation: { escapeValue: false },
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupLocalStorage: 'millionsnest_i18n_lng'
  }
});

export default i18n;
