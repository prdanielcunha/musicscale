import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import pt from "../locales/pt.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import { curationTranslations } from "../locales/curation";
import { trackMissingKey } from "../utils/languageDiagnostics";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: { ...pt, curation: curationTranslations.pt } },
      en: { translation: { ...en, curation: curationTranslations.en } },
      es: { translation: { ...es, curation: curationTranslations.es } }
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
