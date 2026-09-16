// Publishes the Vite build (dev/dist) as the flat production site at the repo root: descriptive JS/CSS
// names, categorized images, self-hosted video, and links rewritten to the production file names.
// Re-run after every build:  cd dev && npm run build && node scripts/reorg.mjs
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const dist = join(root, "dev/dist");
const out = join(root, "assets");
const distAssets = readdirSync(join(dist, "assets"));

// Vite names chunks <name>-<8-char hash>.<ext>; find each by name so a new hash needs no edit here.
const chunk = (name, ext) => {
  const found = distAssets.filter((f) => new RegExp(`^${name}-[A-Za-z0-9_-]{8}\\.${ext}$`).test(f));
  if (found.length !== 1) throw new Error(`Expected one ${name}.${ext} chunk, found ${found.length}`);
  return found[0];
};
const js = { vendor: chunk("sections", "js"), main: chunk("index", "js"), menu: chunk("menu", "js"), webgl: chunk("counter-gl", "js"), map: chunk("visit-map", "js") };
const css = { styles: chunk("sections", "css"), home: chunk("index", "css"), menu: chunk("menu", "css"), "visit-map": chunk("visit-map", "css") };
const jsNames = { [js.vendor]: "vendor.js", [js.main]: "main.js", [js.menu]: "menu.js", [js.webgl]: "webgl-plate-tour.js", [js.map]: "visit-map.js" };

// Everything under assets/ is generated: start clean so retired files never linger.
rmSync(out, { recursive: true, force: true });
const write = (to, data) => {
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, data);
};
const copy = (from, to) => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
};

// dist/img/<path> -> assets/images/<category>/<file>. Only images a page references are published.
const imageDest = (rel) => {
  const file = rel.split("/").pop();
  if (rel === "logo-white.png") return "branding/logo-white.png";
  if (rel === "tile-wall.webp") return "backgrounds/tile-wall.webp";
  if (rel.startsWith("film/")) return file.startsWith("celebrate-") ? `gallery/${file}` : `hero/${file}`;
  if (rel.startsWith("cocktails/")) return `cocktails/${file}`;
  if (rel.startsWith("story/") || /^(chef|spread)-/.test(rel)) return `story/${file}`;
  if (rel.startsWith("shuk/")) return `food/shabbat/${file}`;
  if (rel.startsWith("cultura/")) return `gallery/cultura/${file}`;
  if (rel.startsWith("visit/")) return `location/${file}`;
  if (rel.startsWith("food/") || /^(taco-board|tostada|loaded-fries|quesadilla|chopped-salad|crispy-bites|menu-hero)/.test(rel)) return `food/${file}`;
  throw new Error(`No category for image ${rel}`);
};

function publishPage(distFile, outFile, pageCss) {
  let html = readFileSync(join(dist, distFile), "utf8");
  const swap = (from, to) => {
    if (!html.includes(from)) throw new Error(`${distFile}: missing ${from}`);
    html = html.replace(from, to);
  };
  const entry = distFile === "index.html" ? js.main : js.menu;
  swap(`<script type="module" crossorigin src="./assets/${entry}"></script>`, `<script type="module" src="./assets/js/${jsNames[entry]}"></script>`);
  swap(`<link rel="modulepreload" crossorigin href="./assets/${js.vendor}">`, `<link rel="modulepreload" href="./assets/js/vendor.js">`);
  swap(`<link rel="stylesheet" crossorigin href="./assets/${css.styles}">`, `<link rel="stylesheet" href="./assets/css/styles.css">`);
  swap(`<link rel="stylesheet" crossorigin href="./assets/${css[pageCss]}">`, `<link rel="stylesheet" href="./assets/css/${pageCss}.css">`);
  html = html.replace(/href="menu\.html/g, 'href="lennys-casita-menu.html');

  // Attribute references only (src, srcset candidates, href, poster): ./img/... and ./video/...
  html = html.replace(/(?<=["\s,])(?:\.\/)?img\/([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*)/g, (_, rel) => {
    const dest = imageDest(rel);
    copy(join(dist, "img", rel), join(out, "images", dest));
    return `assets/images/${dest}`;
  });
  html = html.replace(/(?<=["\s,])(?:\.\/)?video\/([A-Za-z0-9_.-]+\.mp4)/g, (_, file) => {
    copy(join(dist, "video", file), join(out, "video", file));
    return `assets/video/${file}`;
  });
  html = html.replace(/data-map-style="(?:\.\/)?map\/([A-Za-z0-9_.-]+\.json)"/g, (_, file) => {
    copy(join(dist, "map", file), join(out, "map", file));
    return `data-map-style="assets/map/${file}"`;
  });

  const leftovers = html.match(/(?:src|srcset|href|poster)="(?:\.\/)?(?:img|video)\/|\.\/assets\/[^"/]+\.(?:js|css)"|href="menu\.html/g);
  if (leftovers) throw new Error(`Unrewritten reference(s) in ${outFile}: ${leftovers.slice(0, 5).join(", ")}`);
  writeFileSync(join(root, outFile), html);
  console.log(`wrote ${outFile} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
}
publishPage("index.html", "index.html", "home");
publishPage("menu.html", "lennys-casita-menu.html", "menu");

// JS: descriptive names, and every chunk-to-chunk specifier follows the rename. A lazy chunk also carries its own
// stylesheet ("./visit-map-<hash>.css"), which lands one folder over once JS and CSS are split into js/ and css/.
for (const [hashed, name] of Object.entries(jsNames)) {
  let src = readFileSync(join(dist, "assets", hashed), "utf8");
  for (const [from, to] of Object.entries(jsNames)) src = src.replaceAll(from, to);
  for (const [cssName, cssHashed] of Object.entries(css)) src = src.replaceAll(`./${cssHashed}`, `../css/${cssName}.css`).replaceAll(cssHashed, `../css/${cssName}.css`);
  write(join(out, "js", name), src);
}

// CSS: fonts move one level deeper (assets/ -> assets/css/, fonts in assets/fonts/).
for (const [name, hashed] of Object.entries(css)) {
  const text = readFileSync(join(dist, "assets", hashed), "utf8").replace(/url\(\.\/([^)]+\.woff2?)\)/g, "url(../fonts/$1)");
  // Quotes belong inside the lookahead: url("data:...) must pass, anything pointing at a file must not.
  if (/url\((?!["']?(?:\.\.\/fonts\/|data:))/.test(text)) throw new Error(`Unhandled url() in ${hashed}`);
  write(join(out, "css", `${name}.css`), text);
}
for (const f of distAssets.filter((f) => /\.woff2?$/.test(f))) copy(join(dist, "assets", f), join(out, "fonts", f));

console.log("published to", out);
