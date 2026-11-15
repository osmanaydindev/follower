// Renders the PNG icons the manifest and iOS need from the two SVG sources.
// PNG is not optional here: Android's manifest wants raster icons and iOS
// ignores SVG for apple-touch-icon entirely.
//
//   npm run icons
//
// Output lives in public/icons/ and is gitignored — it is generated, not authored.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'icons');

const jobs = [
  { source: 'icon.svg', name: 'icon-192.png', size: 192 },
  { source: 'icon.svg', name: 'icon-512.png', size: 512 },
  // iOS does not apply a mask, so the plain mark with its own rounded corners is
  // the right source; it also needs an opaque background.
  { source: 'icon.svg', name: 'apple-touch-icon.png', size: 180 },
  { source: 'maskable.svg', name: 'maskable-512.png', size: 512 },
  { source: 'icon.svg', name: 'favicon-32.png', size: 32 },
];

await mkdir(out, { recursive: true });

for (const job of jobs) {
  const svg = await readFile(join(root, 'assets', job.source));
  const png = await sharp(svg, { density: 512 })
    .resize(job.size, job.size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(join(out, job.name), png);
  console.log(`${job.name}  ${job.size}x${job.size}`);
}
