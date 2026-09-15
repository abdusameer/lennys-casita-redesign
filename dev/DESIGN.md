# Lenny's Casita — redesign direction

## Visual thesis
**The green-tile counter.** Every professional plate photo from the restaurant shares one set:
bottle-green glazed tile, a white counter, warm wood boards, and a flash of pickled-onion pink.
The site is built from that room. Deep tile green is the chapter color, counter white is the paper,
wood is the warm neutral, and a muted Kelly green is the single primary accent (it replaced the pickled-onion pink in September 2026).
Type echoes the house sign — a loud condensed street-sign face for LENNY'S, a soft italic serif
for *casita* — without redrawing the logo.

## Hero focal asset
The real taco-board photo, portrait, on the right half. A giant italic "Casita" crosses from the
green panel into the photo and passes *behind* the food: a background-removed cutout of the same
photo sits on top, so the word lives between the tile wall and the plate. Pointer moves only the
word layer (bg and cutout stay locked together, so nothing ghosts).

## Type
- Display: Bebas Neue (one weight, self-hosted via Fontsource), uppercase — street-sign voice for the hero, section titles,
  dish and cocktail names, prices and big numbers. Replaced Big Shoulders Display in September 2026; weight synthesis is
  off so the browser never fakes a bold of it.
- Accent: Fraunces Variable italic, SOFT 100 — warmth, "casita", pull quotes.
- Text: Hanken Grotesk Variable 400–600 — body, labels, UI.

## Color
- `--tile` #0d3b26 deep glaze, `--tile-2` #145a38 glaze highlight, `--tile-ink` #082517
- `--counter` #f5f1e8 paper, `--grout` #e6dfcf hairlines on paper
- `--wood` #b0703a warm neutral, `--ink` #16140f text on paper
- One accent family, muted Kelly green (hue 136°): `--color-accent` #3c9a55 fills (ink text), progress and marks on dark grounds;
  `--color-accent-hover` #46aa60; `--color-accent-soft` #81bb91 for text, labels and the hero script on dark grounds;
  `--color-accent-deep` #225d32 for text, hairlines and focus rings on paper; `--color-accent-glow` for diffusion.
  `--accent-fg` resolves soft or deep per ground and drives focus rings. The closed-status dot is brass so it never reads as open.

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
- Owner-supplied media (September 2026, Documents/Lenny'sCasita): Chef Lenny portrait, steak frites, the five Shabbat
  Shuk dish photos (re-supplied September 15 as clean studio shots on the green tile), a catering board photo
  (hugeplatter.png, September 15), and two reels saved from the restaurant's Instagram
  (cateringlenny.mp4, worldcuplenny.mp4). Photo crops only remove screenshot artifacts (a lens button, an avatar
  badge, a 5px dark top edge on the steak frites photo); nothing is upscaled.
  The films are trimmed without re-encoding: catering 0–27.7s (before the logo end card), match day 0–12.5s.

## September 2026 refinement
- **Dine with us**: Chef Lenny's portrait bleeds off the page edge and rises into the empty margin beside the
  headline, so the spread reads headline, Lenny, story. Phones set it right-bleeding between headline and copy.
- **The counter**: the owner's six plates (Steak frites replaces the tostada). The pinned scene sizes its spacing,
  type and 4:5 frame from the viewport height, so it is exactly one screen and the controls never clip.
- **Shabbat Shuk**: the panel is untouched. On desktop the section is anchored with CSS sticky (no GSAP pin) and
  scroll cross-fades five dishes, each with photo, name, description and price; a rail jumps between them.
  Phones, tablets, short screens and reduced motion get every dish in normal flow.
- **Cultura**: one composed desktop screen. Beside the untouched copy, a constrained grid: the catering reel and the
  match-day reel side by side on top (42%), a wide crop of the catering board below (58%). The copy sets the row
  height and the grid (size-contained) fills exactly that, so neither column runs past the other; short screens let
  the section grow instead of clipping. Posters are the films' first frames. Films load only when the section is
  near, pause when it leaves or the tab hides, and wait for the Play button under reduced motion or Save-Data.
  Tablets and phones stack normally; phones play the catering reel only.

## September 15 update
- **Type**: Bebas Neue is the display face everywhere `--f-sign` was used; Fraunces stays for the soft italic voice and
  Hanken Grotesk for body and UI text (it already fills the body role, so no second sans was added).
- **Accent**: pink replaced across buttons, the word strip, labels, dropdown and drawer highlights, active numbers,
  progress rails, hover and focus states, and the glass edges (first with acid green, then the muted Kelly below).
- **Order**: the Shabbat Shuk is the first chapter after the film, and first in the Eat & drink dropdown on both pages.
  The film ends on night and the Shuk opens on night before settling into tile-ink, with the tile texture masked in, so
  the two chapters meet without a seam.
- **Shabbat Shuk**: photo-led dish story on the left, order panel on the right (the panel stays first in the markup so its
  heading and the Friday order CTA lead the reading order and phones). Each dish photo carries a large Bebas chapter
  number. Same calm scroll cross-fade, verified names, descriptions and prices.
- **After dark**: six featured cocktails (Spicy Margarita Balagán, Waterpamelon, 616 Gimlet, Carefuleta, Michelada de
  Casita, La Manzana Whiskey Sour), counters 01–06 / 06. The full list stays on the menu page.
- **Cultura**: only the board image changed, to hugeplatter (1672×941 source, published at 720/1280).

## September 15, second pass
- **Accent**: one muted Kelly family replaces the acid green and the last pink (the old blush). The happy-hour chapter's
  blush details became aged brass so green stays special.
- **Hero**: "a timeless table." stays Fraunces italic as the one expressive exception, now soft Kelly with a tight luminous
  edge and a faint blurred diffusion behind it. It resolves once after the words rise (the word masks stop clipping then)
  and never moves again. The Reserve button is the strongest solid Kelly; hover lifts one step with a fine edge in 220ms.
- **After dark**: on fine pointers a soft Kelly light drifts with the pointer through the Tequila & mezcal negative space.
  A fixed-size disc moved by transform inside an edge-masked layer, eased by one rAF loop that sleeps when settled;
  geometry is read on entry and refresh only. The ampersand (now Kelly) brightens slightly as the light nears. The normal
  cursor stays. Touch, reduced motion and Save-Data get the static composition. Reveals here rise 10px, not word by word.
- **Link rows**: a Kelly hairline draws in, the arrow steps ~5px, a faint light gathers at the arrow; colour, opacity and
  transform only (the old padding shift is gone).
