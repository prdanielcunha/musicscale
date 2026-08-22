import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'assets', 'brand-source', 'manifest.json');
const publicRoot = path.resolve(root, 'public');
const sourceRoot = path.resolve(root, 'assets', 'brand-source');

type BrandOperation = {
  path: string;
  operation: 'add' | 'replace' | 'delete';
  sourceFile: string | null;
  byteSize: number | null;
  sha256: string | null;
  width: number | null;
  height: number | null;
};

type BrandManifest = {
  bridgeVersion: number;
  baseSha: string;
  operations: BrandOperation[];
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isInside(parent: string, child: string): boolean {
  return child === parent || child.startsWith(`${parent}${path.sep}`);
}

function readPngDimensions(bytes: Buffer): [number, number] {
  assert(bytes.length >= 24, 'PNG payload is too small');
  assert(bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'PNG signature mismatch');
  assert(bytes.subarray(12, 16).toString('ascii') === 'IHDR', 'PNG IHDR chunk missing');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function decodeCanonicalBase64(text: string, label: string): Buffer {
  const normalized = text.trim();
  assert(normalized.length > 0, `${label}: Base64 source is empty`);
  assert(/^[A-Za-z0-9+/]*={0,2}$/.test(normalized), `${label}: Base64 source contains invalid characters`);
  assert(normalized.length % 4 === 0, `${label}: Base64 source length is invalid`);
  const bytes = Buffer.from(normalized, 'base64');
  assert(bytes.toString('base64') === normalized, `${label}: Base64 source is not canonical`);
  return bytes;
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BrandManifest;
assert(manifest.bridgeVersion === 1, 'Unsupported brand-source manifest version');
assert(Array.isArray(manifest.operations), 'Brand-source manifest operations must be an array');

const prepared: Array<{ operation: BrandOperation; target: string; bytes?: Buffer }> = [];

for (const operation of manifest.operations) {
  const target = path.resolve(root, operation.path);
  assert(isInside(publicRoot, target), `${operation.path}: target must stay inside public/`);

  if (operation.operation === 'delete') {
    assert(operation.sourceFile === null, `${operation.path}: delete operation must not have a source file`);
    prepared.push({ operation, target });
    continue;
  }

  assert(operation.sourceFile, `${operation.path}: sourceFile is required`);
  assert(operation.byteSize !== null, `${operation.path}: byteSize is required`);
  assert(operation.sha256, `${operation.path}: sha256 is required`);
  assert(operation.width !== null && operation.height !== null, `${operation.path}: dimensions are required`);

  const source = path.resolve(root, operation.sourceFile);
  assert(isInside(sourceRoot, source), `${operation.path}: source must stay inside assets/brand-source/`);
  assert(fs.existsSync(source), `${operation.path}: Base64 source does not exist`);

  const bytes = decodeCanonicalBase64(fs.readFileSync(source, 'utf8'), operation.path);
  assert(bytes.length === operation.byteSize, `${operation.path}: decoded byte size mismatch`);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  assert(sha256 === operation.sha256, `${operation.path}: SHA-256 mismatch`);
  const [width, height] = readPngDimensions(bytes);
  assert(width === operation.width && height === operation.height, `${operation.path}: PNG dimensions mismatch`);

  prepared.push({ operation, target, bytes });
}

for (const item of prepared) {
  if (item.operation.operation === 'delete') {
    if (fs.existsSync(item.target)) fs.rmSync(item.target, { force: true });
    continue;
  }

  assert(item.bytes, `${item.operation.path}: validated bytes missing`);
  fs.mkdirSync(path.dirname(item.target), { recursive: true });
  const tempPath = `${item.target}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, item.bytes);
  fs.renameSync(tempPath, item.target);
}

console.log(`Materialized ${prepared.filter(({ operation }) => operation.operation !== 'delete').length} verified MusicScale brand assets.`);
