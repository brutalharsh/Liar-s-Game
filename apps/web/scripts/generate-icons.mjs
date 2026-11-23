/**
 * generate-icons.mjs — zero-dependency PNG icon generator for the Liar's Game PWA.
 * Draws the placeholder app icon (ivory playing card + blood-red diamond on felt)
 * into RGBA buffers and encodes real PNGs with node:zlib.
 *
 * Run: npm run icons   (writes public/icons/*.png and src/app/apple-icon.png)
 *
 * These are deliberately simple placeholders — real art lands in a later wave.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// ── palette tokens (STR/05 §2) — live only in this token script ──────
const FELT = [29, 58, 42];
const FELT_DEEP = [16, 34, 25];
const IVORY = [242, 232, 213];
const BLOOD = [176, 58, 46];
const BRASS = [212, 175, 55];

// ── minimal PNG encoder ──────────────────────────────────────────────
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, pixels) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0x00; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── icon painter ─────────────────────────────────────────────────────
function makeIconPng(size, maskable) {
  const raw = Buffer.alloc(size * size * 4);

  // felt background + lamp vignette
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot((x - c) / c, (y - c) / c);
      const shade = Math.max(0, 1 - Math.max(0, d - 0.45) * 0.55);
      const i = (y * size + x) * 4;
      raw[i] = Math.round(FELT[0] * shade + FELT_DEEP[0] * (1 - shade));
      raw[i + 1] = Math.round(FELT[1] * shade + FELT_DEEP[1] * (1 - shade));
      raw[i + 2] = Math.round(FELT[2] * shade + FELT_DEEP[2] * (1 - shade));
      raw[i + 3] = 255;
    }
  }

  const put = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    raw[i] = rgb[0];
    raw[i + 1] = rgb[1];
    raw[i + 2] = rgb[2];
    raw[i + 3] = 255;
  };

  const roundRect = (w, h, r, rgb) => {
    const x0 = size / 2 - w / 2;
    const y0 = size / 2 - h / 2;
    const x1 = x0 + w;
    const y1 = y0 + h;
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        const cornerX = Math.max(x0 + r, Math.min(x, x1 - r));
        const cornerY = Math.max(y0 + r, Math.min(y, y1 - r));
        const inCore = (x >= x0 + r && x <= x1 - r) || (y >= y0 + r && y <= y1 - r);
        if (inCore || Math.hypot(x - cornerX, y - cornerY) <= r) put(x, y, rgb);
      }
    }
  };

  const rhombus = (cx, cy, hw, hh, rgb) => {
    for (let y = Math.floor(cy - hh); y <= Math.ceil(cy + hh); y++) {
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        if (Math.abs(x - cx) / hw + Math.abs(y - cy) / hh <= 1) put(x, y, rgb);
      }
    }
  };

  const cardW = size * (maskable ? 0.44 : 0.5);
  const cardH = cardW * 1.25;
  if (!maskable) roundRect(cardW + size * 0.03, cardH + size * 0.03, size * 0.065, BRASS);
  roundRect(cardW, cardH, size * (maskable ? 0.045 : 0.05), IVORY);
  rhombus(size / 2, size / 2 + size * 0.02, size * (maskable ? 0.11 : 0.14), size * (maskable ? 0.11 : 0.14), BLOOD);
  rhombus(size / 2 - cardW * 0.31, size / 2 - cardH * 0.35, size * 0.028, size * 0.028, BLOOD);

  return encodePng(size, size, raw);
}

const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "icon-192.png"), makeIconPng(192, false));
writeFileSync(join(outDir, "icon-512.png"), makeIconPng(512, false));
writeFileSync(join(outDir, "icon-maskable-512.png"), makeIconPng(512, true));
mkdirSync(join(root, "src", "app"), { recursive: true });
writeFileSync(join(root, "src", "app", "apple-icon.png"), makeIconPng(180, false));
console.log("icons written: public/icons/{icon-192,icon-512,icon-maskable-512}.png + src/app/apple-icon.png");
