// Genererar appikoner (public/icons) som PNG från en SVG.
//   npm run icons
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// scale < 1 ger marginal runt motivet (krävs för "maskable", där hörnen kan beskäras)
const svg = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#123226"/><stop offset="1" stop-color="#1d4b38"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M256 36 L270 76 L310 90 L270 104 L256 144 L242 104 L202 90 L242 76Z" fill="#c9a55a"/>
    <circle cx="256" cy="308" r="146" fill="#fbf6ea"/>
    <circle cx="256" cy="308" r="146" fill="none" stroke="#c9a55a" stroke-width="10"/>
    <circle cx="256" cy="308" r="106" fill="none" stroke="#c9a55a" stroke-width="4" opacity=".7"/>
    <path d="M256 372 C186 318 194 262 228 262 C244 262 256 274 256 288 C256 274 268 262 284 262 C318 262 326 318 256 372Z" fill="#a3262f"/>
  </g>
</svg>`;

const png = (scale, size, file) => sharp(Buffer.from(svg(scale))).resize(size, size).png().toFile(path.join(OUT, file));

await png(1, 192, 'icon-192.png');
await png(1, 512, 'icon-512.png');
await png(1, 180, 'apple-touch-icon.png');
await png(0.78, 512, 'icon-maskable-512.png');
console.log('Ikoner skrivna till', OUT);
