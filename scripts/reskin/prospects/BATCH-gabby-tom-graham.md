# Batch build log — getfitgabby, trainedbytr, grahamhalliday

Three-tenant parallel batch, started 2026-10-19T19:29Z. Learning-loop run: log every
bottleneck, rework loop and process failure with root cause and fix, same
format as BATCH-ggeorge-jamiebarker-faisal.md.

## Prospects

| Handle | Name | Shape | Qualifier verdict | Admitted via |
|---|---|---|---|---|
| getfitgabby | Gabby Moriarty | E15 athlete, coaching via GoCardless, linktree | REVIEW (owned-url check) | --force (manual clear) |
| trainedbytr | Tom Redmond | Official @hyroxuk coach, TransFit Widnes, dead domain | REVIEW (UK unconfirmed + owned-url) | --force (manual clear) |
| grahamhalliday_ | Graham Halliday | Owner Elation Fitness Glasgow, E15 athlete | REJECT (no coaching offer in bio) | --force (gym lane — bio scan can't see ownership) |

## Timing

- T0: 2026-10-19T19:29:44Z (first command)
- Build time: prepare→BUILT per handle from pipeline.json stage_log
- Total time: T0 → pitch_ready (--complete)

## Bottlenecks / fixes log

| # | Problem | Root cause | Fix | Status |
|---|---------|-----------|-----|--------|
| 1 | Pipeline refused all 3 prospects | `prepare` admits only qualifier PASS; manually-cleared REVIEW/REJECT prospects had no path in | Added `--force=` flag to prepare; forced handles recorded in pipeline.json | FIXED |

## Per-site QA findings

(append as they come in)

### Gabby (`getfitgabby`)

### Tom (`trainedbytr`)

| Problem | Root cause | Fix |
|---------|-----------|-----|
| `apply-thumbnail-index` failed: ratings keyed but fields missing | `required` list includes `notes`, `subjects`, `station` etc. — any absent key = "missing" | Backfilled absent fields; rerun applied all 88 |
| Station slots had zero clean candidates — every station reel (`DaTOJf`, `DcQVI7`, `DcvF4`, `DePU`) carries burned-in coaching captions | Tom's station content is all caption-overlay coaching reels | Mined deep cache (`sled`/`burpee`/`ski`/`row`/`wall` caption scan), ran `video-frame-sheet.py` on `DdI7kuTOIK-` (real burpee broad jump), `Db58fwTInuf` (real SkiErg at HYROX event), `Dd5yxRiOdvA` (real rower); sled-push/pull/carry/lunge/wall-balls left for stock auto-fill |
| `SHORTLIST_CHANGED_USE_TARGETED_BACKFILL` after adding reels post-export | shortlist.sha256 mismatch by design | Manual `bright-export-assets.py` backfill with `/tmp/igenv/bin/python` (system python lacks imageio_ffmpeg), `--index-only`, re-apply, rewrote hash via node |
| Allocation review pass 1–3: bike/talking-reel frames, near-black class frame, talking-head carry | Reel frames are lottery — covers mislead | bike→real coaching frame, sprint→burpee jump frame, wallball→sandbag-crew frame, carry→sled frame, rope→sled-push frame, night→dark class frame |
| Weak pool: `treadmill`, `momentum`, `half` all talking-head "Day N/100" reels; `predictor-hero` a group gym shot; `finish`/`pb-venue`/`race-revel` carry promo overlays | Thin 120-post pull + promo-heavy content | Flagged in approval notes for reviewer — no better candidates exist in the pool |

**Status: WAITING_FOR_ALLOCATION_REVIEW** — `allocation_verified: false`. Final sheet: `scripts/reskin/prospects/batch-oct19/trainedbytr/allocation/allocation-1.jpg`.

**Reviewer correction pass 4–6:** confirmed `Db58fwTInuf` was a StairMaster, not a SkiErg, and `Dd5yxRiOdvA` did not read clearly as a rower. Removed both false station classifications from the allocation. Omitted every unresolved wrong/overlay slot rather than fudging it: `skierg-laugh`, `wallball`, `carry`, `startline`, `splits-hero`, `coaching`, `pb-venue`, `race-revel`, `bike`, `treadmill`, `momentum`, `run-compromised`, `track`, plus `finish` (LAST CHANCE overlay) and `events-secondary` (StairMaster). Omitted `station-skierg` and `station-row` because the available shared stock was bright/face-visible rather than the requested dark no-face fallback. Explicit vetted stock shown in the final sheet for sled-push, sled-pull, farmers-carry, sandbag-lunges and wall-balls. Deleted stale `allocation-2.jpg` left behind by the sheet renderer after the active roster shrank.

### Graham (`grahamhalliday_`)
| 2 | prepare ran ~19 min serially (Bright pull + 3x serial contact-sheet renders) | Serial python loop per finalist | Parallelise contact-sheet renders (or run prepare per-handle in 3 shells) | OPEN |
| 3 | `--resume` iterates ALL finalists — parallel agents can trigger each other's stages | No per-handle filter on resume | Add `--only=handle` flag to resume | OPEN |
- Agents launched 2026-10-19T19:52Z (3 parallel: gabby / tom / graham)


### Graham (`grahamhalliday_` / elationfitness) — pitch strategy

**Core angle: we are not selling Graham a coaching website. We are selling a celebration of the athlete.**

Graham's Instagram has ~60 strong professional HYROX event photographs — finish lines, station action, the 114K "AGAIN" sled post, the overhead floor shot. His site should feel like a Nike athlete page, not a PT booking form. The images and his own philosophy ("You can do everything right and still fall short. But if you keep showing up...") are the product differentiator.

**Why this works on Graham specifically:**

1. **Pride** — He sees himself presented the way professional athletes are presented. Not on Instagram competing with ads. On his own platform, curated deliberately.
2. **Legitimacy** — Instagram says "content creator." A standalone platform with race tools, split analysers, event integration and coaching funnels says "business."
3. **Permanence** — Instagram buries posts. The 114K "AGAIN" post is already sliding down his grid. On his site, it's the centrepiece of his athlete story. The Rome carousel isn't competing with an algorithm — it IS the stations page.
4. **His own words** — The tagline quote is from his most viral post. Not marketing copy. His voice, his philosophy, presented back to him on his own platform. That's the moment he stops thinking "do I need this" and starts thinking "this already feels like mine."

**The line:** "This isn't a website — it's what your Instagram should have been building towards all along."

**Image-specific call-outs for the walkthrough:**
- Hero: his actual HYROX finish line, arms wide, Red Bull stage, photographers
- Athlete story: the "AGAIN" sled shot with his own 114K-engagement quote
- Splits: him face-down on the arena floor, having given everything — then the data tool
- Every station: his own sled push, rowing, burpees, SkiErg, farmers carry, sandbag lunges, wall balls — not stock
- Predictor: his 54:42 on the results board
- Find a partner: him running with Hannah
- Results: him and Hannah beside the 1:00:41 PB board

**Pitch file:** `scripts/reskin/elationfitness.pitch.json`

---

### Graham (`grahamhalliday_` / elationfitness) — build log

- Config created in chassis mode with the Elation gym/community lane, ambient hero, hidden nutrition, real memberships and sponsor links.
- Pool is athlete-heavy and thin on unambiguous gym-community/station coverage; exact sled-pull and farmers-carry need vetted stock fallback.
- First resume partially exported before failing because `subjects` ratings were strings; fixed shortlist and visual-index subjects to arrays and resumed.
- Shared batch resume was temporarily blocked by trainedbytr incomplete thumbnail ratings (parallel-agent collision); Graham now reaches `WAITING_FOR_VISUAL_APPROVAL`.
- Pipeline cannot render allocation while approval remains `decision: REVIEW` / `approved: false`: prospect-pipeline.js lines 435-437 stops before allocation, while the task explicitly forbids setting BUILD. Allocation review therefore needs the parent/reviewer to resolve this gate contradiction.
| 4 | Agents blocked on visual-approval gate — told `decision: REVIEW` but allocation sheets only render after `approved:true`+`decision:"BUILD"` | My agent prompt was wrong: the eyeball gate is `allocation_verified`, not `decision` | Corrected agent instructions: set approved+BUILD, keep allocation_verified false | FIXED (instruction) |
| 5 | video-frame-sheet.py invocation failed | Stale one-arg usage in prompt; real interface is `<records.json> <shortcode> <outdir>` and needs `/tmp/igenv/bin/python` (system python lacks imageio_ffmpeg) | Pass correct usage; consider wrapper script or default-python check | OPEN (tooling) |
| 6 | Tom's resume failed: `shortlist.images` lacked per-image ratings | Requirement lives in apply-thumbnail-index.js + old batch log, not in shortlist.json instructions | Add "fill shortlist.images with honest per-image ratings" to shortlist.json instructions template | OPEN (tooling) |
| 7 | Tom's allocation passed agent review but failed human eyeball — station-skierg was a StairMaster, station-row unclear, wallball/carry/startline/splits-hero wrong content | Agent verified frames but misread machine types + let promo-overlay images into visible slots | Human review caught it; reinforce "verify the FRAME shows the station" — machines confused. Rule: overlays (DUBLIN EARLY ACCESS, PREVIOUS RESULTS, 1-1 COACHING, Day N/100 subtitles) auto-reject from visible slots | OPEN |
| 8 | Agent prompts contained stale/wrong gate info + stale script usage (items 4-6) | Prompts written from memory, not from pipeline source | Fix prompt template: approved+BUILD is the pre-allocation state; allocation_verified is the eyeball hold; video-frame-sheet.py = `/tmp/igenv/bin/python scripts/video-frame-sheet.py <records.json> <CODE> <outdir>`; shortlist.images needs honest per-image ratings incl. `notes` key | FIXED in prompts |
| 9 | Resume of Graham agent was interrupted mid-send (user interrupt) | Human interrupted the resume call | Re-issue resume | OPEN |
| 10 | prospects/ is gitignored → read tool can't open allocation jpgs directly | .gitignore blocks file tools on the whole tree | Copy sheets to /tmp for review; long-term: keep review copies outside ignored path or use a reviewer script | OPEN |

## Eyeball review notes — Tom (2026-10-19 ~21:45Z)

Keepers: hero, race-mate-hero, events-hero, detail, half, bio, coaching-hero, predictor-hero (weak but acceptable).
Fix list sent to agent: station-skierg (StairMaster not SkiErg), skierg-laugh same, station-row verify, wallball (bag setup not wall balls), carry (seated people), startline (camera rig), splits-hero (photo of phone), remove overlays from coaching/pb-venue/race-revel/bike/treadmill/momentum/run-compromised/track.
| 11 | Station mislabels pass agent verification (StairMaster as SkiErg) — gestalt failure | Agents verify via text description, not visual recognition; no canonical reference to match against | DONE: created `chassis/images/station-cues.json` (per-station visual cues + known lookalikes + minEvidence=2) + `stationEvidence` field in visual-index schema; photo-sort enforcement below | IN PROGRESS |
| 12 | Human can pick 30 shots in 10 min off IG; pipeline spends hours on machine triage | Agents lack gestalt classification, brand taste, and the veto instinct | BACKLOG: (a) canonical reference library — 2-3 verified images per station for similarity matching + lookalike few-shot pairs; (b) adversarial second pass — reviewer agent whose only job is "prove this is NOT the station"; (c) larger tiles for station candidates; (d) HUMAN-PICK INTAKE: drop folder of user-picked screenshots into source/, skip triage/shortlist, go straight to index+sort — pipeline does naming/alloc/dedupe, human does judgment | BACKLOG |
| 13 | Quality/station prior: official event-photographer shots (Sportograf-style, arena framing) are strong positive markers for both station correctness AND quality | Pro photogs shoot real stations in real events | Logged as positiveMarker in station-cues.json; rater should treat event-shot candidates as higher prior — BUT must check watermark/EXIF provenance (Sportograf stock was previously rejected for license) and note it | DONE |

- Allocation correction pass: frame sheets generated for DVwRLIOCJ2Y, DVxxOSpCDVO, DZ7vvJYiAkv, DZVZnrEoDZ5 and DXE5ROciPGc. Removed misleading reel frames and screenshot/overlay assets.
- Omitted wallball, carry, splits-hero, startline, finish, track, bike, rope, momentum, half, night, sprint, run-compromised, squad-athlos and skierg-laugh rather than ship wrong content.
- Final active allocation is on allocation-1.jpg and is visually sane. allocation-2.jpg is a stale artefact from the earlier larger roster; every slot shown there is now omitted except detail, whose current clean image also appears on allocation-1.jpg.
- Stock auto-fallbacks used for station-skierg, station-sled-push, station-sled-pull, station-burpees, station-row and station-wall-balls. Real Graham images retained for farmers carry and sandbag lunges.
- Pipeline status: WAITING_FOR_ALLOCATION_REVIEW; allocation_verified remains false.

### Gabby (`getfitgabby`) — allocation review

- Reached `WAITING_FOR_ALLOCATION_REVIEW` with `approved: true`, `decision: BUILD`, and `allocation_verified: false`; no tenant build was run.
- First allocation sheet exposed seven false station classifications: runners were labelled SkiErg/row/carry, a group pose was labelled sled pull, an elevator selfie was labelled burpees, and a mirror selfie was labelled sandbag lunges. Removed every false claim rather than weakening the verification gate.
- Backfilled `stationEvidence` from `chassis/images/station-cues.json` on indexed station claims, but rejected those claims at the visual allocation gate when the actual tiles did not match the cues.
- Final allocation uses the vetted shared stock library for all eight station slots: SkiErg, sled push, sled pull, burpees, row, farmers carry, sandbag lunges, and wall balls. Stock paths are explicit in `approval.slots` so the actual stock appears in the review sheet.
- Omitted weak/wrong/overlay/UI-like slots instead of shipping fillers: coaching/predictor/splits/run heroes, finish, coaching, race-mate hero, race-revel, startline, sprint, track, PB venue, treadmill, bike, SkiErg laugh, wallball, carry, rope, momentum, half, and night.
- Rebalanced clean real imagery: genuine wall-ball event frame for stations hero; unique HYROX images for events hero/secondary; clean running image for run-compromised. Hero, bio, doubles, PB, race-pair, squad, detail and event imagery remain real Gabby content.
- Final current sheet from the first review: `scripts/reskin/prospects/batch-oct19/getfitgabby/allocation/allocation-1.jpg`. `allocation-2.jpg` was then a stale renderer artefact from the earlier larger roster.
| 14 | Build failed: omitImageSlots removed referenced slots — reskin-tenant.js still requires images/… references to exist in pages | omitImageSlots only shrinks the pipeline roster; it does NOT strip page references. Only 10 allocatable slots are unreferenced and safe to omit | Rule: omitImageSlots may ONLY contain {finish, pb-venue, race-revel, sprint, treadmill, rope, squad-athlos, detail, station-lean, walkin}. Referenced slots with no real candidate → assign nearest-context real image or explicit stock path in approval.slots. Long-term fix: reskin-tenant should strip refs for omitted slots OR validate the config | OPEN |

#### Gabby correction pass 2 — real station frames + build

- Reviewer rejected the first stock fallback set: visible Lauren Weeks/name-on-kit imagery, an Army-shirt male and an outdoor male SkiErg were all non-conformant for Gabby's demo.
- Deep-post station hunt generated frame sheets for `DeKG_tMsikP`, `DUyk7MfDJfQ`, `DVtgbSKjKAU`, `DVOkZkxjIg4`, `DecUvHBsywh` and `Dd1mLe0svQD`. The `DeKG` station-breakdown reel, `DVtgb` Glasgow reel, `DVOk` training reel, `Dec` WOD reel and `Dd1` Elite 15 reel supplied real station frames; burned captions were cropped out where needed.
- Final station roster is now all real Gabby/Zara frames — no station stock remains: `DeKG_v1f08` SkiErg, `Dd1_v1f08` sled push, `DXCk_f3` sled pull, `DVOk_v1f54` burpees, `DXyp_f2` row, `DZpx_2` farmers carry, `DeKG_v1f62` sandbag lunges, `Dec_v1f77` wall balls.
- `omitImageSlots` was reduced to the allowed whitelist only: finish, pb-venue, race-revel, sprint, treadmill, rope, station-lean and walkin. All non-whitelisted slots were restored and assigned unique sources.
- Weak spots remain honest rather than hidden: `rooftop`, `suit`, `hoodie`, `detail`, `coaching` and `events-secondary` are nearest-context real images, not ideal semantic matches. Better Gabby lifestyle photography should replace them if supplied later.
- Regenerated allocation sheets were reviewed tile-by-tile: `allocation/allocation-1.jpg` and `allocation/allocation-2.jpg` are current. `allocation_verified: true` was then set.
- Batch `--resume` does build Gabby successfully, then exits 1 on the unrelated `trainedbytr` tenant, which still has missing assets. A direct `node scripts/reskin-tenant.js scripts/reskin/getfitgabby.demo.json` run also completed with exit code 0 and generated `getfitgabby/`.

## Problems & Fixes for Next Agent Run

### Critical: omitImageSlots did NOT strip page references (FIXED)

**Problem:** `omitImageSlots` in demo configs only affected the pipeline's allocation roster. `reskin-tenant.js` had no awareness of it — chassis pages still contained `<img>` tags referencing omitted slots. Builds either failed (strictImages scan) or produced broken image refs.

**Root cause:** The pipeline and the builder were designed independently. The pipeline's `omitImageSlots` was a roster concept; the builder's missing-image scan was a completeness check. Neither knew about the other.

**Fix:** Added omit-stripping pass to `reskin-tenant.js` (chassis mode, after asset copy, before missing-image scan). For each omitted slot, it removes:
1. Elements with `data-slot="<name>"` (full element + children)
2. Standalone `<img>` tags referencing the omitted image
3. `<source>` tags in `<picture>` elements referencing the omitted image

**Impact:** Global change — affects every future chassis-mode build. Safe because it only fires when `omitImageSlots` is set, and only removes references to files the config explicitly declares missing.

**For agents:** You can now omit ANY image slot, not just the 10 "unreferenced" ones. The builder strips the references. But omitting a slot still means the page loses that visual — prefer filling slots with nearest-context real images or conformant stock over omitting.

### Agent instruction bugs that cost time

| Bug | Impact | Fix for next run |
|-----|--------|-----------------|
| Gate confusion: told agents `decision: "REVIEW"` but pipeline needs `decision: "BUILD"` + `allocation_verified: true` | Agents blocked at allocation gate | Correct instruction: set `decision: "BUILD"` immediately after shortlist approval; the real eyeball gate is `allocation_verified` |
| Stale frame-sheet command in prompt | Agents couldn't extract video frames | Correct command: `/tmp/igenv/bin/python scripts/video-frame-sheet.py <records.json> <shortcode> <outdir>` |
| No whitelist documentation for omitImageSlots | Agents omitted 15-21 slots including referenced ones | Now moot (builder strips refs), but agents should still prefer filling slots over omitting |
| shortlist.images needs per-image ratings | Agent missed rating requirement | Include in agent prompt: each image in shortlist needs `{source, rating, slot, stationEvidence?}` |

### Visual review catches (why eyeball gate matters)

| Tenant | Issue | Catch method |
|--------|-------|-------------|
| Tom | StairMaster classified as SkiErg | Allocation sheet visual review |
| Tom | Wallball slot showed people unpacking bags | Allocation sheet visual review |
| Tom | Carry slot showed two seated people | Allocation sheet visual review |
| Tom | Multiple slots had burned-in promo overlays | Allocation sheet visual review |
| Graham | wallball.jpg was blank white | Allocation sheet visual review |
| Graham | carry.jpg was Gmail inbox screenshot | Allocation sheet visual review |
| Graham | splits-hero was phone screenshot | Allocation sheet visual review |
| Graham | finish.jpg was snack product shot | Allocation sheet visual review |
| Graham | track.jpg was shoe product shot | Allocation sheet visual review |
| Graham | Multiple slots had quote/promo overlays | Allocation sheet visual review |
| Gabby | 3 station stock images showed Lauren Weeks (recognisable rival athlete) | Allocation sheet visual review |
| Gabby | Stock images had wrong style (bright outdoor, visible faces) | Allocation sheet visual review |
| Gabby | Runners mislabelled as SkiErg/row/carry | Allocation sheet visual review |
| Gabby | Elevator selfie labelled as burpees | Allocation sheet visual review |

### Station cue verification (new this batch)

Added `chassis/images/station-cues.json` with per-station visual cues and lookalikes. Added `stationEvidence` field to visual index schema. Updated `photo-sort.js` to require ≥2 recorded visual cues for station slots.

**For agents:** When assigning a station slot, record which specific cues you observed in `stationEvidence`. The sort will reject station assignments without sufficient evidence.

### Event photographer marker

Photos by official event photographers (Sportograf etc.) are a positive signal for station verification and image quality. Logged as a prior in station-cues.json. Caveat: watermarked/EXIF-tagged images are fine for private demos but must be flagged for licensing risk.

### Future improvements logged

1. **Canonical reference image library** — 2-3 verified photos per station for similarity matching
2. **Adversarial second pass** — separate agent whose only job is to disprove station classifications
3. **Human-pick intake path** — user screenshots 30 images from IG, drops in folder, skips triage/shortlist
4. **Missing-slot early report** — flag at triage time which slots have no candidates, before sort
5. **Content hashes/build stamps** — prevent stale image-cache confusion

## Timing Log

| Phase | Started | Ended | Duration |
|-------|---------|-------|----------|
| Batch prepare (Bright Data + contact sheets) | 19:29 Oct 19 | 19:48 Oct 19 | ~19 min |
| Three agents launched (visual pipeline) | 19:48 Oct 19 | — | — |
| Tom: first allocation sheet | — | ~20:22 Oct 19 | ~34 min agent time |
| Graham: first allocation sheet | — | ~21:48 Oct 19 | ~2h |
| Gabby: first allocation sheet | — | ~23:30 Oct 19 | ~3h 42m (killed + restarted) |
| Eyeball reviews + correction cycles | 20:22 Oct 19 | ~00:30 Oct 20 | ~4h (multiple rounds) |
| Gabby agent final build | — | ~01:07 Oct 20 | — |
| Tom/Graham agents final build | — | ~01:05-01:07 Oct 20 | — |
| omitImageSlots bug discovered | ~01:10 Oct 20 | — | — |
| Builder fix + all 3 rebuilt clean | Oct 20 | Oct 20 | ~45 min |
| Lint + type-check + browser QA | Oct 20 | Oct 20 | ~15 min |

### Bottlenecks (ranked by time cost)

1. **Agent instruction bugs** (~2h): gate confusion + stale frame-sheet command blocked two agents. Fix: corrected prompts documented above.
2. **Visual correction loops** (~2h): agents passed wrong/mislabelled/overlay images. The eyeball gate caught them but each round was 15-30 min. Fix: station cues + stationEvidence requirement.
3. **omitImageSlots/builder mismatch** (~1h): builds failed or produced broken refs. Fix: builder now strips omitted image references from pages.
4. **Agent interrupts/capacity** (~1h): user interrupts killed agent listeners; one agent hit serving-model capacity. Fix: agents should be fire-and-forget with notification, not blocking waits.
5. **Bright Data post fetch** (~10 min): 120 posts × 3 profiles, serial. Acceptable.

### Comparison to previous batch

| Metric | Previous batch | This batch |
|--------|---------------|------------|
| Prepare time | Longer (first run) | ~19 min (faster, cached profiles) |
| Agent visual pipeline | Not timed | ~2-4h per agent (varies) |
| Correction rounds | Fewer (less strict) | More (eyeball gate + station cues) |
| Build success rate | Higher (fewer omissions) | Lower until builder fix |
| Final quality | Acceptable | Better (station verification, honest omissions) |
