import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

const nodeErrors = {
  pt: {
    node_unreachable: 'Não consegui alcançar esse Live Node na rede local.',
    node_timeout: 'O Live Node demorou demais para responder.',
    node_must_be_local: 'Use um endereço da rede local, como 192.168.x.x, 10.x.x.x ou .local.',
    unsupported_node_protocol: 'O endereço do Live Node deve usar HTTP ou HTTPS.',
    mixed_content_blocked: 'Este navegador bloqueou HTTPS → HTTP local. Abra o MusicScale Live pelo endereço local servido pelo Live Node neste dispositivo.',
    pairing_rate_limited: 'Muitas tentativas. Aguarde alguns segundos e tente novamente.',
    pairing_pin_invalid: 'O código de pareamento não confere.',
    pairing_challenge_expired: 'O código expirou. Solicite um novo.',
    pairing_attempts_exceeded: 'Muitas tentativas de código. Solicite um novo pareamento.',
    pairing_device_mismatch: 'O pareamento não pertence a este dispositivo.',
    pairing_failed: 'Não foi possível concluir o pareamento.'
  },
  en: {
    node_unreachable: 'This Live Node could not be reached on the local network.',
    node_timeout: 'The Live Node took too long to respond.',
    node_must_be_local: 'Use a local-network address such as 192.168.x.x, 10.x.x.x or .local.',
    unsupported_node_protocol: 'The Live Node address must use HTTP or HTTPS.',
    mixed_content_blocked: 'This browser blocked HTTPS → local HTTP. Open MusicScale Live from the local address served by the Live Node on this device.',
    pairing_rate_limited: 'Too many attempts. Wait a few seconds and try again.',
    pairing_pin_invalid: 'The pairing code is incorrect.',
    pairing_challenge_expired: 'The code expired. Request a new one.',
    pairing_attempts_exceeded: 'Too many code attempts. Request a new pairing.',
    pairing_device_mismatch: 'This pairing does not belong to this device.',
    pairing_failed: 'Pairing could not be completed.'
  },
  es: {
    node_unreachable: 'No pude alcanzar este Live Node en la red local.',
    node_timeout: 'El Live Node tardó demasiado en responder.',
    node_must_be_local: 'Use una dirección de red local, como 192.168.x.x, 10.x.x.x o .local.',
    unsupported_node_protocol: 'La dirección del Live Node debe usar HTTP o HTTPS.',
    mixed_content_blocked: 'Este navegador bloqueó HTTPS → HTTP local. Abra MusicScale Live desde la dirección local servida por el Live Node en este dispositivo.',
    pairing_rate_limited: 'Demasiados intentos. Espere unos segundos y vuelva a intentar.',
    pairing_pin_invalid: 'El código de emparejamiento no coincide.',
    pairing_challenge_expired: 'El código expiró. Solicite uno nuevo.',
    pairing_attempts_exceeded: 'Demasiados intentos de código. Solicite un nuevo emparejamiento.',
    pairing_device_mismatch: 'Este emparejamiento no pertenece a este dispositivo.',
    pairing_failed: 'No fue posible completar el emparejamiento.'
  }
};

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
    requests: 'Requests',
    nodeStatus: {
      connecting: 'Conectando',
      reconnecting: 'Reconectando',
      offline: 'Offline'
    },
    nodeSetup: {
      kicker: 'LOCAL CONTROL PLANE',
      title: 'Conectar este ambiente ao Live Node',
      description: 'O Live Node roda no computador de produção e mantém o controle local funcionando mesmo sem internet.',
      connected: 'Live Node conectado',
      disconnect: 'Desconectar',
      address: 'Endereço',
      providers: 'Providers detectados',
      transport: 'Transporte',
      pairing: 'Pareamento seguro',
      enterPin: 'Digite o código mostrado no computador do Live Node',
      pinHint: 'No computador de produção, abra http://127.0.0.1:4317. O PIN aparece apenas localmente e expira rapidamente.',
      pin: 'Código de pareamento',
      confirm: 'Confirmar pareamento',
      nodeAddress: 'Endereço do Live Node',
      addressHint: 'No mesmo computador use 127.0.0.1. Em outro dispositivo use o IP local mostrado pelo Live Node, por exemplo 192.168.1.20:4317.',
      probing: 'Procurando…',
      pair: 'Conectar e parear',
      noCloudSecret: 'As credenciais dos providers permanecem somente no computador local.'
    },
    nodeErrors: nodeErrors.pt
  }},
  en: { translation: {
    brand: 'MusicScale Live', studio: 'Studio', live: 'Live', pastor: 'Pastor', conductor: 'Conductor',
    signIn: 'Sign in with Google', signOut: 'Sign out', sameEcosystem: 'Same MillionsNest ecosystem',
    organization: 'Organization', nextService: 'Next service', noService: 'No upcoming schedule found',
    songs: 'songs', foundation: 'Foundation', providerAgnostic: 'Provider-agnostic', lanFirst: 'LAN-first',
    offlineReady: 'Offline-ready', health: 'System health', node: 'Live Node', cloud: 'Cloud Sync',
    providers: 'Providers', pending: 'Pending', connected: 'Connected', readOnlyBridge: 'MusicScale read-only bridge',
    loading: 'Loading context...', chooseMode: 'Prepared surfaces', now: 'Now', timeline: 'Run of Show',
    bible: 'Bible', media: 'Media', requests: 'Requests',
    nodeStatus: { connecting: 'Connecting', reconnecting: 'Reconnecting', offline: 'Offline' },
    nodeSetup: {
      kicker: 'LOCAL CONTROL PLANE',
      title: 'Connect this environment to Live Node',
      description: 'Live Node runs on the production computer and keeps local control working even when the internet is down.',
      connected: 'Live Node connected',
      disconnect: 'Disconnect',
      address: 'Address',
      providers: 'Detected providers',
      transport: 'Transport',
      pairing: 'Secure pairing',
      enterPin: 'Enter the code shown on the Live Node computer',
      pinHint: 'On the production computer, open http://127.0.0.1:4317. The PIN is displayed locally only and expires quickly.',
      pin: 'Pairing code',
      confirm: 'Confirm pairing',
      nodeAddress: 'Live Node address',
      addressHint: 'On the same computer use 127.0.0.1. From another device use the local IP shown by Live Node, for example 192.168.1.20:4317.',
      probing: 'Looking…',
      pair: 'Connect and pair',
      noCloudSecret: 'Provider credentials remain on the local computer only.'
    },
    nodeErrors: nodeErrors.en
  }},
  es: { translation: {
    brand: 'MusicScale Live', studio: 'Studio', live: 'Live', pastor: 'Pastor', conductor: 'Conductor',
    signIn: 'Entrar con Google', signOut: 'Salir', sameEcosystem: 'Mismo ecosistema MillionsNest',
    organization: 'Organización', nextService: 'Próximo culto', noService: 'No se encontró una escala futura',
    songs: 'canciones', foundation: 'Foundation', providerAgnostic: 'Provider-agnostic', lanFirst: 'LAN-first',
    offlineReady: 'Offline-ready', health: 'Salud del sistema', node: 'Live Node', cloud: 'Cloud Sync',
    providers: 'Providers', pending: 'Pendiente', connected: 'Conectado', readOnlyBridge: 'Bridge MusicScale en modo lectura',
    loading: 'Cargando contexto...', chooseMode: 'Superficies preparadas', now: 'Ahora', timeline: 'Guion',
    bible: 'Biblia', media: 'Media', requests: 'Requests',
    nodeStatus: { connecting: 'Conectando', reconnecting: 'Reconectando', offline: 'Offline' },
    nodeSetup: {
      kicker: 'LOCAL CONTROL PLANE',
      title: 'Conectar este entorno al Live Node',
      description: 'Live Node se ejecuta en el ordenador de producción y mantiene el control local incluso sin internet.',
      connected: 'Live Node conectado',
      disconnect: 'Desconectar',
      address: 'Dirección',
      providers: 'Providers detectados',
      transport: 'Transporte',
      pairing: 'Emparejamiento seguro',
      enterPin: 'Escriba el código mostrado en el ordenador del Live Node',
      pinHint: 'En el ordenador de producción, abra http://127.0.0.1:4317. El PIN aparece solo localmente y expira rápidamente.',
      pin: 'Código de emparejamiento',
      confirm: 'Confirmar emparejamiento',
      nodeAddress: 'Dirección del Live Node',
      addressHint: 'En el mismo ordenador use 127.0.0.1. Desde otro dispositivo use la IP local mostrada por Live Node, por ejemplo 192.168.1.20:4317.',
      probing: 'Buscando…',
      pair: 'Conectar y emparejar',
      noCloudSecret: 'Las credenciales de los providers permanecen solo en el ordenador local.'
    },
    nodeErrors: nodeErrors.es
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
