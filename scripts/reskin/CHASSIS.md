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
- [x] Image contract — `chassis/images/REQUIRED.md` (auto-generated, 31 slots)
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

| Spot | File | Current hed/copy |
| --- | --- | --- |
| Hero motto | index.html | `{{HERO_TITLE_HTML}}` + `{{TAGLINE}}` |
| Story hed | index.html | "{{COACH_NAME}}. {{SEASON_START}} to …" — stat-led, fine as-is |
| Rulebook hed | index.html | "The stuff that's not in the rulebook." |
| Matchmaker copy | find-a-partner.html | voice tokens + "The coach is the matchmaker, not an algorithm" |
| Crew hed | race-crew.html | "Eight stations done — one more: dinner." |
| Desk intro | desk.html | generic ledger copy |
| Coach tone | desk.js/coaching.html | demo framing lines |

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


## Photo sort (scripts/photo-sort.js)

The 31 image slots are declared in `chassis/images/slots.json` — each with a
label, preferred aspect, fill priority, accepted keywords, and a
`faceCritical` flag for shots where a cropped head is fatal (hero, bio,
finish board, portraits).

`node scripts/photo-sort.js <assetsDir>` indexes a folder of source photos
(IG pulls keep their caption sidecars, which become keyword text) and
greedily allocates them: priority order, each photo used once. Output marks
`ok` / `REVIEW` / `PIN` per slot; low-confidence picks (e.g. carousel
sub-images that share one caption) are flagged for human eyes rather than
silently placed — that was the miscrop/misallocation failure mode this
replaces.

`--apply <dir>` copies winners under slot filenames. `--pin slot=file`
locks a slot to a specific photo (e.g. Station 9's hero/bio stay put even
when the asset pile gets re-sorted).
