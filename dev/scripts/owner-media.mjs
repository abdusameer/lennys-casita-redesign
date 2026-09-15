// Web versions of the owner-supplied photos (Documents/Lenny'sCasita, September 2026; the Shabbat set and
// hugeplatter were re-supplied on September 15 as clean studio shots).
// Usage: node scripts/owner-media.mjs <source-dir>
// Crops only remove screenshot artifacts (a lens button, an avatar badge, a dark top edge); nothing is upscaled.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const src = process.argv[2];
if (!src) throw new Error("Pass the source directory");
const out = fileURLToPath(new URL("../public/img/", import.meta.url));

const PAPER = { r: 245, g: 241, b: 232 };
const photos = [
  // [source file, output name, crop (left, top, width, height) or null]
  ["lenny.png", "story/lenny-portrait", null],
  ["streakfrites.png", "food/steak-frites", { left: 0, top: 6, width: 542, height: 544 }],
  ["roastedjalapeno.png", "shuk/roasted-jalapeno", null],
  ["eggplantshuk.png", "shuk/eggplant-shuk", null],
  ["trufflebabgonosh.png", "shuk/truffle-babaganoush", null],
  ["shuk shallat.png", "shuk/shuk-salat", null],
  ["wagyuhoneybrasiedrid.png", "shuk/wagyu-short-rib", null],
  ["hugeplatter.png", "cultura/hugeplatter", null],
];

for (const [file, name, crop] of photos) {
  const base = () => {
    const s = sharp(join(src, file));
    return crop ? s.extract(crop) : s;
  };
  const meta = await base().toBuffer({ resolveWithObject: true }).then((r) => r.info);
  const widths = [...new Set([720, 1280].map((w) => Math.min(w, meta.width)))];
  mkdirSync(join(out, name, ".."), { recursive: true });
  for (const width of widths) {
    const img = base().resize({ width, withoutEnlargement: true });
    await img.clone().webp({ quality: 80 }).toFile(join(out, `${name}-${width}.webp`));
  }
  const top = widths.at(-1);
  await base().resize({ width: top, withoutEnlargement: true }).flatten({ background: PAPER }).jpeg({ quality: 80, mozjpeg: true }).toFile(join(out, `${name}-${top}.jpg`));
  console.log(name, meta.width, "x", meta.height, "->", widths.join(", "));
}
