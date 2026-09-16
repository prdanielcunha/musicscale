import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);

function replaceRequired(path, search, replacement, label) {
  const current = read(path);
  if (!current.includes(search)) {
    throw new Error(`Missing patch target ${label} in ${path}`);
  }
  write(path, current.replace(search, replacement));
}

function replaceRegexRequired(path, pattern, replacement, label) {
  const current = read(path);
  if (!pattern.test(current)) {
    throw new Error(`Missing regex patch target ${label} in ${path}`);
  }
  write(path, current.replace(pattern, replacement));
}

// Correct the release metadata and lock without changing dependency intent.
{
  const pkg = JSON.parse(read('package.json'));
  pkg.version = '0.2.0-beta.0';
  pkg.dependencies.cors = '^2.8.6';
  pkg.scripts['release:minor'] = 'node scripts/bump-release.mjs minor';
  pkg.scripts['release:patch'] = 'node scripts/bump-release.mjs patch';
  pkg.scripts['release:revision'] = 'node scripts/bump-release.mjs revision';
  pkg.scripts['release:visual'] = 'node scripts/bump-release.mjs visual';
  write('package.json', JSON.stringify(pkg, null, 2) + '\n');

  const lock = JSON.parse(read('package-lock.json'));
  lock.version = pkg.version;
  lock.packages[''].version = pkg.version;
  write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
}

const translations = {
  pt: {
    nav: 'Ferramentas de Palco',
    stage: {
      eyebrow: 'Palco',
      title: 'Ferramentas de Palco',
      subtitle: 'Recursos essenciais para ensaio, passagem de som e culto, sem depender de uma cifra aberta.',
      pad_title: 'Ambient Pad',
      pad_description: 'Escolha o tom manualmente e decida se este aparelho será a saída de áudio.',
      metronome_title: 'Metrônomo',
      metronome_description: 'Defina o BPM, marque o tempo e controle o click com áudio preparado para o palco.',
      audio_note: 'O áudio nunca inicia sozinho. Cada aparelho precisa ser habilitado localmente e o Play continua exigindo uma ação do usuário.',
    },
    pad: {
      label: 'Ambient Pad', start: 'Iniciar Pad', stop: 'Parar Pad', volume: 'Volume', volume_control: 'Volume do Pad', stage_open: 'Abrir Pad de palco',
      device_output: 'Reproduzir o Pad neste dispositivo', device_playing: 'Este dispositivo está reproduzindo', device_disabled: 'Áudio desativado neste dispositivo', device_ready: 'Pronto para reproduzir neste dispositivo',
      follow_conduction: 'Acompanha a condução', individual_control: 'Controle individual', return_to_conduction: 'Voltar a acompanhar a condução', select_key: 'Selecionar tom {{key}}',
      neutral_note: 'O Pad é harmonicamente neutro: usa raiz, quinta e oitavas, funcionando com tonalidades maiores e menores sem transformar Am em A maior ou C.',
    },
    metronome: { status_playing: 'Metrônomo reproduzindo', status_ready: 'Pronto para iniciar o metrônomo' },
    beta: 'BETA', build: 'Build {{version}}',
  },
  en: {
    nav: 'Stage Tools',
    stage: {
      eyebrow: 'Stage',
      title: 'Stage Tools',
      subtitle: 'Essential tools for rehearsal, soundcheck and worship without requiring an open chord chart.',
      pad_title: 'Ambient Pad',
      pad_description: 'Choose a key manually and decide whether this device will output audio.',
      metronome_title: 'Metronome',
      metronome_description: 'Set the BPM, keep time and control the click with stage-ready audio.',
      audio_note: 'Audio never starts automatically. Each device must be enabled locally and Play still requires a user action.',
    },
    pad: {
      label: 'Ambient Pad', start: 'Start Pad', stop: 'Stop Pad', volume: 'Volume', volume_control: 'Pad volume', stage_open: 'Open stage Pad',
      device_output: 'Play the Pad on this device', device_playing: 'This device is playing', device_disabled: 'Audio is disabled on this device', device_ready: 'Ready to play on this device',
      follow_conduction: 'Follows direction', individual_control: 'Individual control', return_to_conduction: 'Return to following direction', select_key: 'Select key {{key}}',
      neutral_note: 'The Pad is harmonically neutral: it uses root, fifth and octaves, so it works with major and minor keys without turning Am into A major or C.',
    },
    metronome: { status_playing: 'Metronome is playing', status_ready: 'Metronome ready to start' },
    beta: 'BETA', build: 'Build {{version}}',
  },
  es: {
    nav: 'Herramientas de Escenario',
    stage: {
      eyebrow: 'Escenario',
      title: 'Herramientas de Escenario',
      subtitle: 'Herramientas esenciales para ensayo, prueba de sonido y culto sin depender de una cifra abierta.',
      pad_title: 'Ambient Pad',
      pad_description: 'Elige el tono manualmente y decide si este dispositivo reproducirá el audio.',
      metronome_title: 'Metrónomo',
      metronome_description: 'Define el BPM, marca el tiempo y controla el click con audio preparado para el escenario.',
      audio_note: 'El audio nunca comienza automáticamente. Cada dispositivo debe habilitarse localmente y Play sigue requiriendo una acción del usuario.',
    },
    pad: {
      label: 'Ambient Pad', start: 'Iniciar Pad', stop: 'Detener Pad', volume: 'Volumen', volume_control: 'Volumen del Pad', stage_open: 'Abrir Pad de escenario',
      device_output: 'Reproducir el Pad en este dispositivo', device_playing: 'Este dispositivo está reproduciendo', device_disabled: 'Audio desactivado en este dispositivo', device_ready: 'Listo para reproducir en este dispositivo',
      follow_conduction: 'Sigue la dirección', individual_control: 'Control individual', return_to_conduction: 'Volver a seguir la dirección', select_key: 'Seleccionar tono {{key}}',
      neutral_note: 'El Pad es armónicamente neutro: usa raíz, quinta y octavas, por lo que funciona con tonalidades mayores y menores sin convertir Am en A mayor ni C.',
    },
    metronome: { status_playing: 'Metrónomo reproduciendo', status_ready: 'Metrónomo listo para iniciar' },
    beta: 'BETA', build: 'Build {{version}}',
  },
};

for (const language of ['pt', 'en', 'es']) {
  const path = `locales/${language}.json`;
  const locale = JSON.parse(read(path));
  const copy = translations[language];
  locale.nav = { ...(locale.nav || {}), stage_tools: copy.nav };
  locale.stage_tools = copy.stage;
  locale.pad = { ...(locale.pad || {}), ...copy.pad };
  locale.metronome = { ...(locale.metronome || {}), ...copy.metronome };
  locale.help_modal = {
    ...(locale.help_modal || {}),
    version_beta: copy.beta,
    version_build: copy.build,
  };
  write(path, JSON.stringify(locale, null, 2) + '\n');
}

replaceRequired(
  'components/layout/Sidebar.tsx',
  "import { APP_VERSION } from '../../lib/appRelease';\n",
  '',
  'sidebar version import',
);
replaceRegexRequired(
  'components/layout/Sidebar.tsx',
  /\n\s*\{!isCollapsed && <p className="px-3 py-2 text-\[11px\] text-slate-500" title=\{t\('releaseNews\.currentVersion'\)\}>MusicScale · v\{APP_VERSION\}<\/p>\}/,
  '',
  'sidebar version label',
);

replaceRequired(
  'components/layout/Header.tsx',
  "import { APP_VERSION } from '../../lib/appRelease';\n",
  '',
  'header version import',
);
replaceRequired(
  'components/layout/Header.tsx',
  '    if (pathname.startsWith("/updates")) return t("nav.updates", "Novidades");\n',
  '    if (pathname.startsWith("/updates")) return t("nav.updates", "Novidades");\n    if (pathname.startsWith("/stage-tools")) return t("nav.stage_tools");\n',
  'stage tools header title',
);
replaceRequired(
  'components/layout/Header.tsx',
  '{t("nav.updates", "Atualizações")} · v{APP_VERSION}',
  "{t('nav.updates')}",
  'header update version',
);
replaceRequired(
  'components/layout/Header.tsx',
  "            {t('releaseNews.view')} <span className=\"ml-2 font-mono text-indigo-300/70\">v{APP_VERSION}</span>\n",
  "            {t('releaseNews.view')}\n",
  'header announcement version',
);

replaceRequired(
  'components/layout/navigationRegistry.tsx',
  'import { ShieldAlert, FileText } from "lucide-react";',
  'import { ShieldAlert, FileText, Wrench } from "lucide-react";',
  'stage tools navigation icon',
);
replaceRequired(
  'components/layout/navigationRegistry.tsx',
  '  {\n    id: "updates",\n',
  '  {\n    id: "stage_tools",\n    type: "link",\n    icon: <Wrench className="w-4 h-4 opacity-70" strokeWidth={2} />,\n    labelKey: "nav.stage_tools",\n    defaultLabel: "Stage Tools",\n    path: "/stage-tools",\n    permissionRequired: "musicscale.performance.use",\n    section: "primary",\n    group: null,\n  },\n  {\n    id: "updates",\n',
  'stage tools navigation item',
);

replaceRequired(
  'PrivateApp.tsx',
  "const ChordsPage = lazy(() => import('./pages/ChordsPage'));\n",
  "const ChordsPage = lazy(() => import('./pages/ChordsPage'));\nconst StageToolsPage = lazy(() => import('./pages/StageToolsPage'));\n",
  'stage tools lazy route',
);
replaceRequired(
  'PrivateApp.tsx',
  '                                <Route path="/database" element={\n',
  '                                <Route path="/stage-tools" element={\n                                    <ProtectedRoute requiredPermission="musicscale.performance.use">\n                                        <StageToolsPage />\n                                    </ProtectedRoute>\n                                } />\n                                <Route path="/database" element={\n',
  'stage tools protected route',
);

replaceRequired(
  'components/help/HelpModal.tsx',
  'import { useTranslation } from "react-i18next";\n',
  'import { useTranslation } from "react-i18next";\nimport { APP_VERSION } from "../../lib/appRelease";\n',
  'help version import',
);
replaceRequired(
  'components/help/HelpModal.tsx',
  '  const [activeTab, setActiveTab] = useState("report");\n',
  '  const [activeTab, setActiveTab] = useState("report");\n  const publicVersion = APP_VERSION.split("-")[0];\n',
  'help public version',
);
replaceRegexRequired(
  'components/help/HelpModal.tsx',
  /      case "version":\n[\s\S]*?      case "about":/,
  `      case "version":\n        return (\n          <div>\n            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">\n              {t("help_modal.version_title")}\n            </h2>\n            <Card className="p-5">\n              <div className="flex flex-col gap-4">\n                <div className="flex flex-wrap items-center gap-2.5">\n                  <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">\n                    MusicScale {publicVersion}\n                  </span>\n                  <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-violet-600 dark:text-violet-300">\n                    {t("help_modal.version_beta")}\n                  </span>\n                </div>\n                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">\n                  {t("help_modal.version_build", { version: APP_VERSION })}\n                </p>\n              </div>\n            </Card>\n          </div>\n        );\n      case "about":`,
  'help version panel',
);

replaceRequired(
  'components/common/Metronome.tsx',
  `      {audioError && (\n        <p\n          className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-[10px] font-semibold leading-relaxed text-amber-100/85"\n          role="status"\n        >\n          {audioError}\n        </p>\n      )}\n`,
  `      {audioError ? (\n        <p\n          className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-[10px] font-semibold leading-relaxed text-amber-100/85"\n          role="status"\n        >\n          {audioError}\n        </p>\n      ) : (\n        <p className="mt-3 text-[10px] font-medium text-white/32" role="status">\n          {isPlaying ? t('metronome.status_playing') : t('metronome.status_ready')}\n        </p>\n      )}\n`,
  'metronome status',
);

replaceRequired(
  'components/songs/ChordsViewerModal.tsx',
  '    <div\n      className={`fixed inset-0 z-[120] overflow-hidden flex flex-col font-sans transition-colors duration-300 ${isWorshipFlow ? "bg-[#0A0A0C]" : "bg-[#0A0A0C]"}`}\n',
  '    <div\n      data-performance-mode="true"\n      className={`fixed inset-0 z-[120] overflow-hidden flex flex-col font-sans transition-colors duration-300 ${isWorshipFlow ? "bg-[#0A0A0C]" : "bg-[#0A0A0C]"}`}\n',
  'performance mode marker',
);

replaceRegexRequired(
  'App.tsx',
  / \* The first-access welcome presentation is intentionally not prefetched here\.\n \* Preloading it in parallel with PrivateApp made a non-essential chunk compete\n \* with the critical mobile bootstrap for network, parse and main-thread time\.\n/,
  ' * Release news is intentionally not prefetched here. Loading it in parallel\n * with PrivateApp would make a non-essential chunk compete with the critical\n * mobile bootstrap for network, parse and main-thread time.\n',
  'root app release comment',
);

replaceRequired(
  'tests/setup.ts',
  `    t: (key: string, defaultText: string, options?: any) => {\n      if (!options) return defaultText;\n      let text = defaultText;\n      for (const k in options) {\n        text = text.replace(new RegExp(\`{{\${k}}}\`, "g"), options[k]);\n      }\n      return text;\n    },\n`,
  `    t: (key: string, defaultTextOrOptions?: string | Record<string, any>, maybeOptions?: any) => {\n      const defaultText = typeof defaultTextOrOptions === 'string' ? defaultTextOrOptions : key;\n      const options = typeof defaultTextOrOptions === 'object' ? defaultTextOrOptions : maybeOptions;\n      if (!options) return defaultText;\n      let text = defaultText;\n      for (const k in options) {\n        text = text.replace(new RegExp(\`{{\${k}}}\`, "g"), options[k]);\n      }\n      return text;\n    },\n`,
  'i18n test mock interpolation',
);

console.log('Stage Tools large integration patch applied.');
