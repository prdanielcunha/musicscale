import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import pt from "../locales/pt.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import { curationTranslations } from "../locales/curation";
import { curationModalTranslations } from "../locales/curationModals";
import { dashboardGreetingTranslations } from "../locales/dashboardGreetings";
import { premiumV2Translations } from "../locales/premiumV2";
import { trackMissingKey } from "../utils/languageDiagnostics";

const SUPPORTED_DOCUMENT_LANGUAGES = new Set(["pt", "en", "es"]);

const resolveDocumentLanguage = (language?: string) => {
  const baseLanguage = language?.toLowerCase().split("-")[0];
  return baseLanguage && SUPPORTED_DOCUMENT_LANGUAGES.has(baseLanguage) ? baseLanguage : "pt";
};

const syncDocumentLanguage = (language?: string) => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = resolveDocumentLanguage(language);
};

const buildTranslationResource = (
  base: Record<string, any>,
  curation: Record<string, any>,
  dashboardGreetings: Record<string, string>,
  premium: (typeof premiumV2Translations)[keyof typeof premiumV2Translations],
) => ({
  ...base,
  dashboard: {
    ...(base.dashboard || {}),
    greetings: {
      ...(base.dashboard?.greetings || {}),
      ...dashboardGreetings,
    },
  },
  library: {
    ...(base.library || {}),
    card_accessible_label: premium.library.cardAccessibleLabel,
    gesture_release_to_add: premium.library.gestureReleaseToAdd,
    gesture_preview: premium.library.gesturePreview,
    gesture_hint: premium.library.gestureHint,
  },
  curation,
  premiumV2: premium,
});

i18n.on("languageChanged", syncDocumentLanguage);
i18n.on("initialized", () => {
  syncDocumentLanguage(i18n.resolvedLanguage || i18n.language);
});

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: {
        translation: buildTranslationResource(
          pt,
          { ...curationTranslations.pt, modals: curationModalTranslations.pt },
          dashboardGreetingTranslations.pt,
          premiumV2Translations.pt,
        ),
      },
      en: {
        translation: buildTranslationResource(
          en,
          { ...curationTranslations.en, modals: curationModalTranslations.en },
          dashboardGreetingTranslations.en,
          premiumV2Translations.en,
        ),
      },
      es: {
        translation: buildTranslationResource(
          es,
          { ...curationTranslations.es, modals: curationModalTranslations.es },
          dashboardGreetingTranslations.es,
          premiumV2Translations.es,
        ),
      },
    },
    fallbackLng: "pt",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "millionsnest_i18n_lng",
    },
    react: {
      useSuspense: false,
    },
  });

// Setup dynamic missing key detector to maintain perfection
i18n.on("missingKey", (lngs, namespace, key, res) => {
  trackMissingKey(key);
});

export default i18n;