import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requireDist = process.argv.includes('--require-dist');
const maxBrandFileBytes = 500 * 1024;
const maxBrandPrecacheBytes = 1024 * 1024;
const sourceRoot = path.join(root, 'assets', 'brand-source');
const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8')) as {
  operations: Array<{
    path: string;
    operation: 'add' | 'replace' | 'delete';
    sourceFile: string | null;
    byteSize: number | null;
    sha256: string | null;
    width: number | null;
    height: number | null;
  }>;
};

const expected = new Map([
  ['/LogoIcon-192.png', { bytes: 31479, sha256: 'afe43373f9554bd690dc6fa462f6fd401be1788fd96a2a6da6692ed1a01e219b', dimensions: [192, 192] as [number, number] }],
  ['/LogoIcon.png', { bytes: 129184, sha256: '25ac3cd20857b498f8b9174adcb2331a835404c0f6020756e0460ad9d80c6e54', dimensions: [512, 512] as [number, number] }],
  ['/LogoIcon-maskable-512.png', { bytes: 82018, sha256: 'acf393d978f6b193d7a965dbc06e417bd3e4ff2eb9c8a231138c37eae0e7adf6', dimensions: [512, 512] as [number, number] }],
]);

function hash(bytes: Buffer) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function readPngDimensions(bytes: Buffer): [number, number] {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'asset must be PNG');
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR', 'asset must contain IHDR');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function validateSourceAndMaterializedAssets() {
  for (const [url, contract] of expected) {
    const operation = manifest.operations.find(({ path: target }) => target === `public${url}`);
    assert.ok(operation, `${url} must exist in brand-source manifest`);
    assert.notEqual(operation.operation, 'delete', `${url} must be materialized`);
    assert.ok(operation.sourceFile, `${url} must have a Base64 source`);
    assert.equal(operation.byteSize, contract.bytes, `${url} manifest byte size mismatch`);
    assert.equal(operation.sha256, contract.sha256, `${url} manifest SHA-256 mismatch`);
    assert.deepEqual([operation.width, operation.height], contract.dimensions, `${url} manifest dimensions mismatch`);

    const sourcePath = path.join(root, operation.sourceFile);
    assert.ok(sourcePath.startsWith(`${sourceRoot}${path.sep}`), `${url} source must stay in assets/brand-source`);
    const base64 = fs.readFileSync(sourcePath, 'utf8').trim();
    const decoded = Buffer.from(base64, 'base64');
    assert.equal(decoded.toString('base64'), base64, `${url} Base64 must be canonical`);
    assert.equal(decoded.length, contract.bytes, `${url} decoded byte size mismatch`);
    assert.equal(hash(decoded), contract.sha256, `${url} decoded SHA-256 mismatch`);
    assert.deepEqual(readPngDimensions(decoded), contract.dimensions, `${url} source dimensions mismatch`);

    const publicPath = path.join(root, 'public', url.slice(1));
    assert.ok(fs.existsSync(publicPath), `${url} must exist after materialization`);
    const materialized = fs.readFileSync(publicPath);
    assert.equal(materialized.length, contract.bytes, `${url} materialized byte size mismatch`);
    assert.equal(hash(materialized), contract.sha256, `${url} materialized SHA-256 mismatch`);
    assert.deepEqual(readPngDimensions(materialized), contract.dimensions, `${url} materialized dimensions mismatch`);
    assert.ok(materialized.equals(decoded), `${url} must be byte-for-byte identical to its source payload`);
    assert.ok(materialized.length <= maxBrandFileBytes, `${url} must not exceed 500 KiB`);
  }

  const deletion = manifest.operations.find(({ path: target }) => target === 'public/LogoIComp_Horiz.png');
  assert.equal(deletion?.operation, 'delete', 'horizontal logo deletion must remain in manifest');
  assert.ok(!fs.existsSync(path.join(root, 'public', 'LogoIComp_Horiz.png')), 'unused horizontal logo must remain removed');

  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(!indexHtml.includes('/public/LogoIcon.png'), 'Vite public assets must use canonical root URLs');

  const viteConfig = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
  for (const [url, { dimensions: [width, height] }] of expected) {
    assert.ok(viteConfig.includes(`src: '${url}'`), `PWA config must reference ${url}`);
    assert.ok(viteConfig.includes(`sizes: '${width}x${height}'`), `PWA config must declare ${width}x${height}`);
  }
  assert.match(viteConfig, /LogoIcon-maskable-512\.png'[\s\S]*?purpose:\s*'maskable'/, 'maskable icon purpose must be declared');
  assert.ok(viteConfig.includes('includeManifestIcons: false'), 'manifest icons must not be duplicated into Workbox');
}

function validateBuiltAssets() {
  const dist = path.join(root, 'dist');
  const manifestPath = path.join(dist, 'manifest.webmanifest');
  const swPath = path.join(dist, 'sw.js');
  assert.ok(fs.existsSync(manifestPath), 'built web manifest must exist');
  assert.ok(fs.existsSync(swPath), 'generated Workbox service worker must exist');

  const builtManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { icons: Array<{ src: string; sizes: string; purpose?: string }> };
  assert.deepEqual(new Set(builtManifest.icons.map(({ src }) => src)), new Set(expected.keys()), 'manifest must contain only contracted icons');

  for (const icon of builtManifest.icons) {
    const assetPath = path.join(dist, icon.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(assetPath), `manifest icon ${icon.src} must exist in dist`);
    const bytes = fs.readFileSync(assetPath);
    const contract = expected.get(icon.src);
    assert.ok(contract, `${icon.src} must have a contract`);
    assert.equal(hash(bytes), contract.sha256, `${icon.src} built SHA-256 mismatch`);
    assert.deepEqual(readPngDimensions(bytes), contract.dimensions, `${icon.src} built dimensions mismatch`);
  }

  const sw = fs.readFileSync(swPath, 'utf8');
  const manifestMatch = sw.match(/precacheAndRoute\((\[[\s\S]*?\]),\{\}\)/);
  assert.ok(manifestMatch, 'Workbox precache manifest must be readable');
  const entries = [...manifestMatch[1].matchAll(/\{url:"([^"]+)"/g)].map((match) => ({ url: match[1] }));
  assert.ok(entries.length > 0, 'Workbox precache manifest must contain entries');
  assert.equal(new Set(entries.map(({ url }) => url)).size, entries.length, 'Workbox precache URLs must be unique');
  assert.ok(!entries.some(({ url }) => /LogoIComp_Horiz/i.test(url)), 'unused horizontal logo must not be precached');

  const brandingEntries = entries.filter(({ url }) => /logoicon/i.test(url));
  assert.ok(!brandingEntries.some(({ url }) => /assets\/LogoIcon-/i.test(url)), 'module graph must not emit a hashed LogoIcon duplicate');
  let brandingBytes = 0;
  const hashes = new Set<string>();
  for (const { url } of brandingEntries) {
    const assetPath = path.join(dist, decodeURIComponent(url).replace(/^\//, ''));
    assert.ok(fs.existsSync(assetPath), `precache entry ${url} must resolve to a built file`);
    const bytes = fs.readFileSync(assetPath);
    brandingBytes += bytes.length;
    const digest = hash(bytes);
    assert.ok(!hashes.has(digest), `${url} duplicates equivalent branding content`);
    hashes.add(digest);
  }
  assert.ok(brandingBytes < maxBrandPrecacheBytes, `branding precache must be below 1 MiB (actual ${brandingBytes} bytes)`);
  console.log(`Branding precache: ${brandingEntries.length} entries, ${brandingBytes} bytes`);
}

validateSourceAndMaterializedAssets();
if (requireDist) validateBuiltAssets();
console.log(`MS-PERF-BRAND-ASSETS passed (${requireDist ? 'source + dist' : 'source'} contract)`);
