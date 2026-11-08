# Chassis — neutral tenant base (agreed direction)

## Before every build — checklist (read first)

Short version of the lessons below. The details are in "Build notes", "Template candidates" and "Nav zone colours".

1. **Build from the canonical chassis, not another coach's offer assumptions.** Do not inherit a prospect's programme names, durations, prices, memberships or affiliate codes. Supply that prospect's researched `coachingOffers` and `partnerOffers`; see the commercial-source contract below. `lint-overrides.js` can flag obsolete copy overrides, but a matching regex is not factual verification.
2. **Prefer structured offers to regex-built product cards.** The builder expands tokens in override patterns, but personalised overrides must still be tested against the actual generated output. Do not inject partner cards at a generic `shop-note` boundary: it also occurs on coaching and newsletter pages.
3. **Still-open template gap:** photo slot alt text and labels must match the supplied image. Kim needed a news-hero override because the stock `half.jpg` wording called a HYROX crew photo a half-marathon.
4. **Allocate `colors.zoneAccent`:** a dark complement of the signature colour, readable on white and on the dark menu. The chassis carries that colour into shared-benefit pages (Race Tools / Community / More) through `body.zone-acc`, so check the menu and the page accents together.
5. **Build command:** `node scripts/reskin-tenant.js <config> --output-dir=<new folder>`. The config goes first; there's no `--config` or `--help`. The folder must not already exist, so use `-1`, `-2` suffixes.
6. **Serve from a root containing a `<slug>` symlink** to the build, because pages use `/<slug>/…` paths. Hard-refresh (Cmd+Shift+R) after rebuilds, because images and CSS cache.
7. **Check in this order:**
   - no `{{TOKEN}}` left
   - no other tenants' names or ghost words in visible copy, generated JSON or HTML attributes (Paul, Michele, warriors, FITR, TrueCoach, WhatsApp…)
   - every image path resolves (lazy photos may report `naturalWidth=0` until scrolled into view; check the referenced files too)
   - every page returns 200
   - desktop and phone layouts, including the menu; wait for the hero reveal before judging the screenshot
8. **Keep sales copy and implementation notes separate.** Public pages should sound energetic, confident and specific to the coach — they are showing the prospect how good they look, not explaining how the demo was assembled. Do not put "supplied", "sample", "fictional", "unverified", "pretend", photo-slot notes or preview-rule explanations in visible public copy; use precise natural wording such as "walkthrough", "reference race" or "stays in this browser" only where the workflow genuinely needs it. Coach-only/private tools may keep concise caveats needed to explain local storage, approval or integration limits.
9. **Testimonials** only appear with 3+ distinct approved quotes. Don't pad them.
9a. **Masthead lockup (wordmark + `tokens.SIG`) — derive BOTH from evidence, never guess.** Before naming anything, gather the public self-presentation data points: IG handle and display name, gym/business name, how members actually refer to the place or person, and the shorthand already in use. The wordmark should be the name the coach already trades under — prefer *their* shorthand to invented forms: `@ggcoaching_` → GG (not "George Grayson Coaching"), `@getfitgabby` → GFG, `@apres.london` → APRÈS LONDON, `@trainedbytr` → TRAINED BY TR. If the evidence points at the full name (JOSH HARRISON, JADE), use it. When the data is thin or conflicting, improvise the most plausible name from what you have — and flag it for Chris rather than silently picking. Record the chosen wordmark/SIG and the evidence behind it in the config (a `brandingNote` field) so the next build can see *why*, not just *what*.

**Signature (`tokens.SIG`):** the wordmark identifies the site; the signature is the ownership stamp, always `by …`. Rule: **never restate what the wordmark already says.** Wordmark = full name (JOSH HARRISON) → `by Josh`. Wordmark = first name (JADE) → `by Jade Skillen` (add the surname). Wordmark = initials/abbreviation (GG, PAUL G) → `by George Grayson` / `by Paul Gillingham` (expand it). Wordmark = brand or place (APRÈS LONDON, ELATION, PMA, TRAINED BY TR) → supply the owner (`by Kim`, `by Graham & Matt`, `by Faisal`, `by TR`). Brand contains a surname (BURGON FITNESS, WILDER FITNESS) → drop it from the sig (`by Hannah`, `by Michele`). Partnerships sign first names. Mononym brands (`by Zara`, `by Gabby`) sign the mononym — repetition is unavoidable and acceptable. Cadence decides: a signature is what the person actually signs. `reskin-tenant.js` defaults SIG to `by <coachFirst>` and warns — that default is a floor, not the answer; set `tokens.SIG` deliberately per build.
10. **Use `ensure_ascii=False`** if a script rewrites a config.
11. **Time every build and watch for slowdowns.** Record the start and end time of each stage, and time the generator run with `time`. Put the times and anything that slowed the build into `scripts/reskin/BUILD-LOG.md` as you go, not afterwards. Before starting, read that file's "What to try next time" notes. Move fixes that work into this checklist.
12. **Build toolbox — use these, don't reinvent:**
    - `imageMap` in the demo JSON maps slots to original filenames; `extraCss` holds per-tenant CSS tweaks. Hand-edits to generated output are invisible to the build and get lost on rebuild — declare them instead.
    - `node scripts/verify-build.mjs <dir>` mechanically checks a built site (broken images, viewport overflow, heavy crops with before/after shots in `verify-shots/`). On macOS it also runs Apple Vision face detection (`scripts/facedetect.swift`) on cover-cropped images: a face caught PARTIALLY at the crop edge (ear in shot, chin cut) is always EYE-flagged — almost never good; a face entirely out of frame is a handover WARN — often intentional (action torsos, background shots). Zero faces = "can't prove safe," never a pass. Runs automatically at the end of `reskin-tenant.js` (`SKIP_VERIFY=1` skips); view every EYE shot before sign-off.
    - `node scripts/drift-check.mjs [slug]` rebuilds to /tmp and diffs against the live dir — shows which live files the build doesn't know about. Run before hand-editing an existing site.
    - `node scripts/bust.mjs <slug>` re-stamps `?v=` cache tags after a hand-edit, without a rebuild.

## Shared photo and caption treatment

- Editorial header photos use a `figure.guide-hero-photo` wrapper so the partial corner frame belongs to the image, not a replaced `img` element. Prep Club's main photo uses `guide-hero-photo prep-hero-photo` inside its card, preserving its existing image sizing and curved edge.
- Captions retain the real text, without generated `Fig. 01` prefixes or plate counters. Station labels retain their numbers but have no decorative slash before them. Do not remove breadcrumb separators or meaningful list numbering.
- Partners headers use `body.shelf--partners`, a compact right-hand image column and the supplied image's natural proportions. Never force every portrait into a shallow fixed-height cover crop. On phones the photo stacks without changing its aspect ratio.
- Local source crops must keep the intended head/action intact and feet clearly in or out. Remove captured app controls only where appropriate, never photographer credits; preserve the original in asset spares. Paul's Partners source is now a deliberate head/pointing-hand crop, with the original retained.
- Match the screenshot to the actual page/photo before editing: an arched frame is not necessarily a photo of an arch. Inspect the packed source before promising complete heads/shoes. CSS cannot recover pixels already missing from the file; request an uncropped source rather than claiming an aspect-ratio change fixed it.
- Check rendered pseudo-elements and image ratios on desktop and phone, not just stylesheet text. Regression tests in `tests/template-showcase.test.js` cover the Prep wrapper, Partners proportional sizing, figure-counter removal and station-slash removal.

## Commercial-source contract — mandatory for every pitch

- `coachingOffers` is the single list used for homepage and coaching-page cards. Each row requires `title`, `type`, `description`, `url`, `action`, and `sourceURL`; optional `price` and `features` must be supported by that source. One, two, four or six real offers are preferable to three invented ones. Prices include their billing period and minimum commitment where published.
- `partnerOffers` records actual destinations with the same required fields, optional `code`, and `affiliate: true` where applicable. Keep coaching collaborators, a coach's own store, client access, brand links, and compensated affiliate offers distinguishable. A brand homepage does not prove a discount or partnership.
- The builder validates HTTPS destinations and source fields, escapes card text, and renders the lists after legacy copy overrides. Programme buttons are explicit offer URLs, not `data-training-link="programmesURL"`: the old runtime hook overwrote distinct products with a generic coaching page. Legacy partner-card injections at `shop-note` are ignored when structured partner data exists.
- The neutral chassis no longer invents Race Ready, Foundations, six-week or twelve-week products to fill cards. Without researched offers it shows a neutral enquiry route, not a sellable multi-product catalogue. Do not ship a new pitch on that fallback without a commercial audit.
- Open every official hub, product page, form entry screen and published checkout using GET only. Check the final merchant, product, billing period and named coach/provider. Inspect the rendered page after JavaScript loads, not just config values, raw HTML or HTTP 200. A login/lead-video form is not a product page; a book is not a coaching subscription; a simulation is an event.
- Preserve affiliate tracking/referral parameters. An inactive short link or a 404 referral path needs a checked replacement and a record of whether attribution survives. Do not invent a coupon URL. Distinguish merchant bot challenges from broken DNS/certificates; never bypass either. Do not submit forms, apply codes, add items or make payments to verify a pitch without separate approval.
- Where source prices conflict, omit the price claim and record both values in `offerAudit`; ask for clarification rather than selecting one. Known examples: HTC headline £49 vs FAQ £150/month; Hannah HYROX Lite page £69/month vs linked Stripe £60/month. Michele's site currently fails certificate validation: official HYROX profile/social contact replaces dead routes, while historical Foundations details are preserved for confirmation, not presented as current.
- Keep exact, brief testimonial excerpts, names, provider context and `sourceURL` in `seedFiles["testimonials.json"]`. Three distinct sourced quotes are required by the existing renderer. Do not invent quotations to fill a carousel. Label book endorsements and app reviews as such; never turn them into personal coaching or platform testimonials. Per-quote source links render safely. Do not copy client portraits or before/after photographs without permission.
- Generated price/offer FAQs, all programme promotion entries and the Programmes launchpad follow the sourced offer list; audit them as well as the public cards. `prepareShowcase` must preserve explicit campaign destinations and use generic provider URLs only for missing values. Run `./node_modules/.bin/vitest run tests/template-showcase.test.js` for the regression tests covering that exact overwrite bug. Private Desk walkthrough records remain simulated examples, not imported provider records or proof of a live integration.
- Record `offerAudit`/`partnerAudit` checks and unresolved status in the tenant config and handover. Before sending a pitch, refresh time-sensitive prices, availability and codes. A landing page loading is not proof that a discount still applies.
- Regression checks: compare homepage/coaching card URLs against the source list after runtime scripts; check partner destinations and tracking; check the newsletter page for leaked affiliate-card injections; exercise desktop/phone layouts and source links; run strict images, missing references and the ghost gate. Paul remains a reviewed tenant-specific offer block; test him when shared code changes rather than overwriting that content.

Decided: new tenants should be generated from a neutral "chassis" source
instead of patching the previous tenant (the Dina→Gregor→Josh inheritance
chain). Agreed approach and rationale below.

## Original bootstrap plan (historical)

Current refresh path: Josh now uses the same neutral chassis mode as recent tenants. His original donor configuration is preserved as `joshharrison.donor.json`; `build-chassis.js` builds it into an isolated temporary directory and never overwrites the active Josh site or its tenant registration. The normal `joshharrison.demo.json` is the current site source of truth.

1. Keep `joshharrison/` untouched — it's a live demo and the regression
   reference for the chassis.
2. Fork the generated `joshharrison/` folder into `chassis/` (most complete
   feature set, already fully English and pronoun-consistent).
3. Tokenise persona values mechanically: `{{COACH}}`, `{{BRAND}}`,
   `{{CITY}}`, `{{IG_HANDLE}}`, `{{ACCENT}}` etc. Verification: `grep -ri
josh chassis/` must return zero hits.
4. Empty `images/` + a `REQUIRED.md` contract: fixed slot names (hero.jpg,
   story.jpg, coach.jpg + optional extras) so authored pages never change.
5. Then a full code review for dead machinery (WhatsApp deep-links,
   gender-reveal remnants, unused JS, styles.css + guide.css split,
   duplicated footer markup).

## Generator decision (agreed)

Add a slim "chassis mode" branch to `reskin-tenant.js`
(`if (cfg.mode === "chassis")`): token substitution + asset copy + menu
injection + feature toggles only — skip the regex pair engine entirely.
The old pair path stays for roxjaya/racetoframe and the isolated historical Josh donor. The active Josh demo now uses chassis mode.

- Chassis configs become ~30 lines of token values, not ~600 lines of
  regex patches.
- Unfilled tokens fail loudly (visible `{{TOKEN}}`); missed regex pairs
  fail silently (inherited persona text) — that's the main bug class
  this removes.
- Keep feature copy authored-but-neutral (no lorem ipsum); persona voice
  is filled per tenant and is the part we actually sell.

## Hero system lesson (learned on Josh, Oct 16)

The hero has THREE layers that each compute where the photo sits
independently: CSS (`hero--bleed`/`hero--full`), `app.js`'s runtime feather
mask (contain-math hardcoded — must skip `.hero--full`), and `emerge.js`'s
baked composite (has its own hardcoded gradient literals, ignores CSS
filters). Changing one without the others produces silent mismatches —
Josh's pillarbox was exactly this. In the chassis, collapse this into one
"hero mode" contract (ambient | full) that all three layers read from the
same flag, and treat bake gradient/scrim strength as a single token.

## Status

- [x] Direction agreed
- [x] joshharrison/ browser review by user (in progress)
- [x] Fork to chassis/ + tokenise — `node scripts/build-chassis.js`
      (recipe: `scripts/reskin/chassis.tokens.json`; regenerates Josh, tokenises,
      strips dead files, fails loudly on persona leaks)
- [x] Image contract — `chassis/images/REQUIRED.md` (auto-generated; 44 allocatable slots plus 2 protected crew defaults)
- [x] Dead files stripped — alt.css, coach.css, hero-reveal.js, scene.js,
      doubles.js, diary.js, confetti.browser.js (verified unlinked)
- [x] Chassis mode in reskin-tenant.js — `"mode": "chassis"` + `tokens` map +
      `assets` dir + `heroMode`; fails loudly on unfilled `{{TOKENS}}`; tenant
      record cloned from `chassis/tenant.record.json` (never the roxjaya record)
- [x] Hero contract — single `data-hero-mode="full|ambient"` attribute on
      `.hero--bleed`; CSS selectors + app.js mask check both key off it
- [x] Test tenant generated — `mayaokafor` (fictional, ambient hero; since
      removed — `testchassis.demo.json` can regenerate it on demand):
      all pages 200, zero tokens left, zero Josh-ghosts, images resolve
- [x] Voice slots marked — humour moments are explicit tokens, not inherited
      phrasing: `{{VOICE_DOUBLES_HOOK}}` (mixed-doubles line on find-a-partner),
      `{{VOICE_WEDDING}}` (card-removal joke), `{{VOICE_NEWS_TAKE}}` (third news
      item's take). Plus `cfg.news` — an array of feed items in the owner's voice;
      chassis ships 3 sample items by default so the feed never launches empty.
- [ ] Visual browser review of a chassis tenant (both hero modes)

## Voice & personality map — where a creator's character lives

Required voice tokens (build fails if unfilled): `{{TAGLINE}}`,
`{{HERO_TITLE_HTML}}`, `{{VOICE_DOUBLES_HOOK}}`, `{{VOICE_WEDDING}}`,
`{{VOICE_NEWS_TAKE}}`. The feed itself: `cfg.news` = 3 items in the
owner's voice (title / summary / take / link) — chassis ships 3 generic
samples otherwise.

Optional personality spots — already gender/persona-neutral in the
chassis; override per tenant via `copyOverrides` if the creator's voice
wants something different:

| Spot            | File                  | Current hed/copy                                               |
| --------------- | --------------------- | -------------------------------------------------------------- |
| Hero motto      | index.html            | `{{HERO_TITLE_HTML}}` + `{{TAGLINE}}`                          |
| Story hed       | index.html            | "{{COACH_NAME}}. {{SEASON_START}} to …" — stat-led, fine as-is |
| Rulebook hed    | index.html            | "The stuff that's not in the rulebook."                        |
| Matchmaker copy | find-a-partner.html   | voice tokens + "The coach is the matchmaker, not an algorithm" |
| Crew hed        | race-crew.html        | "Eight stations done — one more: dinner."                      |
| Desk intro      | desk.html             | generic ledger copy                                            |
| Coach tone      | desk.js/coaching.html | demo framing lines                                             |

Gender rule: all copy is gender-neutral by default; division names
(Men / Women / Women's Pro) stay — they're HYROX categories, not persona.
A config wanting a deliberately gendered voice does it through the voice
tokens and copyOverrides, never by editing the chassis.

## Open follow-ups

- **Verify accent FAB actually visible on all sites.** Shipped in commit
  e1d74a0 (Oct 16) but not yet confirmed in a browser. Local tenants: hard
  refresh needed — stylesheets are only cache-busted per regen, so
  racetoframe/roxjaya may serve the old cached CSS until refreshed or
  regenerated. Dina's live site: pushed to `devin/gh-dossier`; if Railway
  deploys `main` it won't appear until merge — check which branch deploys.
- **Revisit hero "secondary fade"** — the ::after scrim gradient on
  hero--full; user parked the decision mid-tuning (currently ~18% max).

## Nutrition safety gate

Every chassis config can declare:

```json
"nutrition": {
  "mode": "standard | nutrition-led | hidden",
  "reviewed": false,
  "reviewer": "Coach or qualified reviewer name"
}
```

- `standard` keeps the generic race-fuelling guide for non-nutrition-led creators.
- `nutrition-led` requires an explicit `reviewed` boolean. `false` keeps the page available for private review but adds a prominent draft warning and `noindex`; `true` shows the named review approval. Omitting the check fails the build.
- `hidden` removes the Fuel page and its navigation links.

This prevents inherited nutritional guidance being silently attributed to a nutrition coach. A nutrition-led prospect must have the page reviewed or intentionally hidden before launch.

## Photo sort (scripts/photo-sort.js)

`chassis/images/slots.json` declares 44 allocatable slots plus two protected
crew defaults. `allocationOrder` is permanent and unique: homepage hero first,
then coaching/bio/product heroes, exact station positions, secondary content
and finally lifestyle. Every page-specific hero and every HYROX station has a
dedicated filename; generic filenames must never stand in for a different
station.

Do not export a whole profile. Generate thumbnail sheets, shortlist one obvious
candidate per active slot (a second only when genuinely close), plus at most ten
spares. Only those files are downloaded full-resolution. The visual ratings are made
from the contact-sheet thumbnails and carried into `visual-index.json`:
subjects, exact station, venue/event, quality 1–10, brand fit 1–10,
homepage-hero score 1–10, overlay, creator/face/crop safety, allowed slots and
rejection reason. Do not reopen downloaded originals: Apple Vision checks OCR,
faces/crops and duplicates automatically, then the rendered site is the final
visual check. Carousel captions are never child-image evidence.

`photo-sort.js --index-only` adds Apple Vision face/OCR/classification and
perceptual-duplicate metadata to the downloaded shortlist only. Thumbnail
ratings flow into that index automatically; full originals are not reopened.
Normal photo-sort fills slots in permanent order with the highest-rated unused
compatible image. Losing hero candidates remain in the pool for later allowed
slots. Strict builds reject repeated sources, near-duplicates, missing critical
slots and text overlays. The protected crew dinner/dance images stay filled by
the template unless `customCrewAssets` is explicitly enabled.

Verification gate (added after the Jade pilot): every exported file carries a
verified `event` tag derived from `date_posted` matched against
`hyrox-event-windows.json` — never guessed from thumbnails. Before any build,
`prospect-pipeline.js` renders `allocation/*.jpg` contact sheets of the actual
downloaded files labelled by slot and stops at `WAITING_FOR_ALLOCATION_REVIEW`.
Build requires `allocation_verified: true` in `approval.json`. Thumbnail ratings
are triage only: video-frame exports never inherit a cover rating blindly, and
station slots must be confirmed against the real downloaded file (or flagged
`allowOffBrandFallback` when no true candidate exists in the pool).

Station verification (added after the Jade correction pass): every station
image needs `stationVerified: true` plus `verificationSource` of `fullres`,
`framesheet` or `stock` in `visual-index.json`; `photo-sort` hard-rejects
`images/station-*` slots without it. From batch-oct19: station claims also
need `stationEvidence` — ≥2 visual cues copied from
`chassis/images/station-cues.json` (which also lists known lookalikes, e.g.
StairMaster↔SkiErg). Stock is exempt (its `.meta.json` is the evidence).
Event-photographer shots are a positive prior but check watermark/EXIF
provenance. Contact sheets write `*-labels.json`
alongside the tiles — always copy label strings from that file, never
transcribe them off a tile (misread `l`/`L`/`m` shortcodes caused repeated
missing-label warnings). Shortlisted videos for semantic slots must be rated
from `video-frame-sheet.py` frames, not the cover. When a station slot has no
confident candidate after triage and backfill, first run a caption scan over
the deepest cached records (`sled`, `lunge`, `wall`, `carry`…) to mine
targeted posts; if the asset genuinely does not exist, prefer a
nearest-context coach shot over off-brand stock, and only use royalty-free
imagery that is dark/arena-branded with no visible faces — a correct but
bright gym stock photo reads worse than an honest event frame. Stock files
ship with a `.meta.json` carrying `stock: true`, `license`,
`station_verified` and `event: null`. Swapped slot images keep their
filenames, so stale browser cache (max-age 300s) can show the previous photo —
hard-refresh before declaring an allocation wrong.

Pipeline boundaries: `prospect-pipeline.js` is the production entry point.
`ig-scan.py`, `ig-triage.py` and `ig-pull.py` are legacy/manual fallbacks and are
never called by it. `apply-visual-review.js` exists only for migrating the Zara
pilot or an exceptional manual correction. `allocation-contact-sheet.py` and
`video-frame-sheet.py` are targeted QA/backfill utilities, not normal stages.
No normal path downloads a whole profile or indexes files outside the shortlist.

## Asset pipeline: scrape → triage → pull → sort

Captions are useless for picking photos ("Manchester" tells nobody
anything), so selection is visual, not textual:

1. `ig-triage.py <handle> <dir>` — thumbnails of the last ~48 posts tiled
   into `sheet-N.jpg` contact sheets, each tile labelled with its
   shortcode.
2. Human/agent views the sheets and names the picks ("DeM64xSu19i,
   Dd4gj47RotA") — one visual pass, no caption guessing.
3. `ig-pull.py <handle> <dir> --only CODE,CODE` — full-res fetch of just
   the picks (plus caption sidecars).
4. `photo-sort.js <dir>` — index + allocate into slots; `--apply` writes
   slot filenames, `--pin` locks known-good photos.

Pulling every post full-res is overkill and hits rate limits — the triage
step keeps the fetch to ~10–15 images per creator.

Triage details (learned the hard way):

- Bump --max to ~100 thumbs — cheap, they're small.
- Carousels tile EVERY node (`CODE_1`, `CODE_2`…) — the cover frame often
  isn't representative; the good shot is frequently frame 3 of 7.
- Video posts get a `[VID]` badge. When stills run thin, promising reels
  become photo candidates: `ig-pull.py --only CODE --frames 3` extracts
  3 stills per video via bundled ffmpeg — 1080p frames are pitch-quality.
- Video triage is early-signal, not blind: the [VID] tile shows IG's cover
  frame, so promising reels (creator mid-event, start pen, finish board)
  are spotted on the sheet before any frames are pulled. Talking-head
  covers rarely yield usable stills — skip those unless the caption tags
  an event.
- Video stills are a first-class source, not a fallback: --frames defaults
  to 3 stills per video, so picked reels automatically drop frame
  candidates (CODE_v1f1.jpg …) into the same pool photo-sort indexes.
  Poor still coverage? Pull more [VID] shortcodes — that's the answer,
  not a compromise.

## Video-still station accuracy (rule)

A reel often pans across SEVERAL stations in one clip — the cover frame's
shortcode says nothing about which station each extracted frame shows.
When a video still is used for a station slot, verify THE FRAME, not the
post: `CODE_v1f2` from a "HYROX day" reel can be a burpee even if the
cover looked like a sled. Every video frame must be reviewed on the frame
sheet and tagged to the station it actually depicts before it can fill a
critical slot.

## omitImageSlots (updated batch-oct19)

`omitImageSlots` in a demo config declares slots that have no usable image.
The builder now strips `<img>`, `<source>`, and `data-slot` element
references to omitted images from generated pages, so the build no longer
fails on missing files. Any slot can be omitted — the page simply loses
that visual block.

**Prefer filling over omitting.** A nearest-context real image or conformant
stock (dark/arena, no recognisable faces) is always better than a hole in
the page. Omit only when nothing honest exists.

## Build notes (learned on michelewilder, Oct 28)

Things that cost time on the first hand-built chassis tenant — read before
the next prospect build:

- **REQUIRED.md overstates the live contract.** `images/slots.json` declares
  ~46 files, but the chassis pages only *reference* ~27 (hero, coaching-hero,
  stations-hero, run-hero, the 8 `station-*`, splits-hero, predictor-hero,
  events-hero, race-mate-hero, doubles, race-pair, pb, startline,
  run-compromised, momentum, skierg-laugh, half, kerb, hoodie, coaching,
  carry, bio, wallball + `gallery/dance` and `gallery/restaurant`). The rest
  are pipeline-allocation slots — supplying them is harmless, but don't burn
  time force-fitting weak images into slots no page displays; stock or
  `omitImageSlots` is fine.
- **copyOverrides match post-token-substitution text.** Tokens resolve to
  the coach's name first, so patterns must target *output* strings
  (`"Michele coaches in United Kingdom"`), not `{{COACH_FIRST}}` source.
  Persona-name leftovers in chassis copy (e.g. `Michele Warriors` titles,
  `@{{SLUG}}warriors`, `group programmes on FITR`) must be overridden with
  the *resolved* name in the pattern.
- **`--output-dir` requires a new, empty path.** Rebuilding to the same
  staged dir errors out — iterate with `-1`, `-2` suffixes or delete the
  old dir. A `--force` flag or auto-suffix would help.
- **Verify order that catches the usual leaks:** build → grep `\{\{[A-Z_]`
  (tokens) → grep prior-tenant names + `warrior`/`fitr`/donor-brand terms
  (ghosts) → check every `images/` src referenced in html/js resolves →
  curl each page 200.
- **Config shape:** `michelewilder.demo.json` is the current best hand-built
  example — tokens, hero focus CSS, tenantGallery, trainingPlatform,
  news (sourced + draft takes), seedFiles (faq/results/athletes/roundups/
  partners), and alt-text overrides for every slot whose image doesn't
  match the chassis caption.

## Template candidates (learned on michelewilder review, Oct 28)

Review-session findings — candidates for chassis fixes, parked until Chris
approves. Currently worked around in `michelewilder.demo.json`.

- **DONE — `cfg.menu` silently no-oped.** `replaceMenu` matched the literal
  string `<ul class="menu" id="menu">`, but the chassis nav carries
  `data-booking-navigation`, so menu overrides never applied. Fixed in
  reskin-tenant.js: marker is now a regex allowing extra attributes.
- **DONE — booking-entry strip removed.** The yellow "Book a session" strip
  under the hero duplicated the nav CTA. The div was *injected* by
  scripts/booking-planner.js (not just chassis/index.html) — the injection
  is now removed; heroes with a `hero-footer` still get the inline button.
- **DONE (Oct 28 rollout) — Grouped nav.** Michele's nav was regrouped to 6 items (Book · Find a
  race-mate · Coaching▾ · Race Tools▾ · Community▾ · More▾) via cfg.menu —
  order standalone links first, dropdowns together. If Chris approves the
  pattern, port it to the chassis default nav.
- **DONE (Oct 28 rollout) — Event card column gap too tight.** The `.event` grid uses
  `gap: 20px` — the date column reads as glued to the event name. Michele's
  config widens the date column to 120px + `column-gap` 48px (desktop only) — longer
  city names like MANCHESTER were overflowing the 90px column and eating the
  gap unevenly. Candidate for chassis styles.css. (Chris confirmed vertical
  line spacing was fine as-is.)
- **NOT DONE — wa-fab icon/label mismatch.** (Still a WhatsApp glyph in chassis/app.js linking to Instagram.) The floating "Message" button uses a
  WhatsApp-style glyph but links to the coach's Instagram. Either swap the
  icon, or add a cfg flag to disable the floater per tenant.
- **NOT DONE — Hero text block.** Portrait/square heroes need `.hero--bleed h2` width
  constrained + `object-position` nudges to keep copy off the subject's
  face — currently hand-rolled per tenant in extraCss. Candidate: a
  `heroTextWidth`/`heroImagePosition` cfg field so configs stay declarative.
- **NOT DONE — `PB_HALF` assumes a half-marathon stat.** (chassis/index.html still says "Recorded half-marathon"; override it per tenant.) Coaches without one end up
  with a wrong "Recorded half-marathon" label (Michele's 1:23 is a HYROX
  finish). Candidate: rename tokens to generic STAT1/2/3 + label tokens.
- **DONE (Oct 28 rollout) — Nav "Links" label points at shop.html.** The chassis nav item says
  "Links" but the target is the shop page — relabelled "Shop" in Michele's
  menu; check the default nav label.
- **DONE (Oct 28 rollout) — Sticky CTA bar overlaps the hero CTAs.** `#sticky-cta` appears as soon as
  `.hero` leaves the viewport, but the `.hero-below` CTA bar can still be on
  screen — two identical "Coach with X" buttons at once. Michele's config
  patches the observer to wait for `.hero-below` too, and renames the bar
  button to match the hero label ("Coach with", not "Train with").
  Candidate: observe `.hero-below` in chassis app.js.
- **DONE — testimonials.json is safe empty — and now has a quality gate (rule,
  Oct 28).** `#athletes-say` only renders with **three or more distinct
  quotes** (deduped on quote text). One or two approvals aren't enough —
  the panel stays hidden rather than padding with filler. Don't seed
  unapproved client quotes just to fill it.

- **NOT DONE — Race-crew dance floor isn't one switch (found on coachedbykim intake, Oct 29).** "Station 10 — the dance floor" is its own section, but dancing is also mentioned in the hero copy, race-weekend editions, fine print, meta description and FAQ/structured data. Dropping it for a coach takes several copy overrides. Candidate: make dancing a single toggle that strips every mention.

- **NOT DONE — persona leftovers still in the chassis (found Oct 29).** `coaching.html` meta still says "group programmes on FITR, and the {{BRAND}} 365 clothing line"; `app.js` still says "a photo for the Warriors Wall"; TrueCoach is named in several places. Every tenant has to override these. Candidate: neutral wording in the chassis.
- **NOT DONE — dead copyOverrides pile up (found Oct 29).** Configs copied from an older tenant carry patterns that no longer match: Michele's config has 61 dead of 197 (52 are Paul leftovers), Paul's 18 of 205, Tom's 4 of 18. Run `node scripts/reskin/lint-overrides.js <config>` and prune before building. Candidate: have reskin-tenant.js warn on unmatched overrides.

## Rollout (Oct 28 — Chris approved)

Chassis + all eight video tenants + paul + michele now carry: grouped
six-item nav (Book · Find a race-mate · Coaching▾ · Race Tools▾ ·
Community▾ · More▾), no booking-entry strip (removed from
booking-planner.js injection), "Coach with" sticky CTA that waits for
hero-below, 120px/48px desktop event cards, and a 3-distinct-quote gate
on #athletes-say. The eight repo dirs were PATCHED in place (not rebuilt)
to preserve hand-edits like trainedbytr's crew-photo; a rebuild produces
the same result since the chassis now carries everything. Michele's
config-level workarounds were removed — she inherits the template.
Minimal-nav pages (watch/podcast/shop/training = "Home" only) were left
as-is; revisit if they should get the full nav.

## Nav zone colours (Oct 28 — Chris approved, G&H pattern generalised)

Three contiguous colour blocks, no reordering: BLACK action pair (Book a
session, Find a race-mate) · signature nav-sell (Coaching▾) · nav-acc on
the three benefit drawers (Race Tools▾, Community▾, More▾). Implemented
via `--zone-accent` in chassis/styles.css + `.nav-sell`/`.nav-acc` classes
in the nav markup. EVERY tenant MUST allocate `colors.zoneAccent` in its
config — a dark COMPLEMENT of the signature colour, >= ~4:1 readable on
white AND on the dark menu (bright golds/ambers fail on white; go darker,
e.g. #b45309 not #e6b83d). Shared-benefit pages are tagged `body.zone-acc`
by the generator and should reuse the accent for page markers/headline
emphasis rather than looking identical to the coach-offer pages. Allocated: tr #b45309, zara #15803d, jade #7c3aed, jamie
#0e7490, graham #1d4ed8, faisal #1d4ed8, josh #0f766e, gabby #0e7490,
paul #1d4ed8, michele #be123c (deep rose vs her teal; set in config at end of the Oct 28–29 session, not yet seen in a browser), coachedbykim #258176 (muted teal; readable on the dark menu and white). Default #b45309 stands until a tenant sets its own. When writing configs from Python use `ensure_ascii=False`, or em dashes and curly quotes turn into `\u` escapes (harmless, but unreadable diffs). The
nine built dirs were patched in place; chassis emits the classes + var
natively. G&H's bespoke nav is the superset version (their sells = Shop·
Podcast·Coaching in signature blue, actions black, drawers amber) and is
documented in HANDOVER.

## Speedup backlog (post batch-3)

- `--force` / auto-suffix on `--output-dir` for staged rebuild iteration
  (michelewilder build, Oct 28).

- `reskin-new.js <handle> <name> <ig>` — scaffold a demo config + approval
  skeleton from a template instead of hand-writing each `*.demo.json`.
- Sheet-aware shortlist assist — pre-bucket labels by verified event /
  video flag / caption keywords so slot assignment starts from a sorted
  table, not 500 raw shortcodes.
- Content-hash (or build-stamp) query strings on image URLs — same
  filename + different bytes caused stale-cache confusion mid-review.
- "Missing slot" report at sheet stage — flag "no sled-push candidates
  seen" at triage instead of discovering it at allocation.
- Batch prepare + parallel builds are live (tenants.json lock in
  reskin-tenant.js); remaining serial step is the eyeball gate by design.

### Build quality and review improvements — proposed

Recorded from Chris's build-tooling discussion. This is a backlog, not authorisation to install services, change the chassis, rebuild tenants or deploy. Inspect existing capabilities before adding replacements: batch agents, contact sheets and Apple Vision photo indexing already exist.

Recommended order:

1. **Permanent Playwright acceptance suite and visual audit output.** Move useful staged-browser tests into the repository when porting approved Kim work. Parameterise tenant URL and use isolated synthetic state. Exercise real form submissions, deep links, notification clearing, repeated clicks, persistence and desktop/mobile layouts. Save HTML reports, failure traces and screenshots. Test shared changes against an isolated generated tenant before applying approved tenant maintenance. Keep screenshot baselines in a consistent browser/OS environment.
2. **Update the existing three-way select/build workflow for the approved chassis.** Locate its current agents/scripts rather than build another orchestrator. Give each build an isolated output directory; use Git worktrees when agents need independent code edits. Assign ownership of shared files: worktrees isolate edits but do not resolve merge conflicts. Never allow concurrent agents to overwrite the master or existing personalised outputs.
3. **One visual review link per batch.** Generate an audit/contact-sheet page with desktop/mobile screenshots of key pages and links to the actual previews and test reports. A contact sheet judges a new build; screenshot regression comparisons protect an already approved build. Neither replaces real interaction tests or explicit human approval. Approval must not automatically imply deployment.
4. **Pilot better photo framing, potentially Cloudinary.** Try subject/face-aware cropping and custom focal points on a small set of difficult approved images. Define desktop hero, mobile hero and card framing separately. Keep originals and source/rights records independent of the service. Do not apply `object-position: center 25%` universally: saving a face can still crop out the exercise or equipment. Automatic cropping does not verify movement, identity, suitability or rights. Check service costs and data handling before adoption.
5. **Improve existing image scoring and slot assignment.** Inspect current Apple Vision face/OCR/classification output first. Add only missing movement/quality/slot-suitability checks, using a vision API if justified. Select by suitability rather than URL order. Text-heavy graphics, prominent unrelated people and uncertain activity labels need review; do not blindly reject all group shots, which can be appropriate for community slots. Report missing suitable candidates rather than silently substituting the wrong exercise.
6. **Consider Argos after screenshot capture is reliable.** It integrates with Playwright for baseline/diff review and approval checks. Useful for shared CSS changes across approved tenants; it detects change, not design quality. Use synthetic data because screenshots/traces are uploaded. Evaluate costs, permissions and data retention before connecting it.
7. **Pilot Herdr only if supervision remains a bottleneck.** Potentially useful for agent status, persistent terminals, remote workers and helper reporting. The native app/herdr-core and Herdr TUI have separate servers and do not share running agents. Closing the app is not the same as reboot recovery; core-hosted processes stop on reboot and are not automatically resumed. Status visibility depends on agent protocol support. Validate compatibility with our actual agents before migrating; do not maintain two orchestration systems without a clear benefit.
8. **Obsidian is optional project-memory navigation.** If useful, view selected existing Markdown notes rather than duplicate them in another manually maintained source of truth. Link tenant approvals, decisions, known issues and Kim-versus-chassis port status. Keep executable configuration and build evidence in the repository/build records, not only in a vault.

Success criterion: each isolated build reports what changed, what passed, what needs visual review and what is approved. Record actual results rather than equating page load, screenshot generation or agent completion with acceptance.

References checked during the discussion:
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Playwright traces: https://playwright.dev/docs/trace-viewer
- Cloudinary image gravity: https://cloudinary.com/documentation/image_gravity
- Argos Playwright quickstart: https://argos-ci.com/docs/quickstart/playwright-quickstart
- Herdr app/core and TUI distinction: https://herdr.dev/

Local experimental acceptance suite at the time of this discussion: `/tmp/roxjaya-clientdesk-test/desk-acceptance.cjs`, targeting `/tmp/roxjaya-coachedbykim-20261029-final-10/`. These are temporary paths, not durable canonical tests; preserve/adapt them during the approved port rather than assuming they survive a restart.
