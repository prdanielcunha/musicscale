// Runtime tracking stays lightweight: locale comparison is loaded by Profile only.
const sessionMissingKeys = new Set<string>();

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
