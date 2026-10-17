# Chassis — neutral tenant base (agreed direction)

Decided: new tenants should be generated from a neutral "chassis" source
instead of patching the previous tenant (the Dina→Gregor→Josh inheritance
chain). Agreed approach and rationale below.

## Plan

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
The old pair path stays for roxjaya/racetoframe/joshharrison so they keep
regenerating identically.

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
- [x] Test tenant generated — `mayaokafor` (fictional, ambient hero):
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
