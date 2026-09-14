// Packs each preview/ page into ONE self-contained HTML file (CSS, JS, fonts and photos inlined),
// so the site renders even where sibling files can't load — e.g. an in-app HTML preview.
// Run after `npm run build:file` (see `npm run build:single`).
import { readFileSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, "preview");
const PAGES = { "index.html": "lennys-casita.html", "menu.html": "lennys-casita-menu.html" };
const MIME = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" };
const dataUri = (rel) => `data:${MIME[extname(rel)]};base64,${readFileSync(join(dir, rel)).toString("base64")}`;

function pack(page, outName) {
  let html = readFileSync(join(dir, page), "utf8");
  const find = (pattern) => {
    const match = html.match(pattern);
    if (!match) throw new Error(`Expected to find ${pattern} in preview/${page}`);
    return match;
  };

  // Stylesheet: keep only the latin font subsets, drop woff fallbacks (woff2 is already embedded).
  const [cssTag, cssHref] = find(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/);
  let kept = 0;
  const css = readFileSync(join(dir, cssHref), "utf8")
    .replace(/@font-face\s*\{[^}]*\}/g, (block) => {
      // The latin subset starts at U+0000-00FF, which the CSS minifier shortens to U+00?? or U+??.
      if (!/unicode-range:\s*U\+(0000-00FF|00\?\?|\?\?)[,;}]/i.test(block)) return "";
      kept += 1;
      return block;
    })
    .replace(/,\s*url\([^)]*\.woff\)\s*format\(["']?woff["']?\)/g, "");
  if (kept < 5) throw new Error(`Only ${kept} latin @font-face blocks kept in ${page}; check the unicode-range filter`);
  html = html.replace(cssTag, () => `<style>${css}</style>`);

  // Script: inline at the end of <body> (inline scripts ignore `defer`).
  const [jsTag, jsSrc] = find(/<script defer src="\.\/(assets\/[^"]+\.js)"><\/script>/);
  let js = readFileSync(join(dir, jsSrc), "utf8");
  if (js.includes("<!--")) throw new Error(`Bundle for ${page} contains '<!--'; inline <script> needs different escaping`);
  js = js.replace(/<\/script/gi, "<\\/script");
  html = html.replace(jsTag, "").replace("</body>", () => `<script>${js}</script>\n</body>`);

  // Photos: each <picture> collapses to one <img> using its largest WebP candidate.
  html = html.replace(/<link rel="preload"[^>]*>\s*/g, "");
  html = html.replace(/<picture>([\s\S]*?)<\/picture>/g, (whole, inner) => {
    const srcset = inner.match(/<source[^>]*srcset="([^"]+)"/)?.[1];
    const img = inner.match(/<img\b[^>]*>/)?.[0];
    if (!srcset || !img) return whole;
    const best = srcset.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]).pop().replace(/^\.\//, "");
    return img.replace(/\ssrc="[^"]*"/, () => ` src="${dataUri(best)}"`);
  });
  html = html.replace(/\b(src|href)="\.\/(img\/[^"]+)"/g, (_, attr, rel) => `${attr}="${dataUri(rel)}"`);

  // Cross-page links point at the sibling single files.
  html = html.replace(/\bhref="(?:\.\/)?(index|menu)\.html(#[^"]*)?"/g, (_, name, hash = "") => `href="${PAGES[`${name}.html`]}${hash}"`);

  const leftovers = html.match(/\b(?:src|href|srcset)="(?!data:|https?:|mailto:|tel:|#|lennys-casita(?:-menu)?\.html)[^"]*"/g);
  if (leftovers) throw new Error(`Unresolved local references in ${page}: ${leftovers.join(", ")}`);

  writeFileSync(join(root, outName), html);
  console.log(`wrote ${outName} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB, ${kept} font faces)`);
}

for (const [page, outName] of Object.entries(PAGES)) pack(page, outName);
