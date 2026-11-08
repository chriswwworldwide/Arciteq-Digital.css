# Build log — timings and optimisation notes

One row per tenant build, added when the build is handed to Chris. The point is to see which stages eat the time and whether each change to the process actually helps.

## George professional photo upgrade — staged only, 3 November 2026

Chris supplied 25 professional race-floor photos (George actually in frame). Placed as slot replacements in the staged preview: hero.jpg (head-on sled pull), gg-media-wall.jpg (Meet George arch — swapped the index figure src; race-day startline untouched), race-pair.jpg + pb.jpg (the two finish-board shots), predictor-hero.jpg (rope pull), race-mate-hero.jpg (finish-line crowd run), stations-hero.jpg (crew on the rigs, Fittest in the City), and all seven station slots now show George — station-row no longer a night-street photo, station-wall-balls now his CENTR-ball squat, etc. Remaining uploads filed in `images/spares-new/` and mirrored to `georgegrayson-assets/images/` (+`spares-new/`).

Also: removed all dead `watch.html` links across his pages (nav items, index showcase card, podcast hero button) — George has no Watch page by design; the config stripped `Watch` links but not `Watch & Learn` variants. One link survives inside coach-preview manage-videos only. Taper Zone gained a real hero (momentum.jpg moved up into `guide-hero-photo`, mid-page figure removed per Chris's instruction). Shop links-hero raised to 30% object-position. Josh's stations-prep "faceless movement reference" captions replaced with public copy (catalog.json + staged page).

Alt text rewritten for every replaced image (no unverified times/partner names on the board shots). Verified with screenshots at 390 and 1440: homepage sled-pull hero (desktop focal raised to 12% so head stays in), stations hero at 18%, predictor at 5% — heads all in frame. Config `extraCss`/slot sync into `ggeorge.demo.json` still pending Chris sign-off on the staged result. Staged only — nothing deployed or committed.

## Paul mobile fixes — Ask portrait collision + missing race-instrument hero — staged only, 3 November 2026

Chris flagged two phone issues on Paul's site (desktop checked too). Root causes, both confirmed:

1. **Ask section:** `.capture` shows `coaching.jpg` full-bleed behind a static circular `.bio` portrait; on phone widths the bg face sat directly under the circle. Desktop unaffected. Fix: phone-only `object-position:30% 75%` on `.capture-bg` (empirically tested — 30% clears the circle completely) plus config comment.
2. **Missing hero treatment:** chassis gap, not a Paul bug. Guidance pages load `guidance.css`, which owns the `.guide-hero-photo` curved bottom edge + partial pink corner frame. Race-instrument pages (`results.html`, `splits.html`, `predictor.html`) load `guide.css`/`race-instruments.css`/`showcase.css` instead, so the treatment never applied — AND `race-instruments.css` sets `.guide-hero-photo{display:none}` under 600px, so on phones those pages had no hero image at all (only a plain mid-page `.art-photo`, which is what Chris saw). Fix ported into Paul's `extraCss` scoped to `.race-instrument .guide-hero-photo`: relative positioning, `border-radius:0 0 48% 8%/0 0 7% 2%`, pink ::after corner frame, `aspect-ratio:16/9 max-height:420px` desktop / `16/10` under 900px, and `body.race-instrument .guide-hero .guide-hero-photo{display:block}` under 600px (extra specificity to outrank the later-loading `race-instruments.css`).

Fix lives in `scripts/reskin/paulgillingham.demo.json` `extraCss` (Paul-local, durable).

**Chassis fix — approved by Chris 3 November 2026, rolled to all 16 staged sites.** Correction to the diagnosis: `chassis/race-instruments.css` already carried the curve+frame rules (lines 13–15) and every staged tenant's copy was byte-identical — the desktop treatment worked all along. The real defect was the `display:none` under 600px, which left phones with no hero at all. Replaced with `.race-instrument .guide-hero-photo img { height:200px }` in the ≤600px block so phones get the same treated hero at a smaller height. Copied the fixed file to all 16 staged tenants in `/tmp/pitch-copy-review-2` (backups `/tmp/ri-before-hero/<slug>/`) and bumped `race-instruments.css?v=hero-mobile-20261103` on results/splits/predictor pages. Paul's earlier `extraCss` rules are now redundant but harmless (same output) — left in place as a documented local safeguard. Three tenants (burgonfitness, htcfisher, hyroxdoncaster) have no hero photo on results/splits — nothing to display, no regression. Spot-verified at 390: jadeskillen/trainedbytr/paulgillingham results heroes display, ~200px, curve+frame computed, images load.

Generator `/tmp/paul-hero-fix-review-1` exit 0, chassis provenance, 34 filled / 18 waived / zero unwaived gaps. Generated output is unformatted while the staged preview files are Prettier-formatted, so the fix was installed by patching `/tmp/pitch-copy-review-2/paulgillingham/styles.css` (appended rules, same content as config `extraCss`) and bumping `styles.css?v=hero-frame-crops-20261103` on index/results/splits/predictor — matching the existing `mobile-crops-20261103` named-key convention. Backups `/tmp/paul-before-hero-fix`. Browser checks at touch-sized 390 and 1440: computed `object-position:30% 75%` on capture-bg at 390 (50% 80% retained at 1440); hero photo now displays on all three instrument pages at 390 with curve + frame computed (border-radius `0 0 48% 8%/0 0 7% 2%`, ::after 56px/2px border), loads naturally, ~213–220px tall; same treatment confirmed at 1440 (250px hero). No page errors, zero horizontal overflow. Local staged preview only — no registry, deployment, commit or other tenant changes.

## Gabby + Zara supplied duo/taper photos — staged only, 3 November 2026

Targeted tenant maintenance across two pitches, no shared chassis change. Chris supplied the Warsaw posed duo shots plus a Zara beach run, Gabby lululemon rest pose and an IG screenshot of the track-session away day ("first away days of the season" per Zara's comment). The back-to-back Warsaw pose is now a find-a-partner figure on BOTH pitches (`images/partner-posed.jpg`, "Doubles is a different sport when the pair is real.") — alts name both athletes without assigning sides. Zara's beach run upgrades her `images/momentum.jpg` (previous 480×640 preserved at `coachedbyzara-assets/spares/momentum-prev.jpg` and `/tmp/zara-momentum-prev.jpg`; inherited "Track walk" alt replaced). Gabby's sit-down pose added as Taper off-day figure; track screenshot cropped with ffmpeg to `images/crew-track.jpg` and added to her race-crew before Station 10. Portrait figures forced to aspect-ratio:4/5 with focal positions so faces survive on the banded guide pages; calm-page rules prefixed to outrank the 21/9 default. Not installed: second Warsaw pose and the steps photo — retained in paste backlog, say the word if wanted.

Generators `/tmp/gabby-photos-review-1` and `/tmp/zara-photos-review-1`, both exit 0 (gabby 33/19, zara coverage clean; strict gates zero unwaived gaps). Browser checks at 1440 and touch-sized 390 on all five figures: natural loads, correct computed positions/ratios, faces intact, no page errors or overflow; each figure confirmed on its own page only. Installed into `/tmp/pitch-copy-review-2/{getfitgabby,coachedbyzara}` on :4323 only; backups `/tmp/gabby-before-photos`, `/tmp/zara-before-photos`. No registry, deployment, commit or other tenant changes.

## Faisal supplied race/cruise photos — staged only, 3 November 2026

Targeted tenant maintenance, no shared chassis change. Chris supplied three photos (the last two from the recent official HYROX cruise); all installed, none replaced — his momentum slot is already a strong stage/MC shot. Mid-race grin added to race-day.html before the "During the race" section as `images/race-smile.jpg`; big group selfie added to race-crew.html before Station 10 as `images/cruise-crew.jpg` ("This is the community — it turns up everywhere.") AND to taper-zone.html before the checklist ("Plan something that isn't training. It counts.") — Chris's intent: off-day/non-race photos belong in Taper content. Trio selfie added to coaching.html after the access-details note as `images/cruise-trio.jpg`; captions honestly label the official cruise, not a PMA event.

Crop iterations: first pass used `.guidance--calm` selectors which don't exist on race-day/race-crew (left defaults); second pass race-crew still sliced Faisal's face at the 16/9 band. Fixed with per-figure `aspect-ratio:4/3` + object-position, and a `.guidance--calm`-prefixed selector on taper so it outranks the calm 21/9 rule. Both figures now show his whole face at 1440 and 390. Faisal config carries a `365→positive` override, so new copy avoids "365".

Generator `/tmp/faisal-photos-review-1` real ~1s, exit 0, strict coverage 33 filled / 19 waived / zero unwaived gaps. Browser checks at 1440 and touch-sized 390: all three figures load naturally with correct computed object positions, faces intact at phone width, no page errors or horizontal overflow; figures confirmed on their own pages only. Installed generated `race-day.html`, `race-crew.html`, `coaching.html`, `styles.css` and the three images into `/tmp/pitch-copy-review-2/faisalpma` on :4323 only; previous files `/tmp/faisal-before-photos`. No registry, deployment, commit or other tenant changes.

## George supplied photos + Birmingham client-results credential — staged only, 3 November 2026

Targeted tenant maintenance, no shared chassis change. Chris supplied two caption screenshots plus three photos. Outdoor wrapped-up run now fills required `images/momentum.jpg` (previous shirtless doubles flex preserved at `scripts/reskin/georgegrayson-assets/spares/momentum-prev.jpg` and `/tmp/george-momentum-prev.jpg`; inherited "Track walk with the bottle" alt replaced with accurate text). Client celebration shot cropped out of the Instagram screenshot with ffmpeg (`images/gg-clients-birmingham.jpg`, 472×315) and added to coaching.html after the access-details note — George's coaching page has no coach-question aside, so the figure anchors on the "access details" paragraph instead. Cycling group photo initially skipped, then installed as second Taper Zone figure `images/taper-ride.jpg` ("Easy company miles beat another hard session this week.") once Chris clarified off-day/non-race photos are taper material. Meet George list gained a verified line from his own "client edition" post: 30-plus athlete results across one HYROX Birmingham weekend, PBs and debuts. Post lists ~25 named client results with times — strong extra pitch hook beyond his own 1:00:42/54:57.

Generator `/tmp/george-taper-photos-review-1` real ~1s, exit 0, strict coverage 29 filled / 23 waived / zero unwaived gaps. First build silently dropped the coaching figure (no aside anchor on his page); caught via generated-file grep, re-anchored, rebuilt. Browser checks at 1440 and touch-sized 390: both figures load naturally with correct object positions and faces intact, new credential line on homepage, no page errors or horizontal overflow. Installed generated `taper-zone.html`, `index.html`, `coaching.html`, `styles.css` and both images into `/tmp/pitch-copy-review-2/georgegrayson` on :4323 only; previous files `/tmp/george-before-taper-photos`. No registry, deployment, commit or other tenant changes.

## TR supplied coaching photos — staged only, 3 November 2026

Targeted tenant maintenance, no shared chassis change. Chris supplied five Tom Redmond shots; two installed, three skipped with reasons. Whiteboard coaching shot added as second Taper Zone figure `images/taper-planning.jpg` ("Nothing new in the last week — the plan is already written."); floor-direction shot added to coaching.html above the Ask aside as `images/coaching-floor.jpg` ("Sessions are coached, not just programmed."), anchored on the coaching-page-only "ask Tom for your access details" text because the aside itself is identical on every generated page — copyOverride `"file"` fields are not honoured by reskin-tenant.js, so patterns must be page-unique. Festival selfie initially skipped, then installed as a further Taper Zone figure `images/taper-festival.jpg` ("Do something that isn't training. It counts.") once Chris clarified off-day/non-race photos are taper material. Dumbbell-rack chat shot skipped — already in use as his momentum.jpg. Supplement selfie remains unused: nutrition module is hidden and no supplement partner exists. No file replaced; existing momentum kept.

Generator `/tmp/tr-taper-photos-review-1` real ~1s, exit 0, strict coverage 30 filled / 22 waived / zero unwaived gaps; stale `images/detail.jpg` waiver warning pre-existing. First build injected the floor figure on all 27 pages — caught, re-anchored on unique text, rebuilt. Browser checks at 1440 and touch-sized 390: both figures load naturally with correct object positions and faces intact, no page errors or horizontal overflow; figure confirmed absent from other pages. Installed generated `taper-zone.html`, `coaching.html`, `styles.css` and both images into `/tmp/pitch-copy-review-2/trainedbytr` on :4323 only; previous files `/tmp/tr-before-taper-photos`. No registry, deployment, commit or other tenant changes.

## Jade Taper Zone supplied photos — staged only, 3 November 2026

Targeted tenant maintenance, no shared chassis change. Chris supplied two real Jade photos; both beat the existing momentum slot, which was a 480×640 venue selfie mislabelled by the inherited "Track walk with the bottle" alt. The field/training shot (Jade checking her watch between athletes) now fills required `images/momentum.jpg` (previous preserved at `scripts/reskin/jadeskillen-assets/spares/momentum-prev.jpg` and `/tmp/jade-momentum-prev.jpg`); the post-session car selfie is the extra `images/taper-postsession.jpg`. Durable config adds two figure overrides with accurate alts plus scoped object-position CSS.

Generator `/tmp/jade-taper-photos-review-1` real 0.710s, exit 0, strict coverage 32 filled / 20 waived / zero unwaived gaps. Browser checks at 1440 and touch-sized 390: both figures load naturally with correct computed object positions and Jade's face intact, no page errors or horizontal overflow. Installed generated `taper-zone.html`, `styles.css` and the two images into `/tmp/pitch-copy-review-2/jadeskillen` on :4323 only; previous files `/tmp/jade-before-taper-photos`. No registry, deployment, commit or other tenant changes. Config file carries large pre-existing uncommitted work; this pass appended overrides/CSS only.

## Jamie Taper Zone supplied photos + camp credential — staged only, 3 November 2026

Targeted tenant maintenance, no shared chassis change. Chris supplied two photos from Jamie's HYROX/Red Bull coaches camp posts plus caption detail. The sunset group run now fills the required `images/momentum.jpg` slot (old 480×640 stock preserved at `scripts/reskin/jamiebarker-assets/spares/momentum-stock.jpg` and `/tmp/jamie-momentum-stock.jpg`); the football game-day portrait is the extra `images/taper-gameday.jpg`. Durable config adds two figure overrides plus scoped object-position CSS, and a verified Meet Jamie list line: one of 60 coaches selected worldwide for the Red Bull and HYROX coaches camp in São Paulo. Caption facts already present in `prospects/jamiebarker/qualification.json` (camp, Pro Doubles in Dublin next, ~4 years coaching, Nottingham industrial economics 2020, Find Your Edge ambassador). "HYROX 365" avoided in new copy because of the pre-existing `365→hybrid` override.

Generator `/tmp/jamie-taper-photos-review-1` real 1.206s, exit 0, strict coverage 32 filled / 20 waived / zero unwaived gaps; gallery warning (3 photos vs 4) pre-existing. Browser checks at 1440 and touch-sized 390: both figures load naturally with correct computed object positions and heads intact, new credential line on homepage, no page errors, failed Jamie resources or horizontal overflow. Installed generated `taper-zone.html`, `index.html`, `styles.css` and the two images into `/tmp/pitch-copy-review-2/jamiebarker` on :4323 only; previous files `/tmp/jamie-before-taper-photos`. No registry, deployment, commit or other tenant changes. Found and restarted a wedged :4323 python http.server (same command/bind) before verification.

## Michele Taper Zone supplied photos — staged only, 3 November 2026

Targeted tenant maintenance, no shared chassis change. Chris supplied two Taper/travel photos. upload-58 red-rocks recovery now fills the required `images/momentum.jpg` slot (old stock preserved at `scripts/reskin/michelewilder-assets/spares/momentum-stock.jpg` and `/tmp/michele-momentum-stock.jpg`); upload-59 stadium walkthrough is the extra `images/taper-venue-walkthrough.jpg`. Durable config adds the two figure overrides plus scoped object-position CSS; source files/manifest updated through upload-59.

Generator timings: first `/tmp/michele-taper-photos-review-1` real 0.884s, exit 1 — caught the required momentum slot being left unrendered by the new filename; final `/tmp/michele-taper-photos-review-2` real 0.767s, exit 0, strict coverage 31 filled / 21 waived / zero unwaived gaps. Existing stale waiver warnings remain for `images/finish.jpg` and `images/race-pair.jpg`; not introduced here. Browser screenshot checks at 1440 and touch-sized 390 inspected both crops, natural image loads and object positions, no page errors or horizontal overflow; installed collection ghost gate PASS. Installed generated `taper-zone.html`, `styles.css` and the two images into `/tmp/pitch-copy-review-2/michelewilder` on :4323 only. No registry, deployment, commit or other tenant changes.

## Homepage Back-scroll chassis + 15-site rollout — 3 November 2026

Stage window roughly 10:37–10:56 GMT. Canonical `chassis/index.html` gained the shared `__s9HomeScroll` checkpoint/helper; Paul's config no longer carries a duplicate bootstrap. Targeted staged homepages under `/tmp/home-scroll-rollout-2/<slug>`; only `index.html` differed from the existing 15 previews. Installed those files to `/tmp/pitch-copy-review-2/<slug>/index.html` and patched Paul's preview to the same helper; backups `/tmp/pitch-before-home-scroll-rollout/<slug>/index.html`.

Generator timings: neutral fixture `/tmp/home-scroll-neutral-template-3` real 1.152s but exit 1 at the pre-existing missing `links-hero.jpg`/`taper-hero.jpg` content gate; clean Paul `/tmp/home-scroll-master-paul-3` real 0.719s, exit 0, 34 filled / 18 waived / zero unwaived gaps. Fifteen-site staging/patching not a generator run; browser matrix other stages not separately timed.

Tests: template showcase 19/19. Chassis scroll checks passed at 1280/320/390. All 15 staged sites passed full Back/Forward, repeated-return, reload, direct-hash, hash-reload, retained-history-state and user-cancel checks at 1440 desktop and 390 touch; clean Paul passed the same pair. All 16 installed previews then passed a 32-check :4323 smoke. No deployment/commit/push or non-homepage staged changes.

## Paul Join the list mobile photo — live

Targeted maintenance, no wholesale build or timing: community header events-secondary.jpg top-aligned below 900px; desktop unchanged, image file untouched. Config and CSS updated, list.html cache key refreshed. Commit c6b916072185b37f4415f27218ce0aee5c7c22fd; Station9-only deployment 8f562748-bb16-48c5-8f2b-4ed828f78693 SUCCESS. Local backup /tmp/paul-before-list-mobile-crop.

Local/live 390 touch and 1440 desktop checks pass image loading, expected focus (0% mobile / 50% desktop), no overflow/errors. Phone screenshot inspected: both heads intact. Live screenshots /tmp/paul-live-list-crop-{390,1440}.png. Forms not submitted; source settings/other sites unchanged.

## Paul Conversations header/count cleanup — live

Isolated durable-source verification `/tmp/paul-conversations-clean-review`: generator real 1.823s, exit 0, strict 34 filled / 18 waived / zero gaps. Actual release is targeted maintenance: remove duplicate podcast header figure, single-column text header, opt out of redundant library count for this page, preserve both episode cards plus empty/error feedback. Correct Linktree button label. No image files or shared template changed. Source config overrides verified in generated HTML/JS.

Local/live at 390 touch and 1440 desktop: header image absent, first portrait appears once, two cards retained, status hidden and empty with content, one-column layout, no overflow/errors/missing Paul resources. Mocked empty/error messages remain visible. Follow-up CSS specificity fix prevents guide.css restoring two desktop columns. Final release 7ec00650ce414ec3b706ba738a5813921d0d2465; Station9-only deployment 2140a5f3-d6e6-45cc-828b-90f33ee66b76 SUCCESS. Fresh CSS/JS query versions. Local backups /tmp/paul-before-conversations-clean. Other stages not timed; source-branch approval unchanged/pending.

## Paul three mobile crops — targeted maintenance, live

No wholesale tenant rebuild. Paul-only mobile focus overrides in config/generated CSS: homepage #tips wallball 0%, Run Zone header 0%, first Rox Lyfe interview thumbnail 65%; max-width 900px. Desktop focus retained. Three affected HTML pages receive fresh CSS cache key. Previous local files preserved at /tmp/paul-before-three-mobile-crops. Five-file commit 6f85e5aba9962d6908de6416dd88eef0599b0d57 pushed to release branch; Station9-only Railway deployment cfb34e89-8f69-4e9e-9d17-1c366351d4cc SUCCESS. No reliable timing measured; no asset/shared engine/other-site changes.

Local and live browser checks at 390 touch and 1440 desktop: six crop checks per environment, loaded images, expected computed focus, no overflow; live page errors and failed Paul resources empty. Live screenshots inspected, all heads visible. Larger Interviews header unchanged; first episode card is the actual third target. Roxjaya deployment independently unchanged. Main/source settings untouched; approval to pin Station9 to release branch still outstanding.

## Paul published to Station9 — 3 November 2026

Approved release commit 9dec2a2d1c9732714b1cde6340a87257397bf32c deployed to station9-demos only, production deployment aba1ba33-b256-4027-bbef-4891f448409f, provider status SUCCESS. Direct upload failed at 742,462,614 bytes (413); GitHub commit redeploy avoided uploading videos/other assets, without deleting files or changing source settings. No reliable end-to-end timing recorded. Roxjaya deployment ID/SHA independently confirmed unchanged.

Live URL https://www.station9studio.co.uk/paulgillingham/?audience=coach verified at 1440 and touch-sized 390. Real hero/reveal inspected, image 1024×884, client map 472px wide, personal profile, three unique offer links, Station9 footer link, no page errors/missing Paul resources/overflow; exact Back restoration after reload at both widths. Browser non-GET/HEAD requests blocked. Live screenshots retained in /tmp/paul-live-hero-{1440,390}.png and /tmp/paul-live-map-{1440,390}.png.

Source-branch persistence is not done: one-off commit deploy can be replaced by a later shared-main deploy. Asked Chris to approve switching only Station9 to the release branch; no change made pending his answer. Existing runtime dependency audit warnings recorded in HANDOVER; no security changes/sign-off in this content release.

## Paul wider hero, source-led profile and client map

Isolated canonical builds `/tmp/paul-wide-hero-profile-review` and `-2`: real 1.320s / 1.540s, both exit 0, 34 filled / 18 waived / zero unwaived gaps. Second build clarifies that individualised training refers to personalised coaching, not the separate PDF products. Image preparation/browser/install stages not timed. Prior preview files at `/tmp/paul-before-wide-hero-profile`; previous portrait-format hero preserved in asset spares. Only Paul's two pages, CSS, hero image and new static map installed; no registry/master/other tenant/deployment changes.

New source 1024×884 hero retained uncut; top-centred focus keeps head/hands intact. Map cropped with native sips from provided screenshot (472×267, app interface removed); credited Rox Lyfe and shared by Paul, no live database or invented counts. Supplied caption panels support retraining at 25, caring/listening, international coaching and discussions with Greg in 2022; not presented as a Rox Lyfe founding date. Homepage profile and coaching page refreshed, exact own-voice quote retained, programme details/testimonials untouched.

Visual reveal/map inspection and Chrome checks at 1440 and touch-sized 390 passed. Installed source image sizes, map count/loads, profile quote and new personalised-copy wording, no page errors/overflow, three unique coaching destinations, and Back returns verified at both sizes. Exact installed footer offsets preserved: 732.71875 desktop / 499.890625 phone. Full installed collection ghost gate PASS. Review trial only, awaiting Chris; source-clipped shoe soles still require a better original.

## Paul Race Day / homepage arch crops

Generator `/tmp/paul-photo-crop-review`: real 2.277s, exit 0, 34 filled / 18 waived / zero unwaived gaps; other stages not timed. Only Paul's styles.css, index.html and race-day.html patched to :4323; previous files at `/tmp/paul-before-profile-and-raceday-crops`. Local photo focus 20% for Race Day finish.jpg, bottom alignment 100% for homepage #story startline.jpg; no photo pixels changed. Accurate alt text added for these photo uses. Shared template and other tenants unchanged.

1440 desktop and 390 touch-sized checks: both finish-photo heads and time digits visible; correct computed positions, natural image loads, alt text, no page errors/overflow. Source name-wall image already clips shoe soles, so bottom alignment removes display clipping but cannot provide intact feet. Full shoe request remains blocked on an uncropped source. Previous Stations arch interpretation was the wrong photo; do not count that as fulfilling this homepage request. Installed :4323 crops verified and Back return still matches the departure position exactly; full installed collection ghost gate PASS.

## Paul-only homepage Back-scroll pilot

Scope explicitly Paul pending Chris's review; master and other tenants not changed. Isolated outputs `/tmp/paul-back-navigation-review{,-2,-3}`; generator wall times (`time`) 1.529s / 1.541s / 1.564s, all exit 0, strict images and slot coverage 34 filled / 18 waived / zero gaps. Other stages not timed. Only final index.html patched to :4323; previous homepage saved at `/tmp/paul-home-before-back-navigation.html`.

Failure reproduced: reload leaves browser history restoration manual; Back from Y=10116 returns to 0. Native auto alone returned about 293px early after layout changed; raw coordinates alone also drifted in touch layout. Per-entry history state plus clicked flow-link viewport offset handles late layout without a URL-wide saved position. No server tracking or persistent browser storage, no extra history entries, no data/photo changes. Restoration cancels on user input; observer/frame/timers stop and auto mode resumes.

Browser validation at 1440 and touch-sized 390: mid-page and footer returns, Forward/Back repetition, reload-before-leaving, fresh Home top, direct hash entry, reload-top/hash clearing, retained unrelated history state and no scroll snap-back after manual wheel/touch input. Actual BFCache persisted return verified with original reload navigation type, plus normal uncached returns. Installed footer link viewport offsets match exactly (desktop 731.953125px, phone 500.328125px); Kim homepage byte comparison unchanged. Ghost gate PASS. Native-only and raw-only attempts failed targeted checks and were not installed. Shared acceptance rollout is pending approval.

## Desk Content count and Paul arch-photo fit

Shared video library now suppresses the redundant non-empty manager count without deleting content or changing the public count. Empty/error states remain. Paul's Stations Prep arch image uses native 1024:895 proportions inside its existing frame to include head and shoes; no image bytes changed.

Final collection `/tmp/pitch-content-preview-review`; all 16 installed on :4323 with old complete previews at `/tmp/pitch-review-before-content-count`. Generator milliseconds (Date.now): Burgon 1547, Kim 880, Zara 806, Elation 852, Faisal 817, Gabby 902, George 941, HTC 1161, Doncaster 1040, Jade 747, Jamie 787, Josh 930, Michele 978, Paul 794, G&H 840, TR 1012. All exit 0, strict image checks and zero unwaived gaps unchanged. Other stages not timed.

Validation: 32 isolated seeded-manager browser checks across 16 sites/1440+390px (counter hidden, actual card and record retained); Paul's draft/publish/public-preview/unpublish workflow at both widths preserves versions, public count and empty feedback. Paul's full arch crop inspected and natural ratios verified at both sizes. Tests use temporary browser contexts only, not user storage or live publishing. Installed preview smoke checked; ghost gate PASS. Node syntax checks passed for source library and existing acceptance script. Added manager-hidden/public-visible assertions to `verify-template-preview.mjs`; full acceptance script not rerun this pass.

## Shared frame/caption/crop pass

Canonical changes: Prep figure wrapper/partial frame, no generated Fig counters or station slashes, natural-aspect compact Partners headers. Paul's original Partners image preserved before the deliberate head/hand crop and Instagram-counter cleanup. Source collection `/tmp/pitch-framing-review`; all 16 installed in :4323 with previous full previews retained at `/tmp/pitch-review-before-framing`.

Measured generator milliseconds (Date.now): Burgon 1411, Kim 795, Zara 721, Elation 779, Faisal 691, Gabby 948, George 834, HTC 1238, Doncaster 1002, Jade 721, Jamie 760, Josh 785, Michele 978, Paul 777, G&H 749, TR 1053. All exit 0, strict images unchanged, zero unwaived gaps. Initial Paul probe 1.284s (`time`). Other stages not timed.

Verification: 18 template unit tests pass; 192 desktop/phone page checks, 32 Prep-frame checks, 252 caption checks; station pseudo-elements have no slash; all 16 Partners headers preserve source image proportions at 1440/390px; no overflow or page errors. Reviewed Partners compositions and Paul's Prep/Partners/caption screenshots. 510 image references present; ghost gate PASS. Caption content and meaningful station/list numbering retained. No live/registry/video changes.

## Paul hero visual review

Compared portrait full bleed, unused sled-pull full bleed, portrait clean half-page and existing venue photo using browser-only trials. Kept full bleed and assigned the unused `sled-pull-face.jpg` to hero; preserved old portrait in source spares. Other image assignments untouched. Generator wall times (`time`): 1.376s first build, 1.974s final dimension/alt build. Both strict-image/coverage passes: 34 filled, 18 waived, zero unwaived gaps. Other stages not timed.

Final output `/tmp/paul-hero-action-review-2`; installed into existing :4323 Paul preview, previous full preview saved at `/tmp/paul-before-hero-action`. Real WebGL reveal canvas observed and removed after handoff at desktop 1440 and phone 390; no ambient layer, page errors or horizontal overflow. Final crops inspected. Installed dimensions/alt checked; three coaching offers retained; full review ghost gate PASS. Do not rebuild the old portrait from the earlier commercial snapshot.

## Commercial-source audit — 2 November 2026

Scope: the other 15 pitch sites' coaching offers plus partner/affiliate destinations across all 16, including Paul's affiliate follow-up. Durable sources are the active configs' `coachingOffers`, `partnerOffers`, testimonial seeds and audit notes; shared renderer/FAQ/campaign generation and `src/template-showcase.js` preserve exact destinations. Full site-by-site ledger and unresolved source issues are at the top of HANDOVER.md. Mandatory future checks are in CHASSIS.md's Commercial-source contract.

Final authoritative output `/tmp/pitch-commercial-final/<slug>`, installed in existing :4323 previews (`/tmp/pitch-copy-review-2/<slug>`). Previous complete previews saved outside the served collection at `/tmp/pitch-review-before-commercial-audit/<slug>`. Live sites/registry unchanged. Intermediate isolated builds are not the review source.

Measured final generator wall time (Date.now around each child process):

| Tenant | ms | Exit |
|---|---:|---:|
| burgonfitness | 1349 | 0 |
| coachedbykim | 704 | 0 |
| coachedbyzara | 730 | 0 |
| elationfitness | 778 | 0 |
| faisalpma | 777 | 0 |
| getfitgabby | 833 | 0 |
| georgegrayson | 897 | 0 |
| htcfisher | 1101 | 0 |
| hyroxdoncaster | 990 | 0 |
| jadeskillen | 761 | 0 |
| jamiebarker | 755 | 0 |
| joshharrison | 909 | 0 |
| michelewilder | 963 | 0 |
| racetoframe | 762 | 0 |
| trainedbytr | 900 | 0 |
| paulgillingham | 852 | 0 |

Other stages were not timed. Intermediate generator runs were measured in terminal output; the late normaliser probe took 1.657s. A final G&H-only priority check took 1.314s and confirms the existing shop offer stays first (`primaryCampaignOffer: "shop"`) while all three coaching promotions remain; only campaign-offers.json was patched into the final collection and installed preview, with the prior JSON retained. Do not treat the earlier public-card checks as sufficient: the promotion/public-destination assertion caught the later prepareShowcase overwrite, which was fixed and covered with permanent regression tests before the final build. A generic ghost-signature collision on Jamie's phrase “the team” was resolved by clearer wording without weakening the gate.

Acceptance: 43 sourced training/resource cards, 55 partner/official-link cards, 88 distinct destinations checked (82 HTTP 200, six merchant challenges). Public form/product content inspected in a JS browser where needed; no submissions, coupon applications, payment details or purchases. Four new regression cases in the existing template-showcase suite; all 16 tests pass. 222 browser page/viewport checks at 1440/390px include post-script card destinations, source-linked testimonials, catalogue/FAQ/promotion agreement, no overflow or page errors, no affiliate cards injected into newsletter pages, and honest Ask fallback for unknown client login. 510 image references present; strict image/coverage checks pass for all 16; ghost gate PASS. Installed :4323 homepages verified for all 16 with no Today redirect. Representative screenshots inspected.

Known incomplete verification: HTC and Hannah Lite conflicting price sources; Michele's certificate-blocked site/current Foundations details; Zara ZARAFPF merchant eligibility; six challenged merchant pages and checkout-code eligibility. Publish only unambiguous prices and keep those flags visible in audit records. Do not turn a bot challenge into a claim that the merchant is broken or that a code works.

## Editorial review batch — isolated copy pass

Generate timings measured with Date.now around each generator invocation, in milliseconds. First batch / second batch: Burgon 1375/1605; Kim 960/922; Zara 664/970; Elation 723/999; Faisal 657/929; George 813/1138; Gabby 729/967; HTC 1058/1434; Doncaster 956/1289; Jade 696/898; Jamie 666/933; Josh 751/1223; Michele 902/1152; Paul 794/1228; G&H 762/866; TR 999/1171. Other stages not timed. Final output `/tmp/pitch-copy-review-2`, served on :4323. 14 successful generators; Zara and G&H fail existing duplicate-photo checks despite zero unwaived slots. Browser: 415 core page loads, selected copy-fault scan; Paul/Kim/G&H desktop/phone homepage overflow checks clear; 510 image references present; ghost gate PASS. Existing staged/live outputs not replaced.

## Duplicate-photo follow-up

Zara: 920ms; G&H: 770ms (Date.now measured generator duration; other stages not timed). Both generators exit 0; strictImages unchanged; zero unwaived gaps. Output `/tmp/pitch-photo-fix-1/<slug>`. Affected HTML/image pair patched into :4323 copy-review stage with previous output saved as `.before-duplicate-fix`; source duplicates moved to asset `spares/`. Desktop 1440px / phone 390px image loading and descriptions verified; screenshots inspected; full copy-review ghost gate PASS.

## Paul's screenshot copy corrections

All 16 generators exit 0 in `/tmp/pitch-copy-corrections-1`. Measured generation milliseconds: Burgon 2016, Kim 1221, Zara 1095, Elation 1038, Faisal 868, Gabby 969, George 1108, HTC 1355, Doncaster 1340, Jade 923, Jamie 955, Josh 1029, Michele 1242, Paul 1047, G&H 870, TR 1253. Other stages not timed. Patched index/prep-club into :4323 while preserving previous output. Paul's 1440/390px browser checks confirm clean stat/Ask text, absence of the five flagged phrases and retained required photo-consent control.

## Paul — verified Rox Lyfe offers and testimonials

Generator wall times (`time`): review-1 2.020s; review-2 1.236s; review-3 1.974s. All exit 0; 34 filled / 18 waived / zero unwaived gaps; strict image checks unchanged. Other stages not timed. Authoritative output `/tmp/paul-roxlyfe-coaching-review-3`; five affected files patched into existing :4323 Paul preview with pre-change copies retained. Rechecked Rox Lyfe source pages for coaching roles, £55 plans, PDF format and exact testimonials. Browser checks at 1440/390px cover homepage and coaching: correct distinct application/product links after script load, prices, testimonial rendering, no horizontal overflow and full photo crop. Testimonial footer spacing corrected locally. A generic ghost signature collision on “the team” was removed by using the clearer destination label “Explore coaching at Rox Lyfe”.

## How to time a build

- Note the clock time (`date "+%Y-%m-%d %H:%M"`) at the start and end of each stage below. Agent turns waiting on Chris don't count; note them separately as "waiting".
- Time the generator itself with `time node scripts/reskin-tenant.js <config> --output-dir=<new folder>`.
- Record times honestly, even when a stage went badly. Never estimate or backfill a time that wasn't measured; write "not timed".

Stages:

1. **Intake:** photos received, graded and shortlisted (MANIFEST).
2. **Research:** links, stats and verification of claims.
3. **Image prep:** crops, slot naming, copying into the assets folder.
4. **Config:** writing the `.demo.json` (tokens, copy overrides, seeds, news).
5. **Generate:** the `reskin-tenant.js` run, including failed attempts.
6. **Verify:** tokens, ghosts, images, page 200s, desktop and phone checks.
7. **Review fixes:** changes after Chris's first look, until he's happy.

## Log

| Date | Tenant | Intake | Research | Image prep | Config | Generate (runs) | Verify | Review fixes | Total | Waiting on Chris |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-28 | michelewilder | not timed | not timed | not timed | not timed | not timed | not timed | not timed | not timed | — |
| 2026-10-29 | coachedbykim | not timed (80 files, 17 batches) | not timed | ended 13:17; review crop pass ended ~17:55; links/accent pass ended ~18:30; starts not timed | rewrite/lint ended 13:29; final lint 13:47, 15:01, 17:50 and 18:31 (91 live / 0 dead) | 0m0.242s; 0m0.197s; 0m0.229s; 0m0.185s; 0m0.163s; 0m0.200s; 0m0.198s; 0m0.183s; wording/colour passes 0m0.214s, 0m0.197s, 0m0.184s, 0m0.206s; image-review pass 0m0.226s; links/accent pass 0m0.245s | 13:38–13:48; post-copy passes ended 14:18 and 15:05; image-review pass ended ~17:58; links/accent pass ended ~18:36 | hero copy fix ended 14:19; wording/colour pass ended 15:06; station/Taper image fix ended ~17:58; links/accent fix ended ~18:36; starts not timed | not timed (intake/research starts missing) | — |

## What slowed each build, and what to try next time

Write this during the build, not after. For each problem: the stage, what happened, roughly how long it cost, and the fix or idea. Move fixes that work into the checklist at the top of CHASSIS.md.

### michelewilder (Oct 28, from memory, untimed)

- Config: copy overrides written against `{{TOKEN}}` source silently didn't match. Fix: write them against the output text (now in the checklist).
- Generate: the wrong argument form (`--config`, `--help`) and reusing an output folder both errored. Fix: exact command in the checklist.
- Verify: the staged build looked broken until it was served from a symlinked root. Fix: in the checklist.
- Review fixes: many small visual rounds (hero copy over her face, event spacing done four times). Idea: check hero text placement and event cards on desktop and phone before handing over.

### coachedbykim (Oct 29, intake only so far)

- Intake: 80 images pasted in batches of five took a long session and filled the chat context, forcing a session change. Idea: drop the photos straight into a folder instead (e.g. `scripts/reskin/<slug>-source/incoming/`) and have them graded from there in one pass.
- Research: the YouTube channel was missed by search and only found by trying likely handle URLs directly. Fix: always try `youtube.com/@<handle>` and TikTok variants of every known handle.
- Config (prediction): copying Michele's config would carry 61 dead overrides. Fix: `lint-overrides.js` before building.
- Image prep: completed at 13:17 after the continuation restart; stage start was not recorded, so no duration is claimed. Required crops used ffmpeg because Pillow was unavailable.
- Config: rewrite + lint pass ended 13:29. The copied config had to be replaced wholesale, not patched; lint now reports 78 live / 0 dead overrides.
- Chassis cleanup: extra neutralisation was needed for Race Crew dancing, WhatsApp fallbacks and 365/list wording. Fix: grep the generated tenant, not just the first edited files.
- Chassis cleanup (later pass): TrueCoach also survived as a hidden `data-link`/`links.json` key, FITR survived in the generic platform setup, and `name="whatsapp"` survived inside form markup even though no visible WhatsApp text remained. Fix: grep case-insensitive attribute names and generated JSON too, not only visible copy.
- Generate: the first isolated build warned `gallery has 5 photos (want exactly 4)`. Fix: keep `tenantGallery` to the approved four and leave unused files out of the manifest.
- Verify: Playwright's first image check marked lazy-loaded photos as broken before they entered the viewport. Fix: only treat eager/in-viewport images as broken in the quick browser pass, and verify every generated media path separately.
- Verify: the Hero reveal needs several seconds to finish; screenshots taken at `DOMContentLoaded` show a blank/mosaic frame. Fix: wait for `.hero-img` decode plus the reveal before judging layout.
- Review fixes: Chris flagged the hero's `Après-ers` line break and a standfirst that read like audit notes. Fix: keep the verified race numbers but write the standfirst as sales copy, and grep the whole generated output for repeated awkward wording, not only the hero.
- Review fixes: public wording needed a separate pass from internal implementation state. Fix: leave data flags/storage keys alone when they do not render, but remove public labels like supplied/sample/fictional/preview caveats; `Après-ers` stays because it is Kim's real community name.
- Review fixes: the planner's copy lived in `scripts/reskin/booking-template/`, not only `chassis/`, so the first wording edits did not reach generated output. Fix: check the installed planner source as well as the visible chassis file when cleaning shared wording.
- Colour: `colors.zoneAccent` was configured correctly but chassis-mode generation left the default amber in `styles.css`. Fix: `ZONE_ACCENT` now resolves from `colors.zoneAccent`; Kim's generated accent is `#14524c` (8.97:1 on white) alongside signature `#e63950` (4.15:1 on white).
- Review fixes: Stations Prep uses forced 16:9 image slots, so portrait action shots were centre-cropped badly. Fix: make deliberate 16:9 source crops in the tenant assets before building; do not rely on CSS centring. Taper's SkiErg hero was also wrong for the page and is now kim-054's rack/bar photo through a local `taper-hero.jpg` override.
- Review fixes: Links reused `coaching-hero.jpg` and the first teal accent was too dark on the black menu. Fix: give module heroes distinct photos where the shoot fits the page (Kim's Links now uses the verified business-event photo), choose `zoneAccent` for both dark-menu and white-page contrast, and tag shared-benefit pages `body.zone-acc` so the accent carries into the page without repainting brand elements.

## George Grayson — content + photo overhaul (staged review)
- Athlete facts corrected: solo 1:00:42 Birmingham, doubles 54:57 Birmingham (w/ Matt Civil); config tokens PB_SOLO/PB_VENUE/PB_DOUBLES/DOUBLES_VENUE updated so rebuild keeps them. Staged copy adds "with Matt Civil" — template renders name-less version.
- Arch copy: stray full stop + duplicated "experience earned on the start line" removed.
- Image rotation: arch=finish-line solo run (gg-finish-run.jpg), results=solo board (gg-solo-board.jpg), find-a-partner=duo board (pb.jpg), race-mate-hero=Puma farmers carry, race-day hero=SkiErg lineup (startline.jpg), predictor-hero=outdoor lunge, podcast-hero=media wall (gg-podcast-hero.jpg).
- Stations: row=race-floor RowErg upload; burpees=George bent-over race shot (no true burpee asset exists); others keep George pro shots.
- Ask links absolute /georgegrayson/#ask on all pages. Podcast category "Podcast clips"→"Podcast". Taper hero capped 190px+crop 15%. Coaching clients-photo capped 340px; athletes-say gap tightened. Video-card thumbs constrained 16:9.
- New images mirrored into georgegrayson-assets/ (hero, station-row, station-burpees, predictor-hero, race-mate-hero, startline, gg-finish-run, gg-solo-board, gg-podcast-hero).

## Get Fit Gabby — review fixes (staged) + chassis
- Homepage: #plans bottom padding reduced; new chassis rule `section.block + section.block{padding-top:0}` + `.block:has(+ .cta-band){padding-bottom:40px}` + `.block.alt` gets an inset top border so consecutive panels share one gap and alt panels delineate. Applied to chassis/styles.css — affects all tenants on next rebuild.
- Gap between London event card and "Got the ticket" partner band tightened via the same rule.
- training.html: "Ask about coaching" card no longer duplicates "Explore programmes" (both went to Linktree); it now links internally to /getfitgabby/#ask.
- splits-hero.jpg lifted (object-position 25%); station-farmers-carry.jpg was an Instagram screenshot incl. UI chrome — cropped to the photo area (562x640), new cache key gm-fc-20261103, mirrored to getfitgabby-assets/.

## Get Fit Gabby — round 2 image fixes (staged)
- station-wall-balls.jpg <- pro wallball.jpg upload (was grainy video still).
- run-zone hero <- gm-invite-run.jpg (the strong event running shot moved off race-day).
- race-day hero <- gm-neon-startpen.jpg (start pen under HYROX lights — proper race-day).
- taper-zone hero <- taper-offday.jpg (calm studio shot; competition shot was wrong mood for taper).
- race-crew: deleted oversized crew-track.jpg figure (park group photo that didn't belong).

## Get Fit Gabby — round 3 (links + hero)
- Anchor bug fixed: /#ask deep links landed ~2500px off-target because browser scrolled before lazy content loaded. load-time re-scroll added to app.js (staged) AND chassis/app.js — all tenants benefit on rebuild. app.js?v bumped.
- Wall balls: earlier "pro" swap was same grainy still — now coachedbyzara's rig shot. Splits hero: gm-finish-celebrate. Taper hero offday crop lifted; station-row 15%; sandbag-lunges 55%.
- Desktop hero editorial restyle (all inside min-width:601px): full-figure contain at 95% right, 94vh height, headline ~78px + 30ch standfirst at 42% top, actions absolute bottom-left off-photo. Mobile unchanged.

## Coached by Zara — round 1+2
- Hero <- zb-zara-solo (Zara-only B&W); duo hero moved to find-a-partner. Scrim added for legibility.
- Ask-zone bg <- gallery/stock-arena (was all-Zara class photo). Prep club <- zb-sled-push. Coaching hero lifted.
- Training page "Ask about coaching" -> /coachedbyzara/#ask (was duplicating programmes link).
- app.js anchor re-scroll patch applied to zara staged + app.js?v bumped — fixes Ask Zara landing wrong.
- splits-hero <- zb-skierg-zara; station-sandbag-lunges <- zb-farmers-carry (literal lunge shot); sled-pull/row/sandbag crop shifts; "STATION 05" caption -> "Rowing —".

## Coached by Zara — pro batch placement (25 uploads)
- Stations: skierg<-PIERGIANNI close pull, sled-push<-low CENTR drive, sled-pull<-rope+crowd, wall-balls<-overhead release (best of 3), farmers-carry<-Zara front w/ bells. Sandbag keeps true-lunge shot.
- Heroes: run-zone<-PIERGIANNI stride, stations page<-sled drive + partner pacing, predictor<-blue-kit focus, taper<-hands-on-hips rig, race-mates<-PIERGIANNI/MORIARTY stride.
- results pb<-duo hand-in-hand finish.
- Spares kept: zb-duo-hug, zb-sandbag-shoulders/profile, zb-chainlink-wallball, zb-bw-duo-run, zb-wallball-scoreboard, zb-wallball-group, zb-skierg-wide, zb-duo-run-back.
- Zara batch 2 upgrades: station-farmers-carry<-solo 24kg carry, run-hero<-solo run close-up. Verified: Zara+Gabby 6th in world at first Elite doubles stop of season (her IG post).
- Zara batch 3: hero<-sandbag-shoulder profile (144); wall-balls<-dark overhead squat (145); sandbag-lunges<-duo lunge (146); stations page hero<-group wallball (147); station-skierg<-purple PIERGIANNI pull (148); splits-hero<-staring-up (150); arch/Meet Zara<-exhausted Myprotein hug (149).

## 2026-11-04 — Station9 pitch hub: Zara, Gabby, George + Paul video live
- Deployed staged review builds for coachedbyzara, getfitgabby, georgegrayson to Station9 via release branch `publish/paul-station9-pitch-20261102` (commit `0a0a083`, Railway deployment `72d5efd1`, station9-demos service only — no main merge, no Roxjaya touch).
- Pitch pages live: /pitch/{paulgillingham,getfitgabby,coachedbyzara,georgegrayson}/ — each with new captioned walkthrough video (intro card sequence: produced-by → already-built → two jobs → Desk → £99 offer → tour; signed "— Chris · Station 9" end card).
- Tracking: pitch page emails on open/play/complete/revisit/CTA taps (VALID_SLUGS + revisit + cta events added in server/pitch.js; pitch/pitch.js flags revisits via localStorage). Site-side: pageview beacon already live; now emails once when a pitch-tagged visitor first lands on a demo site (server/leads.js, utm_source=pitch on explore links).
- New pitch scripts: georgegrayson.pitch.json created; paulgillingham/getfitgabby/coachedbyzara updated with leads→campaigns→finance Desk scenes, automated news/events captions, race-crew meetups line.
- Paul's site deliberately NOT re-synced (deployed version has post-approval fixes the staged copy would revert — same lesson as the last overwrite).

## 2026-11-06 — Station9 main-deploy overwrite: diagnosed, restored, source pinned to release branch
- Chris reported gabby/zara live showing old half-finished photo/crop state. Cause: `station9-demos` still tracked shared `main`; automated commit `071a31710f` ("Publish Roxjaya schedule and news updates") redeployed at 02:27 GMT, replacing release-branch state — the exact recurrence flagged in HANDOVER (same failure that ate Paul's page).
- Restored: `railway redeploy --commit 27de5fda892e81fbeb0cc91ec97a9554610e958b` to station9-demos only (deployment `c06b69c8`). Verified live: crop-focal-fixes CSS and pitch__skip present, gabby last-modified back to the Nov 5 release build.
- **Source pinned:** `railway service source connect --branch publish/paul-station9-pitch-20261102` on station9-demos. Repoint auto-triggered one clean build of the same commit (`6692f94f`, no visible change). Roxjaya service untouched, still on main.
- Going forward: tenant deploys = deliberate pushes to `publish/paul-station9-pitch-20261102` or `railway redeploy --commit`. Automated main commits can no longer touch client-facing demos.
- PawVigil gap found+fixed same day: `Arciteq-Digital.css` service (pawvigil.com) had NO GitHub source — static guide commits from pawvigil-freshness never redeployed it; newest committed guide was 404 live. Reconnected source to `main`; deploy `45370dec` rebuilt from current main and the missing QR-guide page now serves 200. Partition verified post-change: station9-demos still on release branch, gabby live state unchanged.
- Post-restore audit (6 Nov): byte-compared live vs `/tmp/pitch-copy-review-2` for all pitched tenants. gabby, zara, george, paul, kim = identical. **faisalpma was stale** — its approved staging state never reached the release branch. Committed staging → `publish/paul-station9-pitch-20261102` (`1e873907`), auto-deployed (`85b5be2c`), live now byte-identical. Local elationfitness pages-source re-synced to live (nav-sell/nav-acc menu + Guides-link removal); styles already on current chassis rules.
- michelewilder (6 Nov): her staged build was never deployed AND never registered — /michelewilder/ fell through to the shop catch-all ("Collection | Shop"). Pushed staged dir to release branch (`fcf70f3b`), then registered her in data/tenants.json mirroring reskin-tenant.js's roxjaya-record transform (`9a24be80`). Verified live: real title, /michelewilder/stations-prep/ 200, nav-sell present. Same stale-vs-staging condition exists for burgonfitness, htcfisher, hyroxdoncaster, jadeskillen, jamiebarker, joshharrison, trainedbytr (all registered already — file sync only, no registry work). joshharrison = chassis donor, double-check before overwriting.
