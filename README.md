# XR Jags website (formerly the CAAV site) and Immersion in Motion

**XR Jags / Extended Reality Jaguars Research Group** is the Southern University student research group for extended reality.
On October 21, 2026 Southern University decided to rebrand this site in place (same repo, same URL: caav-website.vercel.app)
from the CAAV conference site into the XR Jags site. Content comes from the student site, suvrjags.org, and from SU.
Launch event: Mobile CAVE ribbon cutting at the Leon Waters Museum, Southern University. Date to be announced.

Static site. No build step. Open `index.html` with any web server (for example `python3 -m http.server`).

## Colors (October 24, 2026)
Southern University colors replace every orange (client rule: "No orange, it must be SU yellow"). SU Gold `#FFC72C` is the
primary accent with navy `#00263A` text on it (never white on gold); gold text on white uses `#8A6A00`. Columbia Blue
`#69B3E7` / `#1F6FAE` (text-safe) is the secondary accent only. The top section of every page is a gold field with navy text.
The full sheet is `/brand` (print it to make the brand PDF).

## Pages (XR Jags)
- `/` home, `/about` (5 parts), `/projects`, `/sectors` (+4), `/initiatives`, `/team` (XR Jags Team), `/request-services`, `/book-a-tour`,
  `/contact`, `/news`, `/cave-list`, `/sponsor-interest`, `/media`, `/brand`, `/dashboard` (staff only, noindex, footer link "Team sign-in")
- Redirects in `vercel.json` (permanent): `/board` -> `/team`, `/conferences` -> `/initiatives`, `/membership` -> `/about`.
  The old folders hold a fallback refresh page for servers that ignore `vercel.json`.

## Forms and leads
Every form is `<form data-su-form="tour|service|sponsor|media|contact">` and is saved by `assets/su-leads.js` to the shared
Southern University Supabase `leads` table. `assets/su-config.js` holds the project URL and PUBLISHABLE key; it is empty until
go-live, and the forms then tell visitors to email suradd@subr.edu. Each form has a hidden honeypot field `website_hp`.
`/dashboard` (`assets/dashboard.js`) signs staff in with Supabase Auth and shows the leads table and the activity log.
`assets/su-launch.js` shows the launch pop-up once a week per visitor (not on the tour, sponsor, media and dashboard pages). Its date is one optional `data-date` setting; without it the pop-up says "Date to be announced".
`assets/funding.js` holds funding acknowledgments; an entry shows only once SU's exact approved wording is pasted into it.

## Page helpers (assets/site.js)
- `?from=/path` on any address adds a "Back to where you were" link (same-site paths only).
- `data-help="plain words"` on a section or card adds an accessible "?" button that shows the text.
- Names on `/team` and `/media` (`a.pv`) show a small photo card when the pointer rests on the name, and link to `/team/#slug`.
- Team photos in `assets/img/team/` come from suvrjags.org/team.
- No XR Jags logo file exists yet: the header uses a typed "XR Jags" wordmark. The old CAAV marks stay in `assets/brand/`.

## Sectors (Oct 2026)
`/sectors/` hub and four pages: `healthcare`, `k12`, `plants`, `emergency`. Each has a tagline, short benefits and
"Deep Dive" blocks (`<details>`) that link to the full AM Lab deep-dive page and PDF. Text comes only from the AM Lab deep
dives (SP01, SP02, SP03, SP05, L1, L2), the Immersion in Motion pages and the suvrjags.org project write-ups.

## No motion behind text
Page-title blocks use a dark, pre-blurred still (`assets/img/still/`, about 10 KB each) under a navy overlay instead of
moving film. The moving scene backgrounds (`scene-bg.js`) are no longer loaded. The truck film still plays in its own image
block on the home page, where no text sits on it.

## Launch banner
`assets/su-launch.js` (shared with the other two sites) adds the pop-up and, with `data-banner="on"`, a slim top strip.
Add `data-date="..."` and `data-target="YYYY-MM-DDTHH:MM:00-06:00"` to the script tag to show the date and a day countdown.
It is on every public page, not on `/dashboard`.

## Moving suvrjags.org to this site
`vercel.json` already sends the old Wix addresses to the matching new pages (permanent redirects). `/team` and `/contact`
keep the same address. When SU is ready:
1. In Vercel, open this project, then Settings, then Domains, and add `www.suvrjags.org` and `suvrjags.org`
   (set the bare domain to redirect to `www`).
2. In the DNS for suvrjags.org (currently pointing at Wix), set the records Vercel shows on that screen.
3. Once the domain works, change the sitemap address in `robots.txt` and every `<loc>` in `sitemap.xml` from
   `https://caav-website.vercel.app` to `https://www.suvrjags.org`, and the `SITE_URL` used for `og:url` in each page head.
4. Add `<link rel="canonical" href="https://www.suvrjags.org/<path>">` to each page head only at that point, not before.
5. In Google Search Console, add the suvrjags.org property and submit `https://www.suvrjags.org/sitemap.xml`.

## Staff uploads
`/dashboard` has an Uploads section (bio photos, simulation clips, resume/LinkedIn links, summer camp media). Files go to the
private Supabase Storage bucket `xrjags-uploads`, rows to `public.uploads`. The SQL is block 2 of the shared
`migration.sql`; until it is applied, uploads return an error message and nothing is saved.

---
Earlier notes (CAAV site, kept for history):

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
