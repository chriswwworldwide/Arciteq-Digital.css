---
name: testing-storefront
description: How to run and end-to-end test the PawSense storefront locally — server start, product/segment data, reduced-motion/no-JS emulation, mobile testing, and known gotchas.
---

# Testing the PawSense storefront

## Run it
- Repo root: `/home/ubuntu/repos/desir-noir.css`. Start with `node server.js` (or `npm start`) → serves
  http://localhost:3000.
- `npm install` is covered by the blueprint; the runtime server start is NOT — start it yourself before UI testing.
- Restart the server after any `server.js` change — routing is registered at boot, so a stale process silently
  serves the old behaviour and can make a routing fix look broken (kill the old `node server.js` first).

## Site root / homepage routing
- `/` serves the branded homepage (index.html) directly via `sendFile` — it does NOT redirect to the shop.
  (Historically `/` 302-redirected to `/shop.html`; if you see that, you are on an older commit or a stale server.)
- `/index.html` 301-redirects to `/`. That route MUST be registered BEFORE
  `app.use(express.static(__dirname, { index: false }))`, otherwise static serves the file directly and the
  redirect becomes dead code (the URL bar keeps `/index.html` instead of collapsing to `/`).
- Internal "Home" links point at `/` (not `index.html`): `script.js` injected shared nav, plus `header.html`,
  `success.html`, `blog.html`, `contact.html`, `features.html`.
- Quick routing assertion without the browser:
  `curl -sL -o /dev/null -w "%{url_effective} hops=%{num_redirects}\n" http://localhost:3000/index.html`
  should end at `http://localhost:3000/` with `hops=1`; `/` should be `hops=0`.
- `blog.html`, `contact.html` and `features.html` are still LEGACY un-migrated pages (old "L'art de la
  Séduction" lingerie branding, broken images). Pre-existing and off-brand — do not report as a new
  regression, but they are reachable from the live site.
- Products come from `data/products.json` (tenant `default` = PawSense). Product images are intentional
  paw placeholders ("Photography coming soon") — expected, not a bug.

## Canonical product URLs
`/<nicheCategorySlug>/<productSlug>` e.g. `/pet-safety-essentials/smart-activity-tracker-tag`,
`/senior-pet-care/self-warming-orthopedic-pet-mat`.

## Segment landing pages (PR #40)
- Data: `data/segments.json`; pure renderer: `src/segment-page.js`; build script writes static HTML to
  `segments/`. If `segments/` is stale/missing run `npm run build-segments`.
- Routes: hub served at `/segments` AND `/segments/` (server.js `app.get(["/segments","/segments/"])` →
  `segments/index.html`); pages are static `/segments/<slug>.html`. Six slugs: breeders, show-dogs,
  show-cats, dog-walkers, pet-sitters, multi-pet.
- Each page: breadcrumb `Home › Who it's for › <label>` (the "Who it's for" crumb → `/segments/`), intro
  (Who it's for / Why it matters), "Specialist short reads" (inline `<details class="seg-read">`), needs
  cards, "Curated picks" (product cards linking to canonical product URLs with `?ref=<slug>`), a kit form,
  and FAQs.
- Show pages (show-dogs, show-cats) additionally render an Events section split into "Upcoming events" and
  "Recent events & results" (recent rows include an italic result line) plus a "Show-day rundown" ordered
  timeline. The upcoming/recent split is computed at BUILD time from event dates vs the build date (a
  scheduled workflow rebuilds daily), so the static pages reflect the build date — not necessarily today.
- Kit-interest form: on submit it sets `.seg-enquiry-note` to "Thanks — we'll be in touch." and fire-and-
  forgets a POST to `/api/capture-email` with `{email, source:"segment:<slug>"}`. The message shows
  regardless of the network result. Locally `DATABASE_URL` is unset, so the endpoint returns 500 and logs
  `Capture email failed ... DATABASE_URL is not set` — this is the tolerated case, NOT a bug. Verify the
  POST via the server stdout log, not `performance.getEntriesByType('resource')` (fetch may not appear there).
- Homepage `/` has a "Who it's for" section (`.seg-links`, index.html ~L454) linking all six pages + the hub.

## Emulation
- Reduced-motion: DevTools rendering → emulate `prefers-reduced-motion: reduce`, reload.
- No-JS: DevTools command menu → Disable JavaScript, reload.
- Mobile: DevTools device toolbar (`Ctrl+Shift+M`) at 390×844. Assert no overflow with
  `document.documentElement.scrollWidth <= window.innerWidth`.
- browser_console runs in an isolated world: `document`/DOM is shared but page module globals are not, and
  it does NOT surface network 404s — use the DevTools Console/Network panel (or server log) for those.
- Focus the DevTools pane before `Ctrl+Shift+M`, otherwise the shortcut can hit the page/profile menu.

## Known pre-existing storefront issues (NOT segment-PR regressions)
- Product pages log 404s for `/themes/default.css`, `/styles.css` (MIME refusal), and review UGC video
  `/images/ugc/demo-senior-dog-walk.mp4`. Unrelated to segment pages; segment pages themselves are clean.
- A `favicon.ico` 404 on `/` is a browser default request, not an app bug.
- `.ph-mini { height:100% }` inside flex rows once caused related-card overlap (fixed via
  `align-items:flex-start`). Cart Qty/Remove once failed due to `script.js` being a module (fixed via
  delegated handlers). Re-check if touching those areas.

## Devin Secrets Needed
- None for local UI testing. `DATABASE_URL` (+ `ADMIN_API_KEY`) would be needed only to verify the
  capture-email persistence path end-to-end; without them the client-tolerated 500 path is what's exercised.
