const EPHEMERAL_BINARY_KEYS = new Set([
  'preview',
  'thumbnail',
  'image_base64',
  'imageBase64',
  'base64',
  'blob',
  'binary'
]);

const MAX_PERSISTED_STRING = 16_384;
const MAX_DEPTH = 8;

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return '[omitted:depth]';
  if (typeof value === 'string') {
    return value.length > MAX_PERSISTED_STRING
      ? `[omitted:string:${value.length}]`
      : value;
  }
  if (
    value == null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (EPHEMERAL_BINARY_KEYS.has(key)) continue;
      output[key] = sanitizeValue(item, depth + 1);
    }
    return output;
  }
  return String(value);
}

export function sanitizeObservedStateForPersistence(
  state: Record<string, unknown>
): Record<string, unknown> {
  return sanitizeValue(state, 0) as Record<string, unknown>;
}
