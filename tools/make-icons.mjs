// Erzeugt die App Symbole als PNG (ohne Zusatzpakete): node tools/make-icons.mjs

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const sdBox = (px, py, cx, cy, hw, hh, r) => {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

// Hantel, schräg gestellt
const ANGLE = (32 * Math.PI) / 180;
function shape(x, y) {
  const dx = x - 0.5, dy = y - 0.5;
  const u = 0.5 + dx * Math.cos(ANGLE) - dy * Math.sin(ANGLE);
  const v = 0.5 + dx * Math.sin(ANGLE) + dy * Math.cos(ANGLE);
  let d = sdBox(u, v, 0.5, 0.5, 0.2, 0.032, 0.02);
  for (const s of [-1, 1]) {
    d = Math.min(d, sdBox(u, v, 0.5 + s * 0.205, 0.5, 0.042, 0.17, 0.03));
    d = Math.min(d, sdBox(u, v, 0.5 + s * 0.285, 0.5, 0.03, 0.115, 0.025));
  }
  return d;
}

const lerp = (a, b, t) => a + (b - a) * t;
const C1 = [255, 184, 64], C2 = [242, 92, 5];

function render(size) {
  const out = Buffer.alloc(size * size * 3);
  const SS = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const t = Math.min(1, Math.max(0, (x * 0.45 + y * 0.9) / 1.2));
          let c = C1.map((v, i) => lerp(v, C2[i], t));
          // weicher Glanz oben
          const glow = Math.max(0, 1 - Math.hypot((x - 0.35) / 0.7, (y - 0.05) / 0.45));
          c = c.map((v) => lerp(v, 255, glow * 0.22));
          // Schatten unter der Hantel
          const ds = shape(x - 0.012, y - 0.022);
          const sh = Math.max(0, 1 - Math.max(0, ds) / 0.05) * 0.18;
          c = c.map((v) => v * (1 - sh));
          if (shape(x, y) < 0) c = [255, 255, 255];
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (py * size + px) * 3;
      out[i] = r / (SS * SS); out[i + 1] = g / (SS * SS); out[i + 2] = b / (SS * SS);
    }
  }
  return png(size, out);
}

for (const s of [180, 192, 512]) {
  writeFileSync(new URL(`../icons/icon-${s}.png`, import.meta.url), render(s));
  console.log(`icons/icon-${s}.png`);
}
