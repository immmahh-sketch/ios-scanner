// Rasterises assets/icon.svg into the PNGs Expo needs.
// Run:  node scripts/gen-icon.mjs   (needs `sharp` — `npm i -D sharp` if missing)

import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(ROOT, 'assets/icon.svg'));

// App icon: 1024x1024, opaque, no alpha (App Store / iOS requirement).
await sharp(svg, { density: 384 })
  .resize(1024, 1024)
  .flatten({ background: '#0d1526' })
  .png()
  .toFile(join(ROOT, 'assets/icon.png'));

// Splash / web favicon reuse the same art.
await sharp(svg, { density: 384 })
  .resize(1024, 1024)
  .png()
  .toFile(join(ROOT, 'assets/splash-icon.png'));

await sharp(svg, { density: 96 })
  .resize(48, 48)
  .png()
  .toFile(join(ROOT, 'assets/favicon.png'));

console.log('Wrote assets/icon.png, assets/splash-icon.png, assets/favicon.png');
