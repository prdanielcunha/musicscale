import pt from "../locales/pt.json";
import en from "../locales/en.json";
import es from "../locales/es.json";

export interface DiagnosticResult {
  healthy: boolean;
  totalKeys: number;
  languagesChecked: string[];
  warnings: string[];
  keyCounts: Record<string, number>;
}

// In-memory cache for missing keys detected during the session
const sessionMissingKeys = new Set<string>();

/**
 * Traverses a nested object to list all flat paths of keys (e.g. "nav.dashboard")
 */
function getDeepKeys(obj: any, prefix = ""): string[] {
  let keys: string[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
        keys = keys.concat(getDeepKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
  }
  return keys;
}

/**
 * Tracks a missing key at runtime
 */
export function trackMissingKey(key: string) {
  if (key && !sessionMissingKeys.has(key)) {
    sessionMissingKeys.add(key);
    console.warn(`[Language Engine] Missing key detected: "${key}"`);
    // Attempt to persist in localStorage for persistence across reloads
    try {
      const stored = localStorage.getItem("musicscale_missing_i18n_keys");
      const list = stored ? JSON.parse(stored) : [];
      if (!list.includes(key)) {
        list.push(key);
        localStorage.setItem("musicscale_missing_i18n_keys", JSON.stringify(list));
      }
    } catch (e) {
      // Ignore storage errors safely
    }
  }
}

/**
 * Get all missing keys recorded in the session
 */
export function getSessionMissingKeys(): string[] {
  try {
    const stored = localStorage.getItem("musicscale_missing_i18n_keys");
    const list = stored ? JSON.parse(stored) : [];
    // Combine session and local storage
    const combined = new Set([...sessionMissingKeys, ...list]);
    return Array.from(combined);
  } catch {
    return Array.from(sessionMissingKeys);
  }
}

/**
 * Clear cached missing keys
 */
export function clearMissingKeys() {
  sessionMissingKeys.clear();
  try {
    localStorage.removeItem("musicscale_missing_i18n_keys");
  } catch {}
}

/**
 * Performs a rigorous offline comparison of translations
 */
export function runLocaleDiagnostics(): DiagnosticResult {
  const warnings: string[] = [];
  const ptKeys = getDeepKeys(pt);
  const enKeys = getDeepKeys(en);
  const esKeys = getDeepKeys(es);

  const keyCounts = {
    pt: ptKeys.length,
    en: enKeys.length,
    es: esKeys.length,
  };

  // Integrity Check: Compare Portuguese and English keys
  const ptSet = new Set(ptKeys);
  const enSet = new Set(enKeys);
  const esSet = new Set(esKeys);

  // Pt vs En
  ptKeys.forEach((key) => {
    if (!enSet.has(key)) {
      warnings.push(`Key "${key}" is defined in PT but missing in EN.`);
    }
  });
  enKeys.forEach((key) => {
    if (!ptSet.has(key)) {
      warnings.push(`Key "${key}" is defined in EN but missing in PT.`);
    }
  });

  // Pt vs Es
  ptKeys.forEach((key) => {
    if (!esSet.has(key)) {
      warnings.push(`Key "${key}" is defined in PT but missing in ES.`);
    }
  });
  esKeys.forEach((key) => {
    if (!ptSet.has(key)) {
      warnings.push(`Key "${key}" is defined in ES but missing in PT.`);
    }
  });

  return {
    healthy: warnings.length === 0,
    totalKeys: ptKeys.length,
    languagesChecked: ["pt", "en", "es"],
    warnings,
    keyCounts,
  };
}

/**
 * Safely format strings with template args
 */
export function formatWithReplacements(text: string, countOrReplacements?: any): string {
  if (!text) return "";
  if (typeof countOrReplacements === "object" && countOrReplacements !== null) {
    let result = text;
    for (const key in countOrReplacements) {
      result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), countOrReplacements[key]);
    }
    return result;
  }
  return text;
}
