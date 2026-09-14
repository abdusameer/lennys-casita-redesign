// Deterministic structural reorg: turns the Vite `dist/` build (already non-base64, real
// separate JS/CSS/image files) into the requested flat production tree. No content changes.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, cpSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = "/Users/sam01/Library/Application Support/Claude/scratch-workspaces/8b69634d-2766-4d60-ba1b-4cb08f5fb5fe/978a484c-c335-474e-b503-a036cb1c160a/scratch-2026-09-14-35ce3b/lennys-casita";
const dist = join(root, "dist");
const A = join(root, "assets");
const backups = join(root, "backups");

const mkdir = (p) => mkdirSync(p, { recursive: true });
[
  "assets/css", "assets/js", "assets/fonts", "assets/video",
  "assets/images/branding", "assets/images/hero", "assets/images/food",
  "assets/images/cocktails", "assets/images/story", "assets/images/gallery",
  "assets/images/backgrounds",
].forEach((p) => mkdir(join(root, p)));
mkdir(backups);

// 1) Back up the two original single-file exports untouched, outside the production tree.
for (const f of ["lennys-casita.html", "lennys-casita-menu.html"]) {
  if (existsSync(join(root, f))) copyFileSync(join(root, f), join(backups, f));
}

// 2) Move the Vite dev project aside so the repo root can hold the flat production site.
mkdir(join(root, "dev"));
for (const f of ["src", "public", "vite.config.js", "package.json", "package-lock.json", "scripts", "DESIGN.md", "preview", "index.html", "menu.html"]) {
  const from = join(root, f);
  if (existsSync(from)) cpSync(from, join(root, "dev", f), { recursive: true });
}

// 3) Copy hashed dist assets to descriptive production names (JS + CSS).
const jsMap = {
  "sections-_otGtD-a.js": "assets/js/vendor.js",
  "index-kleZiigI.js": "assets/js/main.js",
  "menu-BYZg1328.js": "assets/js/menu.js",
  "counter-gl-BSoQzpM0.js": "assets/js/webgl-plate-tour.js",
};
const cssMap = {
  "sections-B3uAIfSE.css": "assets/css/styles.css",
  "index-B1bUC1LV.css": "assets/css/home.css",
  "menu-C5eZTmEM.css": "assets/css/menu.css",
};
for (const [from, to] of Object.entries({ ...jsMap, ...cssMap })) {
  copyFileSync(join(dist, "assets", from), join(root, to));
}

// 4) Copy fonts (unchanged filenames).
for (const f of readdirSync(join(dist, "assets")).filter((f) => /\.woff2?$/.test(f))) {
  copyFileSync(join(dist, "assets", f), join(A, "fonts", f));
}

// 5) Copy images into descriptive categories.
const imgMap = {
  "logo-white.png": "branding/logo-white.png",
  "film/poster.webp": "hero/poster.webp",
  "film/beat-1.webp": "hero/beat-1.webp",
  "film/beat-2.webp": "hero/beat-2.webp",
  "film/beat-3.webp": "hero/beat-3.webp",
  "film/beat-4.webp": "hero/beat-4.webp",
  "film/beat-5.webp": "hero/beat-5.webp",
  "film/celebrate-kitchen.webp": "gallery/celebrate-kitchen.webp",
  "film/celebrate-toast.webp": "gallery/celebrate-toast.webp",
  "tile-wall.webp": "backgrounds/tile-wall.webp",
};
for (const c of ["616-gimlet", "carefuleta", "cesar-mateo", "cocoliso", "la-manzana", "mangorita", "matcha-mule", "miami-vice", "michelada", "mojito-pasiflor", "spicy-margarita-balagan", "waterpamelon"]) {
  imgMap[`cocktails/${c}.webp`] = `cocktails/${c}.webp`;
}
for (const base of ["chef-1280.jpg", "chef-1280.webp", "chef-720.webp", "spread-1280.jpg", "spread-1280.webp", "spread-720.webp"]) {
  imgMap[base] = `story/${base}`;
}
for (const base of [
  "chopped-salad-1280.jpg", "chopped-salad-1280.webp", "chopped-salad-720.webp",
  "crispy-bites-1280.jpg", "crispy-bites-1280.webp", "crispy-bites-720.webp",
  "loaded-fries-1280.jpg", "loaded-fries-1280.webp", "loaded-fries-720.webp",
  "menu-hero-cutout.png", "menu-hero-cutout.webp", "menu-hero.jpg", "menu-hero.webp",
  "quesadilla-1280.jpg", "quesadilla-1280.webp", "quesadilla-720.webp",
  "taco-board-1280.jpg", "taco-board-1280.webp", "taco-board-720.webp",
  "tostada-1280.jpg", "tostada-1280.webp", "tostada-720.webp",
]) {
  imgMap[base] = `food/${base}`;
}
for (const [from, to] of Object.entries(imgMap)) {
  copyFileSync(join(dist, "img", from), join(A, "images", to));
}

// 6) Fix the woff url() paths inside styles.css (moved one directory deeper: assets/ -> assets/css/).
const stylesPath = join(A, "css/styles.css");
writeFileSync(stylesPath, readFileSync(stylesPath, "utf8").replace(/url\(\.\/([^)]+\.woff2?)\)/g, "url(../fonts/$1)"));

// 7) Fix the JS-to-JS references (vendor chunk + lazy WebGL chunk import specifiers).
for (const jsOut of ["assets/js/main.js", "assets/js/menu.js"]) {
  const p = join(root, jsOut);
  let src = readFileSync(p, "utf8").replace('"./sections-_otGtD-a.js"', '"./vendor.js"');
  if (jsOut.endsWith("main.js")) src = src.replace("`./counter-gl-BSoQzpM0.js`", "`./webgl-plate-tour.js`");
  writeFileSync(p, src);
}

// 8) Build the two production HTML pages from dist/, rewriting every asset reference.
function buildPage(distFile, outName, cssOut) {
  let html = readFileSync(join(dist, distFile), "utf8");
  html = html
    .replace('<script type="module" crossorigin src="./assets/index-kleZiigI.js"></script>', '<script type="module" src="./assets/js/main.js"></script>')
    .replace('<script type="module" crossorigin src="./assets/menu-BYZg1328.js"></script>', '<script type="module" src="./assets/js/menu.js"></script>')
    .replace(/<link rel="modulepreload" crossorigin href="\.\/assets\/sections-_otGtD-a\.js">/, '<link rel="modulepreload" href="./assets/js/vendor.js">')
    .replace('<link rel="stylesheet" crossorigin href="./assets/sections-B3uAIfSE.css">', '<link rel="stylesheet" href="./assets/css/styles.css">')
    .replace(`<link rel="stylesheet" crossorigin href="./assets/${cssOut.hashName}">`, `<link rel="stylesheet" href="./assets/css/${cssOut.name}">`)
    .replace('href="./img/logo-white.png"', 'href="./assets/images/branding/logo-white.png"')
    .replace(/href="\.\/img\/film\/poster\.webp"/, 'href="./assets/images/hero/poster.webp"');

  // Rewrite every remaining ./img/... or bare img/... reference (src, srcset, href).
  html = html.replace(/((?:\.\/)?img\/)([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?)/g, (whole, _prefix, rel) => {
    const mapped = imgMap[rel];
    if (!mapped) throw new Error(`Unmapped image reference: ${rel}`);
    return `assets/images/${mapped}`;
  });

  const leftovers = html.match(/(?:href|src|srcset)="[^"]*\/img\//g) || html.match(/\bimg\//g);
  if (leftovers) throw new Error(`Unrewritten image path(s) remain in ${outName}: ${leftovers.slice(0, 5).join(", ")}`);
  writeFileSync(join(root, outName), html);
  console.log(`wrote ${outName} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
}
buildPage("index.html", "index.html", { hashName: "index-B1bUC1LV.css", name: "home.css" });
buildPage("menu.html", "lennys-casita-menu.html", { hashName: "menu-C5eZTmEM.css", name: "menu.css" });

console.log("reorg complete");
