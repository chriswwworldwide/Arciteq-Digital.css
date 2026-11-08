# Handover — Station 9 Pitch Pipeline (Oct 2026)

This file catches a new session up on exactly where we are, what is live, and what must happen next.

## Deliverability + funnel findings — 5 November 2026 (READ THIS FIRST for outreach work)

**Read `scripts/reskin/OUTREACH-LOG-2026-11-05.md` before any send, nudge,
email-draft or conversion-planning work.** It logs the night's measured
findings: ~95% inbox placement everywhere except consumer Outlook.com
(junks the new domain), the coach phone-first/admin-sit-down behaviour
model, WhatsApp numbers held for 4 of 12 prospects, the Tue/Thu send +
48-72h surgical-nudge cadence, the ~1-in-8 blended conversion model and
financial arc, the new one-link/price-in-email standard, and the
pitch__skip platform-first line deployed on all six sent pages.

**Consumer-Microsoft rule (agreed 6 Nov):** hotmail/outlook/live/msn
addresses are parked for email outreach — the seed NDRs confirmed a
systematic hard-reject on the new domain, not a fixable SPF problem
(headers showed spf/dkim/dmarc pass; the "SPF validation error" text is
generic). Exception: a verified WhatsApp number overrides the park —
those prospects go WhatsApp-first instead. Do NOT subscribe to Mailreach
warmup yet (~£20-25/mo not justified while no hotmail prospect is on the
send list). **Reminder: re-run a one-off Mailreach spam-panel test
~mid-December (~6 weeks after 5 Nov) to check whether organic warmth has
cleared the consumer rows before farming them.** Parked addresses are
listed in PROSPECTS.md → "How to use this list".

## NEXT TASK — Elation: add Matt Agnew to the platform (as of 6 Nov 2026)

The Elation demo is ~95% Graham (337 vs 9 mentions) but the business is
50/50 Graham Halliday + Matt Agnew. Chris is supplying Matt's photos
himself (do NOT scrape his IG).

**What to read first, in order:**
1. `AGENTS.md` + `.devin/rules/platform-build-and-video.md` — build rules.
2. `scripts/reskin/OUTREACH-LOG-2026-11-05.md` — the full deliverability/
   funnel/channel playbook measured on 5 Nov (send cadence, nudge rules,
   one-link email standard, conversion model).
3. `scripts/reskin/elationfitness.email.md` — email already rewritten to
   the new standard; bottom half has the **verified business-intel block**
   (Ltd structure, accounts, ambassador/CEO split, Birmingham no-result
   caution, £995+£145 price).
4. `PROSPECTS.md` → "HYROX official coach directory" section for the
   38-coach pipeline behind this batch.

**The work:**
1. Chris drops Matt photos into `scripts/reskin/elationfitness-assets/images/`
   (asked for: profile shot, coaching/floor shot, optional race shot —
   e.g. matt-1.jpg, matt-coaching.jpg). If absent, ask him.
2. Wire Matt into the demo: athlete/coach profile slot + community/
   coaches sections where Graham currently carries everything. Targeted
   maintenance on the existing elationfitness demo — NOT a rebuild.
3. Verify locally (`localhost:3000/elationfitness/` + `?audience=coach`)
   and check the pitch video still makes sense if card order/layout
   changed (splice rather than re-record where possible).
4. Final email is already at `elationfitness.email.md`: Graham addressed,
   Matt acknowledged, £995 setup + £145/mo, Thursday deadline, one link.
   Send route likely WhatsApp-first if +44 7555 236806 verifies live,
   else email + IG nudge.

## Birmingham/Hamburg race-weekend pitch batch — current outreach handover, 3 November 2026

**Read first:** `BILLIONS.md` → “Founding UK pitch + pricing — current decision (Nov 2026)” for the offer and positioning, then “Send timing and sequence” → “Birmingham-week correction” for the exact batch logic and safe hooks. The current offer is **£99/month for an initial six months, setup included**, with an optional **£495 upfront covering the full six-month founding period**. Do not improvise a setup-fee menu.

**Send rule:** Wednesday is now the fresh post-race-weekend batch, not a Birmingham-only batch. Use each prospect's actual event: Birmingham only where a published result/presence exists; Hamburg for the Hamburg racers; Paul's own Birmingham-origin anniversary post for Paul. Aim roughly **10:00–11:30**, not first thing. Thursday is for prospects with no verified current event hook.

**Wednesday group — usable hooks:**

- **Hannah Burgon** — Birmingham Pro Women, 1:11:13. Safe result congratulations.
- **George Grayson** — Birmingham solo 1:00:42 plus 54:57 doubles with Matt Civil.
- **Gregor Johnston / Race to Frame** — Birmingham Men, 1:04:03.
- **Josh Harrison** — Birmingham Pro 1:08:20 plus 58:23 mixed doubles with Saoirse Maccana.
- **Tom Redmond** — Birmingham relay 1:07:42 plus 1:22:30 mixed doubles with Sadie Shingler.
- **Faisal Abdalla** — posted “48 hours at HYROX Birmingham”; use presence/home-turf wording, not a result claim.
- **Graham Halliday** — Pro Men start-list entry only; no verified finish found. Either hold for Thursday or use cautious “saw you were down for Pro” wording. Do not congratulate on a result.
- **Jade Skillen** — Hamburg Elite 15, reported as eighth in the world.
- **Gabriella Moriarty** — Hamburg Elite 15 solo and doubles, both sixth per supplied screenshots.
- **Zara Piergianni** — Hamburg alongside Gabby; use Hamburg/pairing hook, not Birmingham.
- **Paul Gillingham** — no Birmingham 2026 result. His own post says his HYROX journey began with Birmingham men's doubles five years ago; 76 races, 23 podiums, 29 locations, 16 countries, two continents. Strong Wednesday hook, but do not imply he raced this weekend.

**Thursday group — no verified current event hook:** Kim Mansell, Ross Fisher, Nigel Wood, Jamie Barker and Michele Wilder.

**Accuracy guardrails:** “No verified Birmingham finish found” is safe; “did not race” is not. Start lists are not finishes. Do not substitute Birmingham for Hamburg. Do not use search-snippet absence as proof. Exact links and the proposed opening lines are in `BILLIONS.md` around lines 885–944 and 1192–1235 at the time of writing.

**Station9 source layout (FIXED 6 Nov 2026):** `station9-demos` (station9studio.co.uk) now tracks **`publish/paul-station9-pitch-20261102`**, NOT shared `main` — Roxjaya's automated main commits can no longer overwrite client-facing demos (this failure mode bit twice: Paul's page, then the whole board at 02:27 on 6 Nov). Tenant deploys = deliberate pushes to that release branch or `railway redeploy --commit <sha>` to station9-demos. Roxjaya service unchanged on main. See BUILD-LOG "2026-11-06 — Station9 main-deploy overwrite".

## Paul Station9 overwrite — DIAGNOSED and RESTORED, 3 November 2026

Chris reported that the Paul link on iPhone opened the PawSense/shop-style site. This was **not** an iPhone redirect: both `www.station9studio.co.uk/paulgillingham/?audience=coach` and `station9-demos-production.up.railway.app/paulgillingham/?audience=coach` were serving `Collection | Shop` from the shared app. The Station9 service had been redeployed from shared `main` at 03:30 GMT by automated commit `6e6612c140be3082ae6e6cbabe430036d502a4fb` (“Publish Roxjaya schedule and news updates”), replacing the one-off Paul release. `/station9/` still loaded its shared-main Station9 page, but without the Paul pitch link.

Restored the exact approved release-branch head `c6b916072185b37f4415f27218ce0aee5c7c22fd` to `station9-demos` using Railway deployment `aaefc3f0-570e-46fb-9936-4ea09c951693`, status SUCCESS. Live mobile-user-agent and Railway-domain checks now return Paul's page; `/station9/` again contains `/paulgillingham/?audience=coach`. No source setting, Roxjaya deployment, main merge or other site changed. **Recurrence risk remains** because Station9 still follows shared `main`; permanent source pinning/splitting still needs an explicit decision.

## Homepage Back-scroll rollout — LOCAL previews and chassis, 3 November 2026

Chris approved Paul's pilot and asked for the same mid-page homepage return across the other 15 pitch sites plus the chassis. `chassis/index.html` now owns the shared `__s9HomeScroll` bootstrap; Paul's tenant-specific duplicate override is no longer needed. Ordinary internal homepage links store the current history entry's coordinates plus a stable clicked-link anchor, Back/Forward restores the clicked section after late layout changes, and wheel/touch/pointer/key input cancels immediately. Unrelated history state is preserved; no extra history entries, cookies, local/session storage or server tracking are added.

Reload handling now shares the same bounded helper: deliberate refreshes return to the top, clear a stale hash and use a short 500ms settle window so the browser's late fragment/scroll race cannot leave the page a few pixels down. Back/Forward restoration still gets the longer 2.5s bounded settle. `history.scrollRestoration` returns to `auto` after either path.

Durable source/test changes: `chassis/index.html`, `scripts/verify-template-preview.mjs`, `tests/template-showcase.test.js`, and `scripts/reskin/paulgillingham.demo.json` (override removal). Staged output for the other 15 is `/tmp/home-scroll-rollout-2/<slug>/`; versus `/tmp/pitch-copy-review-2/<slug>/`, only each `index.html` differed. Those 15 verified homepages were then installed into the existing local preview collection. Previous homepages are backed up at `/tmp/pitch-before-home-scroll-rollout/<slug>/index.html`. Paul's existing :4323 homepage was patched to the same shared helper without replacing his approved content.

Verification: `tests/template-showcase.test.js` passes 19/19. The chassis scroll verifier passes Back/Forward, repeated return, reload, direct-hash, hash-reload and history-state checks at 1280px, 320px and 390px. The neutral template fixture still exits at the existing missing `links-hero.jpg`/`taper-hero.jpg` content gate; the generated fixture was sufficient for the requested homepage-scroll checks. Clean Paul chassis build `/tmp/home-scroll-master-paul-3` passed strict coverage (34 filled / 18 waived / zero gaps; generator 0.719s). All 15 staged sites passed the full browser matrix at 1440 desktop and 390 touch, then all 16 installed :4323 previews passed a 32-check smoke covering footer Back return and hash-reload top. No page errors, unexpected writes or horizontal overflow in these checks.

Deployment state: **local only**. No commit, push, Station9 deployment, registry change or non-homepage tenant patch was made. Paul's live Station9 site remains the prior release. Permanent Station9 source-branch approval and previous commercial/source items remain pending.

## Paul Join the list mobile crop — FIXED LIVE, 3 November 2026

Screenshot 233 was **Join the list → Hear it first** (`list.html`), opening events-secondary.jpg. Added that asset under the Paul-only max-width:900px top-alignment rule, scoped to .community .guide-hero-photo. Phone now shows both runners' heads; desktop remains centred. Local/release configs updated; only generated styles.css and list.html changed (fresh CSS key list-crop-20261103). Previous local files `/tmp/paul-before-list-mobile-crop`. No image pixels, forms, shared template or other site/settings changed.

Release commit **c6b916072185b37f4415f27218ce0aee5c7c22fd**; Station9 deployment **8f562748-bb16-48c5-8f2b-4ed828f78693** SUCCESS. Live `https://www.station9studio.co.uk/paulgillingham/list.html` verified at touch-sized 390 and desktop 1440: correct 0% / 50% focus, loaded image, no overflow/page errors; no submissions made. Phone image visually inspected with both heads intact. Screenshots `/tmp/paul-live-list-crop-{390,1440}.png`. No wholesale build/timing this maintenance pass. Station9 source-branch approval and previous outstanding items remain pending.

## Paul Conversations duplicate portrait + item count — FIXED LIVE, 3 November 2026

Chris flagged that the Interviews/Conversations header reused the first podcast's portrait, plus the redundant “2 items · Podcast” line. Paul podcast.html now has a text-only header (`guide-hero pg-conversations`), full-width single-column grid and readable text width. Episode cards/images/links remain unchanged (two cards; coaching-hero image appears once). Count suppression is page-specific via `data-hide-count="true"`; Paul video-library.js hides/clears the non-empty status only when manager or that opt-out flag applies. Empty and load-error messages still display; Watch count behaviour unchanged. Adjacent Linktree CTA corrected from misleading YouTube label to “More from Paul”.

Durable local and release Paul configs have copy overrides for the header marker, removal of the podcast-only figure, page flag, renderer opt-out and CTA label; extraCss has the higher-specificity `.guide-hero.pg-conversations > .wrap` rule (must outrank guide.css). Canonical chassis/shared engine untouched. Isolated build `/tmp/paul-conversations-clean-review` checked durable rules (1.823s, strict 34 filled / 18 waived / zero gaps). Targeted local preview update only podcast/styles/video-library; previous files `/tmp/paul-before-conversations-clean`.

GitHub commits a7b858e and final **7ec00650ce414ec3b706ba738a5813921d0d2465** on existing release branch. Station9 deployment **2140a5f3-d6e6-45cc-828b-90f33ee66b76**, SUCCESS. Podcast CSS/JS use conversations-clean-20261103 cache revision. Live page `https://www.station9studio.co.uk/paulgillingham/podcast.html` verified at touch-sized 390 and desktop 1440: no header photo, portrait once, two episodes, hidden/empty count status, single-column header, no overflow/page errors/missing Paul resources. Empty/error states separately tested with mocked local responses. Live screenshots `/tmp/paul-live-conversations-clean-{390,1440}.png` and `-cards-{390,1440}.png`. Card-grid scroll screenshots may put its top under sticky menu; image focus itself remains the previously verified mobile 65% crop.

No main merge, source-branch setting, other-site changes or provider submissions. Permanent Station9 source-branch decision and prior outstanding items remain pending.

## Paul three mobile photo crops — FIXED LIVE, 3 November 2026

Chris supplied three phone screenshots and asked for fixes plus exact review locations. Actual targets: **homepage #tips / Coach notes** (wallball.jpg, above Station 01), **Run Zone opening header** (run-hero.jpg), and **Interviews → Guest conversations → first Rox Lyfe episode thumbnail** (coaching-hero.jpg). The larger Interviews header already showed his head correctly and was deliberately left unchanged. Do not confuse that header with the episode card.

Paul-only @media(max-width:900px) focus overrides: tips wallball and Run Zone header 50% 0%; coaching-hero video card 50% 65%. Desktop stays 28% / 50% / 20% respectively. Durable extraCss in original and release Paul config; targeted generated styles.css patch and CSS cache key mobile-crops-20261103 on index/run-zone/podcast only. No assets, shared template, other tenants, copy or source-branch settings changed. Local :4323 preview updated with prior four files at `/tmp/paul-before-three-mobile-crops`.

GitHub release branch commit **6f85e5aba9962d6908de6416dd88eef0599b0d57**; Station9-only Railway commit deployment **cfb34e89-8f69-4e9e-9d17-1c366351d4cc**, status SUCCESS. Roxjaya still b428a409-69cf-43f7-ba35-c8f0b7f7050d / ed6cfb338bfcf149224809bac7fee9f9e91cfb8b. Used direct GitHub commit redeploy, not file upload/main merge. Permanent branch-source approval remains pending.

Live checks at 390 touch and 1440 desktop passed all three URLs: correct focus and fresh CSS revision, loaded images, no overflow/page errors/missing Paul resources; screenshots visually inspected. Non-GET/HEAD requests blocked to avoid submissions. Screenshots `/tmp/paul-live-mobile-crop-{coach-notes,run-zone,interviews}.png`. Review links: `https://www.station9studio.co.uk/paulgillingham/?audience=coach#tips`, `/paulgillingham/run-zone.html`, `/paulgillingham/podcast.html` (scroll to Guest conversations, first episode).

## Paul LIVE on Station9 — 3 November 2026; permanent source-branch decision pending

Railway login renewed. Verified project `6a4a0c27-2fc1-46eb-b2c8-ec545107b9ae`, production `8d5eb20a-9904-4fe3-89a5-4045bc16f77e`: **station9-demos** service `67d1dc81-4492-4422-aac5-1bce765ed233` owns **www.station9studio.co.uk**. Roxjaya is separate `56827a88-2884-4d55-9ba8-9992198da1ad` and was NOT redeployed.

**Live review:** https://www.station9studio.co.uk/paulgillingham/?audience=coach . Public Station9 footer now links to the Paul pitch. GitHub release branch `publish/paul-station9-pitch-20261102`, commit `9dec2a2d1c9732714b1cde6340a87257397bf32c` is deployed successfully as Railway deployment **aba1ba33-b256-4027-bbef-4891f448409f**. Provider status SUCCESS and live HTML/image identity confirmed. Roxjaya remains on deployment `b428a409-69cf-43f7-ba35-c8f0b7f7050d`, SHA `ed6cfb338bfcf149224809bac7fee9f9e91cfb8b`.

Direct `railway up` was rejected before deployment (742,462,614-byte archive / HTTP 413). Did NOT delete/exclude other sites/videos to work around it. Instead used authenticated pinned CLI: `railway redeploy --project <above> --service <station9 id> --environment <production id> --commit 9dec2a2d1c9732714b1cde6340a87257397bf32c --yes --json`. This builds from GitHub and targets only Station9; no settings/env changes, merge to main, migrations, emails or application API writes.

Live Chrome checks passed at 1440 and touch-sized 390: wider 1024×884 hero/reveal visually inspected, personal profile, client map loads, three offer destinations distinct, Station9 hub footer link, no page errors/missing Paul resources/overflow. After reload + click-through + Back, clicked footer offset restored exactly (732.71875px desktop / 499.890625px phone). Production browser checks blocked non-GET/HEAD requests to avoid submissions. Screenshots `/tmp/paul-live-hero-{1440,390}.png`, `/tmp/paul-live-map-{1440,390}.png`.

**Outstanding decision:** this was a ONE-OFF commit deployment. Station9 is still connected to shared main, so a later main deployment could replace it. Explicitly asked Chris whether to point ONLY Station9 to the Paul release branch, leaving Roxjaya on main. Await his answer before changing service source/config. Main still does not contain Paul. Do not claim permanent source pinning is complete. Auth is now working; use `npm exec --yes --package=@railway/cli@5.71.0 -- railway ...`.

Existing dependency warnings remain: Railway build audit reported 28 findings (1 low, 8 moderate, 15 high, 4 critical), while GitHub's earlier default-branch alert count was 62. No dependency/security-policy changes were included; no production security sign-off claimed. Earlier unreleased hardening work remains separate.

## Historical Paul publication preparation — prior login blocker now resolved

Chris approved the reviewed Paul pitch and explicitly requested GitHub plus a mobile-accessible website on the **Station9 hub, not Roxjaya**. Original working tree is very dirty; do not blanket-stage/push it. Prepared a clean shallow clone of current remote main at `/tmp/station9-paul-publish` (base ed6cfb3) and pushed **publish/paul-station9-pitch-20261102**, commit **9dec2a2d1c9732714b1cde6340a87257397bf32c**. GitHub verified the commit exists. Main was NOT changed; no website deployment performed.

Release scope: approved :4323 Paul files copied using final isolated-build file list as an allowlist (backup files/spares excluded), Paul's config/image source, one minimal tenant registration and one Station9 footer link to `/paulgillingham/?audience=coach`. Other existing registry entries byte-equivalent as parsed; no scheduled digest or auto-approval configured for Paul. No HQ CRM database writes, emails, other coach or Roxjaya content changes. New generated HTML/CSS/config formatted with existing Prettier; git diff --check clean. Release browser checks at 1440 and touch-sized 390 pass: image/profile/map, three offers, no overflow/errors, exact Back restoration, hub link. Release working tree clean after commit.

**BLOCKER:** `railway` is not globally installed. Pinned CLI available through `npm exec --yes --package=@railway/cli@5.71.0 -- railway ...` (published 19 Oct, more than seven days old). Its status request failed: saved login expired / grant invalid. Asked Chris to run `npm exec --yes --package=@railway/cli@5.71.0 -- railway login` in his terminal and complete authentication. Do not search for tokens, alter deployment settings or claim release is online. After he confirms login, inspect project/service/domain fresh and deploy specifically to station9-demos; do not blindly merge/push main because the repo is shared with another service. Existing recorded domain `https://www.station9studio.co.uk/` responds with Station9; it is not proof this new Paul build is live. Verify the actual new page and phone layout before sharing a live link.

GitHub push also reported **62 inherited default-branch dependency alerts (2 critical / 28 high / 25 moderate / 7 low)**. No dependencies/security controls were changed in this scoped content release. Local unreleased security work elsewhere in this handover must not be silently mixed into it. Raise this existing warning, do not claim production security was validated.

## Paul wider hero / personal profile / Rox Lyfe map — local review trial

Chris supplied a wider sled-pull photograph and three Instagram caption screenshots, then authorised trying the photo, using the client map and refreshing Paul's coach profile. Paul only: no master, other-tenant, registry or deployment changes.

Source photo `1793662017388924000-8293-226-pasted.jpg` is now the 1024×884 hero.jpg, copied without pixel cropping; prior 870×1024 hero retained at `scripts/reskin/paulgillingham-assets/spares/hero-before-wider-sled-trial.jpg`. Hero focus changed from desktop 50% 18% / mobile 50% 8% to top-centred 50% 0% to preserve his whole head. Desktop remains full bleed; existing phone image-above-headline layout remains. Inspected both: face and hands clear of headline.

Client-map image cropped from screenshot `1793662017392378000-8293-227-pasted.png`, excluding Instagram controls/caption: `images/roxlyfe-client-map.jpg`, 472×267. Native macOS sips used; default python3 has no Pillow. PG_CLIENT_MAP_HTML reuses a responsive, attributed static graphic in homepage #plans and coaching.html. It describes Rox Lyfe's international coaching, not this platform's client database or live tracking. No client/country counts or new location pins invented; no year inferred from the visible 20 August post date. Map text explicitly describes personalised coaching, not customised PDF plans.

Caption panels `...228-pasted.png` and `...229-pasted.png` support retraining as a PT at 25, a caring/listening approach across ages/sizes/abilities, and discussions with Greg in 2022. Wording says they discussed building something together in 2022, NOT that Rox Lyfe was founded then or Paul is its founder. Exact athlete-voice excerpt: “I’m someone who cares. I’m someone that listens.” Homepage Meet Paul lead/list refreshed; coaching team paragraph now carries the personal story. Greg's verified founder/nutritionist role, separate offers, prices and attributed client testimonials retained.

Final isolated source `/tmp/paul-wide-hero-profile-review-2`; durable config `scripts/reskin/paulgillingham.demo.json`. Targeted install: index.html, coaching.html, styles.css, images/hero.jpg and new map only. Prior :4323 files backed up at `/tmp/paul-before-wide-hero-profile`. Screenshots `/tmp/paul-wide-hero-{1440,390}.png` and `/tmp/paul-client-map-{1440,390}.png`. Desktop/touch-sized phone checks passed: real reveal inspected, map loads once per page, personal copy/quote, no overflow or page errors, three distinct offer links preserved, Back return still matches departure exactly. Installed collection ghost gate PASS; strict images/coverage zero unwaived gaps. Await Chris's visual review of this trial. Uncropped name-wall soles and broader Back rollout remain outstanding.

## Paul photo-crop correction — Race Day fixed; complete shoes need a better source

Chris confirmed the Back pilot as “Perfect”, then flagged two Paul crops. The earlier “arch” interpretation was wrong: he meant the **homepage's arched #story profile photo**, not the yellow SkiErg arch on Stations Prep. Do not repeat the claim that the Stations change fulfilled his homepage request.

Paul-only config CSS now bottom-aligns #story's startline.jpg (`50% 100%`) and lowers the Race Day finish.jpg crop (`50% 20%`). Desktop's 640px profile cap had added clipping; bottom alignment removes that extra loss. **The current packed 822×1024 name-wall image itself cuts through the bottoms of the shoes.** Neither the matching gallery version nor CSS supplies those missing pixels. Need an uncropped source with floor beneath the shoes to fully complete the request; no invented pixels or unapproved feet-out substitution. Chris has been told this limitation. Race Day now shows both heads and the full finish-time digits.

Durable changes: local extraCss and three accurate photo alt descriptions in `scripts/reskin/paulgillingham.demo.json`. Isolated source `/tmp/paul-photo-crop-review`; only styles.css, index.html and race-day.html installed into Paul's :4323 preview, with prior files at `/tmp/paul-before-profile-and-raceday-crops`. No assets altered, no other tenant or master changes, no deployment. The Back bootstrap remains in place; broader rollout not performed during this photo task.

Desktop 1440 and touch-sized 390 screenshots inspected; computed positions, image loads, alt descriptions, no page errors and no horizontal overflow checked. The source-clipped soles remain visible at the raw image edge on phone: **do not mark complete shoes resolved without a new source.**

## Paul-only homepage Back-scroll pilot — reviewed positively; broader rollout not performed

Chris asked browser Back to return to the homepage section he left, not the top. Explicit scope is **Paul first**, then review before rollout. Implemented only in Paul's first `copyOverrides` bootstrap rule; canonical `chassis/index.html` and the other 15 sites are unchanged. Do not roll this out automatically.

Reproduced the failure: a homepage reload left `history.scrollRestoration = "manual"`, so a later Back returned from scrollY 10116 to 0. Simply re-enabling native restoration was insufficient: late-loading layout could move the return point roughly 293px, and touch layouts could drift as well.

The pilot stores a small position checkpoint in the current browser history entry (`__s9HomeScroll`), merging rather than replacing other state. For ordinary content/footer links it also records the link's viewport offset in its stable section, so restored layout height can change without losing the clicked spot. Sticky/menu links fall back to coordinates. No extra history entries, storage cookies, local/sessionStorage or server tracking are introduced. A bounded restoration window follows late layout changes; wheel/touch/pointer/key input cancels it and observers/timers are cleaned up. Reload/manual mode returns to auto rather than remaining stuck. Fresh Home visits and deliberate reload-to-top/hero behaviour remain; direct hash links still work. Cached pages are handled via pageshow.persisted without rerunning reload-to-top.

Latest isolated Paul source: `/tmp/paul-back-navigation-review-3`. Only its **index.html** was patched into the existing :4323 Paul preview. Previous homepage preserved at `/tmp/paul-home-before-back-navigation.html`. Durable code is in `scripts/reskin/paulgillingham.demo.json`; no images, copy, client records, video data, registry or deployed pages changed.

Tests: desktop 1440 and touch-sized 390 mid-page and footer links; single Back and repeated Forward/Back; reload before departure; new Home link starts at top; direct #ask honoured; explicit reload clears hash and returns to top; unrelated history state preserved; manual wheel/touch movement not overridden by retries. Actual Chrome back/forward-cache return observed (`pageshow` persisted true while original navigation entry remained reload), and uncached document returns tested. Installed :4323 footer returns match the clicked link position exactly in both sizes; another tenant's homepage compared unchanged. Strict build/image coverage remains 34 filled / 18 waived, zero gaps; ghost gate PASS.

Review at **http://localhost:4323/paulgillingham/** — reload once to load the pilot, scroll down, click through internally, then use browser Back. If approved, move the generic bootstrap into the chassis, remove Paul's temporary override and add the history/layout cases to the shared acceptance checks before updating other tenants.

## Desk Content count and Paul arch photo — latest small corrections

Chris flagged “1 item” under the Desk's published-card preview and Paul's clipped shoes in the arch photo. The first was a genuine count, not a placeholder record: `chassis/video-library.js` now hides that redundant status line only in a non-empty manager preview. No videos/records deleted; empty/error feedback and public library counts retained. Shared fix installed across all 16 :4323 previews.

Paul's yellow SkiErg-arch photo on Stations Prep now retains its native 1024:895 proportions via a local config rule (`height:auto`, `object-fit:contain`), preserving head and both shoes rather than shifting the crop down and cutting off his head. Existing frame/curve retained; photo asset unchanged.

Latest full generated collection: `/tmp/pitch-content-preview-review/<slug>`, installed at the existing `/tmp/pitch-copy-review-2/<slug>` / :4323 links. Complete previous previews are in `/tmp/pitch-review-before-content-count/<slug>`. Earlier collections below are historical snapshots.

Verification: all 16 strict-image/coverage builds pass. With isolated localStorage fixtures, verified the non-empty manager count hidden but card/record retained on all 16 at 1440/390px (32 checks). On Paul, draft save keeps published version, publish updates it, public Watch retains its count, and unpublish keeps a draft and restores empty guidance — checked at both sizes. No user browser storage or server video seed records modified by tests. Arch ratios/crops inspected at both sizes. `scripts/verify-template-preview.mjs` now has permanent Desk-hidden/public-visible count assertions; targeted workflows ran here, not the full script. Node syntax checks pass; ghost gate PASS. No live/registry/video-deliverable changes.

## Shared frames, captions and Partners crops — latest visual review

Chris flagged Prep Club's missing partial frame, generated Fig labels on captions, the white slash before station numbers, and Paul's Partners crop. Fixed in canonical `chassis/prep-club.html`, `shelf.css`, `guidance.css`, `partners.html`; applied to all 16 pitch previews on **:4323**.

- Prep Club now wraps its main photo in the existing `guide-hero-photo prep-hero-photo` figure, reusing the signature-colour corner frame and curved edge. Extra sizing rules prevent the header's fixed height/mobile aspect ratio changing the original Prep image composition.
- Removed the generated Fig prefix and its unused plate counters, not the underlying caption text. Removed the decorative station-number slash, not the station labels/numbers or breadcrumbs.
- Partners uses `shelf--partners`, a right-hand column capped at 300px and natural image proportions, including on phones. No more shallow fixed-height cover crops on those headers.
- Paul's Partners image is a deliberate 836×674 crop retaining his whole head, pointing hand and name, with feet out and the captured Instagram counter removed. Original is `scripts/reskin/paulgillingham-assets/spares/suit-before-framing-fix.jpg`. Updated Partners and Prep selfie alt text. Paul's new full-bleed sled-pull homepage hero and all programme/affiliate fixes are retained.
- Latest complete generated collection: `/tmp/pitch-framing-review/<slug>`, installed at `/tmp/pitch-copy-review-2/<slug>` for the existing **http://localhost:4323/<slug>/** links. Complete previous previews preserved at `/tmp/pitch-review-before-framing/<slug>`. Earlier hero/commercial collections below are historical snapshots.
- All 16 builds pass strict images/slot coverage with zero unwaived gaps; 510 image references resolve; ghost gate PASS. Browser acceptance: 192 page/viewport checks (Prep, Stations, Run, Taper, Race Day, Partners at 1440/390), 32 framed Prep views, 252 caption checks, natural Partners image ratios throughout, no station slash, no horizontal overflow or page errors. Partners photos reviewed; Paul desktop/phone compositions inspected. 18 template tests pass, including two new style regressions. No live site/registry/deployment/video changes.

## Paul hero — full-bleed action photo (latest visual change)

Chris flagged the oversized head in Paul's full-bleed portrait and asked to prefer a naturally suitable full-bleed shot, otherwise use the clean half-page mode. Compared the current portrait, unused sled-pull face shot, clean half-page portrait and existing venue-wide photo in browser-only trials. Chose the unused sled-pull action shot: full head, more surrounding action and better scale, without stealing the venue image from Events.

- Source `sled-pull-face.jpg` moved to canonical `images/hero.jpg`; old portrait preserved at `scripts/reskin/paulgillingham-assets/spares/hero-portrait-before-full-bleed.jpg`. No other photo assignments or waivers changed. Hero remains `heroMode: "full"`, focus 50% 18% desktop / 50% 8% mobile.
- Updated Paul's hero alt text and width/height to the real 870×1024 dimensions in his config. No chassis or other tenant changes. Builds `/tmp/paul-hero-action-review` and `/tmp/paul-hero-action-review-2` pass strict images and slot coverage (34 filled / 18 waived).
- Paul's latest authoritative generated output is `/tmp/paul-hero-action-review-2`, now installed at the same :4323 URL. Previous complete Paul preview preserved at `/tmp/paul-before-hero-action`. The older commercial collection below predates this hero; do not restore its portrait over the new treatment.
- Browser checks at 1440/390px: real reveal canvas observed, clean handoff/removal, no ambient duplicate layer, no overflow or page errors. Settled crops inspected; new photo/head fits both sizes. Installed preview confirms correct image dimensions/alt and retained three coaching offers. Full pitch-review ghost gate PASS.

## Commercial audit — 2 November 2026 (current review)

Chris requested the Paul-style offer/link/source corrections across the other 15 pitch sites, plus affiliate and partner links across all 16. This is implemented locally and installed in the existing **http://localhost:4323/<slug>/** previews.

- Canonical sources: `chassis/`, `scripts/reskin-tenant.js`, `src/template-showcase.js`, active tenant configs. New `coachingOffers`, `partnerOffers`, `offerAudit` / `partnerAudit` fields retain descriptions, prices/commitments, exact destinations, source URLs and unresolved checks. George uses `ggeorge.demo.json`; Faisal uses `faisal.demo.json`.
- Authoritative generated collection: `/tmp/pitch-commercial-final/<slug>`. Installed collection remains `/tmp/pitch-copy-review-2/<slug>` so existing :4323 links work. Complete previous preview directories are preserved at `/tmp/pitch-review-before-commercial-audit/<slug>`. No live :3000 site, tenant registry, deployment, outreach or video changed.
- Replaced the forced three-card catalogue with each tenant's real offer list. The neutral master no longer fabricates Race Ready/Foundations/six-week/twelve-week products. Explicit product URLs survive both runtime scripts and the later `prepareShowcase` pass; regression tests cover that overwrite. All sourced offers appear in promotion choices and the programme launchpad, not just the first two. Commercial price FAQs also derive from the list. Private Desk walkthrough records remain simulated examples, not provider-imported programmes or client records.
- Partner cards now come from structured data. Legacy generic `shop-note` injections are suppressed where that data exists, so newsletter/coaching pages no longer acquire affiliate cards accidentally. Bad destinations and misleading destination labels were corrected; working referral parameters retained. Paul and Michele no longer label Linktree/directory pages as private coaching dashboards. Without a verified client login, training access offers an Ask route rather than a dead button or invented account.
- Added 21 brief sourced excerpts on seven additional sites. Book endorsements and Edge app reviews are labelled separately from coaching clients. Existing Paul's three quotes retained. Source links render per quote; the three-distinct-quote threshold remains. No customer photos copied and no quotations manufactured for sites without suitable evidence. Testimonial footer spacing and the approved visible-testimonial-to-Events transition are shared styling.

### Site-by-site result

| Site | Verified offer / link corrections |
|---|---|
| Burgon | Six routes: Couch to HYROX £30/month; Lite price deferred; Compete from £120/month with 90-day minimum; small groups £89/month (both days £160, PAYG £25); sims; face-to-face PT. Actual enrolment/group/event destinations, three client excerpts, Hysoxs BURGON10, True Physio and Hybrid NW contact route. |
| Kim | Dedicated 1:1, First Time Heroes 12-week, Gym Confidence six-week and Après membership routes. Gym Confidence corrected to Typeform `jyoGk2ng`, not First Time Heroes. Trial and studio membership links checked; no form-hidden prices invented. |
| Zara | One current online-coaching enquiry, not invented Race Ready / six-week products. LSKD, ESN and FivePointFive destinations; ZARALSKD confirmed in supplied bio screenshot. |
| Elation | Real £100/month small-group PT + unlimited classes and £75/month unlimited classes. Three member excerpts; BFA ELATION attribution route checked. |
| Faisal | FITR PMA x HYROX £55/month versus The PMA Method paperback, publisher list £14.99. Book endorsements labelled as book endorsements. Dead PMA domain replaced by live hub; publisher page replaces unavailable Amazon product route. |
| Gabby | One coaching contact form in her official hub, not three fictitious plans. MARCHON/lululemon links retained with no invented discounts or prices. |
| George | Five offers: £100/month 1:1; £45/month hybrid programme (seven-day trial); eight-week programme; £40 beginner and £40 advanced twelve-week running plans. Member login separate. Three client excerpts. Inactive Protein Works short link removed; current GGEORGE/Myprotein 10% and GEORGEGRAYSON15/Castore 15% source adverts recorded; Castore tracking preserved. |
| HTC | Online 12–16 week TrainingPeaks coaching, £15 club drop-in/timetable and programmed run club. Coaching prices withheld because the official page conflicts; no fabricated six-week club plan. |
| Doncaster | Real six-week intro, memberships £67/£83/£99 per month (8/12/unlimited sessions), and simulations £20 members/£40 non-members per person. Source site, membership and sim pages checked in JS browser; three source-published member reviews. No scarcity counters copied. |
| Jade | Paid performance-coaching application distinguished from free video training. No invented Foundations plan. PUMA/Mirafit plus Hilltop's live `lovehilltop.com` destination. |
| Jamie | Edge app membership from £22.99/month; six-month £84.99 and annual £129.99 options from Edge's site. No invented six-week plan or private 1:1 package. Jamie's Edge role sourced; three app reviews labelled as app reviews. |
| Josh | Four real FITR programmes: bespoke £180/month with three-month minimum; HYROX 365 £50/month (opens enrolment); twelve-week plan £60 one-off; Hybrid Performance £19.99/month. Clothing shop separate from coaching. |
| Michele | Live official HYROX coach profile/contact replaces certificate-failing website destinations. No made-up current pricing. Historical Foundations lead preserved in audit notes for confirmation, not declared nonexistent. No private dashboard URL invented. |
| G&H | Hattie's online enquiry; Sculpt & Shape eight weeks; Gregor's actual beginner/advanced/doubles/1:1 programme form. No unpublished prices invented. Own frame shop and Gymshark/DFYNE/TRYKA links/codes kept distinct. `primaryCampaignOffer: "shop"` preserves the frame-shop promotion first without changing its existing creative. |
| TR | Real £179/month 1:1 with three-month minimum (£159 six-month/duo option), versus £120 one-off fourteen-week Benchmark to Breakthrough in FITR. Three genuine client excerpts. |
| Paul affiliate follow-up | Eleven current public partner entries researched via verified Linktree. BFA `/PAUL15` is 404: retain source-listed code with live store, not a fabricated auto-discount URL. Old TrailMaps retouch URL redirects to general catalogue: label the destination accordingly. Londevity/Beet It/Gloovz referral identifiers retained. Reviewed coaching content, photos and compact spacing retained. |

### Verification and explicit limits

- 43 coaching/training/resource cards across all 16 (40 on the other 15), 55 partner/official-link cards, **88 distinct destinations** checked: **82 HTTP 200, six merchant challenges** (lululemon, Castore referral, Mirafit, adidas, DFYNE, Etsy). JavaScript form/product screens also inspected for FITR, Typeform, Stripe and JS-only sites. HTTP 200 alone is not evidence of product identity or coupon eligibility.
- All 16 final generators exit 0, strict images unchanged, zero unwaived gaps. 510 HTML image references resolve. Ghost gate PASS. 16 template-showcase unit tests pass, including four regressions for explicit product destinations, safe URLs and source-offer resolution. Browser acceptance: 222 page/viewport checks across 1440/390px, correct post-runtime offer/partner destinations, visible attributed quotes, no horizontal overflow or JS errors; all programme promotion destinations/FAQs match the catalogue. Additional installed-preview smoke check confirms all 16 homepages stay on the homepage rather than Today.
- **Still unresolved, not silently guessed:** HTC source headline £49 vs FAQ £150/month (doubles £100/person without clear billing unit); Hannah Lite page £69/month vs linked Stripe £60/month; Michele's certificate failure and current Foundations availability/rates (historical £175/eight weeks or two £99 instalments retained); exact merchant mapping/terms for Zara bio code ZARAFPF; content/eligibility behind the six challenged merchant destinations. Existing social codes are source-advertised, not validated by applying them to a checkout.
- No applications submitted, no payment data entered, no carts/codes applied, no purchases or third-party messages sent. Refresh changing prices, stock, availability and codes before pitching. Build contract is at the top of `scripts/reskin/CHASSIS.md`; AGENTS.md points there. Do not use the older intermediate audit directories as authoritative previews.

## Paul — Rox Lyfe offers and social proof

Chris approved updating Paul's homepage coaching panel and coaching page after supplying screenshots of the real offers and testimonials. Durable source is `scripts/reskin/paulgillingham.demo.json`; changes are local to Paul, not new generic offers for other tenants.

- Rechecked `https://roxlyfe.com/coaching/`, `/12-week-training-plan/` and `/doubles-training-plan/`. Personalised coaching uses the existing Paperform application without an invented price. Both downloadable 12-week plans are currently listed at £55 one-off; public note directs purchasers to confirm current price at Rox Lyfe. No scarcity claims copied.
- Shared local `PG_PLAN_CARDS_HTML` keeps the homepage/coaching cards consistent. Explicit personalised/12-week/doubles destinations; no `data-training-link` attributes that would let the generic platform script replace them with the overview URL. Corrected the old 6-week/basic-foundations description of the doubles plan. Coaching replacement also removes the affiliate-card block accidentally injected there by the legacy shop-note regex; Partners page remains intact.
- Added Paul/Greg roles from Rox Lyfe's own copy. Homepage explains the collaboration; coaching page distinguishes personalised support from downloadable plans. Three short verbatim testimonials (Adam Willingale, Barry Trout, Lauren Whyte) replace the prior two-row seed. Existing testimonial renderer now displays three on each page, labelled as Rox Lyfe personalised-coaching experiences, with a visible full-source link. No client portraits or claimed outcomes added.
- Coaching photo uses its natural 849:1024 ratio with contain fit; feet are fully included and alt text matches the championship-wall image. Local testimonial attribution footer padding reset avoids inherited site-footer spacing.
- Isolated builds `/tmp/paul-roxlyfe-coaching-review-{1,2,3}` all pass strict uniqueness and slot coverage (34 filled / 18 waived). Final review-3 is authoritative. Patched only Paul's index/coaching/styles/testimonials/campaign-offers files into the existing :4323 review; previous files preserved with `.before-roxlyfe-offers`. Programme campaign destination now matches the 12-week product page.
- Browser tests: desktop 1440 and phone 390 on both pages, three distinct offer destinations after runtime scripts, two £55 prices, three visible named testimonials, no horizontal overflow; full-photo crop and screenshots inspected; runtime reload check has no page errors. No live registry/deployed site/other tenant pages changed.

## Copy corrections from Paul's screenshot review

Chris flagged five remaining public-copy faults. Fixed Paul's duplicate race-count stat to `2005 / Coaching since`; changed “podium proof” / “caption with” to straightforward results wording without implying Maastricht is the venue of the 1:03:11 result. Removed shared “before any programme pitch” and “once … has your OK” wording; replaced Ask intro with one clean invitation. The actual required photo-consent checkbox remains. Template and active Paul config updated. All 16 builds now exit 0 in `/tmp/pitch-copy-corrections-1`; homepage/Prep Club files patched into :4323 previews with previous versions preserved. Desktop/phone browser checks on Paul confirm the five faults are absent. This screenshot review demonstrates why selected phrase scans are not a substitute for editorial reading.

## Copy review — current isolated preview

Chris requested a broader editorial upgrade after spotting awkward homepage copy on Paul. First pass is in `chassis/` and the active pitch configs; generated reviews are `/tmp/pitch-copy-review-2/<slug>`, served at **http://localhost:4323/<slug>/**. Existing :4321 output, tenant registry and deployed sites were not replaced in this pass.

- Homepage now uses `HERO_TITLE_HTML` rather than a hard-coded headline. `HERO_DEK` is a separate configurable intro with a neutral builder fallback. Twelve configs received individual intros; Gabby/Jamie/Josh/TR retain their existing personalised editorial-pack intros. Paul: “Years of coaching. Race experience that counts.” / “Coaching since 2005. Over 38 HYROX races. Train with Paul for your first start line or a faster finish.”
- First editorial pass covers coaching, tools, run/station/race-day/taper guidance, partner search, crew, results, news CTA, list, links, podcast and Desk leads/clients/finance/programmes. Removed universal podium/Group Coach bylines, public approval notes, assumed meetup schedules, forced regional copy and dating-style doubles language. Kept integration/local-preview caveats. Existing factual coaching guidance is not a completed sports-science fact-check.
- Browser check: 415 core page loads across all 16 sites, with no matches for selected known wording faults or unresolved uppercase tokens. Desktop/phone homepage checks for Paul/Kim/G&H: no horizontal overflow; Paul screenshots inspected. 510 HTML image references resolve. Cross-tenant ghost gate PASS.
- **Duplicate-photo follow-up completed:** Zara race-day `finish.jpg` now uses the previously unused `zb-finish-run.jpg`; G&H homepage Prep Club `doubles.jpg` now uses the previously unused `hattie-dfyne.jpg`. Original duplicates preserved under each asset pack's `spares/`, with `before-duplicate-fix` names. Photo descriptions updated in active configs. Both isolated builds now exit 0 with strict uniqueness enabled and zero unwaived gaps (920ms Zara, 770ms G&H). Only the affected HTML/image pair per tenant was patched into :4323; no registry/live changes. Desktop/phone image-load checks and screenshot review done; ghost gate PASS. Existing pale text on G&H's light Prep Club card is a separate readability issue spotted during the photo check.
- Review is a first editorial pass, not a claim that every dynamic string, FAQ, personal quote or factual assertion has been reverified. Review individual pages with Chris before pitching. The prior photo shopping list still applies.

## START HERE — authoritative end-of-session handover

### Latest session — 30–31 October 2026: Kim pitch, The Desk and visual system

**Read this section before the older 28–29 October snapshot below.** It supersedes older statements about Kim's current preview, audience landing routes and temporary files; older rollout notes remain history, not permission for further rollout.

#### Immediate continuation / scope

Chris approved extending the selected visual treatments to more pages in **Kim's staged test bed**. The first family (predictor, split analyser, Results) is done. Next: Coaching and training guidance (Stations Prep, Run Zone, Taper), then community/events as appropriate to their distinct themes. Continue one verifiable family at a time. **The pixel/photo reveal belongs ONLY on the homepage hero.** Tools must feel like super-classy calculators, not theatrical athletic landing pages.

Do not regenerate Kim, overwrite another tenant, port to the chassis, deploy, push, commit or record video as an automatic follow-on. The approved approach is to experiment in familiar Kim, retain reusable boundaries, then port selected approved work later. Nothing from this session was deployed or committed. The chassis has NOT received these Kim changes.

#### Read in this order

1. `AGENTS.md`, `.windsurfrules`, `.devin/rules/platform-build-and-video.md`.
2. This latest handover section, then older handover sections only as relevant background.
3. `scripts/reskin/CHASSIS.md`, especially **Speedup backlog → Build quality and review improvements — proposed**. The backlog is not execution approval.
4. Current staged source below: begin with `index.html`, `home-editorial.css`, `home-editorial.js`, `styles.css`, `race-instruments.css`; inspect the actual target page and its JS before extending it.
5. For Desk work: `today.html`, `coach-view.js`, `contacts.js`, `integrations.js`, `desk-config.js`, `clients.js`, `client.js`, `leads.html`, `booking-ui.js` and the local acceptance suite.

#### Authoritative current working locations / preview

- **Kim working build:** `/tmp/roxjaya-coachedbykim-20261029-final-10/`.
- `/tmp/coachedbykim` is a symlink to that staged directory, verified at handover.
- **Preview:** `http://localhost:4173/coachedbykim/?audience=public`.
- **Coach home:** `http://localhost:4173/coachedbykim/today.html?audience=coach`.
- **Tour:** `http://localhost:4173/coachedbykim/tour.html?audience=coach`.
- **Tests/artifacts:** `/tmp/roxjaya-clientdesk-test/`; suite: `desk-acceptance.cjs`; Playwright dependency is in that folder's `node_modules`.
- On 31 October at handover, the preview returned HTTP 200 with `cache-control: no-store`, and both temporary directories and symlink existed. Recheck in the next window; do not assume the server survived.
- **Critical:** these are temporary working sources, NOT a durable canonical installation. `/tmp` may disappear on restart. This handover preserves decisions and locations, not the full staged source. Do not rebuild from an older tenant/chassis over this work. Preserve the staged build/tests to a durable location before a restart or any destructive operation, with scope agreed with Chris. No source backup or chassis port was performed by writing these notes.
- If preview is down, inspect the existing preview-server arrangement; serve the staged build under `/coachedbykim/`. Do not replace it with a different tenant or overwrite the symlink target. `npm start` at the repo root serves a different application and is not automatically the right preview.

#### Product brief — the important correction

This is a **personalised pitch to the coach**, not yet a client-conversion optimisation project. Preserve breadth, capabilities and wow. Coach collaboration will determine the final production offer and layout later. The buying argument is: **“This looks like me. People would use it. It could grow my business — and I could manage it.”**

Weight each capability by ownership appeal, local-peer distinctiveness, athlete value, commercial value, ease of demonstration and credibility. Split analyser, predictor and partner finder are standout attractions, not peripheral utilities. Repetition is justified when its job changes: discovery on homepage, utility in navigation, context beside a race, business explanation in coach tour. Do not strip richness merely to shorten the page.

The public experience remains athlete-facing; business/nurture mechanisms are explained in the coach tour, not to public visitors. The community wall is a major emotional pitch asset: **“My people, under my brand.”** Include recognition/belonging alongside race numbers, not just podium/elite messaging. Do not invent transformations or imply permissions.

#### Homepage pitch structure now implemented

Files: staged `index.html`, `app.js`, `planner.js`, `match.js`, `coaching.html`, `data/training-platform.json`, `prep-club.html`, `tour.html`.

- Existing brand/hero preserved. Early **standout tool showcase**: featured split analyser, partner finder, predictor, then a visible free Prep Club route. Original station/run/event/Ask Kim guide routes remain in an expandable section.
- Coach story → coaching offers (personal coaching, First Time Heroes, Gym Confidence) → connected events → partner section → Results wall / community photo wall → supporting stories/content → detailed tips → enquiry. `app.js` reorders the existing section nodes at load, preserving IDs/handlers; do not assume source HTML order is rendered order.
- Event cards sort upcoming confirmed races from existing `data/cities.json`. Each offers **Prepare for this race**, **Find a partner for this race**, **Plan the weekend**, plus days remaining.
- Partner link uses `find-a-partner.html?race=<city-slug>#partner-form`; `match.js` sets the matching race option after async loading. It does not silently replace or filter the entire public board.
- Preparation link uses `coaching.html?race=<city-slug>#race-prep`. `planner.js` renders a contextual panel from the same city data. Longer lead time can suggest exploring a structured build; short lead time points to focused prep/pacing/taper, not squeezing a 12-week programme into two weeks. No new coach product or guaranteed peak condition is claimed.
- Preparation enquiry leads to homepage `?race=<race-name>&audience=public#ask`; `app.js` prefills the question with that race. External coach applications remain the existing verified destinations; no fabricated application integration.
- Gym Confidence application destination was recovered from the existing Partners page, not guessed. Homepage official-links offer card became Gym Confidence; official studio links remain in supporting copy/content.
- Repeated “verified Typeform route / no invented codes” handover-language removed from key offer copy. Coaching's misleading “Already a client → application” card became Gym Confidence, with a smaller truthful returning-client signpost.
- Public Prep Club copy no longer tells athletes they are being sales-nudged or describes avoiding coach posting work; the coach-side readiness mechanism remains.
- Tour rebuilt as three journeys: **race insight → coaching conversation; event → partner → preparation/Prep Club/community; Today → client support/renewal → campaigns**. Public previews open separately. Walkthrough examples are described as examples, not fabricated live integrations.

#### Approved visual vocabulary — preserve these choices

Homepage-only experiment lives in `home-editorial.css` + `home-editorial.js`, linked by `index.html`, gated by `body.home-lab`. Other pages must not import all homepage effects indiscriminately.

Chris explicitly likes:
- Hero photo pop/swell and **the small curved bottom edge** — a keeper. Homepage pixel reveal stays unique there.
- Tactile button lift/pop and pink colour haze; black buttons balancing red. Keep phone controls touch-friendly.
- Fonts, oversized editorial headings, fine rules, pink dashes/blobs, numbered guidance and varied list furniture used purposefully.
- Ivory athlete-profile treatment, arch photo and partial hairlines. Dark/light contrast, sharp typography and soft actions should feel authored, not like identical rounded UI cards everywhere.
- Smaller action buttons beside race dates: compact primary prep action, partner search as an underlined secondary link, quieter weekend link. Phone targets remain 44px.
- Ivory community contact-sheet wall, polaroid lift/straightening and lightbox.

Specific final states / rejected options:
- **Analysis preview box:** upright, rounded 16px, no tilt, no offset shadow and no hover tilt. Chris rejected the slant as not high end.
- **No travelling scan line.** It was trialled then removed at Chris's request. Keep the pink question pop/highlight only.
- Sequence now: 1-second settling delay, then 3 seconds per question, starting at 1s / 4s / 7s. Pink is held during 20–75% of each interval; no overlap, no looping; about 10 seconds total. Chris approved this slower pace. Defined in `editorial-highlight` in `home-editorial.css`.
- **Partial photo contours:** SVG paths with non-scaling strokes, not full enclosing frames. Athlete arch: upper-left shoulder to apex, 1px, 7px outside photo. Ask Kim portrait: left-side arc stopping short of top/bottom, open towards the text, 1.5px on dark background; rotates on phone when text sits below. Removed original full portrait ring/shadow.
- Added matching open top-left contour to the wall-ball photo in “Not in the rulebook”, 1.5px, right/text side open. All use the SAME brand pink `#e63950`; weight differs for contrast, not hue. SVG markup lives in `index.html`; styling in homepage CSS. Do not restore the clipped decorative badge/sliver under the athlete photo (its pseudo-element is disabled).
- Home entrance choreography uses IntersectionObserver + MutationObserver for dynamically inserted event/photo cards; no new animation dependency. Reduced-motion bypass, keyboard focus reveals and normal scrolling retained. Original app reveal rules still exist for other pages.

#### Shared brand correction — now universal within Kim

Initially the signature fix was homepage-only; Chris caught the dark wave on tool pages. It was moved into staged **`styles.css`**, and duplicate homepage rules were removed.

- Byline and underline/swish share a stronger pink (`color-mix` of brand pink 78% and white).
- The moving highlight through BOTH is **white**, not the old dark `#1f1218` stripe.
- The underline uses its original shape as an SVG CSS mask so the same gradient can travel across it.
- Shared reduced-motion rules stop both animations and retain the base colour.
- Verified computed gradients on homepage, predictor, analyser, Results and Coaching: white highlight present, old dark gradient absent. Pages without that signature markup are not newly given one.
- This is shared across **Kim's staged pages only**, not globally installed in the chassis/other tenants.

#### Race intelligence family — first extension completed

Files: `race-instruments.css`, `predictor.html`, `splits.html`, `results.html`. Pages opt in with `body.race-instrument`; stylesheet not loaded by homepage or Desk.

- Compact, consistent headers and quiet photography; NO `emerge.js`/homepage reveal. Photos are suppressed on narrow phone layouts to prioritise inputs; no capabilities removed.
- Precise labels, fine rules, tabular numbers, restrained input focus, two-column desktop forms / single-column mobile, subtle run/station grouping. Pink controls and step labels; existing nav zone colours remain intact.
- Predictor heading “Set a target. Know the numbers.”; main form “Your race inputs”; submit “Calculate my estimate”; output “Your race estimate”. Optional extra details collapsed in native `<details>`; form inputs/algorithm preserved. Placeholder shortened to `e.g. 1:30`.
- Ivory estimate readout with large finish time; refined breakdown tables. Split summary as measured readouts, tidy Results tools/tables.
- Real predictor (including comma input), split submission and Results search/mode tested. Filtering hides existing rows, so tests must count visible rows, not total DOM rows. Calculation logic was not changed in this visual pass.

#### Coaching & training-guidance family — second extension completed

Files: `guidance.css` (new), `coaching.html`, `stations-prep.html`, `run-zone.html`, `taper-zone.html`. Pages opt in with `body.guidance` + modifier (`guidance--coach|--field|--pace|--calm`); stylesheet not loaded by homepage, instruments or Desk. Shared rules: compact hero + corner hairline, ruled station rows, spec readouts, `h4.cue` serif pull-quotes, auto-numbered `Fig.` photo plates, instrument-style inputs, matching FAQ/cta-band. Structural markers use `--zone-accent` (teal) via `--guidance-accent`; signature pink reserved for voice/actions. Per-page flavour: Stations field-guide `/ NN` numbering, Run directional `→` markers, Taper calmer spacing/muted labels, Coaching warm editorial ruled plan columns + tactile buttons.

- **Hover pink top-rule pattern (apply to later families, not yet ported):** `border-top:1px solid rule` on a panel/list row, `border-top-color → pink` on hover (hover-capable pointers only; featured items get NO permanent pink line — Chris explicitly asked the permanent edge be dropped and hover applied to all). First used on homepage `pitch-tool` + coaching `coach-plans`. **Apply on the next visual passes to:** events/calendar cards, partners + prep-club/community cards, news/story cards, race-crew panels, and ruled rows on remaining Desk/tool pages where panels already carry a top rule.
- Bug fixed in passing: `#race-prep` panel on coaching.html rendered as an empty bordered box — `.plan`'s `display:flex` beat the `hidden` attribute; `.guidance [hidden]{display:none!important}` added (same guard as race-instruments).
- Verified: all four pages 200, zero 1440/390 overflow, no JS errors, Run Zone calculators exercised, race-prep hidden-empty/populated-with-race confirmed, hover line screenshot-checked.

#### Community & events family — third extension completed

Files: `community.css` (new), `race-crew.html`, `find-a-partner.html`, `list.html`, `news.html`, `events.html`. Pages opt in with `body.community`; events adds `community--itinerary`; find-a-partner stays off `zone-acc` so it keeps signature pink (it is a black action item). Same accent contract as guidance (`--community-accent`, teal on zone-acc). Community feel: tactile index-card match/travel cards with hover lift + pink top line, mono chips, ruled zone columns with hover pink top, pink-dash `roundup-list` (numbered variant for `ol`), serif coach-take quotes in the news list, itinerary event rows with pink-left date column + hover pink top rule, join-the-list warm minimal form. Itinerary extras on events: pink countdown ticket, mono city tabs, ruled plan-cards/tables. News board, partner/travel boards, city planner tabs, countdown and RSVP editions all exercised — populated correctly, zero 1440/390 overflow, no JS errors.

**Scroll reveal extended:** the homepage's existing `.reveal` drop-in now applies to every public page, not just the treated families — predictor, results, splits, prep-club, partners, shop, watch, podcast and training got the same `reveal` marks, and their late-rendered content (results divisions/roundups, video cards, prep-club feed) calls `revealScan()`. IMPORTANT: `reveal` requires app.js — intake.html and planner.html don't load it, so they were deliberately left unmarked (marking them would hide content). — `window.revealScan()` exposed in app.js so late-rendered content (news rows, race rows, match/travel cards, station-9 card, city guides) gets observed after fetch. Sections, figures, plan/zone cards, specs, FAQs and bands marked `reveal` across all nine styled pages. Verified: every in-view element gains `.in` on scroll, zero page errors, hidden race-prep panel still reveals when populated.

**All page families treated.** Hero-photo convention confirmed: homepage bottom-right sweep (`0 0 48% 8% / 0 0 7% 2%`) + 56px/2px pink corner tick; hero imgs must be `object-fit:cover` + fixed height so the tick hugs the photo edge.

#### Race Day page — new page added to guidance family (post-audit)

New `race-day.html` on the staged build, `body.zone-acc guidance guidance--raceday`, same stylesheet stack as the other guidance pages. Timeline structure (Night before → Race morning → 60/30/10 min → Start line → During → Do/Don't quick reference) covering: night-before food/sleep, morning meals + supplements, heel-lock laces + why, Roxzone walk + why, box breathing + why, mental rehearsal with physical mime, gel timing, mustard/pickle-juice cramp trick. `guidance--raceday` adds `.dodont` two-column ✓/× lists (teal do / pink don't; `.article ul` dash rule now excludes `.do`/`.dont`). Nav "Race day" link added after Taper zone in the Race Tools dropdown on all 20 public navs + `data/nav.json` Race Tools group (position 7) for coach-preview injection. Footer link added on the page itself. Verified: 200 at both `/race-day/` and `/race-day.html`, zero 1440/390 overflow, all reveals fire, FAQ + Article + FAQPage schema included. Candidate for chassis port once approved.

Files: `desk.css` (new); `today.html`, `tour.html`, `leads.html`, `campaigns.html`, `clients.html`, `client.html`, `desk.html`, `manage-programmes.html`, `manage-videos.html`, `platform-setup.html` opt in via `body.desk-page`. Calm/efficient workspace layer over the pages' own inline layouts: mono section labels + tags, tabular numerals on all stats/amounts, quiet hairline borders, mono instrument tabs for filters/switches, one pink top-rule for next-step panels, dashed preview notes, pink focus rings. Deliberately NO scroll reveal — desk tools stay instant, and several desk pages don't load app.js. planner.html keeps its own booking.css theme. Verified: all 10 pages 200 at audience=coach, zero 1440/390 overflow, no JS errors, Today/Clients render queues and stat strips correctly.

**Long-list capping:** `desk-more.js` (new, loaded on desk pages with long lists) exposes `window.deskCap(list, {noun, limit})` — renderers call it after filling a container. Adds a mono count line at the top ("20 clients — first 8 shown") and folds the rest into a dashed "Show all N …" expander. Wired into: leads list (6), clients list (8), finance desk-list (6), campaign responses (5), video-records (6), client timelines (5, both clients.js and client.js), message history (8). Safe on re-render — rebuilds from current children.

**Still untreated (later passes, in rough order):** none — every family done. Remaining open items: parked homepage hero red-banding (deliberately unfixed), and any selective port to chassis if/when approved.

**Full style audit (end of pass):** coverage matrix verified — every HTML page's body class and linked stylesheets match its intended family; no family stylesheet loaded on a page outside that family; no missing links; no duplicate links. Intentional exceptions: `planner.html` (booking.css theme, no family css), `race-planner.html` (redirect stub only), `intake.html`/`planner.html` (no `reveal` marks — they don't load app.js), Desk pages (no reveal — instant tools). Two drift defects found and fixed: (1) `race-instruments.css` still carried the pre-audit hero treatment (44px asymmetric rounding + small 1px tick) — now matches the site-wide convention (bottom sweep + 56px/2px tick); (2) card hover rules in `shelf.css`/`utility.css`/`desk.css` were not gated behind `@media(hover:hover) and (pointer:fine)` like guidance/community — now gated so touch taps don't leave sticky highlights. Final sweep: all 21 public pages + 10 Desk pages at 1440 and 390, HTTP 200, zero overflow, no JS errors (one known favicon 404).

#### Utility family — fifth extension completed

Files: `utility.css` (new), `watch.html`, `podcast.html`, `training.html`, `intake.html` opt in via `body.utility`. Instrument-adjacent treatment: mono filter tabs on the video library, poster-plate video cards with approved pink top-rule hover + subtle image zoom, mono card eyebrows, training route cards with same hover pattern, intake as a proper instrument form (ruled health-question rows, radio pill chips with accent :checked state, accent focus rings, dashed consent row). planner.html deliberately NOT in this set — it is a themed booking surface with its own booking.css. Verified: 200s, zero 1440/390 overflow, no JS errors, radio chips functional.

#### Shelf family — fourth extension completed

Files: `shelf.css` (new), `partners.html`, `shop.html`, `prep-club.html` opt in via `body.shelf`. Tagged-shelf look: mono stamp chips on cards (teal on zone-acc pages, pink on Prep Club), dashed ticket-stub "verified" marks, approved pink top-rule on hover + card lift, corner ticks on hero/prep photos, pink top-rule on the join panel, pink-dash notes. Verified: 200s, zero 1440/390 overflow, no JS errors, cards counted (4/3/9).

#### Earlier functional work in this continuation — keep it working

**Prep Club / unified foundation:** `contacts.js`, `integrations.js`, `desk-config.js`, `nav.js`; small config files under `data/desk/` (programmes, templates, settings, prep-club-feed), site-wide `data/nav.json`. Prospect/member/lead/client slices plus events on shared contacts. Legacy keys mirror for older app/campaign code. Do not claim all demo data is config-driven: seeds still exist in `clients.js`; feature flags/demo-data isolation and a clean canonical port are unfinished. Store migration/event idempotence deserves a separate future review, not a claim of production readiness.

**Lead Desk / tour routing:** fixed missing coach-preview attribute on tour that had rewritten six links to public and bounced them home. `?lead=` selects an enquiry, scrolls it into view and opens reply area on phone. Origin links open separately. Tour now uses meaningful examples/deep links rather than generic top-of-page destinations. Lead source/status/nudge remain browser walkthrough state.

**Client records:** collapsed timeline on register and detail; content assignment refuses at final set and suppresses identical consecutive assignment entries. Contact email/phone wrap on separate lines. Editable watch list: add/remove all eight stations plus compromised running/Roxzone, timeline entries, case-insensitive exclusion of existing labels. Known limitation to consider later: structural re-renders should not silently discard unsaved notes elsewhere; not comprehensively tested.

**Check-ins:** collapsed structured panel (energy, sleep, training difficulty, pain, note). Saving no longer increments workout completion. Flagged check-ins require explicit review, retain notes and leave Today after review. Intake review likewise explicit. Do not equate saving/receiving a check-in with resolving a pain issue automatically.

**Intake:** `intake.html` + `intake.js`; browser-local health questions/emergency contact/consent. Existing email attaches to client/contact, unknown email becomes a lead. Contact fallback handles intake submitted before Client Desk seeds initialise. Reviewed flag shown on record; not a certified PAR-Q, legal waiver or secure production health-record system. No real sensitive test data.

**Booking request decisions:** client record supports cancel/reschedule requested, charge or waive; decisions log to timeline. Guard against repeated charge after resolution. This client-record walkthrough is not a verified complete sync with planner sessions/payment provider. Do not claim production cancellation-policy automation.

**Today:** new coach home and return destination; signature-colour Today button, permanent Support mailto toolbar item with page context. Toolbar consistently ordered: **Today, Bookings, Clients, Leads, Programmes, Content, Finance, Campaigns, Tour, Support**. Some pages had missing menu entries; reconciler now fills them. Public preview retains explicit return to Today. Presentation switch is not authentication.

Today shows next confirmed/in-progress session, real browser-persisted planner events for today's London date, decisions, messages, check-ins, renewals due now/upcoming, new leads. Booking rows open the specific planner dialog; client rows deep-link/expand the relevant section. Ordinary groups show three then “Show all”; decisions remain visible. Desktop day column left / attention right; phone next session → decisions → schedule → other. Empty schedule compact. Uses storage/visibility/pageshow updates to refresh on returning or another tab's action. Replied leads no longer stay in the action queue. No follow-up-due scheduling feature was invented.

**Planner:** `booking-ui.js` now persists `{events, seeded}` under `coachedbykim.planner.v1`; Today reads it. Planner supports `?booking=<id>` to open the matching booking dialog. New browser needs planner initialisation; Today says so rather than making up appointments. Browser-local walkthrough only.

**Programme starter path:** `manage-programmes.html` explains the floor-coach-to-hybrid opportunity before the existing-provider route. Client record signposts own library or “Trainerize, for example”. Important boundary: content-set assignment changes demo state; it does not prove authenticated private workout delivery/client access. Chris understands demo caveats and does not want repeated public disclaimers or a new training app project.

**Tool fixes earlier:** readable light input text in `guide.css`; predictor accepts colon/comma/period time separators, plain numerical placeholders and clearer output. Split preview email optional, split inputs/parser accept comma/period too. Native name/date/division/all-16-splits/consent validation must be filled in real tests. Preview history note corrected; found two null `history-link` dereferences after that note removed the anchor, now guarded in `splits.js`. Do not reintroduce those errors.

#### Known unresolved visual issue — parked by Chris

Dark rectangular patches in red text were reported in BOTH Safari and Chrome, moving during the homepage photo reveal then partly remaining. Not reproduced reliably in our headless captures; do NOT call this fixed. Investigation found transparent WebGL over an opaque stage. Current trial in staged `emerge.js`: `alpha:false`; homepage CSS adds `isolation:isolate; contain:paint` to hero. Canvas removal after reveal and restored photo visibility were verified, but Chris still saw some patches and chose not to spend the day isolating it. Keep parked unless asked; do not remove the approved hero reveal/curve/pop as an unrequested workaround.

#### Tests and artifacts

- Repeatable suite: `node /tmp/roxjaya-clientdesk-test/desk-acceptance.cjs`.
- It launches installed Chrome through Playwright, with a fresh browser context/synthetic data. Main coverage: pain/intake review, payment resolution, renewal, lead reply/unread clearing, correct expanded deep links, no workout increments from check-ins, charge/waive and repeated-charge guard, case-insensitive watch options/persistence, cross-tab refresh, schedule booking approval, toolbar completeness, coach/public return destinations, desktop 1440 / phone 390 overflow and JS errors.
- Last full suite run passed after the homepage pitch restructure. Later visual-only passes ran targeted real tool submissions, Results filtering, contour/lightbox checks, computed signature styles, reduced-motion and 1440/390 overflow checks. Do not present these as exhaustive tests of all Finance/campaign/content combinations, real APIs or all browsers.
- Local screenshots in test folder include `editorial-*`, `hairline-*`, `tips-hairline.png`, `pitch-*`, `instrument-*`, `signature-fixed.png`, header-band captures and hero compositing check. Check timestamps/current source before relying on them: some screenshots show superseded teal controls, the removed scan, or earlier line treatments.
- Current tool tests: predictor `1,30`, valid race/division, 5K `24:30` or fitness fallback, stations selection → visible estimate; invalid `banana` → plain-English format error. Analyser: name, event/date/division, 16 valid splits, consent, optional email/Roxzone blank → visible analysis/history. Results search unmatched → 0 visible athlete rows; “Kim” restores matches; all-finish mode changes records.
- A load-only test is not acceptance. Render/scroll to trigger reveals, wait for async config/data/save completion, fill every required field, exercise the actual action and verify the resulting state. Don't dismiss failed assertions as test mistakes without investigating; several genuine bugs were found that way.

#### Backlog and asset note — not permission for a side project

- Durable tooling discussion is in `scripts/reskin/CHASSIS.md` under the Speedup backlog: permanent Playwright/audit reports, isolated outputs/worktrees for existing three-way agents, improve current Apple Vision scoring before buying new vision services, slot-aware crops (NOT blanket `center 25%`), optional Cloudinary/Argos pilots, optional Herdr supervision, Obsidian only as a view over existing notes. No services installed. Existing agent locations still need investigation; Chris said find them later.
- Chris remembers a photograph of Kim **in her gym with green neon ceiling lights**. Locate/inspect it before suggesting placement; no photo was found/swapped during this session. Do not assume an image filename or relabel another activity.
- Other visual-family plan: Coaching/expertise editorial and warm; Stations as a field guide; Run directional/pace-led; Taper calmer; community tactile/human; events itinerary-led; Desk calm and efficient. Repeat the language, not every composition. Partial contours should remain selective. No hover-only content, no forced scroll, reduced-motion supported.

#### Handoff behaviour

Explain in plain English, keep changes atomic, verify actual desktop/phone interactions and give a three-step manual review after each block. Record what is local versus ported versus deployed. Chris likes bolder experiments that can be cut later, but preserve explicitly approved details and keep the public experience inspiring rather than a technical handover. Next window should acknowledge this state and continue the approved visual extension, not restart the product discussion or silently implement tooling backlog items.

---

This snapshot supersedes older progress notes below. **Chris subsequently authorised working through all nine targeted site-upgrade plans overnight for morning review**, without waiting for a pilot review between sites. He asked that unresolved inputs be noted and worked around safely. That specific local site task has now been carried out as described immediately below. The older planning-only gates remain historical context, not a reason to redo the work or permission for further work. No video changes, outreach, commits, pushes or deployment were authorised or performed. Template review is still not formally signed off.

### Latest session — 28–29 October 2026 (read this first)

Everything below is **local only**. Nothing was committed, pushed, deployed, recorded or sent to a prospect. `git status` shows ~1,240 uncommitted changed/untracked files on `main` since commit `a77a10fd`. That includes this session's work and earlier uncommitted work. Commits need Chris's go-ahead.

**The Mac restarted on 29 Oct, which wiped `/tmp`.** Every preview server from this session is down, and the staged review builds of Paul (`/tmp/paulgillingham-review-v20`) and Michele no longer exist. Both rebuild from their configs (see "Previewing" below). Nothing in the repo was lost.

**1. Michele Wilder demo built (staged, not in the repo).** Config: `scripts/reskin/michelewilder.demo.json`; assets: `scripts/reskin/michelewilder-assets/`. This is the reference example for hand-built chassis configs. Agreed with Chris during review:
- the hero copy is kept clear of her face
- the "Stories, tools and community links" section is removed
- testimonials are hidden (only one quote, which still needs approval)
- no Fuel Zone
- neutral captions on group images whose relationship to her is unknown
- her config-level workarounds were removed once the chassis absorbed the fixes

**2. Chassis + video-site rollout (Chris approved).** Applied to the chassis, the 8 video tenants (`trainedbytr`, `coachedbyzara`, `jadeskillen`, `jamiebarker`, `elationfitness`, `faisalpma`, `joshharrison`, `getfitgabby`), plus Paul and Michele:
- Grouped six-item nav: Book a session · Find a race-mate · Coaching▾ · Race Tools▾ · Community▾ · More▾. Join the list sits under Community; Partners and Shop under More; the "Links" label is corrected to "Shop".
- The booking strip under the hero is gone. It was being re-injected by `scripts/booking-planner.js`; that injection is removed.
- The sticky CTA is now "Coach with X" and waits until the hero buttons have scrolled away.
- Event cards: 120px date column + 48px desktop gap.
- "In their words" testimonials only appear with 3+ distinct approved quotes.
- `cfg.menu` overrides now actually apply (matcher fix in `reskin-tenant.js`).

The 8 video tenant folders were **patched in place, not rebuilt**, to keep hand edits (e.g. trainedbytr's crew photo). Details: CHASSIS.md "Rollout (Oct 28)".

**3. Nav zone colours (Chris approved; generalised from G&H).** Three solid colour blocks with no reordering:
- black: the action pair (Book, Find a race-mate)
- signature colour: Coaching▾
- a per-tenant dark complement (`--zone-accent`): Race Tools▾, Community▾, More▾

Where it's implemented:
- chassis `styles.css` (`--zone-accent`, `.nav-sell` / `.nav-acc`) and the classes in 16 chassis pages
- `reskin-tenant.js` (`colors.zoneAccent`, default `#b45309`)
- `colors.zoneAccent` added to 10 configs (the 9 below + Michele)
- the 8 tenant folders patched in place

Allocated accents:

| Tenant | Signature | Accent |
|---|---|---|
| trainedbytr | `#8b5cf6` | `#b45309` |
| coachedbyzara | `#ef4f91` | `#15803d` |
| jadeskillen | `#c6f24e` | `#7c3aed` |
| jamiebarker | `#e8452c` | `#0e7490` |
| elationfitness | `#f4d000` | `#1d4ed8` |
| faisalpma | `#f5c518` | `#1d4ed8` |
| joshharrison | `#ff2e63` | `#0f766e` |
| getfitgabby | `#e63946` | `#0e7490` |
| paulgillingham | `#f4c20d` | `#1d4ed8` |
| michele | `#17b8a6` | `#be123c` |

Michele's accent was added at the end of the session and hasn't been seen in a browser yet. **Rule for every new tenant:** allocate a dark complement of the signature colour that is readable on white (CHASSIS.md "Nav zone colours"). At the end of the session the 9 configs were also rewritten so em dashes and curly quotes read normally again (an earlier script had turned them into `\u` escapes). The content is identical.

**4. Gregor & Hattie (protected; targeted maintenance only, each pass approved).** See the two "G&H nav…" sections below.
- Nav order: Shop▾ · Podcast · Coaching (signature blue) · Book a slot · Find a race-mate (black) · Race Tools▾ · Community▾ (deep amber `#b45309`).
- Amber is echoed in eyebrow and step labels on the 8 tool and community pages.
- The stray red "the ninth station" footer credit is now amber.
- The durable sources in `scripts/reskin/racetoframe-pages/` match the live pages.

**5. Other.**
- `BILLIONS.md`: "Outrigger #6 — artist sites, networked" (parked idea).
- `PROSPECTS.md`: Coach Kim entry updated.

**6. Coach Kim (Après London) — photo intake done, build NOT started.** This is the next job.
- Everything is in the Coach Kim section of this file (search "Coach Kim (@coachedby_kim)") and in `scripts/reskin/coachedbykim-source/MANIFEST.md`.
- The manifest holds 80 graded files in `incoming/`, a FINAL SHORTLIST of about 22, station coverage, a voice/quote harvest and the open questions.

Chris's decisions for the build:
- Use the pasted images as they are (about 1024px). Most pitch viewing is on mobile, so originals aren't needed yet.
- Burpees use kim-028, weak but real, not text-only. `chassis-demo-assets/images/gallery/stock-burpee.jpg` exists, but its licence isn't recorded anywhere, so don't swap to it without checking.
- Nobody knows which woman on the GYMRACE board (kim-024) is Kim, so don't caption by position.
- No discount codes exist.
- @coach.dillz and @dillzinmotion are the same coach.
- **Crew meetups page:**
  - kim-058 (gold dress) is the top "join me" image.
  - Drop the "Station 10 — dance floor" section and every other mention of dancing: hero line, race-weekend copy, fine print, meta description and FAQ/structured data.
  - Keep the template's generic crew-dinner photo further down.
  - Mechanics: the hero uses `images/gallery/restaurant.jpg` and the dance section uses `images/gallery/dance.jpg`. With `customCrewAssets: true`, supply kim-058 as `restaurant.jpg` and copy the template dinner photo (`scripts/reskin/chassis-demo-assets/images/gallery/restaurant.jpg`) into a body slot with honest alt text. Alternatively keep `customCrewAssets` false and override `src`. Either way, check the result in a browser.

**Previewing (servers need restarting after the restart):**
- **Repo tenants:** `python3 -m http.server 55941 --directory /Users/chri/Desktop/roxjaya`, then open `http://127.0.0.1:55941/<slug>/`.
- **Staged builds:** `node scripts/reskin-tenant.js scripts/reskin/<cfg>.demo.json --output-dir=/tmp/<slug>-review-N`. The config path is the first argument; there's no `--config` or `--help`. The folder must be new each time.
  - Then serve a root folder containing a `<slug>` symlink to that build, because pages use absolute `/<slug>/…` paths.
  - Example: `mkdir -p /tmp/<slug>-root && ln -s /tmp/<slug>-review-N /tmp/<slug>-root/<slug> && python3 -m http.server <port> --directory /tmp/<slug>-root`.
- Browsers cache hard here, so use Cmd+Shift+R after changes.

**Build-speed lessons (status checked 29 Oct):** read "Before every build — checklist" at the top of `scripts/reskin/CHASSIS.md` before building.
- **Done:** grouped nav, booking strip, sticky CTA, event spacing, Links→Shop, the 3-quote testimonials rule, the `cfg.menu` fix, and the new read-only checker `scripts/reskin/lint-overrides.js`.
- **Still not done, so handle by override:** the "Recorded half-marathon" label; FITR / Warriors / TrueCoach / "365 clothing line" wording left in the chassis; the WhatsApp icon on the Instagram button; the dance-floor toggle; a hero text-width setting.
- **Speed backlog, untouched:** `--force` on the output folder, a config scaffolder, sheet-aware shortlisting, image cache-busting, missing-slot reporting.
- **Before Kim's build:** run the checker on a copy of Michele's config and delete the dead overrides first.
- **Time every build (Chris, 29 Oct).** Record each stage's start and end times and anything that slowed things down in `scripts/reskin/BUILD-LOG.md` during the build. Kim's build is the first one to time properly. The log already notes the intake lessons, including putting photos straight in a folder instead of pasting them in batches.

**Open items Chris may want:**
- Rebuild and re-check Paul and Michele, including Michele's new accent.
- A commit of the session's work (needs his go-ahead).
- Whether the minimal-nav pages (watch/podcast/shop/training) should get the full nav.
- A dance-floor on/off template toggle (CHASSIS.md template candidates).

### Earlier — canonical Desk upgrade and video-backed site rollout, 26 October 2026

**Chris approved the reviewed G&H design for the canonical template and all existing video-backed demos, as appropriate to each business.** This supersedes the older G&H-only/no-template-rollout hold below for this specific bundle. The canonical update and targeted ports are installed locally. No videos, outreach, commits, pushes or deployment were authorised or performed. Further new features still need agreement.

#### Coach homepage and public-preview loop — specifically resolved

- The coach homepage WITH The Desk tools is the default landing/return destination. The Desk heading is now a real coach-home link (`?audience=coach`), and private footer return links go to that homepage rather than silently entering public view.
- **Preview public site** opens a separate tab. Every enabled public-preview page has a labelled preview banner and **Back to coach view** doorway. That return is marked as a coach link so the public-navigation handler does not rewrite it back into `audience=public`. Public menus/logo stay public within that preview until the explicit return. This is demo chrome, not part of a production public build with coach preview disabled.
- The exact reported G&H Content → public preview → coach return flow was checked on the actual existing 3034 review server, not only on a staged copy. Refresh existing tabs to pick up the updated script/cache marker `v=2026102604`.

#### Canonical template

- The Desk / Your coaching tools; Bookings, Finance, Campaigns, Programmes, Content. Separate `desk.html` finance and `campaigns.html` promotions, with old finance campaign hashes forwarding. Private workspace pages have no public menu, and the toolbar is placed after the private masthead. Public coach-preview pages retain the public menu. Booking toolbar contrast and coach/client section headings are handled without changing shared booking logic.
- Clear two-panel programme workspace, configurable provider setup (`platform-setup.html`), named actual offer links with duplicate destinations suppressed, and known-provider defaults retained. Unknown programme/application URLs no longer masquerade as provider logins in `resolveTrainingPlatform`. Settings are browser-only links, not workout/client-data sync or authentication.
- Content has Videos and optional Podcast sections, including full hosted episodes/teasers, title/artwork, drafts, preview, publish, draft isolation and reversible unpublish. Per-tenant storage keys retained; public Watch/podcast viewing supports the published preview cards in the same browser. Neutral fixture sample cards remain explicitly examples.
- Client-success campaigns follow the existing offer promotion. They use the current coach’s offer catalogue, actual supplied result/timeframe and optional approved quote/photos, with permission/verification/exact-creative gates and approval reset on edits. No G&H product names, enquiry forms, fabricated client outcomes or photographs were copied into other coaches. No provider progress-data integration or duplicate client-record store added.
- Updated shared wiring/validation in `src/template-showcase.js`, the chassis management components, and verification/tests. Updated the mandatory platform rule to reflect the approved names/navigation/preview return, while keeping new-build chassis sourcing and protected-media boundaries.

#### Targeted installation — NOT wholesale rebuilds

- Josh, Tom/TR, Jamie, Gabby, Faisal, Jade, Graham/Elation and Zara received the verified selected canonical pages/scripts/styles. Their original finance scripts/ledgers and offer-campaign HTML were retained; the existing campaign module moved to the new Campaigns page. Photos/media and race/news/training/offer data remained byte-identical during this pass. Public coaching copy, external destinations and intentional Fuel omissions were not reseeded. The whole `prepareShowcase` routine was NOT run against those existing sites.
- Coaching-led promotions stay first on those eight; client-success stories come second. Podcast controls are disabled on them via `contentPublishing.podcast: false` until there is a verified podcast to manage. Their existing real channel links/public Watch pages remain; no podcast or clip catalogue was invented. Unknown provider sign-ins/individual clip metadata remain the previously recorded outstanding inputs.
- G&H kept the reviewed private tools and existing Race to Frame/client-success ordering. Only the coach-home/public-preview navigation improvement was added in this pass. Their public podcast content, news, original campaign and approved video remain protected; podcast publishing is still owner-preview-only, without a new public hook.
- Installed outputs, maintained `scripts/reskin/<slug>-pages/` files and the existing `.demo.json` page-file pointers are in step. Per-site media/data were not copied into another site. No tenant registry update, other-site rollout or live integration. Do not blindly regenerate these personalised demos later: retain source overrides and do isolated verification first, particularly G&H’s legacy booking-install order and optional public modules.

#### Review and verification

- Existing review index remains http://127.0.0.1:3034/ (all nine now updated); the old template link http://127.0.0.1:3026/template-preview/ was refreshed to the latest neutral build when present. Additional combined index: http://127.0.0.1:3036/ with the verified template at http://127.0.0.1:3036/template-preview/.
- Latest isolated canonical build: `/tmp/station9-desk-rollout-20261026/template-v3/template-preview`. Other staging copies: `/tmp/station9-desk-rollout-20261026/review/<slug>/`. Port 3036 server is `/tmp/station9-desk-rollout-server.cjs` and explicitly maps the template route to the v3 build. Earlier v1/v2 fixture directories are historical, not the latest template.
- Canonical verifier (`TEMPLATE_PREVIEW_DIR=/tmp/station9-desk-rollout-20261026/template-v3/template-preview node scripts/verify-template-preview.mjs`) passed 25 pages at 1280/390px plus races, boards, split history, Results, finance add/reset/export, campaign review/reset/launch preview, video thumbnail/draft/publish/isolation/unpublish/teaser links and booking approval/calendar export. It now also checks the public-preview banner and return to coach view.
- Rollout browser checks passed the template AND all nine at 1280/390px: private navigation, real source-backed offer links/deduplication, setup save and summary, content draft/publish/edit isolation/unpublish, the eight offer campaigns, client-success permission gates/reset, old campaign redirects, dark booking controls, and cross-page public-preview escape. External requests/writes were blocked. Image hashes, finance scripts, original campaign HTML and retained data were independently compared. Representative screenshots visually reviewed.
- **497 tests / 45 files passed after installation; unchanged coverage gate, branch coverage 83.54%; type-check passed; lint zero errors and the same 46 warnings.** No security/formatting policy was weakened and no deployment/provider-backed scan is claimed.
- Rollback material: `/Users/chri/Desktop/Station 9 site backups - 26 Oct 2026/Desk template rollout/` holds pre-port sites/configs, canonical components/shared wiring/verifier, and overwritten maintenance sources. Verification JSON/screenshots and local check/server scripts are preserved there. Task-specific tools: `/tmp/station9-desk-rollout-check.cjs` and `/tmp/station9-public-return-proof.cjs`. No general migration framework was introduced.

**Three-step review:** (1) refresh a coach homepage and open The Desk tools; (2) Preview public site, follow a public menu link, then Back to coach view and confirm the tools return; (3) review Programmes/Content/Campaigns with that coach’s own offers. Site/video alignment approval and any video splice/recording remain separate tasks.

### G&H nav regroup, 28 October 2026
Chris approved regrouping the public nav on the protected racetoframe/ site
(same session as the chassis/nav rollout — G&H were deliberately excluded
from that, this was a separate targeted approval): Shop is now a dropdown
(Race to Frame, Partner offers), Mailing list moved into Community, the
duplicate Find a race-mate removed from Race Tools. Seven top-level items:
Book a slot · Shop▾ · Coaching · Find a race-mate · Podcast · Race Tools▾ ·
Community▾. Applied to all 15 public pages; private Desk pages unchanged.

### G&H nav colour zones + reorder, 28 October 2026 (later same session)
Chris approved a second targeted pass implementing his two-zone bar: their
commercial territory left, visitor toolkit right, with colour marking whose
each item is. New order on all 15 public pages: Shop▾ · Podcast · Coaching ·
Book a slot · Find a race-mate · Race Tools▾ · Community▾. Shop, Podcast AND
Coaching render gold (#e6b83d — warm complement to their #2563eb blue; there
is no literal pink, `--pink` resolves to their blue). Chris's final call:
three colours, one contiguous block each — signature BLUE = their sells
(Shop, Podcast, Coaching all carry `var(--pink)` = #2563eb, so the brand
literally marks its territory), BLACK = the visitor actions (Book a slot,
Find a race-mate — strong and functional), deep AMBER #b45309 = the visitor
benefit drawers (Race Tools, Community — darker than #e6b83d gold because
bright gold is too weak on the white nav bar). Same session, Chris's follow-
up: the amber now echoes inside the drawer pages — `.eyebrow` and `.num`
markers render #b45309 on predictor, splits, results, events, race-crew,
news, stations-prep and run-zone via a per-page `zone-accent` style block
(buttons/links stay brand blue). The footer's "Built with the ninth
station" maker mark was a stray #ff3b3b red — now #b45309 across 10 pages.
Private Desk pages unchanged. NOTE:
the durable mirror sources in scripts/reskin/racetoframe-pages/ were still
on the PRE-regroup menu — now updated to the final order/colours, so they
again match the live pages.

### Earlier refinement — focused G&H Desk navigation, 26 October 2026

Chris approved removing the competing public menu from the private workspace. Removed the public navigation HTML (not merely hidden) from `desk.html`, `campaigns.html`, `manage-programmes.html`, `manage-videos.html` and `platform-setup.html`. The Desk toolbar and View public site doorway remain. Public pages retain their menus, and booking planner HTML/diary controls are unchanged. Root output, existing maintenance sources and active 3034/3035 review copies match; no new source/config pointers were needed. G&H only: no template/other-site/video/deployment changes.

Desktop/mobile 1280/390px checks passed: no public menu or phone Menu button on those five pages; all five Desk tools usable; Finance/Campaigns navigation works; View public site opens the client homepage with its public menu and no Desk toolbar; booking mode controls still work; no page errors or horizontal overflow. Screenshot visually reviewed. Check script: `/tmp/gh-desk-navigation-check-20261026.cjs`. Pre-change pages and sources are backed up at `/Users/chri/Desktop/Station 9 site backups - 26 Oct 2026/GH Desk navigation/`. The earlier management verifier’s expectation of a public Menu button on private pages is now obsolete; use this navigation check for the new separation.

### G&H’s The Desk naming and booking contrast, 26 October 2026

Chris approved **The Desk** as the owner-workspace umbrella, supporting text **Your coaching tools**, and buttons **Bookings · Finance · Campaigns · Programmes · Content**. Applied to G&H ONLY. Private management pages now carry The Desk in the masthead and matching section headings; `desk.html` remains the existing URL but is labelled Finance. The booking page shows **The Desk / Bookings** in coach mode and retains its original client heading in client/public mode. Internal selectors, routes and browser-storage keys were not renamed.

Reproduced the booking contrast fault: its `--ink` is a dark background value, but the toolbar used it for text. G&H’s scoped companion CSS now gives the toolbar explicit light/dark palettes, including button, heading and supporting text colours. Booking content, watermark, scheduler logic and public page headings are unchanged. New CSS cache marker `v=2026102603` lets existing tabs pick up the fix on refresh. Root output, G&H maintenance page sources and both 3034/3035 review copies match. Config/source pointers were retained; no template/shared engine/other-site changes, video edits or deployment.

Desktop/mobile checks at 1280/390px passed for all management headings and toolbar labels, phone expansion, no horizontal overflow, coach/client booking heading switches and public-audience hiding. Measured toolbar button text/background contrast meets at least 4.5:1 on both page styles; screenshots visually reviewed. Checker: `/tmp/gh-desk-labels-check-20261026.cjs`. Original files/config/source copies and screenshots/checker preserved at `/Users/chri/Desktop/Station 9 site backups - 26 Oct 2026/GH Desk naming and contrast/`. The canonical template deliberately retains its older names until Chris approves a later port; do not automatically rename the other eight.

### G&H-only management design pass, 26 October 2026

**Chris has since reviewed the management design and authorised implementing these refinements on Gregor & Hattie ONLY, for his review before any template changes or further rollout.** This supersedes the older G&H toolbar-only description below for the specifically requested owner-workspace changes. The canonical template and other eight sites remain unchanged by this pass. Do not automatically port these refinements to them.

- **Separate functions/pages:** The Desk (`desk.html`) is finance-only. Campaigns now opens `campaigns.html`; the original Race to Frame campaign section and its inline behaviour were moved byte-for-byte, not replaced. Old `desk.html#next-campaign` and `#client-success` links forward to Campaigns, preserving the query/hash. Existing ledger add/export still works; mobile public navigation on the Desk now also has the existing app handler loaded.
- **Campaign order:** existing Race to Frame/product/offer campaign first; new client-success section second (`campaigns.html?audience=coach#client-success`). It supports the actual coaching offer, story focus (including HYROX improvement or a weight-loss milestone), client-approved display name, timeframe/result, optional approved quote and optional starting/latest photos. Draft feed/Story copy is editable. Explicit client permission, result verification and exact-creative approval are all required before copying the caption or previewing the sharing plan. Editing setup/copy resets approval. No fabricated client example is seeded. This is an organic social draft/planning workflow, not a paid-ad integration; the detail note flags that weight-loss/before-after paid creative needs a separate platform-policy review. No client progress records are persisted; uploaded photos stay in that browser session.
- **Manage programmes:** replaced the opaque three panels with a clear coaching-platform panel and named offer buttons: Apply for SheBuilds; Enquire about Sculpt & Shape; Enquire about GJ HYROX programming. All retain the actual existing Typeform destinations. A down-page milestone prompt opens the new success-story campaign. No duplicate generic programme/application buttons.
- **Platform setup:** new private `platform-setup.html`, implemented by G&H’s local `training-platform.js`. Choices are Trainerize, FITR, Other, or not chosen. Coaches add their existing HTTPS coach/client links; Other accepts a platform name. Explicit safe-URL checks reject credentials/token-bearing links, including when reading local storage. Saved setup populates the management page’s coach/client doorway buttons. Storage key `racetoframe:training-platform-preview:v1` is browser-only. This adds provider links, not workout/client-data sync; no account/provider/password was guessed or accessed. Provider exploration links use the official feature pages. Client progress tracking stays in the chosen provider; selected milestones can be entered manually into a campaign.
- **Manage content:** toolbar label replaces Manage videos; existing `manage-videos.html` URL is retained. Separate Videos and Podcast sections filter both the saved library and published-card preview. Podcast supports full hosted episodes and teasers, title/description/artwork, optional teaser-to-full-episode links, drafts, preview/publish and reversible unpublish. Existing storage key/records are retained. Benefit-led copy replaces the implementation disclaimers; the single expandable detail note accurately explains browser-only owner previews. There is NO new public podcast viewer hook and no repopulation/redesign of their public podcast content.
- **Preservation:** original image files, base `styles.css`, news/race data and public podcast content preserved. Only the coach toolbar and companion stylesheet cache marker changed on that public page. The existing product campaign HTML and script were independently compared byte-for-byte after the move. No approved video was edited or re-recorded; no deployment, outreach, commit or push.
- **Sources:** all changed/new G&H HTML/JS/CSS mirrored into `scripts/reskin/racetoframe-pages/` and referenced in the existing `scripts/reskin/racetoframe.demo.json`. Root output, the existing 3034 review copy and new staged review copy match. No shared engine/template edits. Backup of the pre-pass site/config and overwritten source files: `/Users/chri/Desktop/Station 9 site backups - 26 Oct 2026/GH management design pass/`.
- **Review:** existing links at http://127.0.0.1:3034/racetoframe/ now include this pass. Isolated additional review: http://127.0.0.1:3035/racetoframe/ from `/tmp/gh-management-pass-20261026/review/racetoframe/`, served by `/tmp/gh-management-server-20261026.cjs`. Temporary checks: `/tmp/gh-management-check-20261026.cjs` (platform/content) and `/tmp/gh-campaign-check-20261026.cjs` (campaign separation/product preservation/consent/finance). These block external requests and prevent real writes.
- **Verification:** desktop 1280px and mobile 390px layouts/touch menus; platform save/summary and unsafe-token URL rejection; separate podcast/video views; draft/publish/edit isolation/unpublish; separate finance page add/CSV; original product prepare/edit/approval reset/simulation; success-story consent/verification/creative gates and edit resets; old campaign forwarding. No page errors or overflow on the checked journeys. 496 tests/45 files passed with the unchanged coverage gate; type-check passed; lint zero errors and the same 46 warnings. Hash checks confirm canonical template, other eight sites, shared showcase engine and tenant registry unchanged during installation. Chris’s design/content approval is still pending.

**Three-step review:** (1) Manage programmes → platform setup, try a sample provider/link setup and inspect the named offer buttons; (2) Manage content → switch Videos/Podcast and try a draft/publish/unpublish; (3) compare The Desk with the separate Campaigns page, then prepare a sample client-success story below Race to Frame and try the approval checks. Use sample client details/photos during review.

### Morning review — nine local site upgrades, 26 October 2026

**Start here:** http://127.0.0.1:3034/ — one local review index linking all nine Coach’s View and public versions. The isolated copies are at `/tmp/station9-upgrades-20261026/review/<slug>/`. Checked changes were also installed into the existing repository site folders; the review copies and installed changed files match byte-for-byte. This is not a live release or a claim that the old videos now show the new tools.

#### Work completed

- Targeted maintenance of each SAME existing demo, not a chassis rebuild and never another coach as a donor. The canonical template/shared build engine were not changed. Only these nine sites, their page/data sources and their individual configs were changed; no tenant registry update or other-site rollout.
- For the eight other than G&H: canonical Coach’s View/audience behaviour; athlete-facing public navigation; client vs coach booking routes; programme launchpads and separate client training doorway; browser-only video draft/preview/publish/reversible unpublish; combined Calendar & Travel with old trip URLs forwarding while retaining audience and city hash; working predictor race choices; repaired countdown date/timezone handling; seven broken Desk formatters repaired in place, Josh’s already-working formatter retained; offer-led coaching/programme campaigns using each existing coaching photo and public destinations; six source-linked international briefs per coach with distinct, explicitly labelled draft takes.
- Official Birmingham, London, Manchester, Singapore, Melbourne and Hong Kong event pages were rechecked on 26 October. The eight site catalogues are marked checked 2026-10-26, regional races first. Homepage cards, predictor, calendar/travel and countdown use compatible dated records. Recheck before pitching if dates have moved on; Birmingham begins 27 October, so the next-race selection will age quickly.
- Narrow checks confirmed empty race-mate/travel boards on those eight. Added the canonical dated FICTIONAL example cards and browser-only forms, plus split analysis with illustrative history/benchmarks and no athlete submission/email. These are demonstration workflows, not real community members or collected race histories.
- All existing image files were preserved byte-for-byte. Public coaching content, brands, offers, partner routes, Josh’s Watch/channel/store material, Graham’s biography/photography and the eight sites’ existing Fuel omission were retained. No new exercise photography, channel, podcast episode, product price or claimed coach experience was invented.

| Site / slug | Local outcome | Input still required |
| --- | --- | --- |
| Josh / `joshharrison` | Full targeted bundle; existing Hybrid Hub, Watch and clothing links kept; working Desk kept | Individual clip metadata; coach-take/site review |
| Tom / `trainedbytr` | Race/travel/countdown + Desk repaired; owner tools, campaigns, sourced brief and light Watch doorway added | Actual training provider and coach/client sign-ins; selected clips |
| Jamie / `jamiebarker` | Bundle applied; Edge public routes and personalised photos retained | Verified Edge coach/client sign-ins; selected clips |
| Gabby / `getfitgabby` | Bundle applied; existing approved photos and partner destinations retained | Actual provider/sign-ins; selected clips |
| Faisal / `faisalpma` | Bundle applied; PMA routes retained; unverified autobiographical news takes replaced by review drafts | Selected clips; coach-take/site review |
| Jade / `jadeskillen` | Bundle applied; existing PERFORM/application/programme ecosystem retained | Actual provider/sign-ins; selected clips |
| Graham / `elationfitness` | Bundle applied; athlete-led public front door and genuine photos/words retained | Actual provider/sign-ins; selected clips |
| Zara / `coachedbyzara` | Bundle applied; existing coaching identity/photos/routes retained | Actual provider/sign-ins; selected clips |
| Gregor & Hattie / `racetoframe` | LIMITED Coach’s View shell + private programme/video workspaces only; existing bookings, Desk and approved campaign linked | Actual provider/sign-ins; any later public publishing connection needs approval |

#### Unresolved details — do not guess or call these finished integrations

- Josh and Faisal already have explicit FITR catalogue URLs in their existing configurations. Their catalogues and official `https://app.fitr.training/` route respond as FITR JavaScript applications; those two launchpads use the official sign-in, not an invented coach-account URL. No account was accessed or provider integration connected.
- **Tom, Jamie, Gabby, Jade, Graham, Zara and G&H:** actual training-delivery software and coach/client logins remain unverified. The login action is absent and the workspace explicitly flags this; existing public offer/application routes remain usable. A marketing site, Linktree, Edge marketing page or Typeform is not being passed off as a software login. No blanket Trainerize assumption.
- **Video metadata remains pending:** original channel links are retained/used for the public Watch doorways, but individual hosted clip titles/URLs/thumbnails/episode metadata were not sufficiently verified to seed as real recordings. `data/videos.json` is deliberately empty on these previews. The publishing workflow works, but do NOT describe the public libraries as populated clip catalogues. Select verified clips before calling that part pitch-complete.
- G&H’s publishing tool has an **owner-only published-card preview**, not a public Watch hook. Their finished podcast page has no new viewer hook, clips or commentary. All three existing SheBuilds, Sculpt & Shape and GJ application/enquiry routes are listed privately; none is labelled a coach login. Their approved Desk/campaign inline scripts, news data/script, race data, base styles and original media are unchanged. Their existing public HTML received only the audience/navigation shell, not a content refresh.
- All public coach-take text is draft-for-review, not an approved coach quotation. Chris’s site/content review is still required. No recording/splice is authorised by this completed site task; preserve the approved G&H video. Before pitching G&H, still verify the actual hosted/delivered latest cut separately.

#### Sources, preservation and repeatable review

- Durable changed page/script/style/data sources: `scripts/reskin/<slug>-pages/`, referenced by each existing `.demo.json` via `pageFiles`/`seedFiles`. Faisal’s config remains `scripts/reskin/faisal.demo.json`. News/race/training configuration is also kept in step. These are maintenance sources for that SAME coach, never a new-site donor or asset pack. Do not blindly rebuild these personalised sites: any later intentional build still needs isolated verification, especially the legacy G&H build path and shared showcase reseeding behaviour.
- **Originals backed up outside the repo:** `/Users/chri/Desktop/Station 9 site backups - 26 Oct 2026/`. Contains all nine pre-change site folders, original configs, any overwritten page sources under `previous-sources/`, verification JSON/screenshots under `verification/`, and review server/check scripts under `review-tools/`. Nothing was deleted or reset.
- Current temporary review server: `node /tmp/station9-upgrade-server-20261026.cjs`, loopback port 3034. Do not start another on an occupied port or stop unrelated servers. If temporary review files disappear, serve the installed nine site folders with the preserved allowlisted server: `STATION9_REVIEW_DIR=/Users/chri/Desktop/roxjaya node "/Users/chri/Desktop/Station 9 site backups - 26 Oct 2026/review-tools/station9-upgrade-server-20261026.cjs"`. It allows only the nine demo prefixes and rejects write requests/dot paths; it does not start the main app, schedulers or external integrations.
- Verification tools are task-specific local scripts, not a new migration framework. Main browser checks: `/tmp/station9-verify-upgrades-20261026.cjs <slug...>`; detailed checks: `/tmp/station9-verify-details-20261026.cjs`; final syntax/countdown/redirect/audience checks: `/tmp/station9-final-checks-20261026.cjs`. They use the isolated server on 3034, block external destinations and prevent real submissions. Copies are preserved with the Desktop backup. Screenshots are examples for review, not a new broad photo/rights audit.

#### Verification actually completed

- All nine reviewed through affected desktop (1280px) and phone (390px) journeys: no script errors, horizontal page overflow or broken referenced images on the checked pages; Coach’s View sits above the public menu; Show tools works; public view hides owner tools; public bookings remain client-mode.
- Eight predictors produce results after selecting a real race. Six dated races and city guides load; London city selection works; countdowns display the correct 27 October first-listed date. Old trip URLs preserve public audience and selected city when forwarded.
- All eight offer-led campaign workflows exercise prepare/review/edit/approval reset/simulated launch. Desk add/reset/CSV export passed. Video draft/publish/draft-isolation/unpublish passed; G&H remains owner-only. Community preview card creation and split analysis/history passed with no athlete submissions/emails. Existing booking code/data/watermark/timezone are preserved, and client/coach audience modes checked; the unchanged booking workflow also remains covered by the project tests.
- Installed changed outputs, durable page/data sources and checked staging match byte-for-byte. Original media preservation and G&H protected data/scripts verified separately.
- **496 tests / 45 files passed after installation; coverage gate unchanged, branch coverage 83.48%; type-check passed. Lint: zero errors, 46 warnings — the prior 38 plus eight copies of the existing unused `CHAT_GREETING` warning in the preserved per-coach `app.js` source snapshots.** No warning was suppressed or security/coverage policy changed. No fresh deployment/security-provider scan is claimed.

#### Chris’s three-step morning review

1. Open http://127.0.0.1:3034/ and choose each public version: check the existing branding, photos, offers and channel/partner routes still feel right, with no owner tools in the public menu.
2. On the eight upgraded race-tool sites, choose a predictor race, open Calendar & Travel and switch city, then review the sourced Hybrid Brief and draft coach takes.
3. Open Coach’s View (Show tools on a phone), try the booking/programme/campaign/video doorways, and note the provider/clip decisions above. G&H’s video cards stay in the owner-only preview. Approve sites individually before discussing video changes or publication.

### Tomorrow’s review — targeted upgrade plan for the NINE video-backed prospects

**Planning only, prepared from the saved 25 October audit and existing prospect notes. No new broad audit, site edits, rebuilds, deployments or video work were performed for this plan.** Chris is reviewing the template tomorrow. These are candidate upgrades awaiting that review and specific implementation approval, not a standing instruction to run the list.

**Method agreed with Chris:** NEW sites always start from the canonical template. EXISTING personalised demos should receive selected, approved components FROM that template, preserving their own content and layout rather than being rebuilt from scratch. An isolated working copy of the SAME existing demo is for maintenance/rollback, never a donor for another coach. Record corresponding config/page-source changes so a later intentional build does not undo the retrofit. Do not run the whole template `prepareShowcase` routine against an approved existing site: it reseeds data and changes navigation globally. Port the required pieces deliberately; do not create a new migration framework or bulk rollout without approval.

#### Evidence and confidence

- Scope is Josh, TR/Tom, Jamie, Gabby, Faisal, Jade, Graham/Elation, Zara, and Gregor & Hattie. Ross is not in this list: the saved audit found no prepared Ross video. Do not add him or the remaining older sites to this upgrade job automatically.
- The eight non-G&H MP4s are the 23 October repo pitch assets and byte-identical `*-walkthrough-23oct.mp4` Desktop copies. The audit found no newer rendered HTML/CSS/JS, data or image file in those eight builds. Their age alone is not a reason to remake them; they can nevertheless show an existing feature gap. G&H's approved Desktop file is `Gregor and Hattie - LATEST full pitch - 25 Oct 2026.mp4` (10:48).
- All eight other video-backed sites have wide predictor layouts but ZERO selectable target races, and their separate race-trip guide fails to load. Their `cities.json` contains `items: []` while the code expects `cities`. Travel scripts also contain invalid timezone strings. These are confirmed repairs, not optional cosmetic refreshes.
- Desk syntax errors are confirmed on TR, Jamie, Gabby, Faisal, Jade, Graham and Zara. Josh's Desk does not reproduce that error. Do not replace his already-correct formatter merely because the others need it.
- All nine have the booking preview already. All eight other video sites already omit Fuel. Do not re-add Fuel to them merely because the master showcase retains the capability. New public/admin separation and management modules were added to the master AFTER the audit, not to those existing demos.
- Saved `brokenImages` entries with `src: null` were unpopulated modal image elements, not proof of broken visible photos. Josh's saved `ledgerRows: 0` used the G&H selector and is not evidence his Desk ledger is broken. Photo counts establish presence, not activity/identity/rights verification.
- Audit detail is in `/tmp/coach-site-survey-20261025/` (`inventory.json`, `browser.json`, `functional.json`, `videos.json`, `asset-dates.json`, video contact sheets); it is temporary. The durable findings and per-prospect decisions below must remain usable if that directory disappears. No public deployment or external account was reverified tonight.

#### Shared targeted bundle for the OTHER EIGHT, subject to template approval

1. **Repair race tools, not their established layout:** supply correctly shaped, freshly checked confirmed-race data; fix date/timezone handling; make predictor selection/results work; use real regional events or relevant international alternatives instead of TBA cards. Combine Calendar & Travel and forward old trip-planner links. Preserve each page's approved photos and useful unique material. All eight currently have empty city records, not a populated guide to discard.
2. **Coach’s View shell:** port the bar, scoped CSS and audience-switch behaviour; separate Book a session/client training access from Manage bookings/programmes. Preserve the installed diary's branding, watermark, timezone and working demo behaviour. Remove admin links from the public menu/footer, but do not replace the entire public homepage or introduce an owner-sales card grid.
3. **Desk and offer-led campaigns:** patch the seven broken money scripts in place while preserving each synthetic ledger; keep Josh's working Desk. Add a coaching-intake/programme campaign preview with the coach's VERIFIED offer photo/destination, edit/review/approval-reset/simulated-launch sequence. Do not transplant Race to Frame products, prices or shop-led copy into coaching-only businesses.
4. **Programme and video management:** use actual coach/client/programme/application destinations. A public application funnel is NOT proof of a coach software login. Do not default all prospects to Trainerize because the neutral fixture uses it. Port the publishing preview and attach it to the coach's existing video hub, or add a light public hub populated from verified existing clips. No invented channels, podcasts, episodes, app accounts or published coach statements. Keep drafts separate from published preview content and label the browser-only behaviour accurately.
5. **News and community:** replace UK-only framing with a suitable international brief and genuine source links, retaining and refining each coach's voice as reviewed draft commentary. Distinguish original training notes from reported news. Do not copy unverified autobiographical examples as real coach quotations. Where existing race-mate/travel boards or split-history demos are empty or incomplete, consider the master's populated safe previews after a narrow check; these areas were not individually exercised by the original seven-page audit, so do not call every one a confirmed fault.
6. **Preservation/QA:** keep real offers, distinctive imagery, approved crops, brand colour and reveal, partner destinations and useful content. Port only the needed CSS/JS/data fragments, respecting existing selectors, currency and tenant-scoped storage keys. Keep source overrides in step with output. Check changed client/coach journeys at desktop/mobile widths without real submissions, messages, ad spend or provider-account access. This is not permission to copy all master files over the tenant.

#### 1. Josh Harrison / Hybrid Hub — recommended full-bundle pilot, NOT approved to start

- **Keep:** cinematic branding and the separate Hybrid Hub coaching/programmes/clothing routes; existing Watch/YouTube/Instagram/Threads content; corrected bright-trainers coaching photo, running hero with no secondary figure, calmer Taper portrait and crew setting examples. Seven station photos are intentional: rowing and wall-ball references are generic/faceless, and sandbag lunges remain text-only. Do not reintroduce mismatched photos to force eight.
- **Confirmed repairs:** empty predictor race choices and failed trip guide; join calendar/travel and remove TBA feature cards. Desk already has the corrected formatter, so preserve and exercise it rather than treating it as the seven-site error.
- **Targeted additions:** Coach’s View; connect existing Watch to Manage videos; programme launchpad around the recorded FITR setup, separating public programme catalogue/application from verified coach/client sign-in. Keep the actual clothing store, not the neutral example collection.
- **News:** three Preview note cards with takes, not a finished sourced newsfeed. Replace/expand factual briefings with Josh-voice drafts and real sources; no fabricated experiences.
- **Video after site approval:** update predictor action/result, combined calendar/travel (the old script has a separate trip-planner scene), news and Watch/publishing; add/replace the private-tools chapter and apply the slow text-plus-photo station movement. Preserve good home/coaching/partner/closing footage where it still matches. No full remake by default.
- **Narrow checks before work:** current verified FITR coach/client URLs and programme/store routes, exact changed selectors and any retained shot whose visible menu changes materially. No new general photo hunt.

#### 2. Tom Redmond / Trained by TR

- **Keep:** TR identity, Widnes context, existing coaching funnel, approved hero/partner shots and branded diary. His own station reel coverage is thinner; several existing references are explicitly stock. Do not label them as Tom or manufacture eight unique owned exercise photos.
- **Confirmed repairs:** predictor/city data, failed travel guide and Desk syntax error. Retain the personalised ledger and existing correct imagery while repairing the logic.
- **Targeted additions:** shared bundle, with campaigns led by coaching enquiries or a verified programme. The recorded `go.trainedbytr.com/home` route is a coaching funnel, not evidence of Trainerize/FITR account ownership. Verify the actual delivery platform before configuring Manage programmes. A public video hub can use verified training reels rather than pretend he has a podcast or YouTube catalogue.
- **News:** three example/editorial cards with Tom's take and no explicit source records in the saved data. Add factual sourced stories while keeping the voice distinct; label original tips as editorial.
- **Video:** retain the already-updated home/partner footage and useful diary sequence; replace race-tools/calendar/news/Desk failures and introduce the private-tools/campaign journey. Improve station movement around the assets that genuinely exist, including text-only/reference cases.

#### 3. Jamie Barker / Edge

- **Keep:** Jamie's personal-brand front door alongside Edge, not a fictional replacement for the Edge app. Preserve current application/programme destinations, partner routes and the supplied race photos for farmers carry, doubles finish, sled push/pull and Run Zone. Do not swap these for master example imagery.
- **Confirmed repairs:** the common empty race selector/failed trip guide and broken Desk formatter.
- **Targeted additions:** Coach’s View, canonical safe campaign/publishing components and a programme launchpad that respects the actual Edge-related delivery arrangement. An Edge support channel or public marketing link is NOT a verified coach login; that remains a specific outstanding check. Lead campaigns with a verified existing offer, not invented merchandise.
- **News:** three example cards with Jamie's take; only one explicit source entry in saved data. Upgrade the factual/source coverage without flattening his own tone.
- **Video:** keep approved imagery, useful external-offer demonstrations and partner scenes; refresh repaired tool outcomes, combined calendar/travel, news and the private chapter. Existing newer caption style can be preserved where accurate; do not remake it simply because other scripts are older.

#### 4. Gabby Moriarty / GetFitGabby

- **Keep:** the photos Chris already approved; her station roster uses real imagery from her own reels. No new stock sourcing or wholesale photo replacement. Preserve existing coaching/application and partner destinations.
- **Confirmed repairs:** predictor/trip data and Desk syntax error.
- **Targeted additions:** Coach’s View, her actual programme-provider links once verified, a coaching-led campaign and a public video hub using existing real clips with Manage videos behind the coach bar. Do not assume Trainerize, add a fictitious podcast or invent a product business.
- **News:** three editorial/example cards with Gabby's take and no explicit source records. Add source-linked race stories and preserve the approachable coach voice as draft material for review.
- **Video:** preserve approved photo footage and the Marchon partner click-through. Lululemon blocked the recording browser previously; do not reopen that workaround unless the destination itself needs changing. Refresh repaired tool/news/calendar/private-tool sections and use slower movement between station photo holds.

#### 5. Faisal Abdalla / PMA Fitness

- **Keep:** PMA branding, his athlete/coaching authority, actual coaching/programme/affiliate routes and eight existing station-image slots. Preserve distinctive owner content rather than importing the neutral test brand or another coach's programme names.
- **Confirmed repairs:** empty predictor selector, failed trip guide and Desk syntax error.
- **Targeted additions:** the shared Coach’s View and offer-led campaign/publishing tools; configure actual provider accounts/destinations from verified evidence, not the fact that an application or Linktree route exists. Keep commerce/affiliate actions faithful to what is actually offered.
- **News:** three PMA-voice example cards with takes; one explicit source in saved data. Preserve the cadence, but replace unverified personal anecdotes (e.g. an 'Istanbul taught me' example) with truthful, reviewable commentary rather than attributing fabricated experience to Faisal.
- **Video:** old script includes 'UK HYROX news ... Google loves this part.' Replace that with the actual international brief and its benefit, without an SEO guarantee. Re-record repaired tools/combined calendar/private tools as needed; preserve correct hero/coaching/partner scenes and improve station text/photo framing.

#### 6. Jade Skillen

- **Keep:** her established ecosystem and verified PERFORM/1:1/coaching routes, including the recorded `start.jadeskillen.com` / `smashyourhyrox.com` context. Position the demo as consolidation, not replacement of her existing training platform. Preserve her own images and brand voice.
- **Confirmed repairs:** the shared predictor/travel-data faults and Desk syntax error.
- **Targeted additions:** Coach’s View, genuine programme-platform handoff, safe video publishing and promotion of an actual existing intake/programme. Verify coach/client account URLs rather than guessing from the public application funnel. Do not create a competing generic training product under her name.
- **News:** three example cards with Jade's take and one explicit source. Retain the direct coaching tone, add genuinely sourced international items and keep draft/approved authorship distinct.
- **Video:** replace the old UK-only/'Google loves' news pitch, demonstrate the repaired tools and merged calendar/travel, and show the private chapter. Keep useful existing public/partner footage and the slower station text-to-photo flow.

#### 7. Graham Halliday / Elation Fitness

- **Keep:** the athlete-celebration positioning, not a generic personal-training landing page. Preserve the arms-wide finish-line hero; the real 'AGAIN' sled image/quote; the 54:42 predictor photo; eight owner event shots; and doubles context with Hannah. Hannah is a team member, not his girlfriend. Do not replace his genuine biography or quotations with template filler.
- **Confirmed repairs:** predictor choices/city-guide data and Desk syntax error. The strong photography is not the problem to solve.
- **Targeted additions:** put business tools in Coach’s View without letting them dominate the athlete-facing homepage. Verify which coaching/gym/programme business the links actually represent before choosing a provider or campaign offer. The old Watch omission was intentional; if adding a public hub, use verified existing material and clear purpose, not a default podcast catalogue.
- **News:** three editorial/example takes, no explicit source records. Add real stories and thoughtful Graham-voice drafts; preserve verified existing words separately from generated commentary.
- **Video:** retain the finish-line/athlete imagery and correct Hannah context. Replace broken tool sections, merged calendar/travel, news including the old UK/SEO caption, and the private-tools chapter. Give the existing station photos proper holds while moving through the intervening text.

#### 8. Zara Piergianni / Coached by Zara

- **Keep:** Coached by Zara identity, elite-athlete context, current photographs and verified public coaching/programme/partner routes. Do not replace these with a generic gym or another coach's products.
- **Confirmed repairs:** predictor race-data/trip-guide faults and Desk syntax error.
- **Targeted additions:** shared Coach’s View, programme access/management using the actual provider after verification, coaching-led campaigns and video management tied to real available clips. Do not infer the provider from Linktree or invent a branded podcast.
- **News:** three editorial/example cards with Zara's take and no explicit source records. Populate factual international briefings with her distinct draft commentary.
- **Video:** retain correct public imagery and offer/partner footage, replace old UK-only/'Google loves' news narration and repaired tool/calendar/private sections, and improve station text/photo movement. Business outreach routing remains a separate unresolved task; this plan does not authorise contact research or sending pitches.

#### 9. Gregor & Hattie / Race to Frame — LIMITED exception, not the shared eight-site refresh

- **Keep wrapped:** approved public design, photography, products, coaching offers, Partners, existing podcast destinations, combined Calendar & Travel, six sourced Hybrid Brief items, all eight station images, the interactive product campaign and the approved 10:48 latest video. Do not add news commentary: Chris explicitly excluded that further work.
- **Already working in saved audit:** predictor has five selectable cities (with date-TBC option labels), combined travel page loads, booking preview renders, Desk/campaign works. Do NOT call these the eight-site failures or apply the whole repair/reseed bundle. The old formal/extra running-photo complaints concern replaced footage; those images were already absent from the current Results/Run pages. No reason for another photo round.
- **Specific later request before pitching:** add the Coach’s View/coaching-tools menu, separated from the public menu. Manage bookings should target their existing coach diary; Desk and Campaigns should target the existing Desk and approved `#next-campaign`. Port only the toolbar/audience behaviour and necessary supporting pieces; do not overwrite their campaign JS, ledger, styles, shop or public content with the generic master version.
- **Programme check:** retain SheBuilds, Sculpt & Shape and GJ offer/application destinations. Their actual coaching-delivery software and coach/client sign-in remain unverified; a Typeform/application destination does not establish a training platform. Do not default this build to the neutral Trainerize example.
- **Video/podcast management:** if all five Coach’s View tools are approved for this addition, bring in the private publishing preview with verified clip/episode metadata. First identify the smallest compatible public-viewer hook. Their podcast IG interview teasers can lead to full episodes, but that observation alone is not approval to redesign or repopulate their finished public podcast page. Ask before touching that protected public content or adding a separate public hub; an owner-only publishing/card preview is the narrower fallback.
- **Delivery check:** the approved latest asset in the saved audit is the Desktop MP4, unlike the other eight's repo pitch assets. Before pitching, verify which hosted/delivered file and public-site CTA will actually be used; do not assume that the latest Desktop cut is already published. No upload or deployment is authorised by this plan.
- **Video boundary:** adding the toolbar does not by itself authorise a new recording. Keep the final cut intact now. If Chris later wants the new tools shown, recommend a short owner-tools insert or separate clip, retaining the approved campaign and public tour rather than a complete remake.

#### Video work common to the eight — ONLY after the upgraded site is approved

- The planner already appears in all eight recordings; do not insert another complete diary sequence blindly. Reuse good footage where possible and replace only changed/badly qualified captions or changed UI/actions.
- Refresh predictor/results as needed to demonstrate a real selection/outcome, the combined Calendar & Travel and the populated news, then clearly transition from the public tour into Coach’s View for private tools. Josh's old script separately tours the broken trip planner; remove that obsolete duplicate scene.
- Follow the rulebook's station movement: slower forward travel THROUGH the text between deliberate photo or mixed text/photo holds. Do not replace the old text-only stops with a slideshow, and do not manufacture imagery for text-only slots.
- Coach’s View is demo-only chrome, not part of the actual public site. Old public footage without that bar can remain representative of the client view; do not reshoot every public page merely to add the bar. Material changes to the public menu/content still need a narrow retained-shot check.
- Names, image framing, overlays, natural joins and destination/approval actions must match the actual approved build. Keep original files, produce a clearly named LATEST copy, and verify decode/play/seek/joins/caption visibility. No claim that dated files alone certify feature correctness or live deployment.

#### Next-session gates and priority

1. Finish Chris's template review and agree the exact component bundle; this list is not implementation approval.
2. Recommended substantial pilot: Josh, using targeted ports and preserving his Watch/Hybrid Hub/store/photo work. G&H's specifically requested toolbar is a separate minimal track before their pitch, not permission to apply the complete common bundle.
3. Immediately before any approved upgrade, check only the affected files, original video scenes and currently verified destinations. Recheck factual race dates and provider URLs where needed. No full re-audit unless a demonstrated change/blocker warrants it.
4. Stage/back up the existing personalised demo and port only agreed canonical pieces; update its durable source/config in step with output. Test the changed client/coach journeys on desktop/mobile. Chris approves the site before video changes.
5. Roll out one approved prospect at a time. No automatic nine-site run, full directory replacement, new integration service, pitch sending, commit/push or deployment. No actual modifications were made to any of these nine sites or their videos while preparing this plan.

### Canonical template, Coach’s View and programme/video tools — completed locally 25 October 2026

- Always-on canonical build and video rules: `.devin/rules/platform-build-and-video.md`. AGENTS.md also points there and its old donor-regeneration/bulk-loop instructions have been replaced. Read the rulebook before EVERY build, template change, recording or splice. Stations walkthroughs must move through the text between photo holds, not skip the advice or become a slideshow.
- `chassis/` is now maintained directly. `scripts/build-chassis.js` validates it and exits without copying a donor. The canonical flag in `scripts/reskin/chassis.tokens.json` is mandatory; the historical donor mappings/code remain inactive reference material. `scripts/reskin-tenant.js` rejects non-chassis NEW sites, generated-site asset packs, mismatched SLUG tokens and unapproved implicit replacement. Existing legacy maintenance requires `--legacy-maintenance`; existing output replacement additionally requires `--replace-existing` and Chris's explicit approval. Asset packs copy media only, not old HTML, scripts, CSS or data. Missing station slots are no longer silently filled with unrelated legacy exercise images.
- Shared showcase logic is `src/template-showcase.js`. New builds get `build-provenance.json`, a consistent navigation, populated homepage race cards and common race data for calendar/travel, predictor and countdown. Master race data has six specific official events checked 25 October 2026. Regional confirmed events are preferred, with international choices as fallback. A check date over 14 days old or no valid future race stops the build rather than emitting TBA. Refresh `chassis/data/cities.json` from official event pages before a stale/new-region build; the catalogue is not a live auto-refresh service.
- Calendar & Travel is one page with city tabs, transport/stay/food guidance, weekend checklist and coaching/crew connections. Old race-planner links forward there. Master news is The Hybrid Brief with six sourced international stories and distinct coach-take drafts for review; no invented coach experiences or claim of automated ingestion. Explicit editorial notes remain a separate content type.
- The master includes a working Desk formatter and a generic offer-led campaign preview (coaching, programmes, shop): prepare, feed/Story review, photo upload, edit, approval reset and simulated launch. No ad account/spend integration is connected. Optional Shop/Podcast layouts are visible without claiming example products or episodes belong to the coach. Fuel remains in the master showcase, with inclusion on real tenant builds controlled explicitly.
- Audience separation is now mandatory: the public homepage has athlete-facing content, not a mixed business-tools grid. The outlined/tinted Coach’s View bar sits above the public menu and contains Manage bookings, The Desk, Campaigns, Manage programmes and Manage videos. Phone users expand it with Show tools. Client booking uses `view=client`, coach management uses `view=coach`; View public site opens an `audience=public` journey with coach controls hidden and that audience preserved across client navigation. This switch is a demo presentation control, NOT authentication. `coachPreview: false` omits the bar and management pages and ignores browser publishing previews.
- Programme management is a configurable launchpad, not an API sync: `trainingPlatform` supports name, coachURL, clientURL, programmesURL, applicationURL, offerTitle, offerDescription and a private setup note. The neutral fixture uses Trainerize’s verified official account finder (`https://www.trainerize.com/login/`); no coach account subdomain or connection was invented. FITR programme hosts can use the verified `https://app.fitr.training/` sign-in route; other providers accept explicit verified URLs. Unknown existing setups keep their configured programme destination without claiming an integrated dashboard. HTTPS links with embedded credentials or secret query keys are rejected. `manage-programmes.html` is the coach doorway, `training.html` the client doorway; coaching offer previews and campaign programme destinations share the same configuration.
- Watch & Learn is now the public video hub. `manage-videos.html` supplies hosted video/clip links, titles, categories, thumbnail links/uploads (JPG/PNG/WebP up to 500 KB), card preview, saved drafts, explicit publish and reversible unpublish. Draft edits do not replace the last published version until published. This is tenant-scoped browser storage only; it does not update a live site or upload/host the video file. Published browser-preview cards also appear in the public preview; podcast-category clips can link to a full episode and appear on the podcast page. Default sample cards are labelled as layouts, not real coach recordings. No Gregor & Hattie site/video change was made.
- Split analysis now has a browser-only preview path with illustrative history/benchmarks and no submissions or emails. The race-mate and travel boards have dated fictional example cards and browser-only form previews, with no real community posts, personal contact details or introductions sent. Booking remains the established fictional/in-memory preview; live auth/storage, confirmations and provider calendar sync are not enabled. No production connection has been added by this template task.
- Neutral fixture: `.devin/template-preview.json`. It uses a fictitious Template Review identity, example.com destinations and existing preview photography, NOT a sales-ready real-coach build. Reviewed generic rowing/wall-ball references are used; lunges are text-only where the sample asset was inappropriate. Image rights still require checking before publication. The unrelated farmers-carry figure was removed from the master running page.
- Review build is isolated at `/tmp/station9-template-review-20261025/audience-v2/template-preview`, served at `http://127.0.0.1:3026/template-preview/` while its temporary preview server runs. Nothing was registered, pushed or deployed; existing coach sites and all videos, including Gregor & Hattie, were left untouched.
- Repeatable verification: create a NEW isolated output with `node scripts/reskin-tenant.js .devin/template-preview.json --output-dir=/tmp/NEW-REVIEW/template-preview`, then `TEMPLATE_PREVIEW_DIR=/tmp/NEW-REVIEW/template-preview node scripts/verify-template-preview.mjs`. The verifier starts its own loopback static server, tests 23 pages at 1280/390px plus public/coach separation, programme links, video draft/preview/publish/edit/unpublish, podcast teaser/episode links, predictor, splits, Results search, Desk add/reset/CSV, campaign prepare/edit/approval-reset/launch and booking request/approval/.ics export. It blocks external requests and mocks pageview analytics; no real submissions are sent. Existing prepared coach sites are not test targets.
- Verification passed: 496 tests / 45 files with coverage; branch coverage 83.48% (80% gate unchanged), type-check, lint (zero errors; 38 existing warnings), and desktop/mobile preview workflows. Repository-wide formatting and deployment/security-provider gates were not claimed as newly passed. No automatic retrofit of the other 22 sites or their videos is authorised by this completion.

### MUST read before any new build, template work or video

The canonical plan and mandatory rules are `.devin/rules/platform-build-and-video.md`, also linked near the top of AGENTS.md. **Every new tenant MUST be generated from `chassis/`, not the previous coach's site.** Read the complete rule file before starting. It includes confirmed-event selection, whole-platform showcase standards and the video rule to scroll through station text while pausing primarily on photography—not skip either the photos or the advice. Chris approved fixing the master in this thread; that does not authorise rebuilding existing sites. The later nine-prospect plan allows only specifically approved targeted maintenance. Gregor & Hattie's requested toolbar is the limited pending exception described there, not permission to reopen their protected public content or video.

### Working agreement with Chris — mandatory

**Do exactly the task Chris explicitly asks for. Suggestions, inspired ideas and useful observations are welcome; ask and wait for approval before acting beyond that scope.** "Go", "continue" and "finish" refer to the agreed task only. Do not turn photo swaps or template updates into architecture work, reusable-library projects, broad audits, optional test campaigns or unrelated fixes. If an out-of-scope change is genuinely necessary, explain the blocker briefly, recommend an option and ask first. Tool auto-approval is not scope approval. This is now recorded prominently in AGENTS.md and BILLIONS.md → Chat notes, with the older autonomous-next-block permission corrected.

Chris repeatedly stopped scope creep in this session. The lesson is to finish the requested deliverable using the established template and assets, not expand the engineering project. The next assistant should read this, acknowledge the state, then ask what specific task Chris wants next.

### Repository, server and publication status

- Repository: `/Users/chri/Desktop/roxjaya`.
- Current branch: `main`. HEAD is `a77a10fd` — `Make every walkthrough lead directly into its live coach platform`.
- Remote: `https://github.com/chriswwworldwide/Arciteq-Digital.css.git`. The repository is public: do not commit real client schedules, private records, passwords or tokens.
- The working tree contains many modified and untracked files from planner rollout, videos, security hardening and Josh's refresh. It is NOT clean. No files are currently staged. Preserve all work; do not reset, checkout over it, delete untracked files or blanket-stage/commit/push.
- Last confirmed pushed release in the conversation was `a77a10fd`, containing the earlier seven video endings and hosted-page CTA work. Planner-spliced videos, the 22-site planner rollout, security source changes and current Josh refresh remain local/uncommitted. No code push/deployment was performed for these latest changes.
- Local server was restarted and last observed serving `http://localhost:3000/`. `npm start` is the normal start command. Verify whether the existing process is running before starting another; do not kill ports blindly. Localhost links work on this Mac, not a separate phone.
- Railway service discussed: `station9-demos`; another visible service is `Arciteq-Digital.css` (PawVigil context). Shared-code publication may affect more than one service, so confirm targets before any release.
- Public base: `https://www.station9studio.co.uk/`. Use **www** until apex DNS is explicitly fixed and verified. Earlier apex/Namecheap and Railway maintenance/404 observations are historical; public availability was not rechecked during this documentation task. Do not assume a public URL serves the current local version.
- Dina's proof site: `https://roxjaya.com/roxjaya/`. Dina is a proof case, not part of outreach. No new outreach until Station 9 mailbox send AND receive work and have been tested.

### Website locations and latest versions

For a tenant slug, local site is `http://localhost:3000/<slug>/`; the public destination is `https://www.station9studio.co.uk/<slug>/`. The table gives destinations, not a fresh claim that the latest build is online.

| Site | Local review URL | Public destination | Current-version status |
| --- | --- | --- | --- |
| Station 9 hub | http://localhost:3000/station9/ | https://www.station9studio.co.uk/station9/ | Previous public baseline recorded; newest planner changes local |
| Josh Harrison / joshharrisonfit | http://localhost:3000/joshharrison/ | https://www.station9studio.co.uk/joshharrison/ | Current refresh local only; latest photos still for Chris to review |
| TR / Tom Redmond | http://localhost:3000/trainedbytr/ | https://www.station9studio.co.uk/trainedbytr/ | TR pilot visually approved by Chris; newest planner/video local |
| Jamie Barker | http://localhost:3000/jamiebarker/ | https://www.station9studio.co.uk/jamiebarker/ | Earlier layout/photos/video release pushed; newest planner/video local |
| GetFitGabby | http://localhost:3000/getfitgabby/ | https://www.station9studio.co.uk/getfitgabby/ | Earlier layout/photos/video release pushed; newest planner/video local |
| Faisal / PMA | http://localhost:3000/faisalpma/ | https://www.station9studio.co.uk/faisalpma/ | Newest planner/video local |
| Jade Skillen | http://localhost:3000/jadeskillen/ | https://www.station9studio.co.uk/jadeskillen/ | Newest planner/video local |
| Graham / Elation Fitness | http://localhost:3000/elationfitness/ | https://www.station9studio.co.uk/elationfitness/ | Public destination recorded; newest planner/video local |
| Coached by Zara | http://localhost:3000/coachedbyzara/ | https://www.station9studio.co.uk/coachedbyzara/ | Newest planner/video local |
| Dina / Roxjaya | http://localhost:3000/roxjaya/ | https://roxjaya.com/roxjaya/ | Working proof site; this session's planner rollout local only |

Planner rollout covers 22 existing coaching/platform slugs plus the neutral template: `roxjaya`, `fennellfitness`, `gym64`, `hustle`, `hyroxdoncaster`, `kore`, `nutrifit`, `pacegym`, `racetoframe`, `mayaokafor`, `faisalpma`, `jadeskillen`, `elationfitness`, `coachedbyzara`, `htcfisher`, `burgonfitness`, `station9`, `joshharrison`, `georgegrayson`, `jamiebarker`, `getfitgabby`, `trainedbytr`. Other listed folders are not automatically pitch-ready or newly deployed. Template preview: `http://localhost:3000/chassis/planner.html`.

### Latest Josh changes — use this state, not the superseded photo notes below

Active source: `scripts/reskin/joshharrison.demo.json` in chassis mode. Active assets: `scripts/reskin/joshharrison-chassis-assets/`. Generated site: `joshharrison/`. Seven supplied originals remain under `scripts/reskin/joshharrison-source/supplied/`; earlier originals/assets are preserved separately.

| Requested change | Actual local result / review link |
| --- | --- |
| Burpees | Image restored with chest-to-floor reference and proper reserved dimensions: http://localhost:3000/joshharrison/stations-prep/#burpee-broad-jumps |
| Rowing | Faceless crop reused from Jamie's build; generic reference, not described as Josh: http://localhost:3000/joshharrison/stations-prep/#rowing |
| Farmers carry | Supplied kettlebell photo visible, sizing and incorrect recovery caption fixed: http://localhost:3000/joshharrison/stations-prep/#farmers-carry |
| Wall balls | Ball-and-hands crop from TR's existing build, no face; generic reference: http://localhost:3000/joshharrison/stations-prep/#wall-balls |
| Coaching | Suit photo replaced by Josh crouching with bright trainers. Whole image, natural proportions and trainers visible: http://localhost:3000/joshharrison/coaching.html |
| Run Zone | Running hero retained; secondary crouching/recovery figure removed entirely: http://localhost:3000/joshharrison/run-zone/ |
| Taper | Calmer `bio.jpg` portrait reused from the small Ask Josh circle, not the SkiErg shot: http://localhost:3000/joshharrison/taper-zone/ |
| Crew meetups | Template restaurant/dinner and nightclub/dance photos restored as setting examples, not claimed to be Josh's client events: http://localhost:3000/joshharrison/race-crew.html |
| Fuel Zone | Removed locally with `nutrition.mode=hidden`; page returns 404 and all rendered HTML links, including Taper hash links, removed. Chris says Fuel should not be part of the coach-site standard; do not silently bulk-change other tenants to align them |
| Mobile reveal | Stale canvas bug reproduced and fixed on Josh: http://localhost:3000/joshharrison/ |

- Josh now has 18 HTML pages after Fuel removal. Modern menu includes Book a slot first, all retained race tools, race-trip planner, Community, Watch, Partners, Join the list and The Desk. Ask prompts/footer links and hero booking CTA are present.
- Earlier copied exercise photos and descriptions were unreliable. Do not infer activity from filenames: inspect the actual picture. The remaining sandbag-lunge section stays text-only rather than showing an unrelated exercise; do not reintroduce the crouching shot as wall balls/lunges.
- Recorded race stats and public programme/store/social routes were preserved from existing source. Some editorial/guide content is explicitly draft/preview, not a claim of Josh's approval or published posts. Tropical-weather copy for Worcestershire and unsupported guide credentials were corrected locally; 26/27 reference weights were checked against the official HYROX singles PDF. Brand links/codes still need owner confirmation before public use.
- Main image corruption cause: legacy copy overrides printed capture syntax such as `$1src="$2...` instead of expanding it. `src/reskin-overrides.js` plus generator changes restore captures while keeping dollars in token values literal. Desk's invalid `var £` identifier became `formatMoney`, and the template's demo storage key is tenant-specific. Josh's Desk add/reset interactions were checked using fake browser-local data.
- Historical template donor is preserved as `scripts/reskin/joshharrison.donor.json` for reference only. The later canonical-template change retires donor regeneration: `build-chassis.js` now validates the maintained `chassis/` and never copies the donor. Do not restore the historical regeneration path or use active Josh as a build source.
- Old generated Josh build backup: `/var/folders/sj/037z84yd2qz33p9mhyl801g40000gn/T/s9-josh-before-refresh-GFPzsz/joshharrison`. This is temporary storage, not a permanent backup guarantee. Original source photos/configuration are still in the repo.

### Shared generic photo folder

The existing pool is `scripts/reskin/stock/`, not a new second library. New reviewed framing references:

- `generic-rowing-detail.jpg` — source `scripts/reskin/jamiebarker-assets/images/station-row.jpg`, 723x690, face excluded by the existing crop.
- `generic-wallball-release.jpg` — source `scripts/reskin/trainedbytr-assets/images/station-wall-balls.jpg`, crop `[0,0,850,350]`, ball and hands only.
- `scripts/reskin/stock/catalog.json` records source/framing and `licenseVerified:false`. Do NOT call these royalty-free or assume every older stock-folder image is generic/accurate/licensed. Chris approved existing-build references; never caption a reference athlete as the prospect. The briefly considered rear-view candidate was discarded, not used.

### Mobile hero lesson and actual fix

At 390x844 → 375x667 during the reveal, the old canvas stayed 390x432.625 while the photo became 375x400.1875, leaving a stale composite extending below the photo. `chassis/emerge.js` and the rebuilt `joshharrison/emerge.js` now stop stale snapshots when the container dimensions change, including during cross-fade; restore the original image; and prevent the timeout fallback starting a second reveal. The canonical shader/effect was not redesigned. Normal portrait, wave resize and handoff resize were checked. Other existing tenant copies were NOT bulk-updated; preserve this guard during any intentional future master regeneration.

### Booking planner — what actually exists

- Installed locally across all 22 coaching/platform sites and template; native fictional/in-memory preview only. Chris approved TR's visual test (including using `@example.test` sample email rather than a real address).
- Client: `http://localhost:3000/trainedbytr/planner/?view=client`; coach: `http://localhost:3000/trainedbytr/planner/?view=coach`; equivalent Josh route under `/joshharrison/planner/`.
- Monday–Sunday desktop grid, phone day selector, 06:00–20:00 availability with lunch bookable, assessments/new-client requests, returning-client sample bookings, approval/reschedule/cancel flows, 24-hour notice/cutoff, group capacity/featured classes, working hours/buffers, blocked time, holidays and return notice, individual/week .ics export.
- Coach portrait watermark is optional. Existing sites use their own picture where available; the blank template has no watermark image and lists `images/planner-watermark.jpg` as an optional slot. Original/subtle vs stronger watermark comparison is supported.
- UK time zone Europe/London; Dina Asia/Jakarta. No real storage, booking authentication, transactional conflict prevention, payment, confirmation/reminder email, messaging or provider calendar synchronization. Public coach preview contains fictional data only. State resets on refresh; a calendar-file export is NOT ongoing/two-way sync.
- Demo booking form deliberately restricts email to `@example.test` (e.g. `chris@example.test`). Nothing is mailed by a sample planner booking. Do not casually remove this safeguard or represent the preview as a production diary.
- Canonical UI/model/CSS/HTML: `scripts/reskin/booking-template/`. Installer: `scripts/booking-planner.js`; rollout utility: `scripts/build-booking-planners.mjs`. Do not run the rollout again unless asked. Existing race-trip planner.js is a different tool and must not be overwritten by booking code.

### Seven videos — exact files and destinations

Latest videos are 1280x720 caption-led MP4s. Each keeps its original walkthrough/partner scenes, adds roughly 65.5 seconds of the coach-branded booking planner immediately BEFORE The Desk, and retains the final card pointing to the hosted page's clickable Explore your live platform button. MP4s themselves do not contain reliable clickable links.

Each local hosted asset is `pitch/<slug>/video.mp4`; each latest Desktop copy is `/Users/chri/Desktop/<slug>-walkthrough-with-planner.mp4`. These seven Desktop files and seven repo assets were found during this handover update. Older `*-review-22oct.mp4` / other review copies are not the latest planner-spliced versions.

| Coach / slug | Planner starts approximately | Final duration | Public pitch destination (newest version NOT yet pushed/verified online) |
| --- | --- | --- | --- |
| Faisal — faisalpma | 4:26 | 6:08 | https://www.station9studio.co.uk/pitch/faisalpma/ |
| Jade — jadeskillen | 4:19 | 6:00 | https://www.station9studio.co.uk/pitch/jadeskillen/ |
| Graham — elationfitness | 4:27 | 6:09 | https://www.station9studio.co.uk/pitch/elationfitness/ |
| Zara — coachedbyzara | 4:31 | 6:13 | https://www.station9studio.co.uk/pitch/coachedbyzara/ |
| TR — trainedbytr | 4:46 | 6:35 | https://www.station9studio.co.uk/pitch/trainedbytr/ |
| Jamie — jamiebarker | 4:56 | 6:44 | https://www.station9studio.co.uk/pitch/jamiebarker/ |
| Gabby — getfitgabby | 4:48 | 6:34 | https://www.station9studio.co.uk/pitch/getfitgabby/ |

- Local pitch URLs use the same paths on `http://localhost:3000`, e.g. `http://localhost:3000/pitch/trainedbytr/`. Public pages previously returned 404 while Railway deployment/maintenance was pending; no fresh public availability test was made for this documentation task.
- Josh is NOT one of these seven video builds. No Josh pitch video/page was created in this session; do not invent a working `/pitch/joshharrison/` URL. His website URL is above.
- `scripts/record-demo.mjs` records; `scripts/reskin/*.pitch.json` hold walkthrough scenes. Recorder handles new-tab links, shared planner-scene injection and caption placement inside native dialogs.
- `scripts/reskin/planner.segment.json` is the shared planner sequence. `scripts/splice-planner-videos.mjs` handles Desk detection and insertion; `scripts/video-text.swift` provides Apple Vision OCR.
- `scripts/reskin/planner-video-splices.json` stores original/output hashes, exact cut points, insertion durations, Desktop paths and temporary backup directories. Do not reset the manifest or splice again into already-updated videos. Later closing-card edits must preserve the planner; `scripts/refresh-pitch-videos.mjs` was adjusted accordingly.
- Full decode/duration/join/closing-card checks and local browser playback/seek tests passed earlier. The Desktop/repo copies were verified byte-identical then. No video regeneration, decode or hashing campaign was run merely to update this handover.
- Gabby's partner click-through uses Marchon because lululemon blocked the recording browser. TR/Jamie corrected scenes and editorial hero/photo updates were preserved.
- Hosted player/tracking: `server/pitch.js`, `pitch/pitch.js`, `pitch/pitch.css`, `pitch/<slug>/index.html`. Demo CTA opens that coach's site in a new tab. Existing tracking covers page view/play/25-50-75%/complete/demo/reply clicks. Cumulative visit-history summaries in notification emails are NOT implemented.

### Security work and release settings — not a claim the live service is hardened

Detailed changes are retained below. In brief: reviewed runtime/development updates brought both npm audits to zero known findings at the last audit; Node 22/24 support and npm 11.21.0 recorded; independent CI checks and pinned actions prepared; security headers/private-file alias guards/public tenant-config filtering added; private finance routes authenticate before schema/data work and are bound to desk-key tenant; pitch payload/rate/notification limits and header-only private summary auth added; remote DB verification/logging/backup credential handling hardened. No blind forced audit upgrades or lowered coverage/security thresholds.

GitHub settings already changed remotely: Dependabot alerts and automatic security updates enabled; secret scanning/push protection preserved; main blocks force push/deletion including admins. Normal pushes remain allowed. Mandatory CI/PR review is NOT enforced; it needs Chris's decision after actual check runs, accounting for content bots that currently push main. Source workflow fixes have not run as the new definitions on GitHub because they are still unpushed.

Chris confirmed station9-demos DATABASE_URL is private and approved preparing explicit private-network mode locally. For that confirmed service, the future coordinated release variable is:

`DATABASE_TRANSPORT=railway-private`

Use a SERVICE variable, not a project-wide shared variable. Do not add/apply it or deploy until Chris explicitly requests the release. Leave DATABASE_URL/passwords unchanged. Mode requires a valid *.railway.internal hostname and Railway project/environment/service IDs, rejects public/lookalike hosts, query routing overrides and conflicting TLS settings, and validates before listening. PostgreSQL-layer TLS is disabled only for this opted-in mode, relying on Railway's encrypted WireGuard network. Runtime markers are sanity checks, not cryptographic attestation. Default public connections still verify TLS; DATABASE_SSL_CA can supply a provider CA. Loopback local Postgres remains supported and a read-only SELECT 1 succeeded earlier.

Before ANY shared-code deployment, confirm the other affected Railway service's DB transport; Arciteq-Digital.css was not checked. Then verify a real DB query inside Railway after the coordinated release—a green basic health page alone is not proof. Do not request/paste full credential-bearing connection URLs. SONAR_TOKEN is absent; FOSSA is optional and its key absent. Actual provider scan runs, DB connection and release status remain to be validated, not assumed.

### Verification and unfinished items — do not silently finish these

- Latest full functional/coverage suite: **483 passed across 44 test files**, branch coverage **85.69%**, unchanged 80% requirement. Type-check passed; reveal-script lint had zero errors with the existing unused-catch warnings. Browser review covered all 18 Josh pages at desktop/mobile widths, no JS errors/overflow, requested photos, Fuel removal, and mobile reveal resize/settle behavior.
- The last combined command was NOT wholly green: `git diff --check` still reported trailing whitespace in generated `joshharrison/taper-zone.html` around line 394 after removing Fuel links. It is a minor outstanding cleanup item, NOT fixed in this documentation-only task. Ask before doing more code work.
- Last repo-wide format check reported legacy HTML/CSS parser errors in 26 files plus drift; its exact current count was not rerun after Josh work. Thirteen other legacy HTML/CSS files were found with old literal replacement fragments. Other generated Desk/reveal copies were not bulk-patched. These are separate suggested work requiring approval, not an automatic next block.
- New scope rules and this handover are the only changes requested in the current documentation task. The fresh window must NOT automatically fix trailing whitespace, reformat the repo, rebuild tenants, roll out shared scripts, make a video, configure services, commit/push/deploy, implement bookings, audit dependencies or send outreach.
- No current planner/security/Josh/photo/video changes are published just because local tests passed. Latest Josh photo arrangement and mobile behavior still await Chris's personal review. TR visual approval does not mean Josh's latest build is approved.
- Keep mailbox DNS/send-receive verification, cumulative pitch-email history, production booking/auth/storage/conflicts/messaging/calendar providers, broader legacy repair and release policy as pending only.

### Pitch refinements and technology wording

Main positioning remains: **Your business's platform, already built—see it before you pay.** Open with one genuine specific Instagram-post reference; mention Dina's reaction only if true. Keep the prospect's hosted walkthrough as the main CTA. Dina's proof link belongs before the sign-off; reserve the final P.S. for a real hold-until date followed by moving to the next coach, no drama. No outreach until the mailbox gate passes.

PHP news was discussed: this application is Node.js/JavaScript, not PHP. Do not sell it as hack-proof or categorically safer than WordPress/Shopify. Shopify core/themes are not WordPress/PHP, although separate integrations can use PHP. Non-PHP is supporting reassurance about that specific flaw, not the headline sales advantage. No new security-comparison sales copy was approved for insertion. Coach-owned images first; use generic exercise references honestly where approved, never imply a borrowed athlete is the coach.

### Cross-site survey — 25 October 2026, findings only

- Chris requested comparison before deciding template changes. Survey inventoried the 22 coaching/platform sites listed above plus `chassis`, and loaded seven key pages per site at 1280px and 390px (308 local page-load checks). No horizontal overflow was found on those checks. This is not a full content-rights, production-readiness or external-integration certification. Audit scripts/results and video contact sheets are in `/tmp/coach-site-survey-20261025/` (temporary, not permanent storage).
- All 22 have the booking-planner preview installed and rendering. Race-trip planning is a separate feature. Eleven modern sites show the race-trip guide load-failure message: the eight video-backed coaches other than Race to Frame, plus Maya, George Grayson and Station 9. The master and those builds seed `data/cities.json` as `{items: []}`, but planner/predictor code expects `cities`. The eight video-backed coaches were also checked individually: their predictor race selector has zero selectable races despite the correct horizontal layout. Trip scripts additionally contain invalid timezone strings such as `the UK/England`; the master has `the UK/{{REGION}}`.
- Browser-reproduced Desk syntax errors affect Faisal, Jade, Graham/Elation, Zara, Jamie, Gabby, TR, Maya and George. Example: `trainedbytr/desk.html` still declares invalid `var £`. Josh and the master already use the corrected `formatMoney` identifier. Older sites generally do not expose `/desk.html`; Station 9 also returned 404 at the tested public route, which must not be treated as proof its protected Desk is missing.
- All ten priority sites (nine with videos plus Ross) render wide desktop predictor forms; Ross has newer rendered styling despite legacy generation configuration. Nine older sites retain narrow approximately 220px predictor forms. Twelve sites retain Fuel pages; master still includes Fuel. Only Race to Frame currently combines calendar/travel and contains the interactive campaign preview. Keep optional commerce/podcast/campaign features configurable rather than assuming all coaches need Race to Frame's product-led structure.
- Nine sites have empty news data: Fennell, Gym64, Hustle, HYROX Doncaster, Kore, Nutrifit, Pacegym, Ross and Burgon. Other modern builds mostly have three editorial/example cards with a `take`, not a verified recurring newsfeed. Dina/Roxjaya has 18 sourced records, 13 with takes; Race to Frame has six source-linked records and no takes by Chris's explicit finished-work exception. Master already supports coach takes, but still has UK-only news framing and example seed content.
- Eight repo pitch MP4s are dated 23 October and match their corresponding `*-walkthrough-23oct.mp4` Desktop copies byte-for-byte. No rendered HTML/CSS/JS, image or data file in those eight sites had a modification time newer than its MP4 during this survey. This supports video freshness, but timestamps and sampled contact sheets are not proof every frame/function is correct. Race to Frame's final LATEST Desktop cut is 25 October; Ross has no matching prepared video found. Do not re-record merely because of this survey.
- Proposed next template specification, NOT permission to implement: working shared race-data shape; merged calendar/travel with proper timezones; international sourced news plus reviewed coach-voice commentary; Fuel off by default with explicit opt-in; functioning Desk formatter; existing booking preview; optional offer-led campaign, shop, podcast and Watch modules; activity-correct photo slots with text-only fallback; photo-led video scenes and concise approved caption style.
- **No site, template or video was changed by this audit.** Only these findings were logged. Gregor & Hattie remain wrapped. Ask Chris which implementation block to approve next; do not bulk-rebuild or propagate changes automatically.

### Coach voice in news — checked and logged 25 October 2026

- Chris wants news briefings to include a short coach-specific comment on each item: this is an opportunity to express the coach's voice, not simply repeat the source summary. Keep factual reporting and the coach's interpretation distinct, and retain the original source link.
- Verified the existing optional `take` field: `faisalpma/news.js` renders **Faisal's take:** and `trainedbytr/news.js` renders **Tom's take:**. Faisal's seeded news items contain voice-led example commentary; they are marked private pitch previews, not verified statements personally supplied by Faisal. Do not invent personal experiences or present generated comments as approved coach quotations.
- Josh also supports `take`, but the current renderer labels it **Preview note:** and the seeded entries are review placeholders. Do not assume every tenant already has finished coach-voice commentary.
- Future news builds/refreshes should pair each sourced briefing with a concise, clearly drafted coach-voice take for review. This note is not permission for a cross-site rollout.
- **Explicit exclusion: do not change Gregor & Hattie's Hybrid Brief or re-record their video to add commentary. Chris considers that work finished for now.** This task only checked the existing pattern and logged the preference.

### What the next window should do

1. Open `/Users/chri/Desktop/roxjaya`; read AGENTS.md, this latest snapshot, then BILLIONS.md → Chat notes.
2. Preserve all modified/untracked work and keep credentials out of the conversation. Read details below only as needed; historical imperative task lists do not override the scope agreement.
3. Acknowledge the handover and ask Chris for the next specific task. Offer suggestions if useful, but wait for approval before acting. There is no standing permission to continue the pending list.

---

## Earlier detailed progress / historical context

## Josh photo and mobile follow-up — local only

- Fuel Zone is hidden for Josh and its page/menu/footer/hash links removed. Taper's photo is the same calmer `bio.jpg` used in the Ask circle. Crew meetups again show the template restaurant and nightclub references, labelled as setting previews rather than Josh/client photos.
- Coaching now uses the crouched bright-trainers shot (`coaching-hero.jpg`, copied from the former Run Zone recovery image), with natural proportions and full trainers visible. The secondary Run Zone figure is removed; its running hero remains.
- Burpee/farmers images restored with reserved aspect ratios and corrected captions. Rowing reuses Jamie's existing faceless crop; wall balls use the ball/hands crop from TR's existing build, not the briefly considered rear-view candidate. Both are generic references, never attributed to Josh.
- Shared pool already exists at `scripts/reskin/stock/`. Added `generic-rowing-detail.jpg` and `generic-wallball-release.jpg` plus catalog.json recording source files/crop and unverified license status. A stock filename is NOT evidence of royalty-free licensing or a suitable exercise/face-free framing.
- Mobile reveal bug reproduced: after resizing 390x844 to 375x667, canvas stayed 390x432.625 while the photo became 375x400.1875. Chassis reveal now stops stale composites using frame bounds plus ResizeObserver (including cross-fade), restores the real image and prevents timeout-triggered second initialization. Canonical shader unchanged. Only Josh's generated site rebuilt; carry this guard forward if intentionally regenerating the master from the historical donor.
- Desktop/mobile checks passed on all 18 remaining pages: requested station/Coaching/Run/Taper/Crew placements, no horizontal overflow or JS errors, Fuel 404 and no remaining links. Mobile resize checked during wave and handoff; no stale canvas or repeated reveal. Real bookings/messages remain disabled in planner previews. No push/deployment.

## Earlier Josh template refresh — superseded photo arrangement

- Rebuilt `joshharrison/` from the current chassis using `scripts/reskin/joshharrison.demo.json`; only Josh's tenant registration changed. Local URL: http://localhost:3000/joshharrison/ . No push/deployment.
- Canonical assets: `scripts/reskin/joshharrison-chassis-assets/`. All seven supplied originals preserved under `scripts/reskin/joshharrison-source/supplied/`; screenshot cropped to its photo area. Existing exact aliases (hero/hero-alt/hero-reveal, avatar/josh-face, finish/josh-floor) were not treated as distinct new photos. New clear SkiErg/farmers-carry/run/transition/rope/recovery images assigned by activity.
- Historical first-pass arrangement: the crouching photo was initially put in Run Zone and four station photos were omitted. This was later superseded: bright trainers are now on Coaching only; burpee/farmers/rowing/wall-ball images are restored; Crew dinner/dance templates restored at Chris's request; only sandbag lunges remain text-only. See the authoritative latest snapshot above. Do not restore the old arrangement.
- Modern hero, booking CTA/menu, Ask footer prompts, all race tools, Watch, coaching/programme/store links and Desk retained. Floating duplicate CTAs hidden for Josh. Wrong photo descriptions, unsupported guide credentials and inherited tropical-weather copy corrected locally; 26/27 singles standards checked against the official HYROX PDF. Illustrative editorial cards explicitly marked as preview content.
- Fixed legacy regex replacement processing: authored capture references expand again, while dollars in token values remain literal. This caused the visible $1src fragments. Template and donor Desk money formatter renamed from invalid JS currency identifier to formatMoney; template demo storage key now tenant-specific. Only Josh's generated site rebuilt. Thirteen other legacy HTML/CSS files still contain old replacement artifacts and require a separate rollout; no bulk regeneration here.
- Historical donor config preserved at `scripts/reskin/joshharrison.donor.json`; `chassis.tokens.json` points to it. build-chassis now builds that donor in an isolated temp directory with --template-donor/--output-dir, never over the active modern Josh site. New staging output must not already exist and does not alter the registry or live planner. Current chassis was not regenerated during this refresh.
- Old Josh build preserved at `/var/folders/sj/037z84yd2qz33p9mhyl801g40000gn/T/s9-josh-before-refresh-GFPzsz/joshharrison`. Tests cover literal-dollar/capture handling and isolated output safety. Browser audit checked all 19 pages at 1440/390 widths: no JS errors, visible broken images, code fragments or overflow. Desk add/reset checked; mobile menu, planner request and full trainers crop checked separately.

## Booking planner — approved design rolled out locally

- Chris approved the TR design and requested rollout to every existing site and the template. Installed locally across all 22 registered coaching/platform sites, including Roxjaya, plus the neutral chassis. No public deployment has been performed. Seven existing walkthroughs now have a branded planner segment spliced immediately before the Desk, without re-recording the rest. All planners remain explicitly fictional, in-memory previews; Dina's real client data is not used.
- Local client preview: http://localhost:3000/trainedbytr/planner/?view=client ; coach preview: http://localhost:3000/trainedbytr/planner/?view=coach . Both are public design previews with fictional data, not authenticated live diaries.
- Native Monday–Sunday/hour-block desktop diary; phone/tablet day selector; faint full-page coach-photo watermark; public availability hides sample names. Session selection, new-client requests, returning-client sample bookings, approval, manual entry, working hours/buffers, blocks, completion/no-show, cancellation and reschedule interactions are in-memory only and reset on refresh.
- Explicit 24-hour cancellation wording, exact site-timezone cutoff (Roxjaya: Asia/Jakarta; UK demos: Europe/London), contact-coach path inside 24 hours. No real bookings, fees, email, reminders, persistence or calendar syncing. Production backend, tenant-isolated storage/authentication, transactional double-booking prevention and messaging remain a separate implementation block after design approval.
- Canonical shared source: scripts/reskin/booking-template/{planner.html,booking-ui.js,booking-model.js,booking.css}. Installer: scripts/booking-planner.js; bulk refresh: node scripts/build-booking-planners.mjs. Both tenant build modes and chassis regeneration call the installer, so future builds retain booking pages/menu/CTA. Original TR assets remain the historical pilot; --from-pilot re-promotes and overwrites canonical shared source, so do not use it for routine builds. Booking scripts never replace the existing race-trip planner.js.
- Neutral template preview: http://localhost:3000/chassis/planner.html ; watermark and portrait are empty by default. Optional master image slot: images/planner-watermark.jpg in chassis/images/slots.json. Existing sites reuse their coach bio image where no dedicated watermark exists. booking.watermark and booking.timeZone can be set per tenant.
- Every site's preview is at /<slug>/planner/ ; append ?view=coach for the fictional coach view. Main menu starts with Book a slot; homepage repeats it beneath the photo (inside an existing editorial hero footer, or in a new separate booking strip for older layouts).
- Comparison version: append `&backdrop=watermark` for the stronger portrait watermark, or `&backdrop=subtle` for the original. Background toggle preserves the current demo diary in memory.
- Latest pilot additions: 06:00–20:00 with lunch bookable; distinct featured group classes with sample capacities, reserve/release spots and coach highlight controls; Initial assessment in the session dropdown; first-position Book a slot navigation and homepage hero-footer button.
- Coach controls include date-range holidays with a public return-to-working-hours notice and warnings for existing sessions (never silently cancelled); per-session/week .ics exports labelled DEMO, with one-time-import warning. Phone-calendar free/busy sync is NOT connected or implemented; needs provider authorisation after design approval. No silent phone access is implied.
- Verification: npx vitest run tests/planner-demo.test.js tests/booking-rollout.test.js (17 tests, including DST/cutoff, overlaps/buffers, public labels, hours/lunch, group capacity, holidays, escaped/folded calendar export, idempotent navigation, blank-photo template and unchanged race-trip planner). Rollout browser checks covered all 22 sites at 1440 and 390 pixels: names, photos, timezone, request/approval, first-menu link, below-hero CTA and no horizontal overflow; template makes no photo request. ESLint and type-check. Latest browser checks at 1440 and 390 pixels cover group highlight/reservation/cancellation, assessments, exports, holiday blocks/notices, background switching and homepage CTAs with no write requests. Earlier baseline also checked at 768 pixels. Existing race-trip planner checked separately.

## Walkthrough planner splices — seven local review copies ready

- Updated pitch/<slug>/video.mp4 for Faisal, Jade, Graham, Zara, TR, Jamie and Gabby. Each adds about 65.5 seconds immediately before The Desk; original partner click-throughs, corrections and Explore your live platform closing cards remain intact. Pitch pages use a new video cache key and no longer claim a five-minute runtime.
- Desktop copies: <slug>-walkthrough-with-planner.mp4. Durations: Faisal 6:08; Jade 6:00; Graham 6:09; Zara 6:13; TR 6:35; Jamie 6:44; Gabby 6:34. Review cut points and backup paths are recorded in scripts/reskin/planner-video-splices.json. Originals were backed up in the referenced temporary work directories.
- Reusable scene: scripts/reskin/planner.segment.json. record-demo.mjs inserts it before desk.html in future full recordings. PITCH_SCENES_FILE selects an isolated recording script; PITCH_NO_END_CARD=1 omits the extra end card; PITCH_STRICT=1 fails actions rather than hiding errors. Native-dialog captions are brought into the dialog layer so they remain visible.
- Splice utility: node scripts/splice-planner-videos.mjs [slug...]; --analyze only locates Desk transitions. Uses native Apple Vision OCR via scripts/video-text.swift; needs macOS Swift and ffmpeg. Manifest prevents duplicate insertions, and changed previously-spliced inputs require review rather than automatic re-splicing. Do not blindly reset the manifest.
- Verified all videos decode, match their Desktop copies byte-for-byte and keep Desk/closing frames. Six automated splice jobs also check the Desk heading after the inserted segment; TR's first splice was checked manually. Local hosted playback and seeking checks intercept notification events rather than sending real alerts. No push or public deployment in this task.

## Security hardening — local changes verified; deployment gates remain

- Baseline had 8 affected production package entries and a broken zero-job CI workflow. Patched dependencies and compatible development tooling using reviewed releases older than seven days; no forced audit fixes, peer-check bypasses or deleted lockfiles. Both production-only and full npm audits now report zero known vulnerabilities. npm 10 hit a peer-resolution bug; updates succeeded with npm 11.21.0 without changing global npm configuration. Native node --watch replaces the legacy nodemon development watcher.
- GitHub changes already applied remotely: Dependabot vulnerability alerts and automatic security-update PRs enabled; secret scanning and secret push protection remain enabled. Main now blocks force pushes and branch deletion, including for administrators. Normal pushes/content bots still work. Required status checks/PR approvals are NOT enforced yet: choose that workflow after the first real green security runs and account for content bots pushing to main.
- CI source repaired locally: independent dependency, secrets, Trivy, CodeQL, tests and runtime checks run even if formatting fails. Actions are pinned to verified release SHAs; Node 22 used; no coverage-badge writes back to main; no public Lighthouse report uploads. ZAP starts against an isolated local test server, errors are actionable, and FOSSA optional-key conditions use env rather than invalid secrets-in-if syntax. Duplicate update-sitemap workflow now manually delegates to the canonical CI rather than running a broken duplicate. Weekly Dependabot source config added.
- All active workflow files validate with actionlint 1.7.12 (official archive checksum verified). The repaired workflow definitions have not run on GitHub yet because source changes remain unpushed; enabling Dependabot may independently start its own scans or PRs. SONAR_TOKEN and FOSSA_API_KEY are currently absent; Sonar now fails explicitly until configured instead of being blocked behind Prettier. FOSSA remains optional as originally intended; CodeQL and other security checks do not depend on those tokens. AI review checkout credentials and file handling hardened; provider/model configuration still needs validation in a real run.
- Added shared browser security headers (nosniff, same-origin framing, base/object restrictions, strict referrers, HTTPS-only HSTS and opener/feature policies), removed Express fingerprint, made uncaught exception responses generic, redacted the central DB logs and removed connection-string fragments from their logging. This is a conservative compatible CSP baseline, NOT a full nonce-based script policy or a penetration-test certification.
- Static private-file guard now canonicalises encoded/dot-segment aliases and fails closed for hidden/malformed paths. Raw data/tenants.json is no longer served; its route returns only public tenant IDs, hostnames and hero product IDs needed by the existing supplier UI, not automation, owner contacts or internal author configuration.
- Desk authentication is capped at 120 requests/minute/IP per process. Finance endpoints authenticate before touching tables; GET and write tests use forged tenant parameters/body/referrer and still bind to the key owner's tenant. Hashed random desk keys and constant-time key comparisons preserved. This is not a complete audit of every tenant-data endpoint.
- Pitch events now use a 4KB parser, bounded 90 requests/10 minutes/IP, session validation, cross-site rejection and deduped session/event notifications. Owner alerts capped at 30/hour per process; valid events still record when alert quota is reached. Provider fallback now awaits success correctly. Multi-replica distributed limits are not implemented. Private pitch summary requires x-admin-key or x-admin-api-key; query-string admin keys no longer authenticate. If an admin key was previously used/shared in URLs, rotate it through secure configuration, not in chat.
- Postgres pool, migrations and backups share transport selection. Default remote connections verify certificates; optional DATABASE_SSL_CA supplies a public provider CA. URL flags cannot disable verification, and query-based host/hostaddr/port/service/servicefile routing overrides are rejected. Local loopback remains supported without TLS; explicitly selecting DATABASE_TRANSPORT=verify-full requires verified TLS even locally. Backup credentials stay off command arguments.
- Chris confirmed station9-demos uses a private Railway database and approved an explicit private-network mode. For that confirmed service ONLY, the release setting is DATABASE_TRANSPORT=railway-private (service variable, not project-wide shared variable). This selects no PostgreSQL-layer TLS while relying on Railway's documented encrypted, environment-isolated WireGuard network: https://docs.railway.com/private-networking . No unverified certificate is accepted.
- Private mode requires a syntactically valid *.railway.internal hostname plus nonempty RAILWAY_PROJECT_ID, RAILWAY_ENVIRONMENT_ID and RAILWAY_SERVICE_ID. These are Railway-provided runtime sanity checks, not cryptographic network attestation. Public/lookalike hosts, absent runtime markers, unknown modes, routing overrides and conflicting TLS/CA settings fail closed. Server validates configuration before listening. Other services stay on default verified TLS unless individually checked and explicitly opted in. The other visible Railway service, Arciteq-Digital.css, has NOT had its database transport confirmed; check it before any shared-code deployment that would update both services.
- The code and service-variable setting must be coordinated at release. DO NOT add/apply the variable or trigger a deployment while release is held. Leave DATABASE_URL and credentials unchanged. No Railway variables have been changed; real private-network DNS/database connectivity still requires an actual DB query in the deployed environment (a green /health alone is not proof). No migration, backup or webhook replay was run.
- Private-mode follow-up verification: 477 tests passed with the unchanged coverage gate (85.66% branches), lint/type-check and isolated HTTP smoke passed. Tests cover explicit opt-in, invalid hosts, runtime markers, routing overrides, conflicting/duplicate TLS flags, pg pool configuration/cache changes and refusal to start with unsafe configuration. Desktop/mobile planner/video previews passed under simulated private-mode settings with analytics/notifications intercepted; this was NOT a real Railway connection test.
- Initial hardening verification (before the private-mode follow-up above): 448 tests passed with coverage (85.45% branches; unchanged 80% gate), lint and type-check passed, npm production/full audits zero, workflow lint passed. Isolated HTTP smoke passed for headers/private aliases/public projection/private unauthenticated routes. All 22 planners and seven video players load and work under the hardened headers with no JS errors; notification requests mocked in browser checks. Test-mode server disables schedulers, not production monitors.
- Repo-wide format:check still fails due legacy HTML/CSS parse errors in 26 files plus formatting drift. Confirmed representative errors in committed HEAD (Race to Frame CSS and Burgon index), not introduced by these security edits. Check was not excluded, ignored or downgraded. Formatting cleanup is separate; security jobs now run independently of that failure.
- Original refactor-verification shell script was not run: it kills the current dev server and replays webhooks into a database, with absent baseline snapshots. Instead checked syntax, generated a fresh 218-entry route/middleware snapshot, ran isolated HTTP/security tests and full coverage suite. HTTP behaviours intentionally changed for hardening.
- No code push, application deployment, secret rotation, migration or application email/payment call in this hardening block. GitHub settings above are the only already-live changes.

## Photo review status

- GetFitGabby: photos approved by Chris; no further photo sourcing needed (22 October 2026).
- Jamie Barker: five additional race photos supplied by Chris for farmers carry, doubles finish, sled push, sled pull and Run Zone (22 October 2026).

## 1. Current operational state

### Microsoft 365 email setup — INCOMPLETE

**Do not send outreach from `chris@station9studio.co.uk` yet.**

Live DNS check (authoritative Namecheap nameservers):

| Record             | Expected                                                      | Current state                                                     |
| ------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| MX                 | `station9studio-co-uk.mail.protection.outlook.com` priority 0 | Still pointing to 5 old `eforward*.registrar-servers.com` records |
| TXT verification   | `MS=ms84635686`                                               | Correct and present                                               |
| SPF TXT            | `v=spf1 include:spf.protection.outlook.com -all`              | Still old `v=spf1 include:spf.efwd.registrar-servers.com ~all`    |
| Autodiscover CNAME | `autodiscover` → `autodiscover.outlook.com`                   | Missing                                                           |

What has been done:

- Microsoft 365 Business Basic trial created.
- Admin sign-in address changed to `chris@station9studio.co.uk`.
- Domain ownership verified in Microsoft (`MS=ms84635686`).
- Namecheap **Mail Settings** changed to **Custom MX** and the Microsoft MX row entered.

What is blocking:

- Namecheap has not yet published the MX change to its authoritative DNS. The UI shows Custom MX with the correct value, but a live `dig` still returns the old forwarding records.

Next step:

1. Wait up to 30 minutes, then re-check `dig MX station9studio.co.uk`.
2. If it still has not flipped, click **Save All Changes** again in Namecheap Advanced DNS.
3. Once MX is correct, add the Autodiscover CNAME and replace the SPF record.
4. Re-check all three records publicly.
5. Only then click **Continue** in Microsoft Admin Centre.
6. Add `chris@station9studio.co.uk` to Outlook on iPhone.
7. Send a test email and reply to it. Only use the address for outreach after the reply arrives.

Fallback if Microsoft stays painful:

- Cancel the trial before renewal.
- Use **Namecheap Private Email** instead (same DNS host, simpler routing).
- Create `chris@station9studio.co.uk` there and add it to Outlook.

### Outreach channel strategy

Instagram direct messaging is now high-risk. The `@station9.studio` business account was deactivated after only a small number of personalised pitches. The current plan is:

- **Primary:** personalised email with a Loom-style video walkthrough.
- **Instagram:** discovery and relationship only, not full pitches.
- **Email sender:** ideally `chris@station9studio.co.uk` once routing works; otherwise an established personal mailbox with display name **Chris Wood — Station 9** and signature:
  ```
  Chris Wood
  Founder, Station 9
  https://www.station9studio.co.uk/station9/
  ```

## 2. Historical demo/publication records — not fresh availability checks

The statuses in this older table were recorded before the current local work and Railway maintenance. They are historical, not proof of the newest online version. Use the authoritative snapshot's destinations/statuses above. Site folders are served under `https://www.station9studio.co.uk/<slug>/` when deployed; main is the recorded Railway deployment branch.

**URL rule for pitches (Oct 22):** always send `https://www.station9studio.co.uk/<slug>` — WITH the `www`. The apex domain (`station9studio.co.uk`, no www) points at a dead Namecheap parking IP (192.64.119.235) and times out. Bare-domain links in emails will silently fail for recipients. Permanent fix queued: Namecheap Advanced DNS → replace apex A record with URL Redirect to `https://www.station9studio.co.uk/`.

| Slug             | Public URL                                      | Prospect                              | Status                                                                                        |
| ---------------- | ----------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `station9`       | https://www.station9studio.co.uk/station9/      | Station 9 hub / product front door    | Live                                                                                          |
| `racetoframe`    | https://www.station9studio.co.uk/racetoframe/   | Gregor & Hattie / Race to Frame       | Live, not yet pitched by email                                                                |
| `jadeskillen`    | https://www.station9studio.co.uk/jadeskillen/   | Jade Skillen                          | Live; original Instagram pitch sent before account deactivation                               |
| `joshharrison`   | https://www.station9studio.co.uk/joshharrison/  | Josh Harrison                         | Live; original Instagram pitch sent before account deactivation                               |
| `faisalpma`      | https://www.station9studio.co.uk/faisalpma/     | Faisal Abdalla / PMA Fitness          | Live, not yet pitched                                                                         |
| `georgegrayson`  | https://www.station9studio.co.uk/georgegrayson/ | George Grayson / GG Coaching          | Live, not yet pitched                                                                         |
| `burgonfitness`  | https://www.station9studio.co.uk/burgonfitness/ | Hannah Burgon / Burgon Fitness        | Live, not yet pitched                                                                         |
| `htcfisher`      | https://www.station9studio.co.uk/htcfisher/     | Ross Fisher / HTCC Christchurch       | Live; already pitched on Instagram                                                            |
| `jamiebarker`    | https://www.station9studio.co.uk/jamiebarker/   | Jamie Barker / Edge                   | Live; only verified route is Edge support                                                     |
| `coachedbyzara`  | https://www.station9studio.co.uk/coachedbyzara/ | Zara Piergianni                       | Live; no verified business email yet                                                          |
| `elationfitness` | `/elationfitness/` (local)                      | Graham Halliday / Elation Gym Glasgow | Built locally, fully reskinned with his own IG event photography — pitch-ready pending deploy |
| `getfitgabby`    | `/getfitgabby/` (local)                         | Gabby Moriarty                        | Built locally with her real station imagery                                                   |
| `trainedbytr`    | `/trainedbytr/` (local)                         | Tom Redmond / TransFit Widnes         | Built locally; coaching-page photo moved above plan cards                                     |

Other tenant folders exist (`hustle`, `pacegym`, `gym64`, `nutrifit`, `kore`, `fennellfitness`, `hyroxdoncaster`, `htc...`) but are not currently pitch-ready. `hyroxdoncaster/` is an old pre-chassis demo (Nigel Wood) — needs a chassis rebuild before pitching.

## 3. Repository and deployment

Local repository: `/Users/chri/Desktop/roxjaya`
Git remote: `https://github.com/chriswwworldwide/Arciteq-Digital.css.git`
Deployment branch: `main` → Railway auto-deploys.
Historical working branch: `devin/gh-dossier`

Key directories:

- `chassis/` — neutral base template for new tenants.
- `scripts/reskin/` — per-tenant config JSON files, source packs and asset folders.
- `scripts/reskin-tenant.js` — generator that turns a config + assets into a tenant folder.
- `scripts/prospect-pipeline.js` — batch pipeline: qualify → triage → export → sort → allocate → build.
- `scripts/build-chassis.js` — regenerates the neutral `chassis/` from the current best donor.
- `scripts/photo-sort.js`, `scripts/apply-thumbnail-index.js`, `scripts/allocation-contact-sheet.py`, `scripts/bright-contact-sheet.py`, `scripts/bright-export-assets.py` — photo pipeline.
- `data/tenants.json` — registry of all tenants, hostnames, automation and nav.
- Dossiers at repo root: `GREGORHATTIE.md`, `JOSHHARRISON.md`, `FAISAL.md`, `JADESKILLEN.md`.
- Business plan and pipeline: `PROSPECTS.md`, `BILLIONS.md`.
- Project notes: `AGENTS.md`.

## 4. Multi-tenant architecture

The system is a **shared chassis + generated tenant output**.

1. `chassis/` holds a neutral, tokenised site (no persona left in it).
2. A tenant config (`scripts/reskin/<slug>.demo.json`) supplies tokens, colours, assets and voice.
3. `scripts/reskin-tenant.js` copies `chassis/` into `<slug>/`, substitutes tokens, injects menus/data, and registers the tenant in `data/tenants.json`.
4. The result is a self-contained static folder that Railway serves at `/<slug>/`.

Rules:

- **Global changes** (shared engine logic, core templates, layout, shared CSS, checkout) go in `chassis/` or root-level files and affect every tenant on next rebuild.
- **Local changes** (brand, colours, images, voice, per-site SEO, page renames) belong in the tenant config or tenant output folder.
- Generated tenant folders are outputs, not sources of truth. The source of truth is the config + assets in `scripts/reskin/`.

For the full build/photo process, see `AGENTS.md` section "Start here for batch tenant builds" (added alongside this handover) and `scripts/reskin/CHASSIS.md`.

## 5. The pitches — current angle for each receiver

**Copy rules agreed Oct 22 (apply to every future draft):**

- **Personal opener first, when genuine:** reference one specific Instagram post, pinned post or coaching point early in each personalised pitch. Explain briefly why it resonated rather than offering generic praise. Example used by Chris: "My partner Dina, who's a HYROX athlete and PT, loved your pinned post about overtraining for women." Use this wording only when Dina actually saw the post and said that; never invent her reaction or imply she endorses the prospect. Record the post link/topic with the prospect notes so the reference can be checked. Prefer relevant coaching content over private family details. Keep it to one sentence, then move straight to the already-built platform.
- **Personalisation is an engagement hypothesis, not a promised uplift:** a sincere, relevant opener can make the pitch feel considered rather than mass-sent, but no conversion percentage is established. Compare replies and meaningful video engagement over time; do not attribute all differences to the opener.
- **No analogy/justification lines.** Coaches know whether they want a platform and why — the "you need a website like you need a phone" framing was dropped as salesy. After the personal opener, say "I've already built your platform" and let the demo do the persuading.
- **One main CTA:** the hosted walkthrough page, with its live-demo button underneath. No video attachment. A supporting proof link is not a separate ask.
- **Dina proof before the sign-off; deadline in the P.S.:** after the main walkthrough link, add a supporting proof line such as "My partner Dina is a HYROX athlete and PT — here's the platform she already runs on: https://roxjaya.com/roxjaya/". Sign off, then reserve the P.S. for "I'll keep your build open for you until [day/date], then we move on to the next coach — no drama." Only state a genuine deadline we will honour. Keep the hosted prospect walkthrough as the main CTA; Dina's link is evidence, not another action to request. Recheck the proof URL before each outreach batch.
- **Subject stays ambiguous** — reads like a client enquiry ("Quick question about your sessions, X").
- **Deliverability gate:** test-send to own Yahoo/Gmail before each batch; 14MB attachments from a cold domain are the biggest failure mode.
- **Next iteration — own video platform (decided Oct 22):** replace attachments with `station9studio.co.uk/pitch/<slug>/` — our own branded video page (video on top, demo link underneath = single CTA). Build in view tracking (pageview + play/watch events pinged to a lightweight endpoint) so we know if and when a prospect watches — that timing drives the follow-up. The page itself is product proof. Avoid Loom/YouTube chrome; ours is the brand.
- **Stagger sends one per day**, P.S. deadline = send date +4 days (keeps the one-per-city story honest).

Use these as the starting point. Each pitch should be 45–90 seconds in a Loom-style video, then wrapped in a short email.

### Gregor & Hattie / Race to Frame

- **URL:** https://www.station9studio.co.uk/racetoframe/
- **Route:** Race to Frame contact form: https://racetoframe.com/pages/contact; Linktree: https://linktr.ee/gregorandhattie; IG @gregorandhattie.
- **Status:** Demo live. Not yet pitched by email.
- **Angle:** "Your audience is huge and your funnel is held together with a Linktree." Demo the consolidated umbrella brand: podcast, coaching, shop, race tools, community, and the Money Desk for the business side. Frame it as relief from fragmentation, not a prettier website.
- **Money Desk:** Include it. Their synthetic ledger shows Shopify + coaching + affiliate income vs expenses. Pitch line: "the platform runs the boring bits too."
- **Price:** £995 setup + £129/mo (founding rate). With Money Desk: £1,195 setup + £178/mo.

### Faisal Abdalla / PMA Fitness

- **URL:** https://www.station9studio.co.uk/faisalpma/
- **Route:** `faisalpmafitness@gmail.com` (recorded public route); Linktree: https://linktr.ee/pmafitness; IG @faisalpmafitness.
- **Status:** Demo live. Not yet pitched.
- **Angle:** Authority figure with coaching, programmes and a personal brand scattered across links. Pitch is an owned platform for the whole PMA ecosystem — coaching hub, race tools, Warriors Wall for athletes, all under his roof.
- **Money Desk:** Include it for his coaching/programme/affiliate mix.
- **Personal hook:** His post about daughter Cleo’s 4th birthday — use only if sincere.

### George Grayson / GG Coaching

- **URL:** https://www.station9studio.co.uk/georgegrayson/
- **Route:** `george@georgegraysonfitness.co.uk`
- **Status:** Demo live. Not yet pitched.
- **Angle:** Treat as the creator-commerce tier closest to Gregor & Hattie. Show consolidation of coaching, programming, race tools and community. Emphasise owning the relationship with athletes instead of routing through third-party apps.

### Hannah Burgon / Burgon Fitness

- **URL:** https://www.station9studio.co.uk/burgonfitness/
- **Route:** `hannahburgonpt@gmail.com`
- **Status:** Demo live. Not yet pitched.
- **Angle:** "You've outgrown Squarespace." She has an established community and premium pricing (£89/mo). The pitch is infrastructure: community space, results/event tooling, race tools — things Squarespace cannot do. Do not criticise the look of her current site.

### Ross Fisher / HTCC Christchurch

- **URL:** https://www.station9studio.co.uk/htcfisher/
- **Route:** `ross@hyroxtrainingclubchristchurch.co.uk`
- **Status:** Already pitched on Instagram before deactivation.
- **Angle:** Affiliated training club with 60+ athletes. Sell the Season features: travel board, results engine, race-mate finder. Frame as a bolt-on to his existing decent site.
- **Next action:** Decide whether to bridge from the Instagram DM to his business email with a short "also sent this to your inbox" note.

### Jade Skillen

- **URL:** https://www.station9studio.co.uk/jadeskillen/
- **Route:** Official contact appears tied to `@smashyourhyrox.com`; coaching funnel at `https://start.jadeskillen.com/`. Exact email must be copied from Instagram’s official Contact button — do not guess.
- **Status:** Instagram pitch sent before account deactivation.
- **Angle:** Established coach with a real ecosystem already split across `start.jadeskillen.com`, `smashyourhyrox.com` and social links. Pitch is consolidation, not replacement: PERFORM programme, 1:1 coaching, race tools, Warriors Wall, all under one roof.
- **Personal hook:** Her pinned post on burnout — reference it briefly if resending.

### Josh Harrison

- **URL:** https://www.station9studio.co.uk/joshharrison/
- **Route:** Hybrid Hub contact form/email needs verification; clothing site `https://hybrid-hub.uk/`; Linktree `https://linktr.ee/JHFIT`; IG @joshharrisonfit.
- **Status:** Instagram pitch sent before account deactivation.
- **Angle:** His audience is already a business (coaching + programmes + affiliates + clothing + YouTube) with no single owned front door. Pitch a cinematic dark site, pink-accented, carrying coaching, race tools, partners and a Money Desk.
- **Personal hook:** His "Can AI do that?" reel — every discipline, every "no". Frame the demo as the thing AI cannot build: a real, owned platform.

### Jamie Barker / Edge

- **URL:** https://www.station9studio.co.uk/jamiebarker/
- **Route:** Only verified route is Edge support: `support@findyouredge.app`. This is not a direct Jamie business address.
- **Status:** Demo live. Not yet pitched.
- **Angle:** Edge is a product/app business; Jamie is the founder/face. Pitch should frame the demo as a creator front door for Jamie the coach, while respecting that Edge is a separate support channel. Consider asking Edge support to forward a business enquiry.

### Zara Piergianni

- **URL:** https://www.station9studio.co.uk/coachedbyzara/
- **Route:** Linktree `https://linktr.ee/coachedbyzara`; no verified business email.
- **Status:** Demo live. Not yet pitched.
- **Angle:** Hold until a legitimate business route exists. Do not pitch through Instagram DM again.

### Graham Halliday / Elation Fitness

- **URL:** local build `elationfitness/` — deploy to Railway before pitching.
- **Route:** IG `@grahamhalliday_` (personal), `@elationgymglasgow` (gym). Email TBD.
- **Status:** Demo built and reskinned entirely with his own Instagram event photography. Pitch walkthrough script written: `scripts/reskin/elationfitness.pitch.json`. Pitch strategy logged in `scripts/reskin/prospects/BATCH-gabby-tom-graham.md`.
- **Core angle — "a celebration of the athlete", not a coaching site.** Every image is his own professional HYROX race photography; the quote in The Athlete section is his own words from his 114K-like "AGAIN" post. The line: _"This isn't a website — it's what your Instagram should have been building towards all along."_
- **Image map worth naming in the walkthrough:** hero = his actual finish-line shot (arms wide, HYROX FINISH, Red Bull stage); Athlete = "AGAIN" sled image + his own quote; splits = face-down on the arena floor; all 8 stations = his real event shots (sled push/pull, SkiErg, row, burpees, farmers carry, sandbag lunges, wall balls); predictor = his 54:42 finish board; results = him and Hannah (@elationhannah, team member, NOT his girlfriend — girlfriend is Jen) at the 1:00:41 board; find-a-partner = running with Hannah.
- **Chassis notes:** Watch page stripped and links removed via copyOverrides (header + footer regexes). Coaching page photo moved above plan cards (global chassis change). `.guide-hero-photo img` now uses `object-fit: contain` + `max-height: 520px` so full-body images don't crop heads (global change).

### Gabby Moriarty and Tom Redmond

- Local demos `getfitgabby/` and `trainedbytr/` built via the same chassis. Gabby's station roster is all real imagery from her own reels. Tom's is thinner — his station content is caption-overlay coaching reels, several slots use explicit stock.

### New prospects (researched 24 Oct 2026) — pitch notes

None built or pitched yet. Details and scoring: PROSPECTS.md → "New creator-coach prospects". Apply the Oct 22 copy rules above to every one: a genuine opener from a real post (record the post link here before sending), "I've already built your platform", one CTA (hosted walkthrough), Dina proof line, deadline in the P.S. Don't name or quote anything we haven't verified on their own channels.

#### Paul Gillingham (@paulgillingham_)

- **Route:** Paulmgillingham@gmail.com (on his Linktree); IG DM.
- **Angle:** "Mr HYROX has no home of his own." His coaching lives on Rox Lyfe (someone else's brand) and a Paperform form, and his income is split across ~13 affiliate codes on a Linktree. Pitch the consolidation: his own platform, with coaching, his plans and every partner code in one place, plus the Desk to track affiliate income — the same relief-from-fragmentation pitch as Gregor & Hattie.
- **Show:** a partners page with his real codes (Hybryd PG10, Puma ROXLYFE30, Built for Athletes PAUL15, Beet It PAUL25, Xendurance PAUL20, Zone 8 PAUL10), race history (Team GB, 38+ races, age-group world record), coaching apply button, Desk with affiliate lines.
- **Careful:** don't criticise Rox Lyfe or suggest he leave them — position it as *his* brand alongside his Rox Lyfe work. Ask before building how he wants Rox Lyfe plans represented.
- **Opener idea:** a recent race or Deadly Dozen judging post; his "Poptart Paul" pre-race habit is a light, genuine hook if it's still on his feed.

#### Lucas Parker (@coachparkerpt)

- **Route:** IG DM (WhatsApp number is in his bio; no email found). Check Instagram's Contact button for an email before sending.
- **Angle:** "Your results have outgrown your website." World record holder, 57:18 Pro PB, adidas athlete — currently on a free Framer template address. Pitch a proper athlete platform plus a home for Running Academy (group sessions, sign-ups, community) in one place.
- **Show:** the athlete story (Buxton, manual jobs to elite), race results board with his real times, Running Academy section, predictor/splits tools as lead magnets for runners moving into HYROX.
- **Careful:** the template site isn't "bad" — say he's outgrown it (same rule as Hannah Burgon). Use his own wording from his site/IG for the story, not ours.
- **Opener idea:** a recent race post (Salt Lake City Pro, Sep 2026, or London PB).

#### Michele Wilder (@michele_wilderfitness)

- **Route:** wilderfitnessuk@gmail.com (official HYROX coach listing).
- **Angle:** "Your community deserves a home you own." Hyrox Newbies already exists on Facebook — the pitch is moving the community's centre onto her own platform (questions, race-mate finder, first-race guides, Foundations sign-ups) while the Facebook group keeps running. Beginner-focused, not elite.
- **Show:** first-timer journey — race calendar, find a race-mate, station guides, Foundations programme page, community wall. Tone: warm, reassuring, "no silly questions".
- **Careful:** never suggest shutting the Facebook group. Get her real follower count and Foundations price before building.
- **Opener idea:** a Foundations launch post or a newbie live stream.

#### Eilidh Boyd (@elationeilidh)

- **Route:** IG DM; warm intro via Graham Halliday if his pitch lands first. Only the gym email (elationgymgroup@gmail.com) is public — don't use it for her personal pitch.
- **Angle:** personal-brand lane (like Gabby, not like Elation gym): her own platform for online coaching and the In-Season HYROX plan, replacing two Google Forms. Small, affordable, quick win.
- **Show:** coaching application built in, the in-season plan page, partner codes (ESN, Teveo, Wolf Tuna), Glasgow race content.
- **Careful:** sequence after Graham — don't pitch Elation staff before the gym owner has seen his. Make clear it's separate from the gym's brand.

#### Martyn Paterson (@martynpaterson_)

- **Route:** IG DM (no email found).
- **Angle:** "You've just launched — launch it properly." Linktree created July 2026; coaching sits on FITR. Pitch a founding-client platform for MP Performance Coaching with his Pro results front and centre.
- **Show:** results (Pro 1:02:38 Gdansk, Pro Doubles 55:54 Glasgow), coaching page linking to FITR, YouTube section.
- **Careful:** confirm his location and follower count first (Scotland is a guess from race history). Founding-client pricing fits a newer business.

#### Coach Kim (@coachedby_kim)

- **Status (29 Oct):** photo intake complete; build not started. Next job, with Chris's build decisions, is in "Latest session — 28–29 October 2026" at the top of this file. Image catalogue and shortlist: `scripts/reskin/coachedbykim-source/MANIFEST.md`.

- **Route:** IG DM (no email found). Also: admin@apreslondon.co.uk / +44 7471 581970 on the studio side.
- **Angle:** STUDIO lane confirmed — Apres London is her own gym (Deptford/SE London). Updated Oct 28 intel: race activity dropped off over the past year while she built the studio; recent posts are heavily FORM/TECHNIQUE content; and she teased "AI Coach Kim" (an AI clone avatar of herself — Coachvox/Delphi-style product) on 6 Aug with NO public link since, so it may be gated or stalled.
- **Pitch:** "be in more places at once" — she already believes in scaling herself (that's what the AI avatar is FOR), so lead with Manage videos / Watch & Learn: she creates and publishes her own form-technique library on HER platform, on her terms, no clone needed. The AI angle is a complement, not a rival — a clone is a feature that needs a platform to live in; the platform is bookings + programmes + content + community. Trainerize hookup stays in the demo (existing coaching plumbing), but it's supporting cast, not the lead.
- **Demo emphasis:** owner content publishing front and centre (draft/preview/publish her form-cue videos), form/technique library populated in her voice, first-timer programmes (First Time Heroes 12-week, Gym Confidence 6-week), studio booking via The Desk, trainerize launchpad present but quiet. Ask-Kim FAQ widget demos the honest version of "talk to Kim at 2am".
- **Verified athlete stats (her own "HYROX Wrapped" post, 18 Apr 2025):** surname MANSELL; HYROX PRO athlete; 18 races (her own 22 Oct 2025 caption — supersedes the 16 in the Wrapped post), 7 divisions, 9 partners; 8 cities raced (London ×7); best ranks #2 women age-group, #6 women, #10 pro women (AG); 1:12:28 London Olympia. Re-verify before publishing — stats predate her quieter racing period.
- **Content + racing intel (photo intake, Oct 29):** Apres has a YouTube channel with produced episodes (first-timers at ExCeL London, filmed by @thomasgelder_gc). Verify the URL, then it's real Watch & Learn content with nothing invented. She still races lighter formats: GYMRACE doubles with Danni Alderson (00:53:28) and ATHX Games. "Class of 26/27" is just her casual phrase, not a programme name; members are "Après-ers". Studio account @apres.london (Deptford SE8) opened 8 Feb 2025 with a Rox Queens women's event where she taught SkiErg damper/technique. Fastest solo: 1:12:20 London 2023. Apres IS an official HYROX Training Club (confirmed by Chris, Oct 29); link the hyrox.com listing in the build. She has disclosed a shoulder injury publicly; keep health details off the site. Full catalogue: `scripts/reskin/coachedbykim-source/MANIFEST.md`.
- **Verified links (researched Oct 29):** Linktree has three Typeform applications only, no discount codes: 1-2-1 online coaching `https://3dxl5l929b0.typeform.com/to/YrCzbiGc`, First Time Heroes 12-week `https://3dxl5l929b0.typeform.com/to/vHubNv45`, Gym Confidence 6-week `https://3dxl5l929b0.typeform.com/to/jyoGk2ng`. Its bio still says "10 HYROX races" (stale). Studio sites: apreslondon.co.uk (14-day trial `/trial/`, memberships, contact, WhatsApp consult) and apreslondon.com (new site: class types Après Slalom, Après Nordic, The Lift, Hyrox/ATHX). Address: Unit 12 Resolution Way, Deptford SE8 4NT. Studio IG @apres.london. Classes booked through the Après app (TeamUp). TeamUp's HYROX Bootcamp page calls her "Après founder, Kim". Official HYROX Training Club status: Chris confirmed, and Hyrox Vault (third party) lists it; no deep link exists into the official finder (hyrox-training-finder.hyrox.com). **YouTube: https://www.youtube.com/@Après.London** ("The Hybrid Fitness Studio taking fitness off-piste!") — a 4-part studio series: "Founding Après: Episode 1" (M_j6PyfPRKw), "Building Après - Episode 2" (6q4hLRYw2X8), "Starting Après - Episode 3" (T7iiKgIKnRo), "Training Après - First Ever Member Hyrox" (w4sfpfIlhDE). An older @ApresLondon channel has only "Apres Teaser" (PPvTIIPfMmE); @kimmansell exists but is empty. **TikTok: @coachedby_kim** (display name "ApresLondon", 17 videos, "Taking fitness off-piste"). Do NOT use TikTok @coachedbykim — that's a different coach, Kim Hadfield. Dillz: @coach.dillz and @dillzinmotion treated as the same coach (Chris).
- **Trainerize framing (Chris, Oct 28):** position the platform's own content layer as potentially making the subscription OPTIONAL — her Après-branded technique library is public, branded and lead-generating, which is the part Trainerize can't do. Trainerize only stays necessary if she uses it for programme delivery/tracking; demo shows native library leading, provider doorway quiet. Cost-saving argument + brand argument in one.

#### Jade Leigh (@jadeleighcoaching)

- **Route:** IG DM / WhatsApp (in bio).
- **Angle:** one home for three things: HYROX coaching, Summit & Soul retreats and guided hikes, and her Radiance business.
- **Careful:** her content may be more women's-health than HYROX — confirm the HYROX share before building. Don't make health claims for her products.

#### Lewys (@lewysmsfitness)

- **Route:** IG DM / WhatsApp (in bio).
- **Angle:** The Revival Coach brand as a proper platform. Lowest priority — only if the higher prospects stall; check HYROX share first (leans physique).

## 6. Roxjaya and Dina’s role

- `roxjaya/` is the **original tenant** built for Dina Rosdiana — the flagship proof case.
- Intended live domain: `roxjaya.com` (also `www.roxjaya.com`).
- Dina’s digest goes to `dinazumba1987@gmail.com`.
- **Dina is not involved in outreach.** Her site exists only as the proof case: "this is what it looks like when a coach already has the platform."
- All new prospect demos are generated as separate tenants using the same engine, not by editing `roxjaya/`.

## 7. New-session behavior — supersedes the old automatic task list

Read the authoritative snapshot at the top and AGENTS.md, acknowledge the state, then ask Chris which specific task to do. Suggestions and inspired ideas are encouraged, but must not be executed outside the agreed task without permission. The previous automatic deployment/recording/outreach list is obsolete: Graham and all seven walkthroughs already exist locally, and release/mailbox gates remain. Ambassador research, wider repairs, new outreach and publication are pending possibilities only—not instructions to start them.

## 7a. Image pipeline — what was fixed this session (Oct 20)

The root cause of "3 hours of stock-photo hunting while 15 better images sat in the prospect's IG grid" was found and fixed:

- **Bright Data was returning exactly 12 posts per profile** for a 120-post request, with zero carousel children expanded. The "HYROX Rome" 12-shot professional carousel was never in the data — the visual selector couldn't pick what it never received.
- **`assess-finalists.js`** now validates pull quality: warns on shallow pulls (<50% of requested) and zero carousel expansion.
- **`prospect-pipeline.js`** auto-falls through to `ig-triage.py` (Instaloader via Chrome session) when Bright Data is shallow or unexpanded. Deeper-IG retry happens before any stock fallback; every stock fill is logged.
- **`ig-triage.py` `MAX_CAROUSEL` raised 6 → 20.** Both triage paths now tag professional event carousels with `[PRO]` — detected via 6+ children, HYROX location keywords in captions (Rome, London, Warsaw, Athens, etc.) or photographer credit signals (📸, "photo by", @hyrox).
- **Candidate caps widened:** 4 candidates per slot (was 2), 20 spares (was 10).
- **Broken envs:** `/tmp/igenv` venv has a broken `browser_cookie3` (only a `__pycache__` stub) and wrong site-packages path. The repo `.venv` now has `instaloader` + `browser-cookie3` + `rembg[cpu]` (rembg is broken on Python 3.14 via numba; use the Apple Vision Swift cutout at `/tmp/cutout` instead — `swiftc` source was inline in this session, recreate if needed).
- **IG session was rate-limited (401)** at end of session. Followees pull for the ambassador excavation needs a cooled-down session — wait 30+ min.

The image-pipeline fixes in this historical Oct 20 section were recorded as committed/pushed at that time. This is NOT the status of the later session work.

## 8. Current uncommitted work — preserve it

Branch is main at a77a10fd; the working tree has extensive modified and untracked planner, video, security, template, Josh and documentation work. The staging area was empty when checked for this handover. See the authoritative snapshot above. Do not infer a clean tree or published changes from older notes; do not reset/delete/blanket-commit anything.

## Cross-tenant ghost gate (added during batch QA)

`python3 scripts/check-batch-ghosts.py <batch-dir>` — extracts each chassis
config's distinctive verified strings (token values + capitalised phrases from
copyOverrides) and fails if any appear on another tenant's site. Chassis-source
and engine-default strings are boilerplate, not leaks. Shared-legit terms
(common cities, sponsors, real platforms, Zara's verified doubles partner) are
in the script's ALLOW list.

Context: the chassis originally inherited Kim/Après product names as
placeholders — "Gym Confidence", "Heroes", "Hybrid Coaching · monthly",
"studio-owner focus" shipped on every tenant. Now tokenised:
PROG_ONE/PROG_ONE_TAG/PROG_ONE_URL, PROG_TWO/PROG_TWO_TAG/PROG_TWO_URL,
PKG_MONTHLY, ATHLETE_FOCUS, OFFER_SUMMARY, PLANS_LEAD, PROGRAMMES_SUMMARY,
STUDIO_NOTE, LINK_CARD_*, PROG_CARD_DESC, COMMUNITY_DESC.
Verified real products wired: Kim (First Time Heroes, Gym Confidence,
Hybrid Coaching · monthly, Après studio link), G&H (SheBuilds 1:1,
Sculpt & Shape, Hybrid programming & testing + real Typeforms + racetoframe.com),
George (Hybrid Program, Run & Strength), Faisal (PMAHYROX, PMA Method),
Jamie (Find Your Edge), Josh (Hybrid Hub, FITR), Jade (Smash Your HYROX),
Elation (Small Group PT, Class membership, Balmore Road).
Generic honest defaults elsewhere: Race Ready / Foundations / Monthly coaching.

## Session handover — Linktree sweep, venue photos, wall rework (latest)

Batch state: **17 athlete sites** at `/tmp/pitch-batch/<slug>/` (gym sites
hustle/kore/pacegym parked at `/tmp/pitch-batch-gyms-hold/`; configs remain in
`scripts/reskin/`). Ghost gate PASS. Preview usually `localhost:4321/<slug>/`;
engine prints `localhost:3000` too.

### Linktree sweep — completed
Checked every tenant's Linktree/site. New verified data wired:
- **Paul**: 6 affiliate-code cards on partners.html (HYBRYD PG10, PUMA
  ROXLYFE30, Beet It PAUL25, Xendurance PAUL20, Built for Athletes PAUL15,
  Zone 8 PAUL10). Two dead copyOverrides removed.
- **G&H**: code cards Gymshark GREGORHATTIE10, DFYNE GREGORHATTIE, TRYKA GREG;
  all three Typeforms re-confirmed.
- **George**: real products replaced generics — 8 Week Program →
  georgegraysonfitness.co.uk/8-week-program, GG workouts →
  online.georgegraysonfitness.co.uk, Protein Works card (GGEORGE).
- **Faisal**: PMAHYROX→FITR URL, The PMA Method book→Amazon, real YouTube
  channel on watch page, pmafitness.co.uk site card.
- **Gabby**: real YouTube (@getfitgabby) on watch page.
- **Fennell**: found his Linktree — "Group Programming · 1-week free trial" →
  Google Form forms.gle/cmYRJC5JRNG1Ptsq7 wired to APPLY_URL + PROG_ONE.
- No Linktree found (404): Kim, Jade, Jamie, Josh, Elation, Doncaster, Burgon,
  Michele. Their data comes from own sites/source notes.

### Kim / Après — new photo pack + verified facts
~20 new photos catalogued in `scripts/reskin/coachedbykim-assets/images/`
(studio-*, kim-*, apres-cafe-* prefixes; IG screenshots kept as *-ig-*.png).
Placed: `kim-coaching-wattbike`→coaching-hero (venue unconfirmed but valid as
coaching shot), `kim-ergs-warm`→run-hero, `kim-sled-awall`→stations-hero,
`studio-flex-duo-stand`→race-mate-hero, `kim-apres-banner-event`→avatar.
Unused spares: `studio-clean-press` (video rip, weak), `studio-rower-dark`
(unconfirmed venue), `kim-sled-closeup`, `kim-awall-portrait`,
`studio-member-awall`, `studio-small-crew` (IG carousel crop), cafe shots
(context only — cafe is @aprescafe.london, launched ~Jun 2025, NOT the gym).
Old slot files kept as `*-prev.jpg`.
Verified facts from her IG captions: Official HYROX Coach 4 years, 5 seasons,
18 races every category mostly solos, clients to World Championships,
"I now own my own HYROX studio", Friday HYROX workshops at Après, yfitwear
affiliate, online coaching for HYROX/weight-loss/strength.

### TR / trainedbytr — new photo pack + verified facts
New files in `trainedbytr-assets/images/` (tr-* prefix; IG post screenshots
kept as tr-post-*.png). Placed: `tr-whiteboard-clean`→coaching-hero,
`tr-class-gymking`→homepage crew-photo (via copyOverride + alt),
`tr-crew-attitude-wall` + `tr-headcoach-poster`→wall polaroids.
Spares: `tr-floor-through-rig`, `tr-expansion-build`, `tr-desk-laptop`,
`tr-class-floor-dark` (weak).
Verified: TransFit Widnes expansion open (Jul), address Cross St Widnes
WA8 6HS, Head Coach, Tue 19:00 HYROX + Wed 18:00 HARDIO classes, first class
free via TF site. Fuel-guide reel captured but **no fueling page** — Chris's
call: coaches don't get a dedicated nutrition page.

### Race Wall rework — chassis-wide pattern
- Chassis default wall (`chassis/data/gallery.json`) = 4 stock polaroids:
  stock-arena, stock-rower, **stock-finish** (doubles-finish celebration,
  joyful — replaced grim collapse shot and stock-barbell), stock-burpee.
- Engine copies stock files from `chassis-demo-assets/images/gallery/` — list
  at reskin-tenant.js ~line 472; stock-finish.jpg added there.
- Wall rule established with Chris: **stock base + 2-4 real member/crew shots**;
  wall should read as members posting, not a coach portfolio (Kim's wall was
  rebalanced to member-majority after his feedback).
- Kim wall = 4 stock + wall-crew-left + wall-crew-right (member crops from
  anniversary shot) + studio-anniversary. Bad crops deleted.
- Shared-pack stock files live per-tenant; stock-finish.jpg also copied to
  joshharrison-assets gallery.

### Prospect ranking (17 athletes, from Linktree sweep)
Tier 1 pitch-ready: Kim, TR, R2F, Doncaster, HTC, Paul.
Tier 2 strong-one-gap: Michele (needs one real product name), Elation,
George, Faisal, Jamie, Jade.
Tier 3 question-first: Burgon (needs Pyramid sim photo), Josh (is Hybrid Hub
physical?), Zara (no product — pitch is "platform for launch"), Gabby,
Fennell (DROPPED from this pitch batch — photos were the contaminated
shared pack; revisit when real Bedford photos arrive).
Full list with IG handles was delivered in-session; regenerate by reading
each config's IG_URL if needed.

### CURRENT TASK — asset hunt in progress (2 coaches down)
Chris is pasting batches of IG screenshots/photos per coach; each batch gets
catalogued into `<slug>-assets/images/`, IG screenshots are cropped to the
photo area (ffmpeg crop, shave ~20px right edge to kill the mute icon), and
the good ones are placed via config (slot overwrite or copyOverride), then
that tenant is rebuilt into /tmp/pitch-batch. Read captions carefully — they
carry verified facts (class times, addresses, products, partnerships) worth
banking even when the photo isn't used.
Done: **Kim** (wattbike/ergs/sled/banner placements + wall rebalance),
**TR** (whiteboard/gymking/attitude-wall/headcoach placements) and
**HTC/Ross** (sled-track crew→gym-crew+crew-photo, neon GTC portrait→avatar,
ENDURE class/venue/lineup→3 wall polaroids; exterior-logo shot kept spare;
old files kept as *-prev). Edited BOTH htcfisher.chassis.json (batch build)
and .demo.json (kept in step). Verified facts: GTC Health Clubs × HTC
collaboration, Ross is GTC's in-house Hyrox Performance Coach (post dated
15 Feb), memberships via GTC gym tour, functional floor branded "ENDURE"
(purple). Chris confirmed GTC is a collaboration, NOT a relocation — ROXBOX
Mudeford remains the club's home in site copy; ENDURE-floor photos are the
club's real sessions under the collab and captions stay venue-neutral.
**Michele** (mic portrait→bio.jpg ask-portrait+planner; FB ref screenshots
kept mw-post-*). Verified: Wilder Fitness co-run with her partner,
currently hiring Level 3 PTs; wedding photo banked as context only —
never site material. Still no verified product name (want stands).
**Elation/Graham** (2 venue crew shots + hoodie coach duo + Warsaw stadium
crop→wall, now 8 polaroids 7-real/1-stock). Verified: co-account
@elationgymglasgow, 8:15am team class, PGE Narodowy Warsaw trip (16 Apr),
second named coach exists (hoodie duo). Batch 2 added branded-wall
(Eft sign) + floor-decal crew + London podium-flags shots — wall now 11.
Verified: Simone Enrici — Graham's doubles partner, HYROX London 54:21
silver (7 Mar), podium flags displayed at gym. Balmore Road exterior
still open. Elation photo fixes same session: ask-bg→floor-decal crop,
podcast figure→hoodie duo, race-day→detail.jpg (startline now
homepage-only), taper-hero.jpg filled + un-omitted.
**George** (class shot→crew-photo replacing generic doubles.jpg; first
REAL wall photos: Alex medal + FuelCell turf alongside 4 stock = 6).
Verified: client Alex O'Brien Sheffield HM PB 1:50:40→1:49:12 (client-
success material), second handle @ggcoaching_. Note: his g1-g6 gallery
files are PRO event shots (Red Bull arch etc), not his members — kept
off the wall. Batch 3 (catalogued only, not placed — Chris said more
coming): gg-birmingham-finish (HYROX Birmingham finish screen 1:00:42),
gg-friday-gang + gg-games-floor (class/event shots, need icon crops),
gg-post-games-4 + gg-post-birmingham (ref PNGs). Verified: GG Games is
the 4th iteration ("GG Games 4.0", 4 Oct); George HYROX Birmingham 2026
finish 1:00:42 = 2:23 PB; coach handle @coachadamhybrid (Adam — likely
the hoodie-duo partner). Batch 3 now placed: wall = 11 polaroids
(7 real/4 stock) incl Birmingham finish + Friday gang + GG Games floor;
coaching-hero = GG coaching-floor shot; crew-photo = class shot.
**Jade** batch 1 (catalogued only — more coming): js-duo-bw-1/2 (B&W
portraits Jade+Kat Parnell), js-race-course (pro race action, ENGLAND
bibs PARNELL/SKILLEN), js-post-elite15 + js-post-e15-stats (refs).
Verified: Jade Skillen + Kat Parnell race E15 doubles, ENGLAND kit;
PB 54:26; 7 races/7 countries in one season; PUMA-sponsored
(@pumatraining); first E15 major = Hamburg. Batch 2: js-run-elite15
(cropped), js-run-rigs, js-flag-fan (Jade+Kat+young fan, England flag,
"TO STOCKHOLM" E15 banner), js-run-bw-concept (B&W Concept2 run),
js-finish-floor (finish-area drama). Chris: screenshot photos are
usable — captions kept for info. Batch 3: js-run-profile (Mira Fit arm
stamps — possible sponsor), js-track-highfive (B&W track training),
js-interview-mic (HYROX-branded mic post-race), js-stockholm-flag +
js-podium-check (both cropped). HUGE verified facts via katparnell
post: E15 Doubles Women THIRD PLACE $4000 check; season results —
Chicago 57:42, Hamburg E15 59:03, Dublin 56:29, Melbourne E15 56:17,
EMEA London 55:03, Warsaw E15 54:26; missed Phoenix (L5 S1); ACL
injury; next = Stockholm E15, Strawberry Arena. Batch 4:
js-park-outdoor (Jade+Kat pointing, cropped), js-marden-run +
js-marden-point + js-piggyback-finish (Jade with a MARDEN-vest male
racer — partner NOT yet identified, caption generically), cropped run
shot clean. Cross-prospect link: @faisalpmafitness likes her posts.
Batch 5: js-shaka (post-race personality shot), js-bordeaux-hug +
js-bordeaux-erg + js-racewalk-bib (all cropped), js-post-bordeaux ref.
Verified: HYROX Bordeaux season opener — Mixed Doubles AG GOLD 53:33
(mixed partner unverified — likely the MARDEN man, caption generic);
sponsors confirmed @pumarunning/@puma.uk/@pumartraining +
@mirafitofficial. Another cross-link: @paulgillingham_ likes posts.
PLACED (reviewed vs existing — kept the stronger old ones): wall 4→8
(stock arena/rower/burpee/finish + bordeaux-hug, podium-check,
stockholm-flag, flag-fan); race-day hero startline→js-run-elite15
(killed the index duplication); shaved baked-in mute icons off
hero.jpg + coaching-hero.jpg (*-prev kept). Kept: Dublin piggyback
hero, whiteboard teaching shot, row-grimace wallball, Narodowy B&W
startline (now homepage-only), SKILLEN-bib bio, stadium race-mate.
**Josh** batch 1 (ref screenshots only, not placed — more coming):
HYBRID HUB = Josh's coaching BRAND/COMMUNITY (@hybrid.hub, "Always
earned. Never given."), NOT a physical venue — physical side = GYMBOX
("At work with @gymboxofficial", AD-tagged partnership). Hub products
verified via linktree: 1-1 coaching discovery calls (30-min booking),
365 CLOTHING line, TRAINING PLANS. 365 athletes incl @lewiscollinsfit
(Ironman Italy). Hub IG runs "Recent Client Wins". YouTube channel
exists — handle coming in a later upload. Batch 2 facts: tagged
@adidastraining twice (adidas relationship — ambassador?); races
HYROX HUNGARY @hyrox.hun (first race of season ~mid-Oct, "6 days
out"); documents season on YouTube vlog (weekly uploads); drives an
Audi (matches existing josh-audi.jpg); "1-1 coaching + programs" via
@hybrid.hub. Photo candidates banked inside screenshots: street-run
shot, supps-store aisle, gym legs. Batch 3 — FITR ABOUT PAGE
(the-hybrid-hub.fitr.training): programmes verified — 1-1 Bespoke
Coaching (3-month min), The Hybrid Performance Program (flagship
community plan), Fitr-app delivery/tracking, macros guidance,
fortnight check-ins, mindset coaching. Contact TheHybridHubb@gmail.
com. Provider = FITR → planner/apply links should point there.
Batch 4 — PRICES VERIFIED: HYBRID PERFORMANCE £19.99/mo, HYROX 365
£50/mo, 12 WEEK HYROX PLAN 1.0 £60 one-off, 1-1 ONLINE COACHING
£180/mo (4 active programs, 2 active coaches). SHOP hybrid-hub.uk
verified live: skull cap £30, tech gloves £25, tees/hoodies/jackets/
tanks/accessories/joggers/shorts/bundles — real e-commerce to wire.
Also does Ironman 70.3. Batch 5 ("Behind the Brand" manifesto):
founded in Worcestershire (config already correct), footer shows
IG+TikTok+YouTube + gift card. WIRED same session: plan cards →
HYROX 365 £50/mo (Fitr link) + 1-1 Bespoke Coaching £180/mo 3-mo min
(typeform); STORE_URL → hybrid-hub.uk (was stale thehybridhubclothing.
com). STILL WANTED: Gymbox interior/class photos, YouTube handle,
name of the 2nd active coach.
**Zara** batch 1 (catalogued only): zb-gabby-bw-1/2/3 (J8FRAMES pro
B&W portraits at HYROX wall), zb-post-e15 ref. Verified: Zara's E15
doubles partner = @getfitgabby (our Gabby!) — E15 Series race in
Germany; "16th elite race over 4 seasons"; race broadcast on
hyroxworld YT. Shared-portrait rule: these duo shots suit BOTH
coaches' sites but same image on two different prospect sites is
fine (different pitches). Batch 2: zb-gabby-budapest (start-line
race shot, cropped) + zb-gabby-run (cropped, baked "56:27 #OV1
#AG1" overlay = verified result in-frame) + 3 ref PNGs. Verified:
HYROX Budapest 17 Oct — "Hyrox Huns" finish 56:27, OVERALL 1st +
AGE-GROUP 1st for Zara Piergianni + Gabriella Moriarty; next =
Hamburg Elite Series. Cross-link: @trainedbytr likes their posts.
Batch 3 (all usable pro race photos): zb-skierg-zara (icon shaved),
zb-gabby-runs, zb-sled-push (Zara, XCENTR sled), zb-sled-pull-gabby
(rope, PUMA barrier), zb-burpee — station-prep quality material.
Batch 4 (cleanest set, no chrome): zb-farmers-carry (Gabby, 20kg
bags), zb-wall-balls (CENTR targets, counter at 27/100),
zb-finish-run (both arms out across the line — money shot),
zb-hug-floor (post-race hug), zb-post-win ref. RESULT UPGRADED:
Budapest = win in the PRO DOUBLES WOMEN division at the FIRST-EVER
HYROX Budapest, 56:27, OV1+AG1. Kit sponsor: lululemon logo tops.
faisalpmafitness likes again. Batch 5 (profile+sponsor refs):
WORLD CHAMPION TITLES — "HYROX Elite15 Athlete / Women's Doubles
World Champion / Relay World Champion" (linktree). Sponsors:
LSKD kit (code ZARALSKD), ESN Elite Sports Nutrition,
FivePointFive breathwork (ZARAFPF). 1-1 online coaching via
linktree; IG runs "CLIENT WINS" highlights; 14k followers.
**Gabby** batch 1 (log only): Zara partner-profile refs banked as
gm-post-zara-*. Crossover rule from Chris: shared duo shots may be
used on BOTH sites (different prospects/pitches) but keep each
site's own imagery dominant — don't lean on the partner's content.
Batch 2 (HUGE): Gabby = MIXED DOUBLES 30-39 WORLD CHAMPION, Chicago
14 Jun 2025, 54:36, with DAVID O'TOOLE (GBR) — hyroxworld official
post; gm-world-champion.jpg cropped from it. Sponsors: MARCHON +
lululemon + Pliability (per linktree; coaching brand "Pliability
Coaching & Training"?). YOUTUBE LIVE: @getfitgabby channel, 555
subs, 3 vlogs (Budapest race vlog, last-hard-session, first video) —
Watch capability is honest, not stubbed. trainedbytr commented
"Incredible! 🐐🐐" on the champion post; faisalpmafitness liked.
Batch 3: COACH/TEAM — coached by @laurencalvertj ("wouldn't be
here without you"), team = PHASE SEVEN 7 (@cammie__g), squad tags
@thehalehaus_ + @labmgmt "TEAM INT". Results: C15 solo 6th + PB
(Hamburg); races C15 solo Friday + E15 doubles Saturday. Photos:
gm-run-moriarty (B&W, MORIARTY bib + England flag + lululemon),
gm-hamburg-run + gm-skierg-train (cropped). Photo credit
@raftermediastudio on race shots. Batch 4-6: gm-neon-startpen
(pink neon letters — cutout candidate for Chris), gm-skierg-gabby,
gm-sled-pull, gm-sled-push, gm-burpee, gm-row-grimace, gm-farmers,
gm-hands-hips, gm-arms-raised, gm-finish-celebrate (both crossing),
gm-floor-sit (post-race exhausted pair — emotional), gm-run-
portrait (reel crop, text overlaps subject — needs rembg cutout or
keep as-is). QUOTE MATERIAL: "You've got new dreams now but don't
forget the ones that already came true x" (her post). GRWM = beauty
audience crossover (elf/wonderskin/estee product list).
@bymatthewc tagged on YT launch post (her filmer). Batch 7:
gm-sled-closeup + gm-farmers-duo (Gabby w/ 16kg bags, male
partner behind — likely David O'Toole), gm-invite-run (cropped —
shows baked "Hamburg Challenger 15 Singles Officially Invited"
card = verified invite), refs: 56:22 result w/ @rnatoalejandro
(SECOND doubles partner, different race), STATION BREAKDOWN post
= her coaching voice (full split numbers — usable for
station-prep/coaching copy). Jade commenting on her posts too.
Batch 8 (all clean jpgs): gm-sled-grip (Centr sled close-up),
gm-renata-farmers (confirms @rnatoalejandro = Renata Alejandro,
blue-kit second partner), gm-burpee-grid, gm-zara-blue-run (Zara
+Gabby blue-kit run), gm-bordeaux-flags (ZARA+GABBY holding TWO
HYROX BORDEAUX podium flags — pair's podium-flags proof).
STILL TO DO — per-coach wants (from the gym-linked trainers list):
- Burgon (@hannahburgon_pt): real Pyramid Performance floor/sim shot — zero
  venue photos
- Josh (@joshharrisonfit): is Hybrid Hub a physical place? Any shot of it
- Fennell (@fennellfitness): DROPPED from the current pitch batch by Chris
  (entire pack was the contaminated shared pack; revisit when his real
  Bedford photos arrive)
- Doncaster (@hyrox_doncaster): gym exterior/signage, "Home of Hard Work"
  wall; ~60 unmined source photos exist too. **IG unreachable 1 Nov:**
  account doesn't surface in app search or Google; possibly renamed or
  suspended. Related but different account found: @nwfitness (32 posts,
  contact Nathan info@nwfitness.co.uk — FB page "NW Fitness - Hyrox
  Training Club", active 12 Oct). Fallback photo source if IG stays dark:
  the NW Fitness Facebook page + hyroxdoncaster.com. Parked per Chris.
- HTC/Ross (@hyroxchristchurch): GTC Health Club venue or class mid-session
- Elation/Graham (@grahamhalliday_): Balmore Road exterior/branded wall
- Paul (@paulgillingham_): him coaching / coaching space
- Zara/Gabby/Jade/Jamie/George/Faisal/Michele: generally thinner packs —
  better race/crew/coaching shots always welcome
- Also watch for: named products, partner/affiliate codes, class timetables,
  venue addresses in captions (bank them even if photo unused)

### Open items
- ~~TR "3 of 12 places left" is time-sensitive~~ DONE 1 Nov: softened to
  "Limited places" (PROG_ONE_TAG), rebuilt, verified live.
- yfitwear: partner card for Kim only if a code/link is confirmed.
- Kim verified copy facts (above) not yet written into homepage copy.
- Café could be a labelled community mention on Kim's site (separate venue).
- Fennell photos, Josh venue answer, Burgon Pyramid shot, Michele product
  name = the four external asks.
- USER'S manual edits to preserve: chassis/app.js {{PKG_MONTHLY}},
  HANDOVER.md ghost-gate section.

### Zara + Gabby renovation pass — DONE (placement review applied)
Mapped current placed images vs new zb-/gm- packs; applied upgrades only:

**Zara (coachedbyzara):**
- Stations: station-skierg -> zb-skierg-zara (pro race shot, Gabby behind);
  station-burpees -> zb-burpee (was a dark empty corridor). Other station
  shots already real and good — kept.
- Wall: was 4 chassis stock -> 7 real (mixed order): zb-hug-floor,
  zb-gabby-bw-1 (J8FRAMES portrait), zb-finish-run, zb-gabby-run (56:27
  overlay = its own proof), zb-farmers-carry, zb-gabby-runs,
  zb-bordeaux-flags (copied from gabby's pack — legit duo shot).
- race-day.html startline (was dupe of index) -> zb-gabby-budapest neon
  start-pen via copyOverride (index keeps race-paint shot).
- Partners/copy: LINK_CARD_* -> "Coached by Zara hub" (mentions LSKD code
  ZARALSKD, ESN, FivePointFive); PROG_TWO = "1-1 coaching";
  COMMUNITY_DESC names Gabriella Moriarty / Hyrox Huns.
- Kept as already-verified: RACE_RECORD both world titles, PB_DOUBLES
  55:14 Warsaw (Budapest 56:27 was a win, not a PB), partner tokens.

**Gabby (getfitgabby):**
- Tokens already fixed earlier: RACE_RECORD = HYROX Mixed Doubles World
  Champion; PB_DOUBLES 56:27 @ Budapest.
- Stations: 6 swapped to new pro shots — skierg (gm-skierg-gabby pink
  neon), sled-push, sled-pull, burpees (gm-burpee-grid), farmers-carry
  (gm-farmers-duo), row (gm-row-grimace). Wall-balls (ATTITUDE wall) and
  sandbag-lunges (blue-bra carry) kept — already real.
- Wall: stock-barbell out; 8 mixed: gm-world-champion (Chicago podium),
  squad-gym, gm-floor-sit, race-mates, gm-neon-startpen, arena-run,
  gm-bordeaux-flags, gm-finish-celebrate.
- race-day.html startline (dupe of index) -> gm-invite-run (Hamburg C15
  invite card baked in) via copyOverride.
- HERO_STATS_HTML now real: 54:36 World Champion / 56:27 Budapest OV1+AG1 /
  Elite 15 (was generic "Race ready / Stronger together").
- stripBlocks: removed 'youtube-link' — her @getfitgabby YT is verified,
  YOUTUBE_URL already real. TikTok stays stripped (unverified).
- Partners: LINK_CARD_* hub copy (mentions YT channel); PROG_TWO =
  "coaching"; COMMUNITY_DESC names Lauren Calvert + Phase Seven 7 + Zara.
- Ghost checker: added Budapest/Bordeaux/Piergianni to ALLOW — legitimate
  shared facts between partner sites (Moriarty already allowed precedent).
- .prev backups kept for all swapped station files.

Both rebuilt, ghost gate PASS.

Note: Zara's #story figure deliberately shows zb-zara-solo (B&W J8FRAMES
solo crop) even though the arch frame crops it imperfectly — left in place
per Chris as a standing reminder that this photo deserves a strong slot.
Revisit during site runthrough; original startline.jpg shot remains
available (.prev backup + file intact).

### Zara + Gabby zero-based photo audit — DONE
Eyeballed every real asset in both folders (contact sheets), rated, and
re-mapped slots from scratch. Displaced shots went back into the pool, not
the bin. Final placement:

ZARA — hero: zb-finish-run (left-cropped, arms-out duo). Profile: zb-
gabby-bw-3 UNCROPPED duo, alt "Zara (left) with doubles partner Gabby
Moriarty — @j8frames_". Avatar: solo B&W head crop. Wall(8): hug-floor,
sled-push (ex-hero), gabby-run(56:27), bw-1, farmers-carry, bordeaux-flags,
bw-2, gabby-runs. Stations: + wall-balls swapped to zb-wall-balls (solo
throw over group shot). race-day: zb-gabby-budapest.

GABBY — hero: gm-arms-raised (was run-moriarty; arms raised, face visible,
dark arena). Profile: gm-huns-bw-2 (bw-2 duo), alt "Gabby (right) with
partner Zara Piergianni — @j8frames_". Wall(10): world-champion,
squad-gym, huns-bw, floor-sit, startline-wall (displaced profile shot —
MORIARTY arch), neon-startpen, arena-run, run-moriarty (displaced hero),
bordeaux-flags, finish-celebrate. Stations unchanged (already gm-*).

Pool (unused but banked): zb-sled-pull-gabby, zb-gabby-budapest dupes,
gm-hamburg-run (low-res), gm-run-portrait, gm-skierg-train, gm-sled-grip,
gm-hands-hips, gm-renata-farmers, gm-zara-blue-run, gm-arms-raised dupes,
race-mates.jpg, station .prevs.

chassis/emerge.js fix: ambient bake now respects .hero-amb
object-position (was centred-cover, put faces mid-roll). Global file,
correctness-only change.

Gate: added 'Gabby Moriarty' to ALLOW. All .prev backups kept.

### Hannah Burgon — caption/info batch applied
Logged 5 refs (hb-post-about/services/profile/linktree, hb-brum-pb).
Config was near-total placeholder (all URLs -> IG, "Open" PBs, partner
gym = her own brand). Applied verified facts:
- LINKTREE/APPLY/PROGRAMMES/STORE_URL -> linktr.ee/hannah_burgon
- PARTNER_GYM -> Pyramid Performance (@pyramid_performance) — venue
  mystery solved; still zero venue PHOTOS though
- PB_SOLO 1:11:13 Birmingham (Pro Solo, OV#39 AG#5, ~Nov 2026 PB)
- RACE_RECORD "HYROX Pro Solo racer — 1:11:13 PB"
- TAGLINE -> her own voice: "everyday people to the strongest, fittest
  versions of themselves"
- PROG_ONE "sim events" (dated sims seen: 8 Nov, 13 Dec) / PROG_TWO
  "1-1 coaching"
- Banked NOT applied: MSc Sport Nutrition + pre-race nutrition guide ->
  candidate to enable nutrition module; WhatsApp group 26/27; Deadly
  Dozen Worlds competitor; "free PT taster week soon"; services list
  (1:1 PT/online/small groups/corporate events); 90-day promise in bio;
  qual stack (BSc Sport Sci, MSc Sport Nut, HYROX Perf Coach, Licensed
  Running Fitness Coach, L3 PT, 6+ yrs).

Batch 2 (her own site, hannahburgonfitness.co.uk — DEAD site (server not
found as of this pass; lapsed domain = literal pitch point)): applied — PROG_TWO "small group coaching / max
4 · tue + thu" (real product, "without the cost of 1-to-1 PT"),
COMMUNITY_DESC now names Pyramid Performance, Ford Street SK3.
hb-small-group.jpg cropped from site screenshot — first REAL training
photo in her pack; went straight onto the wall as its first polaroid.
Banked: full venue address Unit 1b Heapriding Business Park, Ford St,
SK3 0BT ("NEW LOCATION"); sim dates 8 Nov / 13 Dec / 3 Jan with Half
12:30 + Full 1:45 formats and real Sign-Up buttons (usable for her
events/calendar later); FAQ structure real (Tue+Thu sessions); she HAS
IG+FB+TikTok per site footer. "Strength From Within" = brand motto.

Batch 3: her pre-race fuelling guide (5 refs hb-post-fuel-1..5) — REAL
authored nutrition content: 1-4g/kg CHO 1-4h pre, race-day timeline
(3-4h substantial meal → 1-2h small top-up → 30-60min final carb),
start-time-dependent strategy. Genuine candidate to enable the fuel
module honestly (MSc Sport Nutrition + her own published guide).
hb-race-floor.jpg cropped (her mid-race, Foodspring/Puma backdrop) —
wall polaroid #2.

Batch 4 (hb-post-fuel-6..10): guide continues — "Top Up Carbs — Not
Stuff Your Face With Carbs" night-before rule; worked timelines for
8AM start (night-before high-carb dinner → 6am light breakfast →
7-7:15am carb top-up) and 2PM start (dinner → 8-9am breakfast →
10-11am snack → 11:15-12:15 optional top-up → 1pm optional pre-race
→ 2pm race); hydration section (thirst + urine colour as indicators,
hydrate on waking, no litre-in-stomach). All her authored copy —
enough substance now to build a fuel page in her own voice.

Batch 5 (hb-post-fuel-11..12): guide close — her quotable "Burgon
Fitness Golden Rule: DON'T EXPERIMENT ON RACE DAY — Me" and the
PRACTISE→TRAIN→EVALUATE→ADJUST→CONFIRM→RACE ladder. WhatsApp group
CTA confirmed with real terms (1 educational piece/week, weekly Q&A,
training advice, free). COMMUNITY_DESC updated to lead with it.

FUEL PAGE ENABLED (user-approved): burgonfitness is now the first
nutrition-led tenant — nutrition.mode "nutrition-led", reviewed:true,
reviewer "Hannah Burgon (her own published guide)". copyOverrides on
race-day.html replace the two generic fuel articles with HER content:
night-before = "Top up carbs — not stuff your face" + early-wave note +
golden rule cue ("Don't experiment on race day"); race-morning =
1-4g/kg CHO 1-4h (70kg = 70-280g), the 3-stage timeline, BOTH worked
wave examples (8am + 2pm), her hydration rules, and her
practise-evaluate-adjust close. Race-craft sections (60/30/10 min,
start line) untouched. approve-note now credits the MSc + guide.

Follow-up: dos/don'ts + first FAQ on race-day also rewritten to her
guide — "top up carbs + the bread", 1-4g/kg 1-4h, hydrate-on-waking,
urine-colour gauge, don't-force-breakfast-early-wave, litre-in-stomach.
Race-craft items (laces, Roxzone, breathing) left generic.

Race-day art figure: finish.jpg (HYROX banner crop, bad) →
hb-race-floor.jpg (her real mid-race shot). NB race-pair.jpg and
startline.jpg are the same underlying photo — startline stays as the
guide-hero so race-pair was rejected to avoid an on-page dupe.

CHASSIS UNIFORMITY PASS (user-flagged):
- styles.css: .sub a:hover + .s9-zone:hover used --pink-100 bg with
  light --ink text = unreadable pill on dark dropdowns. Now
  color-mix(pink 18%, paper-2) — readable on all tenants.
- reskin-tenant.js: dinner-template.jpg was a required chassis slot
  the crew-defaults copy list never shipped (every chassis tenant
  would 404 it). Added to the copy list.
- coaching.html: photo was a one-off 760px centered block below the
  hero (coach-photo-frame). Moved to standard guide-hero-photo inside
  .guide-hero — now same top-right framed treatment as race tools.
  Dead .coach-photo/.coach-photo-frame rules removed (guidance.css +
  inline style).
- watch.html: guide-hero had NO photo while sibling podcast had one —
  added guide-hero-photo using spare slot squad-athlos.jpg.
- partners.html + list.html: public guide-hero pages with no photo —
  added guide-hero-photo using spare slots suit.jpg (partners) and
  events-secondary.jpg (list). Desk/leads/clients/tour stay photoless
  (coach tools, intentional); training.html is a portal card-grid.
- Burgon: un-omitted gallery/restaurant.jpg + gallery/dinner-template.jpg
  + coaching-hero.jpg; filled from her real pack — restaurant =
  venue-restaurant (literal table shot), dinner-template =
  squad-athlos (her crew), coaching-hero = station-lean (gym squat
  coaching shot); suit.jpg <- race-revel, events-secondary.jpg <-
  venue-nightclub. Zara/Gabby: dropped dinner-template omission (the
  protected default now lands). NB burgon strictImages blocks copying
  one photo into two slots — each slot needs a distinct file.

FLEET-WIDE REBUILD (all chassis tenants into /tmp/pitch-batch):
every chassis-mode config rebuilt and verified — 0 missing image refs,
ghost gate PASS. Fixes required by the new slots:
- coachedbykim: suit/events-secondary/squad-athlos filled from spare
  studio-* shots (moved, not copied — strictImages dup; note
  studio-flex-duo-stand was already a byte-dup of race-mate-hero.jpg)
- paulgillingham: suit.jpg was a byte-dup of predictor-hero.jpg — now
  his hoodie.jpg (real kit shot)
- hyroxdoncaster: PROG_TWO "HYROX sim sessions" → "sim sessions"
  (template renders "Apply for {PROG_TWO}", colliding with Josh's
  signature — systemic false positive, same fix as Burgon earlier)
- station9 + mayaokafor (testchassis): pre-existing build failure —
  links-hero + taper-hero missing with no omit entries. Added omits.
  Not caused by this pass; predates it.
Tenants already omitting the new slots (htcfisher, hustle, kore,
pacegym, fennell, etc.) keep photoless heroes there — intentional.

Doncaster + HTC un-omitted (pitch batch — photoless heroes not OK):
- Doncaster: restaurant=venue-restaurant (set table), dinner-template=
  venue-nightclub, suit=race-revel (Grant podium flag), events-secondary
  =sandbag-lunges, coaching-hero=farmers-carry (moves, not copies —
  strictImages).
- HTC: restaurant=venue-restaurant, dinner-template=htc-crew-sledtrack-big,
  suit=htc-crew-exterior (lineup was in tenantGallery — don't steal
  referenced files!), events-secondary=venue-noisy-lobster (their pub),
  coaching-hero=race-revel, squad-athlos: file was byte-dup of hero.jpg
  -> farmers.jpg. NOTE: several htc-* files are referenced in
  tenantGallery — check refs before moving spares.

PER-SITE ALLOCATION PASS (16-site pitch batch, Chris-approved):
Real photos only, moved (not copied) for strictImages; semantic fit over
"any available pic". All rebuilt to /tmp/pitch-batch — 0 missing refs,
ghost gate PASS. Filled:
- paulgillingham: links-hero=detail (leaderboard shows PAUL GILLINGHAM)
- michelewilder: links-hero=hoodie (kit flex selfie)
- getfitgabby: taper-hero=gm-hands-hips, links-hero=hoodie (comp kit at
  venue), momentum un-omitted. Now FULL.
- jamiebarker: suit=race-revel, links-hero=sprint
- coachedbyzara: suit un-omitted (duo kit file), links-hero=hoodie
  (squad mirror selfie), squad-athlos=zb-sled-pull-gabby (old file was
  a trail-trees shot — overwritten). Still missing: taper-zone.
- elationfitness: suit=race-revel. Still missing: news(half),
  shop(links-hero), watch(squad-athlos) — only 3 spares existed.
- jadeskillen: suit=js-shaka, squad-athlos=js-bordeaux-erg (group),
  links-hero=js-interview-mic. Still missing: taper-zone.
- trainedbytr: pb un-omitted (celebration file existed), race-pair=
  doubles (treadmill pair), suit=tr-expansion-build (TR neon + merch),
  links-hero=tr-desk-laptop (coach at laptop), squad-athlos=
  tr-class-wallballs. Still missing: taper-zone.
- joshharrison: REMOVED a copyOverrides regex that stripped figures for
  a hardcoded slot list — hidden blocker, omit list alone couldn't fix.
  taper-hero=josh-rooftop (sunset), momentum=josh-field (carry),
  half=josh-half, suit=josh-suit (literal suit), links-hero=josh-profile,
  squad-athlos=josh-bologna. Now FULL. NOTE: his real photos live in
  joshharrison-assets/images (josh-* files); config uses
  joshharrison-chassis-assets — moved files across.
- hyroxdoncaster: 5 stations filled (skierg,row,sled-push,sled-pull,
  burpees). Still missing 9 pages (see shopping list).
- htcfisher: 5 stations + links-hero=venue-nightclub (Noisy Lobster).
  Still missing 8 pages.
- burgonfitness: suit/events-secondary/squad-athlos un-omitted (files
  existed — squad-athlos was byte-dup of hero.jpg, now rope.jpg);
  station-farmers-carry=carry. Still missing ~10 pages.
- georgegrayson: suit=squad-athlos (squad in kit), links-hero=finish.
  faisalpma: suit=sprint, links-hero=pb-venue. Both still missing
  taper-zone. NB configs are ggeorge.demo.json + faisal.demo.json —
  stale /tmp dirs 'ggeorge' + 'faisal' deleted.
- coachedbykim: already FULL. racetoframe: protected, untouched.

GOTCHAS LEARNED:
- copyOverrides can strip whole figures by slot-name regex — check for
  "<figure\\b...replace: \"\"" before assuming an omit is the blocker.
- Files sitting in a tenant assets dir but NOT referenced still get
  copied to dst — moving (not copying) avoids strictImages byte-dups.
- Check tenantGallery/config refs before moving a spare (htcfisher,
  burgon hb-small-group are wall-locked).

INSTAGRAM SHOPPING LIST (photos to fetch — see chat report):
per-coach specifics reported to Chris; remaining gaps are taper-zone
photos on most sites + hero shots for Doncaster/HTC/Burgon race tools.

RACETOFRAME UNFROZEN + FILLED (Chris lifted freeze): 17 slots filled
from their real pack — suit=dfyne-kit (G&H in partner kit), links-hero
+events-secondary=their frame products (frame-on-wall, frame-manchester),
coaching-hero=duo-black, stations-hero=stock-arena (their own arena
photography), events-hero=stock-sleds, half=hattie-run, taper-hero=
breather, momentum=run, run-hero=hero-run, predictor-hero=hero-tattoo
(chest RACE TO FRAME tattoo), splits-hero=sled-headon, race-mate-hero=
duo-teal, station-farmers-carry=carry, station-sandbag-lunges=
station-sandbag, pb=station-lean, skierg-laugh=stock-rower. Remaining
gaps: dinner-template (needs a food/table shot), race-pair (needs a
second duo-racing shot). Ghost gate PASS.

CHASSIS WORD-AUDIT (post-photo pass, Chris-requested): fixed three
systemic copy defects across every tenant:
- GENDER-BUG: all coach-facing copy was hardcoded she/her — every male
  coach's site said "the routine SHE gives her own athletes" etc.
  Rewrote ~13 strings in chassis (race-day, find-a-partner, app.js,
  match.js, predictor.js, clients.js, campaign.js) to they/them —
  correct for men, women AND the G&H duo. Female sites (e.g. Kim) still
  legitimately contain she/her where verified.
- TITLE-BUG: every <title> said "studio booking" — wrong for online
  coaches (Jade), non-studio brands (PMA, G&H framers). Now
  "coaching, race tools and booking". Also "Find the studio, coaching
  routes" links card -> "Coaching routes, sessions and official
  channels". "Studio series" (podcast label) KEPT — reads as
  recording-studio media, fine for all.
- PLURAL-BUG (racetoframe only): singular "the coach's OK / the coach
  sees / your coach" -> coaches' via copyOverrides in
  racetoframe.chassis.json.
- Ghost gate learned Kim's override phrases as signatures; stale
  non-batch builds (fennell, hustle, kore, mayaokafor(testchassis
  config), pacegym, station9) rebuilt so shared chassis copy matches —
  gate PASS. mayaokafor's config is testchassis.demo.json.
- 'TBC' hits in client/clients/match/predictor JS are intentional
  "date TBC" for unbooked races — not placeholders. All brand names
  verified real (Hybrid Hub, TransFit Widnes, Balmore Road, Après
  London, patch framing, Graham Halliday, Nigel Wood).
All 16 batch sites + 6 stale tenants rebuilt: 0 problems, gate PASS.

SLOT COVERAGE CONTRACT (Chris's model, now enforced in reskin-tenant.js):
Every chassis-required image (the 51 slots in chassis/images/REQUIRED.md)
must either RENDER on a page or be explicitly waived in omitImageSlots.
The build FAILS on any "unwaived gap" — a slot silently rendering
nothing (missing file, pruned figure, copyOverride strip). This would
have caught the Josh figure-strip bug at build time.
- Build log now prints "slot coverage: N filled, M waived, 0 unwaived
  gaps"; failures list the exact slots.
- planner-watermark exempt — REQUIRED.md documents it as optional.
- STALE WAIVERS advisory (non-fatal): waived slot whose file exists —
  means un-waive it or the waiver is outdated. Current advisories:
  zara/carry, josh/carry, michele finish+race-pair, tr/detail — all
  files referenced by the tenant's own copyOverrides; left flagged as
  per-tenant decisions for Chris.
- Crew default copies now skip waived slots (was copying
  dinner-template into tenants that waived it).
- Unreferenced pool files moved to <slug>-assets/spares/ (~140 files)
  so packs keep spares without them silently shipping or tripping
  strictImages. Waivers added per tenant documenting each unfilled
  required slot — configs now carry the full picture.
- Batch results: 16 sites, 0 unwaived gaps, 0 missing refs, gate PASS.
  Non-batch stale tenants (fennell, hustle, kore, mayaokafor, pacegym,
  station9) NOT re-waived — they'll need omit entries when next built.

AMBIENT HERO GHOST (fixed in chassis/emerge.js):
The homepage "rolls in" via emerge.js, which bakes the finished hero
into a WebGL canvas, plays the reveal, then cross-fades to the live DOM.
In ambient mode (data-hero-mode="ambient") .hero-amb renders as a
FULL-BLEED blurred layer, but the bake only drew ambient blur clipped
to the photo's painted rect ("no silhouette on the left"). At handoff
the live full-bleed layer popped in as a ghost beside the photo.
Full-mode heroes were unaffected (.hero-amb is display:none there —
same reason Gabby/Zara stopped showing it once they went full).
Fix: the bake now checks if .hero-amb is actually rendered and draws
it across its own layout box with its own object-position; the
clipped-rect bake is kept only for the full-mode branch where the
ambient layer is invisible anyway. Applies to every ambient tenant on
rebuild; no per-site patches needed. Only mayaokafor (testchassis)
currently builds ambient — good visual test bed.

UPDATE — the recurring part of the ghost was a chassis leak, not just
the bake: coachedbykim's entire extraCss block had been pasted into
chassis/styles.css (incl. a desktop media rule that re-enabled
.hero-amb and set hero-img to contain/76% for EVERY data-hero-mode=
"full" hero — so all "full" pitch heroes secretly rendered ambient,
i.e. blurred copy + sharp photo = ghost to the right during roll-in).
Removed the whole block (her --hero-focus, #plans/#athletes-say
spacing, tips-photo crop were all hers). Kim/Michele/Paul carry the
same treatment in their OWN extraCss with per-site object-positions —
deliberate, kept. Full heroes now render true cover+no-amb; ambient
heroes (kim/michele/paul desktop, maya) get the corrected emerge bake
that draws .hero-amb across its real box. All 22 rebuilt, gate PASS.
Lesson: never paste a tenant extraCss into the chassis — grep chassis
for tenant fragments if a style "recurs" site to site.

Paul's screenshot confirmed the look: blurred giant face + sharp
contain photo = "ghost". Removed the ambient-on-desktop override from
paulgillingham, michelewilder and coachedbykim extraCss (kept their
--hero-focus crops, mobile positions and art/tips tuning). All three
now render true full heroes like Josh. No site in the batch carries
the amb display:block override anymore; only genuine ambient mode
(maya) keeps .hero-amb, with the corrected emerge bake.

AMBIENT GHOST, part 3 (the actual render cause, from maya screenshot):
the bake drew the ambient blur bare across the whole canvas but the
live ::after scrim is much heavier on ambient heroes (0.82 left / 0.86
bottom vs full-mode's 0.2/0.18) — so during the reveal the blurred
photo showed uncovered, then the scrim smothered it at handoff =
"ghost fades, not fully gone". emerge.js now branches on ambVisible:
ambient bake uses the heavy scrim values and drops the full-mode
brightness(1.22) photo lift (ambient hero-img is unfiltered). Full
heroes keep original values. All 16 + maya rebuilt.

AMBIENT GHOST — final fix (design-level, Chris's call):
the "ghost" was never an animation bug — the half-page hero DESIGN is
a blurred twin of the photo behind the sharp one; scrim tweaks only
dimmed it. .hero-amb is now display:none for ambient heroes too —
contain photo on flat stage, no twin during or after the reveal.
emerge.js: ambVisible branch kept as fallback for tenants that
re-enable it; the else branch bakes flat stage (no clipped blur) and
the contain photo gets a stage-coloured left-edge feather after the
stamp (replacing the old pre-photo feather that did nothing).
app.js edge-feather mask still applies to ambient — feathers the
photo into the flat stage as intended.

COACH LANDING MODEL (changed back, Chris's call):
coach-view.js no longer redirects /?audience=coach to today.html —
the coach landing is the public homepage WITH The Desk toolbar above
it (exposition-first for pitches). "Preview public site" still opens
/?audience=public (toolbar hidden, public-preview banner). "Back to
coach view" now returns to /?audience=coach, not today.html. Today is
only reached by clicking it in the toolbar. The homepage already
carried the data-coach-view aside; no markup change needed.
