// Builds responsive WebP + JPEG variants from the restaurant's original photos.
// Usage: node scripts/images.mjs <source-dir>
// Source files are the originals extracted from the lennyscasita.com page capture.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const src = process.argv[2];
if (!src) throw new Error("Pass the source directory");
const out = fileURLToPath(new URL("../public/img/", import.meta.url));
mkdirSync(out, { recursive: true });

const photos = [
  ["115.webp", "taco-board"],
  ["107.webp", "tostada"],
  ["111.webp", "loaded-fries"],
  ["113.webp", "quesadilla"],
  ["109.webp", "chopped-salad"],
  ["105.webp", "crispy-bites"],
  ["090.webp", "spread"],
  ["chef.jpg", "chef"],
];

for (const [file, name] of photos) {
  for (const width of [720, 1280]) {
    const base = sharp(join(src, file)).resize({ width, withoutEnlargement: true });
    await base.clone().webp({ quality: 76 }).toFile(join(out, `${name}-${width}.webp`));
    await base.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(join(out, `${name}-${width}.jpg`));
  }
}

// Hero pair: background and cutout must share exact pixel dimensions so they overlay perfectly.
const HERO = { width: 1586, height: 2048 };
await sharp(join(src, "115.webp")).resize(HERO).webp({ quality: 80 }).toFile(join(out, "hero-board.webp"));
await sharp(join(src, "115.webp")).resize(HERO).jpeg({ quality: 80, mozjpeg: true }).toFile(join(out, "hero-board.jpg"));
await sharp(join(src, "taco-cutout.png")).resize(HERO).webp({ quality: 82, alphaQuality: 90 }).toFile(join(out, "hero-board-cutout.webp"));
await sharp(join(src, "taco-cutout.png")).resize(HERO).png({ compressionLevel: 9, palette: true }).toFile(join(out, "hero-board-cutout.png"));

// Logo: keep the original white mark, add a 2x-safe webp.
await sharp(join(src, "091.webp")).png().toFile(join(out, "logo-white.png"));

console.log("images written to", out);
