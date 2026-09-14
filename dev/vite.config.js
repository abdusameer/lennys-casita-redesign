import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const PAGES = ["index", "menu"];

// Icons: Solar (CC BY 4.0) and Simple Icons (CC0), fetched from the Iconify API into src/icons.
// They are inlined at build time so they render without JavaScript.
const ICONS = {
  "arrow-up-right": "solar_arrow-right-up-linear",
  "arrow-right": "solar_arrow-right-linear",
  "arrow-left": "solar_arrow-left-linear",
  "arrow-down": "solar_arrow-down-linear",
  chevron: "solar_alt-arrow-down-linear",
  map: "solar_map-point-linear",
  phone: "solar_phone-linear",
  letter: "solar_letter-linear",
  clock: "solar_clock-circle-linear",
  calendar: "solar_calendar-mark-linear",
  bag: "solar_bag-4-linear",
  gift: "solar_gift-linear",
  shirt: "solar_t-shirt-linear",
  star: "solar_star-bold",
  chef: "solar_chef-hat-linear",
  wine: "solar_wineglass-linear",
  document: "solar_document-text-linear",
  users: "solar_users-group-rounded-linear",
  home: "solar_home-2-linear",
  play: "solar_play-linear",
  pause: "solar_pause-linear",
  instagram: "simple-icons_instagram",
  facebook: "simple-icons_facebook",
  yelp: "simple-icons_yelp",
  tripadvisor: "simple-icons_tripadvisor",
};

function inlineIcons() {
  const dir = `${root}src/icons/`;
  const cache = new Map();
  const load = (name) => {
    if (!ICONS[name]) throw new Error(`Unknown icon "${name}"`);
    if (!cache.has(name)) {
      const svg = readFileSync(`${dir}${ICONS[name]}.svg`, "utf8")
        .replace(/\swidth="[^"]*"/, "")
        .replace(/\sheight="[^"]*"/, "")
        .replace("<svg", '<svg aria-hidden="true" focusable="false"');
      cache.set(name, svg);
    }
    return cache.get(name);
  };
  return {
    name: "inline-icons",
    transformIndexHtml(html) {
      return html.replace(
        /<span class="([^"]*\bicon\b[^"]*)" data-icon="([a-z-]+)"><\/span>/g,
        (_, cls, name) => `<span class="${cls}" aria-hidden="true">${load(name)}</span>`
      );
    },
  };
}

// `vite build --mode file` writes preview/: a copy that opens straight from disk (file://),
// where browsers refuse module scripts and crossorigin requests. One classic deferred script,
// no code splitting, one page per run (FILE_PAGE). The regular build (dist/) keeps ES modules
// and the lazy three.js chunk.
function classicScripts() {
  return {
    name: "classic-scripts",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler: (html) =>
        html
          .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
          .replace(/<link rel="modulepreload"[^>]*>/g, "")
          .replace(/\scrossorigin(?=[\s>])/g, ""),
    },
  };
}

export default defineConfig(({ mode }) => {
  const fileMode = mode === "file";
  const page = process.env.FILE_PAGE || PAGES[0];
  if (!PAGES.includes(page)) throw new Error(`Unknown FILE_PAGE "${page}"`);
  return {
    // Relative base so the build works from any folder or host path.
    base: "./",
    plugins: [inlineIcons(), fileMode && classicScripts()].filter(Boolean),
    build: {
      target: "es2020",
      // file:// blocks web-font requests, so the preview copy embeds woff2 files in the CSS.
      assetsInlineLimit: fileMode ? (filePath) => filePath.endsWith(".woff2") : 0,
      outDir: fileMode ? "preview" : "dist",
      emptyOutDir: fileMode ? page === PAGES[0] : true,
      modulePreload: fileMode ? false : undefined,
      // Without this, a classic (iife) build injects CSS from JavaScript; keep a real stylesheet instead.
      cssCodeSplit: !fileMode,
      chunkSizeWarningLimit: fileMode ? 900 : 600,
      rolldownOptions: fileMode
        ? { input: `${root}${page}.html`, output: { format: "iife", codeSplitting: false } }
        : { input: Object.fromEntries(PAGES.map((name) => [name, `${root}${name}.html`])) },
    },
  };
});
