# Lenny's Casita — redesign direction

## Visual thesis
**The green-tile counter.** Every professional plate photo from the restaurant shares one set:
bottle-green glazed tile, a white counter, warm wood boards, and a flash of pickled-onion pink.
The site is built from that room. Deep tile green is the chapter color, counter white is the paper,
wood is the warm neutral, and pink is used only for live status and the single primary accent.
Type echoes the house sign — a loud condensed street-sign face for LENNY'S, a soft italic serif
for *casita* — without redrawing the logo.

## Hero focal asset
The real taco-board photo, portrait, on the right half. A giant italic "Casita" crosses from the
green panel into the photo and passes *behind* the food: a background-removed cutout of the same
photo sits on top, so the word lives between the tile wall and the plate. Pointer moves only the
word layer (bg and cutout stay locked together, so nothing ghosts).

## Type
- Display: Big Shoulders Display 800/900, uppercase — street-sign voice (LENNY'S, section titles).
- Accent: Fraunces Variable italic, SOFT 100 — warmth, "casita", pull quotes.
- Text: Hanken Grotesk Variable 400–600 — body, labels, UI.

## Color
- `--tile` #0d3b26 deep glaze, `--tile-2` #145a38 glaze highlight, `--tile-ink` #082517
- `--counter` #f5f1e8 paper, `--grout` #e6dfcf hairlines on paper
- `--wood` #b0703a warm neutral, `--ink` #16140f text on paper
- `--onion` #e5487f accent (primary action, live status)

## Section sequence
1. Nav — logo, Menu / Story / Bar / Visit, live open status, Reserve.
2. Hero — H1 message + Reserve / Order CTAs, cutout depth composition.
3. Facts rule — Glatt kosher (OK), full bar, Pico-Robertson, since 2020.
4. Welcome — word-revealed statement, rewritten house copy.
5. The counter — pinned plate tour: scroll drives a WebGL tile-flip between six real plates.
6. Story — Charcoal → March 15 2020 → May 11 2020 → Pico Blvd, with the chef photo and the takeout-era spread.
7. The bar — dark typographic chapter: tequila & mezcal, cocktail + happy-hour menu links.
8. Guests — three real reviews from the existing site, text only (no avatars), links to Yelp/Tripadvisor.
9. Ways to eat — Reserve, Order, Shabbat, Catering, Gift card, Merch as an index list.
10. Visit — address, map, hours table with today highlighted, phone, email, socials.
11. Footer — final CTA, hiring, blog, contact.

## Motion narrative
GSAP everywhere. Hero: photo unmasks upward, headline words rise, the "Casita" word slides in
behind the plate, CTAs are visible from the first frame. Sections: heading words stagger in,
then copy, then media. One pinned scene (the counter) scrubs a tile-by-tile texture flip — the
tile wall itself becomes the transition. Hover/focus states are CSS.

## Smooth scroll
Lenis (lighter, drives from the GSAP ticker, native scroll position for ScrollTrigger).
Locomotive Scroll v5 is itself Lenis-based plus extra modules we do not need. Only Lenis is installed.
Disabled under `prefers-reduced-motion`.

## Three.js decision
Yes, one canvas with one job: the plate-tour texture transition in a tile grid that matches the
photographed wall. Lazy-loaded when the section approaches, DPR capped at 1.75, paused offscreen
and when hidden, disposed on teardown, context-loss safe. Static `<img>` stack is the default
markup, and remains the experience under reduced motion or WebGL failure.

## Asset provenance
- Plate photos, chef photo, overhead spread, logo: existing lennyscasita.com (restaurant-owned; "KF" shoot, 01-13-25).
- Taco-board cutout: background removed from that same photo (Higgsfield remove_background).
- Icons: Solar (Iconify, CC BY 4.0); social marks: Simple Icons (Iconify, CC0) for the restaurant's real profiles.
- Reviews: the three quotes displayed on the existing homepage.
- Story facts: "Mi Casa Es Su Casa" post on lennyscasita.com/blog.
- Fonts: Fontsource (OFL).
