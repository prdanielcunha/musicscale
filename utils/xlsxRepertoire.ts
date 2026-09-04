const MAX_XLSX_BYTES = 15 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 256;
const MAX_ENTRY_UNCOMPRESSED_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 48 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 128;

const textDecoder = new TextDecoder("utf-8");

interface ZipEntry {
  name: string;
  method: number;
  flags: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const decodeXmlEntities = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );

const xmlAttribute = (attributes: string, name: string) => {
  const escaped = name.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const match = attributes.match(
    new RegExp(\`(?:^|\\s)\${escaped}=(?:"([^"]*)"|'([^']*)')\`, "i"),
  );
  return match ? decodeXmlEntities(match[1] ?? match[2] ?? "") : null;
};

const normalizeZipPath = (value: string) => {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("../") ||
    normalized === ".." ||
    normalized.startsWith("/")
  ) {
    throw new Error("XLSX_UNSAFE_PATH");
  }
  return normalized;
};

const findEocdOffset = (bytes: Uint8Array) => {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset--) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  return -1;
};

const listZipEntries = (buffer: ArrayBuffer): ZipEntry[] => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const eocdOffset = findEocdOffset(bytes);
  if (eocdOffset < 0) throw new Error("XLSX_INVALID_ZIP");

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  if (entryCount > MAX_ZIP_ENTRIES) throw new Error("XLSX_TOO_MANY_ENTRIES");
  if (centralDirectoryOffset + centralDirectorySize > buffer.byteLength) {
    throw new Error("XLSX_INVALID_CENTRAL_DIRECTORY");
  }

  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;
  let totalUncompressed = 0;

  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > buffer.byteLength) throw new Error("XLSX_INVALID_ENTRY");
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("XLSX_INVALID_CENTRAL_DIRECTORY");
    }

    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    if (flags & 0x1) throw new Error("XLSX_ENCRYPTED_NOT_SUPPORTED");
    if (method !== 0 && method !== 8) {
      throw new Error("XLSX_UNSUPPORTED_COMPRESSION");
    }
    if (uncompressedSize > MAX_ENTRY_UNCOMPRESSED_BYTES) {
      throw new Error("XLSX_ENTRY_TOO_LARGE");
    }

    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > buffer.byteLength) throw new Error("XLSX_INVALID_ENTRY");
    const name = normalizeZipPath(
      textDecoder.decode(bytes.slice(nameStart, nameEnd)),
    );

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error("XLSX_EXPANDED_TOO_LARGE");
    }

    entries.push({
      name,
      method,
      flags,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
};

const decompressEntry = async (
  buffer: ArrayBuffer,
  entry: ZipEntry,
): Promise<Uint8Array> => {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const offset = entry.localHeaderOffset;

  if (
    offset + 30 > buffer.byteLength ||
    view.getUint32(offset, true) !== 0x04034b50
  ) {
    throw new Error("XLSX_INVALID_LOCAL_HEADER");
  }

  const fileNameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.byteLength) throw new Error("XLSX_TRUNCATED_ENTRY");

  const compressed = bytes.slice(dataStart, dataEnd);
  if (entry.method === 0) return compressed;

  if (typeof DecompressionStream === "undefined") {
    throw new Error("XLSX_BROWSER_UNSUPPORTED");
  }

  const source = compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength,
  ) as ArrayBuffer;
  const stream = new Blob([source])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const decompressed = new Uint8Array(await new Response(stream).arrayBuffer());

  if (
    entry.uncompressedSize > 0 &&
    decompressed.byteLength !== entry.uncompressedSize
  ) {
    throw new Error("XLSX_SIZE_MISMATCH");
  }
  return decompressed;
};

const readZipText = async (
  buffer: ArrayBuffer,
  entries: Map<string, ZipEntry>,
  path: string,
) => {
  const entry = entries.get(normalizeZipPath(path));
  if (!entry) return null;
  return textDecoder.decode(await decompressEntry(buffer, entry));
};

const findFirstWorksheetPath = async (
  buffer: ArrayBuffer,
  entries: Map<string, ZipEntry>,
) => {
  const workbook = await readZipText(buffer, entries, "xl/workbook.xml");
  const relationships = await readZipText(
    buffer,
    entries,
    "xl/_rels/workbook.xml.rels",
  );

  if (workbook && relationships) {
    const sheetMatch = workbook.match(/<sheet\b([^>]*)\/?\s*>/i);
    const relationshipId = sheetMatch
      ? xmlAttribute(sheetMatch[1], "r:id") || xmlAttribute(sheetMatch[1], "id")
      : null;

    if (relationshipId) {
      const relationshipTags =
        relationships.match(/<Relationship\b[^>]*\/?\s*>/gi) || [];
      for (const tag of relationshipTags) {
        const attrs = tag
          .replace(/^<Relationship\b/i, "")
          .replace(/\/?\s*>$/, "");
        if (xmlAttribute(attrs, "Id") !== relationshipId) continue;
        const target = xmlAttribute(attrs, "Target");
        if (!target) continue;
        const normalizedTarget = normalizeZipPath(target);
        return normalizedTarget.startsWith("xl/")
          ? normalizedTarget
          : normalizeZipPath(`xl/${normalizedTarget}`);
      }
    }
  }

  if (entries.has("xl/worksheets/sheet1.xml")) {
    return "xl/worksheets/sheet1.xml";
  }

  const fallback = Array.from(entries.keys())
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort()[0];
  if (!fallback) throw new Error("XLSX_NO_WORKSHEET");
  return fallback;
};

const parseSharedStrings = (xml: string | null) => {
  if (!xml) return [] as string[];
  const values: string[] = [];
  const items = xml.match(/<si\b[^>]*>[\s\S]*?<\/si>/gi) || [];
  for (const item of items) {
    const parts: string[] = [];
    const textNodes = item.match(/<t\b[^>]*>[\s\S]*?<\/t>/gi) || [];
    for (const node of textNodes) {
      const inner = node
        .replace(/^<t\b[^>]*>/i, "")
        .replace(/<\/t>$/i, "");
      parts.push(decodeXmlEntities(inner));
    }
    values.push(parts.join(""));
  }
  return values;
};

const columnIndexFromCellReference = (reference: string) => {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return -1;
  let value = 0;
  for (const letter of letters) {
    value = value * 26 + (letter.charCodeAt(0) - 64);
  }
  return value - 1;
};

const rowIndexFromCellReference = (reference: string) => {
  const digits = reference.match(/\d+$/)?.[0];
  if (!digits) return -1;
  return Number(digits) - 1;
};

const extractCellText = (
  body: string,
  type: string | null,
  sharedStrings: string[],
) => {
  if (type === "inlineStr") {
    const textNodes = body.match(/<t\b[^>]*>[\s\S]*?<\/t>/gi) || [];
    return textNodes
      .map((node) =>
        decodeXmlEntities(
          node.replace(/^<t\b[^>]*>/i, "").replace(/<\/t>$/i, ""),
        ),
      )
      .join("");
  }

  const valueMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
  if (!valueMatch) return "";
  const raw = decodeXmlEntities(valueMatch[1]);

  if (type === "s") {
    const index = Number(raw);
    return Number.isInteger(index) && index >= 0
      ? sharedStrings[index] ?? ""
      : "";
  }
  if (type === "b") return raw === "1" ? "TRUE" : "FALSE";
  return raw;
};

const parseWorksheet = (xml: string, sharedStrings: string[]) => {
  const rows: string[][] = [];
  const cells = xml.match(/<c\b[^>]*>[\s\S]*?<\/c>/gi) || [];

  for (const cell of cells) {
    const opening = cell.match(/^<c\b([^>]*)>/i);
    if (!opening) continue;
    const attrs = opening[1];
    const reference = xmlAttribute(attrs, "r");
    if (!reference) continue;

    const rowIndex = rowIndexFromCellReference(reference);
    const columnIndex = columnIndexFromCellReference(reference);
    if (
      rowIndex < 0 ||
      columnIndex < 0 ||
      rowIndex >= MAX_ROWS ||
      columnIndex >= MAX_COLUMNS
    ) {
      continue;
    }

    while (rows.length <= rowIndex) rows.push([]);
    const body = cell.slice(opening[0].length, cell.length - 4);
    rows[rowIndex][columnIndex] = extractCellText(
      body,
      xmlAttribute(attrs, "t"),
      sharedStrings,
    );
  }

  return rows
    .map((row) => {
      const normalized = Array.from(
        { length: Math.min(row.length, MAX_COLUMNS) },
        (_, index) => row[index] ?? "",
      );
      while (normalized.length && !normalized[normalized.length - 1]) {
        normalized.pop();
      }
      return normalized;
    })
    .filter((row) => row.some((cell) => String(cell).trim().length > 0));
};

export async function readFirstXlsxWorksheet(
  fileOrBuffer: File | Blob | ArrayBuffer,
): Promise<string[][]> {
  const buffer =
    fileOrBuffer instanceof ArrayBuffer
      ? fileOrBuffer
      : await fileOrBuffer.arrayBuffer();

  if (buffer.byteLength === 0) throw new Error("XLSX_EMPTY");
  if (buffer.byteLength > MAX_XLSX_BYTES) {
    throw new Error("XLSX_FILE_TOO_LARGE");
  }

  const entriesList = listZipEntries(buffer);
  const entries = new Map(entriesList.map((entry) => [entry.name, entry]));
  const worksheetPath = await findFirstWorksheetPath(buffer, entries);
  const [worksheetXml, sharedStringsXml] = await Promise.all([
    readZipText(buffer, entries, worksheetPath),
    readZipText(buffer, entries, "xl/sharedStrings.xml"),
  ]);
  if (!worksheetXml) throw new Error("XLSX_NO_WORKSHEET");

  const rows = parseWorksheet(
    worksheetXml,
    parseSharedStrings(sharedStringsXml),
  );
  if (!rows.length) throw new Error("XLSX_NO_DATA");
  return rows;
}

export const XLSX_REPERTOIRE_LIMITS = {
  maxFileBytes: MAX_XLSX_BYTES,
  maxRows: MAX_ROWS,
  maxColumns: MAX_COLUMNS,
} as const;
