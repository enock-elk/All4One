import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'public/icons');

const PNG_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="All4One">
  <rect width="512" height="512" rx="96" fill="#0f172a"/>
  <g transform="translate(128 128) scale(10.667)" fill="none" stroke="#e87878" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/>
    <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/>
    <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>
  </g>
</svg>`;

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.warn('sharp not installed — skipping PNG generation. Run: npm i -D sharp');
    return;
  }

  const svg = Buffer.from(PNG_SVG);
  for (const size of [192, 512]) {
    const buf = await sharp(svg).resize(size, size).png().toBuffer();
    writeFileSync(resolve(outDir, `icon-${size}.png`), buf);
    console.log(`Wrote icon-${size}.png`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
