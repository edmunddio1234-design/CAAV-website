# CAAV website and Immersion in Motion

Static site. No build step. Open `index.html` with any web server (for example `python3 -m http.server`).

## Look (October 2026)
The CAAV main site follows the look of 14islands.com: a cool light-gray page (`#F2F2F2`, not cream), pure white panels,
near-black text (`#070707`), muted gray (`#8A8A8A`) for the first part of two-tone headlines, small uppercase labels,
big image blocks with soft organic edges, text set off to the right, and lots of white space. Buttons have 10 px corners
(no pill buttons). Motion is GSAP 3.12.5 + ScrollTrigger from cdnjs: headlines rise in, images scale in on scroll and tilt a
little under the pointer. Everything is visible without JavaScript and motion is off for reduced-motion visitors.
Phones (under 640 px) get a 4-tab bottom bar and a full-screen menu.

`/immersion-in-motion/` is a separate look (dark, ada.cx-style, General Sans) with its own `assets/` folder. It is moving to
its own site; do not style it from the main `assets/`.

## Fonts
- **Supreme** (display, 300/400) and **Switzer** (body and UI labels, 400/500), variable `.woff2`, self-hosted in
  `assets/fonts/`, from the Fontshare (Indian Type Foundry) library. License: `assets/fonts/FFL.txt` (ITF Free Font License).

## Pages
- `/` home, `/about`, `/board`, `/conferences`, `/cave-list`, `/news`, `/membership`, `/contact`, `/brand`
- `/immersion-in-motion/` the campaign page, `/immersion-in-motion/sub-projects/` the seven sub-projects,
  `/immersion-in-motion/am-lab/`
- `/immersion-in-motion/Immersion-in-Motion-Overview.pdf` one-page overview for plant managers

## Site family
The CAAV, Immersion in Motion and AM Lab are separate sites that link to each other through a slim strip at the top of the
header (desktop) and in the footer (all sizes). The addresses live in one place: the `FAMILY` constant at the top of
`assets/site.js`. Foundations is private and is not linked.

## Files
- `index.html` and `<page>/index.html` each page; design tokens sit in `<style id="tokens">` in each page head so /tweak can edit them
- `assets/site.css` shared layout and components; `assets/caav.css` brand-page pieces
- `assets/site.js` menu, image slots, site-family links (`FAMILY`), GSAP motion
- `assets/fonts/` `Supreme-Variable.woff2`, `Switzer-Variable.woff2`, `FFL.txt`
- `assets/brand/` logos (SVG, unchanged) and `brand-tokens.css` (the new colors and fonts)
- `assets/img/` drawn placeholder art (`art-cave.svg`, `art-lines.svg`, `art-road.svg`) and `edge-mask.svg` (the soft edge)
- `tweak.js` live-edit panel: add `?tweak` or `/tweak` to any page address
- `vercel.json` clean URLs and font caching

## Image slots
Drop photos into `assets/img/` with these names and they replace the drawn art automatically:
`hero.jpg` (home), `caavcon.jpg` (home and conferences), `mobile-cave.jpg` (home and conferences), `cave-list.jpg`.
Until a file exists, the drawing shows with a small "Image slot" label. No stock or fake photos are used.

Photos for `immersion-in-motion/`: `truck-exterior.jpg`, `demo-in-use.jpg`. `grand-opening.mp4` is currently an
AI-generated concept clip. Replace it with real footage.

## Notes
- Facts about the CAAV come from thecaav.org. Facts about the Mobile CAVE come from the printed flyer and the project framework.
- The logo marks are original drawings, not the CAAV's or Southern University's official logos. Their colors are kept as drawn.
  The lockup SVGs use live text; convert to outlines before print.
- The booking form opens the visitor's email app. It does not save anything.
- Never commit tokens or keys to this repo.
