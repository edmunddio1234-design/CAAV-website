# CAAV website and Immersion in Motion

Static site. No build step. Open `index.html` with any web server (for example `python3 -m http.server`).

## Pages
- `/` home, `/about`, `/board`, `/conferences`, `/cave-list`, `/news`, `/membership`, `/contact`, `/brand`
- `/immersion-in-motion/` the campaign page, `/immersion-in-motion/sub-projects/` the seven sub-projects
- `/immersion-in-motion/Immersion-in-Motion-Overview.pdf` one-page overview for plant managers

## Files
- `assets/site.css`, `assets/caav.css`, `assets/site.js` shared styles and behavior (GSAP motion, tab bar, form)
- `assets/fonts/` Archivo, Public Sans, Azeret Mono, Kalam (all OFL, licenses included)
- `assets/brand/` logos (SVG) and `brand-tokens.css`
- `tweak.js` live-edit panel: add `?tweak` to any page address

## To add
Photos in `immersion-in-motion/`: `truck-exterior.jpg`, `demo-in-use.jpg`. Until they exist, a labeled placeholder shows.
`grand-opening.mp4` is currently an AI-generated concept clip. Replace it with real footage.

## Notes
- Facts about the CAAV come from thecaav.org. Facts about the Mobile CAVE come from the printed flyer and the project framework.
- Brand colors were sampled from a photo of the flyer. Marks are original drawings, not the CAAV's or Southern University's official logos.
- The booking form opens the visitor's email app. It does not save anything.
- Never commit tokens or keys to this repo.
