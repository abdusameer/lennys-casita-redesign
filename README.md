# Lenny's Casita — Website

A plain, dependency-free static site: two pages, no build step, no server-side code.

## Project structure

```
index.html                   Homepage ("A modern casita, a timeless table")
lennys-casita-menu.html      Full menu page
assets/
  css/
    styles.css                Shared styles + fonts (used by both pages)
    home.css                  Homepage-only styles
    menu.css                  Menu-page-only styles
  js/
    vendor.js                 Shared runtime (GSAP, Lenis, nav, hours, reveals)
    main.js                   Homepage behavior (film hero, plate tour, pours)
    menu.js                   Menu-page behavior (chapter rail, tacos, builder)
    webgl-plate-tour.js        Lazy-loaded WebGL tile-flip effect (loads only when needed)
  fonts/                       Self-hosted web fonts (woff/woff2)
  images/
    branding/                  Logo
    hero/                      Film poster + 5 scene stills
    food/                      Dish photography (food/shabbat/: the five Shabbat Shuk dishes)
    cocktails/                 Cocktail photography + Cesar Mateo portrait
    story/                     Chef Lenny portraits + "takeout years" photo
    gallery/cultura/           Catering board (hugeplatter) + first-frame posters for the Cultura films
    backgrounds/               Green-tile texture used behind glass panels
  video/                       Self-hosted Cultura films (H.264 MP4, muted loops, no audio played)
dev/                          The original Vite source project (for future edits — see below)
backups/                      Untouched copies of the two original single-file exports
```

## Running it locally

No build step. Any static file server works, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

Opening `index.html` directly by double-clicking also works, since all assets are
relative files (fonts, images, CSS, JS) — nothing is embedded as base64 and nothing
requires a bundler.

## Editing the site

Two ways:

1. **Quick text/price edits**: edit `index.html` / `lennys-casita-menu.html` directly —
   they're plain HTML.
2. **Structural or style changes**: edit the source in `dev/` (a Vite project), then rebuild and publish:
   ```bash
   cd dev
   npm install
   npm run build              # writes dev/dist/
   node scripts/reorg.mjs     # regenerates index.html, lennys-casita-menu.html and assets/ at the repo root
   ```
   Owner-supplied photos go through `node scripts/owner-media.mjs <folder>` (WebP + JPEG, no upscaling).
   The trimmed source films live in `dev/public/video/`.

## Deploying to GitHub Pages

1. Push this repo to GitHub (see the project's git history for the current remote).
2. In the repo's Settings → Pages, set the source to the `main` branch, root folder.
3. The site will be served at `https://<user>.github.io/<repo>/`.

No further configuration is needed — there's no build step Pages needs to run.

## Media ownership

The photography, logo, and cocktail-book/menu content used on this site were pulled
from the restaurant's own previously-published website and PDFs. **Confirm the
restaurant owns or has licensed every image, and has approved its use here, before
this site goes live publicly.**
