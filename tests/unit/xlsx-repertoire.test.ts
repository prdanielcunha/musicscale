import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readFirstXlsxWorksheet } from "../../utils/xlsxRepertoire";
import { parseRepertoireMatrix } from "../../utils/repertoireTransfer";

const encoder = new TextEncoder();

function u16(value: number) {
  return [value & 0xff, (value >>> 8) & 0xff];
}
function u32(value: number) {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}
function concat(parts: Uint8Array[]) {
  const size = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}
function bytes(values: number[]) {
  return Uint8Array.from(values);
}

function buildZip(
  entries: Array<{ name: string; content: string; deflate?: boolean }>,
): ArrayBuffer {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const raw = encoder.encode(entry.content);
    const compressed = entry.deflate
      ? new Uint8Array(deflateRawSync(raw))
      : raw;
    const method = entry.deflate ? 8 : 0;

    const localHeader = bytes([
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(compressed.byteLength),
      ...u32(raw.byteLength),
      ...u16(nameBytes.byteLength),
      ...u16(0),
    ]);
    localParts.push(localHeader, nameBytes, compressed);

    const centralHeader = bytes([
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(compressed.byteLength),
      ...u32(raw.byteLength),
      ...u16(nameBytes.byteLength),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(localOffset),
    ]);
    centralParts.push(centralHeader, nameBytes);
    localOffset +=
      localHeader.byteLength + nameBytes.byteLength + compressed.byteLength;
  }

  const local = concat(localParts);
  const central = concat(centralParts);
  const eocd = bytes([
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(central.byteLength),
    ...u32(local.byteLength),
    ...u16(0),
  ]);

  const archive = concat([local, central, eocd]);
  return archive.buffer.slice(
    archive.byteOffset,
    archive.byteOffset + archive.byteLength,
  ) as ArrayBuffer;
}

describe("safe XLSX repertoire reader", () => {
  it("reads a compressed first worksheet and feeds the LouveApp-compatible parser", async () => {
    const sharedStrings = [
      "Nome da Música",
      "Artista",
      "Tom Original",
      "BPM",
      "Link da Cifra",
      "Link do Vídeo",
      "Link Áudio",
      "Santo",
      "Banda Teste",
      "D",
      "https://cifra.example",
      "https://video.example",
      "https://audio.example",
    ];

    const sharedStringsXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      sharedStrings.map((value) => \`<si><t>\${value}</t></si>\`).join("") +
      "</sst>";

    const worksheetXml = \`<?xml version="1.0" encoding="UTF-8"?>
      <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>
          <row r="1">
            <c r="A1" t="s"><v>0</v></c>
            <c r="B1" t="s"><v>1</v></c>
            <c r="C1" t="s"><v>2</v></c>
            <c r="D1" t="s"><v>3</v></c>
            <c r="E1" t="s"><v>4</v></c>
            <c r="F1" t="s"><v>5</v></c>
            <c r="G1" t="s"><v>6</v></c>
          </row>
          <row r="2">
            <c r="A2" t="s"><v>7</v></c>
            <c r="B2" t="s"><v>8</v></c>
            <c r="C2" t="s"><v>9</v></c>
            <c r="D2"><v>72</v></c>
            <c r="E2" t="s"><v>10</v></c>
            <c r="F2" t="s"><v>11</v></c>
            <c r="G2" t="s"><v>12</v></c>
          </row>
        </sheetData>
      </worksheet>\`;

    const archive = buildZip([
      {
        name: "xl/sharedStrings.xml",
        content: sharedStringsXml,
        deflate: true,
      },
      {
        name: "xl/worksheets/sheet1.xml",
        content: worksheetXml,
        deflate: true,
      },
    ]);

    const matrix = await readFirstXlsxWorksheet(archive);
    const result = parseRepertoireMatrix(matrix);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      title: "Santo",
      artist: "Banda Teste",
      key: "D",
      bpm: 72,
      chordsUrl: "https://cifra.example",
      videoUrl: "https://video.example",
    });
    expect(result.rows[0].extra).toEqual({
      "Link Áudio": "https://audio.example",
    });
    expect(result.unknownHeaders).toEqual(["Link Áudio"]);
  });

  it("rejects an empty/non-zip payload instead of guessing", async () => {
    await expect(
      readFirstXlsxWorksheet(new Uint8Array([1, 2, 3, 4]).buffer),
    ).rejects.toThrow("XLSX_INVALID_ZIP");
  });
});
