export function normalizeSearchText(input: unknown): string {
  if (typeof input !== "string") {
    if (input == null) return "";
    return String(input).trim().toLowerCase();
  }
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .toLowerCase()
    .replace(/['"´`\u2018-\u201D]/g, " ") // Remove quotes/apostrophes
    .replace(/[^\p{L}\p{N}]/gu, " ") // Replace punctuation with space, keep letters and numbers
    .replace(/[\u200B-\u200D\uFEFF]/g, " ") // invisible chars
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim();
}
