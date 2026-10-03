export const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

type FirestoreTimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
  _seconds?: number;
  _nanoseconds?: number;
};

export function coerceDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = Math.abs(value) < 1e12 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Date-only values represent a calendar day, not midnight UTC. Anchoring at
    // noon prevents timezone conversion from shifting the displayed day.
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? `${trimmed}T12:00:00.000Z`
      : trimmed;

    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "object") {
    const timestamp = value as FirestoreTimestampLike;

    if (typeof timestamp.toDate === "function") {
      try {
        const date = timestamp.toDate();
        return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
      } catch {
        return null;
      }
    }

    const seconds =
      typeof timestamp.seconds === "number"
        ? timestamp.seconds
        : typeof timestamp._seconds === "number"
          ? timestamp._seconds
          : null;

    if (seconds !== null) {
      const nanoseconds =
        typeof timestamp.nanoseconds === "number"
          ? timestamp.nanoseconds
          : typeof timestamp._nanoseconds === "number"
            ? timestamp._nanoseconds
            : 0;
      const date = new Date(seconds * 1000 + nanoseconds / 1_000_000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  return null;
}

export function resolveDateLocale(language?: string | null): string {
  const normalized = (language || "").toLowerCase();
  if (normalized.startsWith("en")) return "en-US";
  if (normalized.startsWith("es")) return "es-ES";
  return "pt-BR";
}

export function formatDateInBrazil(
  value: unknown,
  locale = "pt-BR",
  options: Intl.DateTimeFormatOptions = {},
): string | null {
  const date = coerceDate(value);
  if (!date) return null;

  return new Intl.DateTimeFormat(locale, {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  }).format(date);
}
