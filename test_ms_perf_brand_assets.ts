import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requireDist = process.argv.includes('--require-dist');
const maxBrandFileBytes = 500 * 1024;
const maxBrandPrecacheBytes = 1024 * 1024;
const expectedIcons = new Map([
  ['/LogoIcon-192.png', [192, 192]],
  ['/LogoIcon.png', [512, 512]],
  ['/LogoIcon-maskable-512.png', [512, 512]],
]);

function readPngDimensions(filePath: string): [number, number] {
  const png = fs.readFileSync(filePath);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${filePath} must be a PNG`);
  assert.equal(png.subarray(12, 16).toString('ascii'), 'IHDR', `${filePath} must contain an IHDR chunk`);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

function walkSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') return [];
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkSourceFiles(entryPath) : [entryPath];
  });
}

function validateSourceAssets() {
  for (const [url, dimensions] of expectedIcons) {
    const assetPath = path.join(root, 'public', url.slice(1));
    assert.ok(fs.existsSync(assetPath), `${url} must exist in public/`);
    assert.deepEqual(readPngDimensions(assetPath), dimensions, `${url} dimensions must match its contract`);
    assert.ok(fs.statSync(assetPath).size <= maxBrandFileBytes, `${url} must not exceed 500 KiB`);
  }

  assert.ok(!fs.existsSync(path.join(root, 'public', 'LogoIComp_Horiz.png')), 'unused horizontal logo must remain removed');

  const searchableExtensions = new Set(['.css', '.html', '.js', '.jsx', '.json', '.ts', '.tsx']);
  const sourceText = walkSourceFiles(root)
    .filter((file) => searchableExtensions.has(path.extname(file)) && path.basename(file) !== 'test_ms_perf_brand_assets.ts')
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  assert.ok(!sourceText.includes('/public/LogoIcon.png'), 'Vite public assets must use canonical root URLs');
  assert.ok(!sourceText.includes('LogoIComp_Horiz.png'), 'removed horizontal logo must not have source references');

  const viteConfig = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
  for (const [url, [width, height]] of expectedIcons) {
    assert.ok(viteConfig.includes(`src: '${url}'`), `PWA config must reference ${url}`);
    assert.ok(viteConfig.includes(`sizes: '${width}x${height}'`), `PWA config must declare ${width}x${height}`);
  }
  assert.match(viteConfig, /LogoIcon-maskable-512\.png'[\s\S]*?purpose:\s*'maskable'/, 'maskable icon purpose must be declared');
}

function validateBuiltAssets() {
  const dist = path.join(root, 'dist');
  const manifestPath = path.join(dist, 'manifest.webmanifest');
  const swPath = path.join(dist, 'sw.js');
  assert.ok(fs.existsSync(manifestPath), 'built web manifest must exist');
  assert.ok(fs.existsSync(swPath), 'generated Workbox service worker must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    icons: Array<{ src: string; sizes: string; purpose?: string }>;
  };
  for (const icon of manifest.icons) {
    const assetPath = path.join(dist, icon.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(assetPath), `manifest icon ${icon.src} must exist in dist`);
    const declared = icon.sizes.split('x').map(Number);
    assert.deepEqual(readPngDimensions(assetPath), declared, `${icon.src} dimensions must match its manifest declaration`);
  }
  assert.deepEqual(new Set(manifest.icons.map((icon) => icon.src)), new Set(expectedIcons.keys()), 'manifest must contain only the contracted icons');

  const sw = fs.readFileSync(swPath, 'utf8');
  const manifestMatch = sw.match(/precacheAndRoute\((\[[\s\S]*?\]),\{\}\)/);
  assert.ok(manifestMatch, 'Workbox precache manifest must be readable');
  const entries = [...manifestMatch[1].matchAll(/\{url:"([^"]+)"/g)].map((match) => ({ url: match[1] }));
  assert.ok(entries.length > 0, 'Workbox precache manifest must contain entries');
  assert.equal(new Set(entries.map(({ url }) => url)).size, entries.length, 'Workbox precache URLs must be unique');
  const brandingEntries = entries.filter(({ url }) => /logoicon/i.test(url));
  assert.ok(brandingEntries.length > 0, 'branding assets must remain available offline');
  assert.ok(!entries.some(({ url }) => /LogoIComp_Horiz/i.test(url)), 'unused horizontal logo must not be precached');
  assert.ok(!brandingEntries.some(({ url }) => /assets\/LogoIcon-/i.test(url)), 'module graph must not emit a hashed LogoIcon duplicate');

  let brandingBytes = 0;
  const hashes = new Map<string, string>();
  for (const { url } of brandingEntries) {
    const assetPath = path.join(dist, decodeURIComponent(url).replace(/^\//, ''));
    assert.ok(fs.existsSync(assetPath), `precache entry ${url} must resolve to a built file`);
    const bytes = fs.statSync(assetPath).size;
    assert.ok(bytes <= maxBrandFileBytes, `${url} must not exceed 500 KiB`);
    brandingBytes += bytes;
    const hash = crypto.createHash('sha256').update(fs.readFileSync(assetPath)).digest('hex');
    assert.ok(!hashes.has(hash), `${url} duplicates equivalent branding content at ${hashes.get(hash)}`);
    hashes.set(hash, url);
  }
  assert.ok(brandingBytes < maxBrandPrecacheBytes, `branding precache must be below 1 MiB (actual ${brandingBytes} bytes)`);
  console.log(`Branding precache: ${brandingEntries.length} entries, ${brandingBytes} bytes`);
}

validateSourceAssets();
if (requireDist) validateBuiltAssets();
console.log(`MS-PERF-BRAND-ASSETS passed (${requireDist ? 'source + dist' : 'source'} contract)`);
