# Batch build log — ggeorge, jamiebarker, faisalpma

Three-tenant parallel batch, built 2026-10-18. Everything below is a real
failure we hit, why it happened, and what fixed it. Append per-site QA
findings here as they come in.

## Infra / pipeline problems

| # | Problem | Root cause | Fix | Status |
|---|---------|-----------|-----|--------|
| 1 | Three parallel builds could lose tenant registrations | `reskin-tenant.js` read-modify-wrote shared `data/tenants.json` — last-write-wins race | Lockfile + stale-lock recovery + atomic temp-file rename in both registration paths (commit `686e318`, pushed to `devin/gh-dossier` and `main`) | FIXED — 4-writer race test passed, 20/20 tenants intact after batch |
| 2 | New sites 404 at `/<slug>/` and `/<slug>/<page>/` after build | Site routes register per-tenant **at server boot** (`server/sites.js`); a server from the previous day held port 3000 and never saw the new tenants | Restart `npm start` after any batch | FIXED — add "restart server" step to the batch checklist |
| 3 | Partner links rendered as `www.everlast gyms.com` / `applied nutrition.com` — Safari can't open | `chassis/partners.html` built URLs as `https://www.{{PARTNER_*_LC}}.com/` but `_LC` tokens hold spaced display names. Global bug — affected Faisal, George, Jamie, **and live sites** (Jade `hilltop honey`, Zara `lskd`) | Chassis now uses explicit `{{PARTNER_GYM_URL}}` / `{{PARTNER_SUPP_URL}}` tokens; real URLs added to all 7 PARTNER_* demo configs | FIXED for the 3 new tenants; older live tenants keep broken baked links until next rebuild (rebuild sweep optional) |
| 4 | Three background agents cancelled mid-run | Subagent cancellation/staleness — pipeline left at `preparing` | Relaunched `prepare`/`resume` directly in background shells | WORKAROUND — prefer own shells for long pulls |
| 5 | 16 of George's shortlisted labels "not found" at export; 22 more at second pass | Shortlist labels were **transcription misreads** from sheet tiles (`l`↔`I`, `0`↔`O`, `DbD6`↔`DaD6`, `DZiS`↔`DZK58`), not missing posts | Fuzzy-match shortlist labels against canonical `contact-sheets/*-labels.json` before exporting; auto-corrected all 22 | FIXED — rule already in CHASSIS.md: copy labels from labels.json, never transcribe. Still happened twice → see speedup item (a) |
| 6 | `apply-thumbnail-index.js` required ratings in `shortlist.images`, not a hand-written `visual-index.json` | Misunderstood which file is the rating source — visual-index is an *output* of the apply step | Write `shortlist.images` keyed by exported label (parent label for `_fN` frames); run `apply-thumbnail-index.js` then `photo-sort --index-only` | DOCUMENTED here |
| 7 | `reskin-tenant.js` rebuild alone does NOT re-read `approval.slots` | Pipeline materialises `scripts/reskin/<slug>-assets/images/` from approval at build time; direct rebuild only mirrors the assets dir | To swap a photo post-build: update `approval.slots`, copy new file into `<slug>-assets/images/`, then rebuild | DOCUMENTED here — candidate for a `--resync-assets` flag |

## Image allocation problems (the eyeball gate doing its job)

### Jamie (`jamiebarker`)

| Problem | Fix |
|---------|-----|
| Shortcode typo `DUleWa7DFrs` (l not I) — 16 labels missing | Corrected to `DUIeWa7DFrs`, re-exported |
| 16 shortlisted labels outside initial 120-post pull | Targeted 200-post Bright Data backfill (not a full re-pull) |
| `DUscrKZjJNW_5` + `DUIeWa7DFrs_2` assigned twice | Rebalanced — same-source reuse is hard-rejected |
| `DdJFGzcimzt_5_f1`/`_f2`, then `_4_f1`/`_4_f2` same-video frame pairs | Replaced — same-reel frames count as near-dupes |
| `DeRaBbLqjBu_1_f1` had "ChatGPT: define hybrid" overlay mid-frame | Swapped carry → camp drill walk frame |
| `DdJFGzcimzt_5_f3` assigned to sandbag-lunges but showed coach walking cones, no bag | Swapped to ball-slam stride frame as nearest lunge read |
| No real sled-push exists in his content | Approved stock fallback (no-face HYROX stock) — flagged in approval notes |
| Text-overlay files `DXotsSwDAke_3/5` | Rejected out of hero slots |

### Faisal (`faisalpma`)

| Problem | Fix |
|---------|-----|
| Reel `Dbz5eUHNpZr` caption said "wall balls + sled" — frames were actually **rope pulls**, not wall balls | Reclassified as sled-pull; wall-balls needed stock |
| `DdXDNv-ESmR_3` looked like a carry — was actually a **loaded sled push** | Reclassified; farmers-carry → US Army PD stock |
| `DcVlexLtYlI` frames = overhead double-pole pull — caption confirmed "ski" erg workout | Accepted as SkiErg (frame + caption corroboration), f1 used over blurred f3 |
| `DcnTY4cNNog` treadmill reel has "EVERYTHING IS MENTAL" burned into **every frame** | Both run-hero and predictor-hero swapped to clean shots |
| `DasZMFnjdj8_6_f1` (lakeside triathlon) landed on predictor-hero; `DasZMFnjdj8_8` (raw splits-table screenshot) landed on news hero `half.jpg` — user-flagged as bad photos | predictor-hero → treadmill gait-lab frame (`Dbc-tiRDfM0_16_f3`); half.jpg → HYROX-floor handshake (`DZUIgPWDd_7_10`); events-secondary → athlete mid-race (`DaF3ozWNeia_1_f1`) |
| No real wall-ball or farmers-carry imagery in 120 posts | Commons CC-BY 4.0 HYROX wall-balls (HybridFitty) + US Army PD kettlebell carry — flagged `stock`, no-face rule waived where faces visible (same precedent as wall-balls) |
| `stock-sandbag-lunges-hyrox.jpg` had Sportograf copyright EXIF despite CC claim | Rejected provenance, used Jade-approved stock instead |
| `STORE_URL`/`PROGRAMMES_URL` pointed at IG | → `pmafitness.fitr.training/p/PMAHYROX` (real programme) + `linktr.ee/pmafitness` (real hub) |
| Coaching offer copy generic ("{{BRAND}} 365 kit drop") vs his real offers (PMAHYROX on Fitr, PMA Method book, MC work) | CTAs point at real destinations; offer *copy* still template — open item for per-tenant copy pass |

### George (`ggeorge`)

| Problem | Fix |
|---------|-----|
| 22 shortlist labels were transcription typos, not missing posts | Auto-corrected via fuzzy match to labels.json |
| `hero` + `coaching-hero` were two near-identical purple squad group shots | coaching-hero → wall-ball coaching frame |
| `events-hero`/`events-secondary` were adjacent frames of the same crowd | events-secondary → HYROX squad photo |
| `predictor-hero` + `splits-hero` were adjacent frames of one treadmill shot | splits-hero → 0:59:41 finish-time board (literal splits); pb → finish-floor athlete; track → turf sprint strip |
| `race-mate-hero` was a female athlete — not George | Swapped to his outdoor run-club group |
| `sprint` carried a "WINDERMERE TRIATHLON chip time" overlay | Swapped to clean trail runner |
| `DbD6_h-iMQO`/`DXBxyMCGgJ`/`DbnKD5CEHw` label misreads | Corrected to `DaD6_h-iMQO`, `DXBxvyMCGgJ`; detail slot → Garmin watch shot |
| `DU_kPbUiJ44_5` assigned as `.jpg` but post is a reel | → `DU_kPbUiJ44_5_f1` |
| `Dbn3HG8oHOz_1` frames: f1 arena wall balls, f2 rower, f3 wall balls — caption-mixed carousel | Frame-verified: f1 → station-wall-balls, f2 → predictor-hero (rower erg) |
| `DZK58dyItvg_1_f2` real sandbag lunge, `_f3` real wall-ball throw | Real imagery used — no stock needed except farmers-carry (US Army PD) |
| `DeSNIZ-CJr9_4` rope-pull frames verified via frame sheet | station-sled-pull |
| `DaD6_h-iMQO_2_f1/f2/f3` triple assignment across skierg/skierg-laugh/carry | Same-reel near-dup rule → carry swapped to cyclists |

## Open items

- [ ] Per-tenant coaching offer copy pass — tiles still say generic chassis copy ("{{BRAND}} 365 kit drop", "Group Programmes"), not each coach's real offer names (e.g. George's Hybrid Program / 12-week run+strength / 1:1 online coaching / class booking; Faisal's PMAHYROX + PMA Method book + MC).
- [ ] Live tenants (Jade, Zara, Josh, G&H) carry baked broken partner links — one-off rebuild sweep optional, only when next touched.
- [ ] `--resync-assets` flag for `reskin-tenant.js` so post-build photo swaps don't need manual copy into `<slug>-assets`.
- [ ] "Restart server after batch" — add to build checklist or make site routes resolve tenants lazily at request time instead of boot.
- [ ] Jamie/George QA pass pending user review — append findings below.

## User QA findings (append as found)

### George — first pass (all FIXED + rebuilt)

| Finding | Root cause | Fix |
|---------|-----------|-----|
| "100k Ultra" stat sat under a "HYROX Birmingham" sub-label | The `PB_HALF` chip's caption was a copyOverride replacing "AJ Bell Birmingham Half" with "HYROX Birmingham" — mismatched pairing of value and label | Override changed to "Ultramarathon" so value+label agree |
| Headline read "George Grayson. first HYROX to 1:05…" — lowercase after full stop | `{{SEASON_START}}` = "first HYROX" is lower-case by design (used mid-sentence elsewhere); the h3 renders it straight after a full stop | Added copyOverride for that h3 pattern → "From his first HYROX to a 1:05 in one season." |
| Predictor-hero subject sat too low in frame | `Dbn3HG8oHOz_1_f2` is mostly arena floor with the athlete cropped at the top edge | Moved to `station-skierg` (its erg content reads well there per user) and predictor-hero now uses `DXcHWklCEOp_5` — athlete mid-jump on the Concept2 race floor |
| Sled-push station showed ergs, not a sled | `DU_kPbUiJ44_4` was vision-tagged `sled_push` (subjects included "prowler") but the actual content is athletes bent over mid broad-jump | → `station-burpees`, where the content genuinely fits. Sled push now `DYptWEoiAf1_2_f2` — woman driving a loaded sled down a track |
| Burpee station showed people standing on the race floor | `DXcHWklCEOp_5` was tagged `burpee` verified but is ambiguous race-floor crowd | Slot now holds `DU_kPbUiJ44_4` (see above); `DXcHWklCEOp_5` moved to predictor-hero where "athlete on the race floor" is contextually right |
| SkiErg station pic weaker than a pic elsewhere | `DaD6_h-iMQO_2_f1` is a motion-blurred reel frame; the predictor pic was better | Swapped as above — `Dbn3HG8oHOz_1_f2` is now the SkiErg station image |
| Farmers carry is US Army stock | No real carry in George's content | Keeping — user: "just about serves if needed". Still flagged `stock` in approval notes |

**Meta-problem logged (the important one):** four of these images carried `stationVerified: true` with confidence scores of 7–8 and were *wrong or weak*. The rating field was judging "is there plausible evidence" not "is this a good, well-framed photo of that station". Fix to build into the gate: every verified rating must carry a short **suitability note** (what's actually in frame + framing quality), and station slots prefer well-framed verified shots over merely-verified ones. Add `suitability` text field + `framing` score (subject-in-frame 0–10) to `photo-visual-index.schema.json` — tracked in speedup backlog.

**User idea — stock backup folder (endorsed, partially implemented):** keep a vetted stock library per station so a missing slot auto-fills instead of shipping a wrong image. `scripts/reskin/stock/` now exists seeded with the already-approved stock (farmers-carry, sandbag-lunges, sled-push, rower, arena, barbell, sleds). Remaining work — wire the allocation gate to resolve `stock/<station>` automatically when no verified candidate exists — is in the backlog.

### George — second pass (all FIXED + rebuilt)

| Finding | Root cause | Fix |
|---------|-----------|-----|
| Race-calendar hero showed a trail/road race, not HYROX | `events-hero` had no event-context requirement — any crowd/run photo scored | `requireEvent: true` added to events-hero + events-secondary in `chassis/images/slots.json`; George's now `DT_GyO4iPb3_8_f2` (HYROX finish zone) |
| News hero showed a village fun run | `half.jpg` (news hero) had the same gap | `eventPreferred` bonus scoring added; image now `DXcHWklCEOp_8` (athlete at HYROX finish board) |
| Run-zone pic "passable but not HYROX" | same as above; no verified HYROX running shot exists in his pool | `run-hero` kept (real race-run shot — running must be visible); `run-compromised` swapped to HYROX gym-floor frame `DeZuJXOI-ic_1_f2` |
| "Visit the store" went to IG on all three sites | The `{{BRAND}} 365` own-merch card is hardcoded G&H copy in the shared chassis; STORE_URL fell back to IG for tenants with no store | Card fully tokenised: `{{STORE_NAME}}`/`{{STORE_TAG}}`/`{{STORE_COPY}}`/`{{STORE_CTA}}`/`{{STORE_URL}}`, defaults preserve G&H copy. George→georgegraysonfitness.co.uk, Jamie→findyouredge.app (his actual coaching app), Faisal→linktr.ee/pmafitness |

## Engine changes hardcoded this round (all global)

1. **`stripBlocks` + `data-strip` markers** (`reskin-tenant.js`, both chassis files): any element with `data-strip="<id>"` can be dropped per-config via `stripBlocks: ["id"]`, matched with tag-depth awareness so nested divs don't cut early. First use: `store-card` on the index plan card + partners card.
2. **copyOverride token expansion** (`reskin-tenant.js`): `{{TOKEN}}` inside `copyOverrides` *patterns and replacements* now expands against `cfg.tokens`. **This was a silent bug — every existing override that used `{{COACH_NAME}}`/`{{SEASON_START}}` in a pattern had never fired.** Now they do, so rebuilt tenants may show copy shifts (all intended overrides).
3. **`requireEvent` / `eventPreferred` slot flags** (`chassis/images/slots.json` + `photo-sort.js`): requireEvent hard-rejects non-event-verified candidates (events-hero, events-secondary); eventPreferred gives +12 score to eventVerified photos (predictor-hero, splits-hero, run-hero, run-compromised, half, stations-hero).
4. **`framing` + `suitability` index fields** (`photo-visual-index.schema.json` + `photo-sort.js`): framing scores subject-in-frame 0–10 and feeds allocation score; suitability is a mandatory-style plain-English "what is actually in frame" note that also feeds keyword evidence.
5. **Stock auto-fallback** (`prospect-pipeline.js` + `scripts/reskin/stock/`): a required slot missing from approval auto-fills from `stock/station-<name>.jpg` — currently stocked: skierg-less set: farmers-carry, sandbag-lunges, sled-push, sled-pull, row, wall-balls (still needed: skierg, burpees). Auto-fills are recorded in the build result so the log stays honest.

### Jamie — first pass (STAGED — awaiting go to rebuild)

| Finding | Root cause | Fix |
|---------|-----------|-----|
| Homepage hero is a swim shot (goggles + cap) — wrong sport for a HYROX coach site | Allocation-gate error: `DYjVlMQjEdD_2` (his Ironman swim content) was hand-picked for drama without a sport-context check. The sorter didn't choose it — I did. | **Engine:** `forbiddenKeywords: [swim, goggles, pool, cycling, bike]` added to hero slot + `eventPreferred` on hero — a non-HYROX-sport photo now can't win hero again. **Image:** hero → `DUIeWa7DFrs_2` (rope slam mid-slam at a HYROX event) |
| "THE ATHLETE" section + Ask-circle show a women's EDGE team group — "is that her?" | `bio.jpg` = `DYjVlMQjEdD_1` — same post as the swim hero; I allocated the carousel's group tile, not a Jamie shot. Bio serves both the athlete section and the ask avatar. | `bio.jpg` → `DUQaFk8jMU1_1` (Jamie sprinting, face clearly his) |
| "first HYROX" lowercase after full stop in athlete headline | Same `{{SEASON_START}}` token issue as George | Same copyOverride added to Jamie's config |
| Jamie's head cut off on coaching page | `coaching-hero.jpg` = `DdqyworitKV_1` portrait, CSS `object-position: center` crops the high face | → `DdqyworitKV_6` (full-body mid-carry, face safely mid-frame); `_1` moves to `coaching.jpg` bg where crop doesn't matter |
| Split analyser hero is an unrelated crowd shot | `splits-hero` = `DYcY2eaDAp9_1_f3` spectators | → `DUIeWa7DFrs_7` — literally a "FINISH TIME 1:04:09" board |
| Wall-balls station shows a pull-up on an outdoor rig | `DdJFGzcimzt_5_f2` misclassified | → `stock/station-wall-balls.jpg` — first live use of the new stock fallback |
| SkiErg station shows a rope climb | `DeeWBAGCuoT_11_f3` is a rope climb frame | → `_11_f1` (overhead strap pull — nearest real SkiErg motion in his pool); `f3` correctly becomes `rope.jpg`; `skierg-laugh` gets the freed outdoor-rig frame |
| "Apply for 1:1" + "See programmes" buttons → his IG | `APPLY_URL`/`PROGRAMMES_URL` both pointed at IG — no real surface existed in config | → `findyouredge.app` (his actual coaching product). **Reviewed all three:** George → georgegraysonfitness.co.uk (apply + programmes), Faisal → apply=linktree, programmes=FITR PMAHYROX |

**Cascade note:** 21 slot moves staged in `approval.json` — the same-reel frames used across skierg/hero/rope are visually distinct scenes (noted in approval notes, not silent).

### Template/engine fixes (pass 3 — global)

| Finding | Fix |
|---------|-----|
| "first HYROX" lowercase after full stop on every tenant's athlete headline (Faisal confirmed) | **Root fix, not per-config:** `{{SEASON_START}}` is lowercase by design for mid-sentence use — chassis now renders `{{SEASON_HEADLINE}}` which defaults to a sentence-start sentence (`From ${SEASON_START} to ${PB_SOLO} in one season.`). Per-tenant headlines set for all three. George/Jamie's redundant copyOverrides removed. |
| Footer "News" + "UK scene" both → news page | "UK scene" link removed from all 12 chassis footers |
| Taper Zone page exists but isn't in any menu | Added under Race Tools submenu in all 18 chassis files |
| YouTube/TikTok footer links point at IG when tenant has neither | `data-strip="youtube-link"`/`"tiktok-link"` markers added; stripBlocks set on George, Jamie, Jade, Zara (both) and Faisal (TikTok only — his YouTube is real) |
| Warriors Wall section always hidden — `data/gallery.json` empty by design | Seeded 6 generic HYROX event photos (Wikimedia Commons, CC-BY) per site as "community picks", flagged as seeds in the JSON until real submissions land |
| Jamie: YouTube+TikTok tokens were his IG | stripBlocks hides both footer links |

### Jamie — pass 2 (shipped)

| Finding | Fix |
|---------|-----|
| SkiErg station showed overhead strap pull, not a SkiErg | `stock/station-skierg.jpg` — real Concept2 SkiErg photo (CrossFit, Commons) |
| Burpee station flagged again | `stock/station-burpees.jpg` — real HYROX Worlds burpee broad jump (Lauren, CC-BY) |
| Wall-balls showed pull-up rig | `stock/station-wall-balls.jpg` (from earlier pass) |
| News hero was a triathlon photo | `half.jpg` → `stock-arena.jpg` (HYROX arena wide) |
| Predictor-hero had "Thursday PM" burned-in overlay | → `DUIeWa7DFrs_3` HYROX race pair |

### Verification pass (what was actually checked, not assumed)

- **Eyeballed all 60 shipped tiles** (20 key slots × 3 sites from the built `*/images/` dirs, not the source pool) — caught 4 more real problems: Jamie predictor text overlay, George blonde-athlete coaching-hero (not him), Faisal splits-hero = adjacent frame of predictor-hero's treadmill reel, and Jamie dupe collisions (the build gate also caught `half`=`pb` itself).
- **Every external href extracted and curl-tested**: 12 partner/store/programme links — 11 resolve. `everlastgyms.com` times out (their site is slow/bot-blocking — domain verified official via search, opens in browsers). `castore.com` 403 = Cloudflare bot-block, fine in browser.
- **30/30 page routes 200** (index, coaching, stations-prep, predictor, splits, taper-zone, events, news, partners, run-zone × 3 sites).
- **Features**: gallery.json 6 items ×3; wall-photos section present; taper zone in nav; no UK-scene dup; yt/tiktok stripped where no account; headlines capitalised.
- **Lint clean** on all edited scripts. `tenants.json` 20/20 intact.

### Pass 4 — wall + cache-busting (global bugs found)

| Finding | Root cause | Fix |
|---------|-----------|-----|
| Warriors Wall never renders on ANY site | **Schema mismatch**: chassis `data/gallery.json` seeds key `items`, but `app.js` reads `json.photos`. Wall stayed `hidden` forever. Every tenant built from chassis had a dead wall. | Chassis + all three tenant assets dirs now seed `photos` array. Wall seeded with htcfisher's real crew/meetup pics (8 per site: Málaga crew, Istanbul podium, Glasgow, race-day pairs) until real submissions land. |
| Wall seeding wiped by rebuild | Per-tenant **assets dir** also carries a stale `data/gallery.json` and `imageOverrides` mirrors it over the build — seeding the tenant dir directly doesn't survive. | Seeded into `<tenant>-assets/data/gallery.json` + `images/gallery/` so rebuilds reproduce it. Lesson: never hand-edit the built dir; edit the assets dir. |
| User saw stale swim hero after fix landed | Server sends `Cache-Control: max-age=300` and image URLs never change between rebuilds — browsers serve the old file. Verification sheets were also rendered BEFORE the final rebuild, so they certified a pre-swap state. | **Content cache-busting now built in**: `reskin-tenant.js` appends `?v=<build ts>` to every `/slug/images/*` src/href (extending the existing css/js buster). Every rebuild = fresh URLs = no stale heroes. |
| Verification gap | Sheets generated from source pool/early state, not the shipped dir post-rebuild. | Verification step now = contact sheet of `tenant/images/` AFTER final rebuild + route/link sweep. Logged as process rule. |

- Faisal: resolved — wall live, headline fixed, links verified.
- George: wall live, all passes fixed, awaiting re-check.
- Jamie: wall live, hero confirmed serving rope-slam (hard refresh if cached), awaiting re-check.

## Speedup backlog (carried over — see CHASSIS.md "Speedup backlog")

a. **Preflight label validation** — script validates every shortlist label against `*-labels.json` and auto-corrects single-char misreads *before* export. Biggest time-cost this batch.
b. `reskin-new.js` config scaffolder.
c. Sheet-aware shortlist assist (bucket labels by verified event/video/keywords).
d. Content-hash query strings on image URLs (stale-cache confusion mid-review).
e. "Missing slot" report at sheet stage ("no sled-push candidates seen" at triage, not allocation).
f. Stage timing instrumentation in `pipeline.json` (still pending from earlier list).
