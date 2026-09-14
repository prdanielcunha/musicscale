import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import pt from "../locales/pt.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import { curationTranslations } from "../locales/curation";
import { curationModalTranslations } from "../locales/curationModals";
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
        translation: {
          ...pt,
          curation: { ...curationTranslations.pt, modals: curationModalTranslations.pt },
          premiumV2: premiumV2Translations.pt,
        },
      },
      en: {
        translation: {
          ...en,
          curation: { ...curationTranslations.en, modals: curationModalTranslations.en },
          premiumV2: premiumV2Translations.en,
        },
      },
      es: {
        translation: {
          ...es,
          curation: { ...curationTranslations.es, modals: curationModalTranslations.es },
          premiumV2: premiumV2Translations.es,
        },
      },
    },
    fallbackLng: "pt", // Fallback consistently
    interpolation: {
      escapeValue: false // react already protects from xss
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "millionsnest_i18n_lng"
    },
    react: {
      useSuspense: false // Statically loaded, no suspense loading screen flickers
    }
  });

// Setup dynamic missing key detector to maintain perfection
i18n.on("missingKey", (lngs, namespace, key, res) => {
  trackMissingKey(key);
});

export default i18n;
