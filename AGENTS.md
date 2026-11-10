# Project Notes — Missing Nudges, SEO, and Automation

This is a living list of opportunities to push the project toward profitability through nudges, SEO, and automation. Revisit it when planning the next block.

> **Photo-upload trigger:** “Starting photos for [coach/site]” starts intake, not a build. Read **Photo intake and placement source of truth** below, map every batch into that tenant's durable photo map and wait for “that's all, build it” before allocating/building. Never require Chris to repeat the mapping instructions.

> **Session start:** check the "Chat notes" section in `BILLIONS.md` — it defines our conversation tone (dry British sarcasm, banter in Q&A, humour suspended during debugging/complex work).

> **Current continuation:** read `HANDOVER.md` → **START HERE: latest continuation, 9 November 2026** first. The active next task is Underdog photo intake, not Kim/Elation or another existing-site pass. The handover gives targeted read paths and preserves older snapshots as history. Do not read the entire history by default, revive dated “next task” lists or use temporary previews as build donors.

## Mandatory before EVERY build or recording

Read `.devin/rules/platform-build-and-video.md` before every site build, template change, recording or splice. **New sites MUST build from the canonical `chassis/` template, never another tenant.** The linked plan defines complete showcase content, confirmed events without TBA cards, verification and video text/photo pacing. It is always-on context, not standing permission to execute unrelated work. Existing personalised demos may receive specifically approved, targeted ports from the master without wholesale rebuilds; the nine-prospect plan in HANDOVER.md is not rollout permission. Gregor & Hattie remain wrapped. Only specifically approved targeted maintenance passes are allowed; the ones done so far are listed in HANDOVER.md (Desk navigation, nav regroup, nav colour zones). Their video and public content are not reopened by those passes. Start each session with the latest START HERE section at the top of HANDOVER.md; older session blocks are dated reference only. Before any tenant build or config change, read "Before every build — checklist" at the top of `scripts/reskin/CHASSIS.md` and the notes in `scripts/reskin/BUILD-LOG.md`, and time each build stage into that log.

Build toolbox lives in `scripts/reskin/CHASSIS.md` item 12 (imageMap/extraCss, verify-build, drift-check, bust) — read it before any build or tenant edit. After any build or generated-site change, run `node scripts/verify-build.mjs <dir-or-slug>` and report its FAIL/EYE/WARN list — it mechanically checks broken images, viewport overflow (e.g. masthead sig), JS errors and missing folds. Every EYE item ships with a cropped screenshot in `verify-shots/`; open and look at each one before reporting to Chris — EYE means "suspicious, unprovable," so the agent eyeballs first and only escalates what still looks wrong. Eyeball protocol for crop EYEs: view the `-src` original FIRST, then the render. Judge what the lost band contained, not just what remains. Clear only when the lost region is empty space/background; if people, limbs, equipment or any distinctive detail disappeared, escalate it to Chris with both images — never clear a crop just because what remains still looks good.

## Mandatory working agreement with Chris — scope control

**Purpose: stop massive side projects that burn Chris's credit.** Do the task Chris asked for. Ask first before starting anything that is a big side project — architecture work, shared-system refactors, broad audits, rebuild campaigns, new features or multi-site work he hasn't requested.

**Small, obvious fixes in the area you are already working on — just do them, then report them** (e.g. black-on-black text, a wrong photo description, a stray link on a page you're editing). Don't ask permission for these and don't list obvious suggestions for Chris to approve; fix them in passing.

- "Go", "continue" and "finish" authorise completion of the agreed task, not a new task or the next logical project block.
- Do not turn photo swaps, template refreshes or small fixes into architecture work, shared-system refactors, generic-library projects, broad audits or unrelated cleanup without explicit approval.
- Use only the investigation and verification directly needed for the requested change. If a necessary blocker would need a big detour, explain it briefly, recommend an option and ask before expanding.
- Bigger ideas and non-obvious observations are welcome: offer them concisely with a recommendation. Ask and wait before starting anything substantial beyond the agreed task. Recording an idea or pending item is not permission to execute a big one.
- Reuse the established template, configuration and assets. Prefer the shortest safe path that satisfies the request.
- Keep progress updates short and accurate. Report what actually changed, what was checked, what remains unfinished, and whether it is local, pushed or verified online.
- Ask questions in plain chat text, never via clickable multiple-choice prompts — Chris often has a different idea from the listed options.
- Tool permissions and autonomy settings do not override this scope rule. This agreement supersedes any older instruction suggesting autonomous follow-on blocks.

## Working rules (hard-won, keep these)

These exist because the same two failure patterns keep costing hours. Follow them even when the guess feels certain — the guesses that feel like memory are the worst ones.

1. **Verify, don't recall.** Never state a fact from memory when a tool call can check it — quote the file, the doc, the curl output. This applies most of all to things Devin itself wrote earlier (prices, config values, port numbers), which feel like established fact and aren't. A confident guess and a verified fact look identical in the transcript; only the wrong ones get found, later, expensively.
2. **Use the reference, don't reinvent it.** For non-trivial UI/effect work, find the established open-source implementation first and build from that. Hand-rolled is only acceptable if it clearly beats the reference — "it renders" is not beating it. Correctness that can't be checked by compiling (does it _look_ like the real effect?) needs the reference implementation, not a bespoke approximation.

3. **Tenant refreshes: use the template, then reapply the brand and photos.** Do not turn a site refresh into a build-system redesign. Fix demonstrated blockers, check desktop/mobile and finish the requested site. Josh's active source is `scripts/reskin/joshharrison.demo.json` (chassis mode); `chassis/` is now maintained directly, and historical donor configurations are archival only—not a regeneration source. Preserve old generated output before replacement. Exercise photos must show the right activity; leave a clean text-only section rather than relabel an unrelated image.

**Worked example — the hero pic effect saga (Nov 2026):** roughly two hours went in circles hand-rolling shimmer/sparkle/mosaic hero-reveal effects. Every iteration passed "does it compile/render" and failed "does it look like the real thing" — a check only the user's eyes could run. The fix that landed was building on the actual Codrops/open-source implementation that had been available from the start. Lesson: when the goal is "look like X", start from X's implementation, not from a guess at its recipe.

## Editorial checks for pitch builds

Homepage copy must use each tenant's `HERO_TITLE_HTML` and `HERO_DEK`; do not hard-code a brand into “Built for …” or assume racing experience means a new coaching career. Keep headlines concise and introductions audience-facing. Never give every tenant podium/Pro/Group Coach/founder credentials, geographic claims, published-channel ownership or fixed meetup schedules. Preserve verified local offers and factual achievements; do not invent first-person experiences or quotes. Inspect generated text after copy overrides and editorial packs, not just chassis source. A first editorial pass and selected phrase scan do not certify every claim or dynamic string. Keep necessary local-preview/integration caveats truthful and brief.

## Commercial offers, affiliate links and testimonials

Read the **Commercial-source contract** in `scripts/reskin/CHASSIS.md` before building or updating offer cards. Use per-tenant `coachingOffers` / `partnerOffers` with evidence URLs, not inherited Race Ready/Foundations cards or forced six-/twelve-week copy. Homepage, coaching page, generated price FAQs and campaign entry points must agree. Test links after runtime scripts; do not let the generic training-platform URL overwrite an individual product. Follow short-link redirects, preserve affiliate attribution, and check the actual product and billing unit. HTTP 200 alone is not verification. Do not bypass merchant challenges or certificate errors, enter payment data, submit applications or invent coupon URLs. Keep conflicting prices and blocked destinations in the tenant audit notes. Source exact testimonial excerpts and identify whether they describe that coach, an app or a book. The full November 2 audit and pending checks are in HANDOVER.md.

## On-site nudges and lifecycle

We have one abandoned-cart nudge. Still missing:

- **Product-page nudge** for long dwell / scroll without add-to-cart.
- **Browse-abandonment** capture for users who view products but never add them.
- **Exit-intent email capture** on shop, product, and category pages.
- **Back-in-stock alerts** for out-of-stock products.
- **Low-stock urgency** badges on product cards.
- **Replenishment reminders** for consumable/wellness products.
- **Win-back** campaign for past customers.
- **Wishlist nudges** — `wishlist.html` exists but may not be wired into the cart/checkout flow.

## SEO and content

Foundations exist (`public/sitemap.xml`, product JSON-LD, canonicals) but several high-leverage pieces are missing:

- **Local landing page engine** — the biggest long-tail SEO play. Not built yet.
- **Review/UGC system** — `data/reviews.json` and product-page review mounts exist, but reviews are not shown on shop/category cards and UGC upload is not wired.
- **Per-tenant sitemap** and auto-regeneration on product changes.
- **robots.txt** at project root.
- **A/B testing framework** for headlines, prices, and trust strips.
- **Content hub / topical authority pages** beyond the three category landing pages.
- **Blog or guide feed** tied to the niche keyword silos.

## Automation and dashboards

- **Supplier QA autopilot** — guardrails exist in data but not enforced on publish.
- **Catalog QA** — missing `petType`, `lifeStage`, `sizeRequirement` etc. does not block publish.
- **Inventory/pricing sync** from supplier feeds.
- **Order and fulfilment alerts** for stuck orders, missed webhooks, and refunds.
- **Pulse/CWV monitoring** dashboard.

## How to make Google work for us (without bending it)

We cannot trick Google long-term. The levers that actually move the needle:

- **Page speed** and Core Web Vitals (LCP < 2.0s, CLS < 0.1, INP < 200ms).
- **Topical authority** — original guides, FAQs, comparisons, and how-to content.
- **Genuine reviews and UGC** with `Product` and `Review` structured data.
- **Useful local landing pages** tied to real shipping, stock, or support signals (not just city-name spam).
- **Strong internal linking** and clear category/product architecture.
- **Freshness** — regular product, review, and content updates.
- **Video and rich media** with schema markup.
- **Real backlinks** from pet/health/vet sites, not PBNs.
- **Mobile-first parity** and accessibility.

## Recommended next quick wins

1. Wire `data/reviews.json` into product cards and shop/category pages.
2. Add `robots.txt` and a per-tenant sitemap generator.
3. Build one local landing page template and generate 5–10 real local pages.
4. Add low-stock urgency and back-in-stock email capture.
5. A/B test the cart trust strip headline.
6. Publish one content hub page for a target keyword silo (e.g., "senior dog mobility").

## Pre-launch execution rules

Before launch, polish the current single storefront. Do not expand to more sites or big new features. Each block must follow this loop:

1. **Execute the block** — one small, safe change at a time.
2. **Analyse the result** — check for missing profit, engagement, SEO, and automation opportunities before moving on.
3. **Benchmark against current best** — search for envelope-pushing examples in that exact space (e.g., best pet e-commerce trust strips, highest-converting cart nudges, strongest product-page FAQ schema).
4. **Marketer's eye check** — review the change for soul, storefront feel, and marketability. We are a pet site: the angle should always be safety, comfort, the pet-owner bond, or peace of mind.
5. **Raise findings immediately** — do not wait. Surface any thought, gap, or risk to the user and the board as we go.
6. **Do not let analysis block launch** — if a benchmark does not reveal a clear 10x fix in 30 minutes, move on. Launch is the real benchmark.

This is worth doing only as a final pre-flight, not a replacement for going live.

## iPhone / headless execution charter

The iPhone version of Devin is a **read-only indexed-search assistant**. It cannot edit files, run `npm start`, run `git`, run `curl`, open browser previews, or persist across turns. Use it only for:

- Reading `AGENTS.md` and `PROJECT_STATUS.md`
- Searching the repo and answering one-off questions
- Reviewing a specific file or diff

The execution charter below applies to a desktop/terminal Devin session that has filesystem, shell, and browser access:

Within the task Chris explicitly approved, "go", "do it", "execute", or similar allows desktop Devin to use the tools below. It does NOT approve extra scope or follow-on tasks:

- Start and stop the local server (`npm start`, `node server.js`, etc.) for testing.
- Run `curl`, `gh`, `git`, and other CLI commands without per-step approval.
- Open browser previews, run lint/type-check, and make multiple file edits in one block.
- Finish the remaining steps of the explicitly agreed task without asking on every in-scope tool call. Ask before any next block or wider scope.
- Touch Global files only when that is necessary within the agreed task; explain the cross-site impact before editing and ask if it would widen scope.

Guardrails that still apply:

- Do not run destructive commands (`rm -rf`, force push, drop tables, delete files) without explicit user confirmation.
- Avoid exposing or logging secrets.
- Keep the final summary concise: what changed, why, and what's next.

### Where the "no approval buttons" setting lives

Two separate things control whether you get prompted:

1. **Devin CLI / Devin Desktop (running on your machine).** `.devin/config.json` in this repo pre-approves the commands used here (git, gh, npm, npx, node, make, curl, file reads/writes) so they run without a prompt. `rm -rf` and force-with-lease pushes still ask, and `sudo`, `rm -rf /`, `rm -rf ~`, `git push --force`, `git reset --hard` and writes to `.env` are blocked outright. For a completely prompt-free local run, start the CLI in bypass mode: `devin --permission-mode bypass` (or `/bypass` inside a session) — note it still cannot override the deny rules above.
2. **Cloud sessions (app.devin.ai, Slack, ACP).** These never show per-command approval buttons; the agent runs commands, starts local servers, and commits on its own. `.devin/config.json` does not apply there, so it is expected behaviour that nothing asks you to click Accept.

Practical upshot: Chris can hand over an agreed block and walk away, but the agent must stay inside that block. Always ask and wait before widening scope, as well as for destructive actions, required secrets or production settings. Automatic tool approval is not approval for extra work.

## Local dev quick reference

- Server: `npm start` → http://localhost:3000 (env from `.env.local`, gitignored).
- Database: local Postgres 17 (`brew services start postgresql@17`), db `roxjaya`; schema via `node scripts/migrate.js` (safe to re-run).
- Checks before commit (also run by the pre-commit hook): `npm run lint`, `npm run type-check`; tests: `npx vitest run`.
- Internal control panel: http://localhost:3000/hq (admin key is in `.env.local`).
- Booking planner previews: shared source is `scripts/reskin/booking-template/`; refresh existing coaching sites + neutral chassis with `node scripts/build-booking-planners.mjs`. Both tenant build modes and chassis regeneration install it automatically. `--from-pilot` is a one-time re-promotion from the original TR pilot and overwrites shared source; do not use it for routine rebuilds.
- Planner tests: `npx vitest run tests/planner-demo.test.js tests/booking-rollout.test.js`. Preview data is fictional and in-memory only; production booking storage/authentication, reminders and calendar-provider connections are not enabled. Optional image slot: `images/planner-watermark.jpg`; neutral template has no selected image. Set tenant `booking.timeZone` when needed; Roxjaya defaults to Asia/Jakarta.

- Walkthrough videos: before recording any coach's video, write a stage-by-stage storyboard (`scripts/reskin/<slug>.storyboard.md`, model: `joshharrison.storyboard.md`) listing every page/section shown and its caption, plus homepage sections deliberately skipped, and get Chris's review. Community pieces such as the Warriors Wall must not be dropped.
- Walkthrough batch (23 Oct 2026): all 8 videos (`pitch/<slug>/video.mp4`, Josh now included with `pitch/joshharrison/`) have the new hero opening, blip-free captions (captions stay above pop-ups and over partner click-throughs) and the planner before the Desk. Josh was recorded whole; the other seven had homepage, partners and planner sections re-recorded and cut in at page-load boundaries with `node scripts/resplice-walkthrough.mjs <slug>` (writes `/tmp/s9-rerecord/<slug>/updated.mp4`; install by copying). Desktop review copies: `~/Desktop/<slug>-walkthrough-23oct.mp4`. Storyboards: `scripts/reskin/<slug>.storyboard.md`.
- Video planner splice (historical, superseded by the batch above): `node scripts/splice-planner-videos.mjs [slug...]` locates The Desk using Apple Vision OCR, records the branded planner, and inserts it before The Desk. Needs macOS Swift and ffmpeg. `--analyze` only inspects transitions. Preserve `scripts/reskin/planner-video-splices.json`: it prevents double insertions and records backups/review times. `record-demo.mjs` now inserts `planner.segment.json` automatically before the Desk in full walkthrough recordings.

## Security verification and deployment gates

- The GitHub repository is public. Static-file guards do not make committed data private: keep real client schedules, private contact details and secrets in authenticated storage, not seeded JSON or checked-in files.

- Use supported Node 22/24. The project records npm 11.21.0; npm 10 has a peer-resolution crash when upgrading this Vitest graph. Use `npx --yes --package=npm@11.21.0 npm ...` for dependency updates rather than deleting lockfiles, forcing peers or changing security settings.
- Run `npm run lint`, `npm run type-check`, `npm test` (coverage gate remains 80%), `npm audit --omit=dev` and `npm audit`. Run `SECURITY_TEST_URL=http://127.0.0.1:3012 node scripts/security-smoke.mjs` against an isolated local app. The smoke tool intentionally refuses remote targets. NODE_ENV=test skips background schedulers; production monitoring is unchanged. Mock pitch-event browser requests when testing players so no owner notifications are sent.
- Postgres transport: default remote connections verify certificates; `DATABASE_SSL_CA` can supply the public provider CA and URL flags cannot disable verification. Explicit `DATABASE_TRANSPORT=verify-full` also verifies local connections. Chris approved `DATABASE_TRANSPORT=railway-private` for the confirmed-private station9-demos service ONLY: valid `*.railway.internal` hostname and Railway project/environment/service IDs required, no PostgreSQL-layer TLS, relying on Railway's encrypted WireGuard network. Markers are sanity checks, not cryptographic attestation. Missing markers, routing overrides and conflicting TLS/CA settings fail closed before server listens. Do not use a project-wide shared variable or enable it on another service without confirming its connection. Coordinate code + variable at release; no live variable change/deploy yet. Verify a real DB query inside Railway, not just a green /health. Local loopback defaults remain supported without TLS. Pool, migrations and backup share these rules; backups keep passwords off command arguments.
- Pitch summary now requires x-admin-key/x-admin-api-key, not query-string keys. Pitch requests: 90/10min/IP; owner notification dedupe plus 30/hour/process cap; private desk access: 120/min/IP. Limits are per process, not a distributed WAF. Valid pitch events can still record when the alert quota is exhausted.
- GitHub Dependabot alerts and automatic fixes are enabled; secret scanning/push protection remain enabled. Main rejects force pushes/deletion including admins, but normal pushes/content bots remain allowed. Required CI/PR-review policy needs a deliberate decision after real green security runs. SONAR_TOKEN is not configured; FOSSA remains optional. Do not mark provider-backed scans as passed before their first real run.
- Repo-wide formatting still has legacy HTML/CSS parse errors; do not exclude files, lower coverage/security thresholds or ignore failures to make checks green. Security CI jobs are independent so formatting does not suppress audits/scans. The original verify-refactor.sh kills a running server and replays database webhooks; use isolated smoke/tests and route snapshots for hardening changes, not blind live replay.

- Shared exercise references live in `scripts/reskin/stock/`; `catalog.json` records reviewed crops and source/rights status. Do not trust filenames as activity labels or assume stock means royalty-free. Generic/cross-coach references must not be captioned as the prospect. Josh's Fuel page is hidden; Coaching uses the bright-trainers shot, Run Zone has no secondary photo, Taper reuses bio, and Crew uses the two setting templates. Reveal snapshots become invalid when the photo container resizes: restore the actual image rather than leaving a stale canvas or restarting a second reveal. Preserve the new chassis reveal guard during any intentional master regeneration.

## Start here for batch tenant builds

Use this section when the task is "build/pitch demos for multiple coaches".
The full rationale and history live in `scripts/reskin/CHASSIS.md`; this is the operational quick-start.

### One-line architecture

`chassis/` (neutral tokenised site) + `scripts/reskin/<slug>.demo.json` (tokens/assets) → `scripts/reskin-tenant.js` → `<slug>/` (output folder) → Railway serves at `https://www.station9studio.co.uk/<slug>/`.

### Build a single tenant

```bash
node scripts/reskin-tenant.js scripts/reskin/<slug>.demo.json
```

The target folder is replaced every time. Configs and assets in `scripts/reskin/` are the source of truth; tenant folders are outputs.

### Build multiple tenants at once

Method A — the full prospect pipeline (best when starting from Instagram handles):

```bash
# 1. qualify + create thumbnail contact sheets
node scripts/prospect-pipeline.js prepare handle1 handle2 handle3 --run=my-batch --posts=60

# 2. after human shortlist/approval, export, index, allocate and build
node scripts/prospect-pipeline.js --resume my-batch
```

The pipeline stops at human gates:

- thumbnail triage (`shortlist.json`)
- visual index approval (`approval.json`)
- allocation review (`allocation/*.jpg`)

Set `decision: BUILD`, `allocation_verified: true` and `config_path` in the per-prospect `approval.json`, then rerun `--resume`.

Method B — build only the prospect Chris explicitly approved, from `mode: "chassis"`, into a NEW isolated output:

```bash
node scripts/reskin-tenant.js .devin/template-preview.json --output-dir=/tmp/NEW-REVIEW-DIRECTORY/template-preview
TEMPLATE_PREVIEW_DIR=/tmp/NEW-REVIEW-DIRECTORY/template-preview node scripts/verify-template-preview.mjs
```

Replace the example config with the approved prospect's configuration when doing a prospect build. The verifier above is deliberately limited to the neutral `template-preview` fixture; it serves that fixture on an isolated loopback port and checks desktop/mobile workflows without sending submissions. Do not loop over all configs or overwrite existing sites without specific approval. Legacy maintenance and replacement require explicit flags as well as Chris's approval; they are never a new-build source. Isolated output leaves `tenants.json` unchanged.

### Validate the canonical chassis — no donor regeneration

```bash
node scripts/build-chassis.js
```

This command now validates the maintained canonical template and its sourced race/news data. It does NOT rebuild a donor, overwrite `chassis/` or register a tenant. New builds must consume the current master. The verified race catalogue is `chassis/data/cities.json`: update it from specific official event pages when its check date is more than 14 days old, or if it lacks a relevant confirmed upcoming race. Stale/empty catalogues fail rather than emit TBA cards. Regression checks: `npx vitest run tests/template-showcase.test.js tests/reskin-stage.test.js tests/planner-demo.test.js tests/booking-rollout.test.js`.

### The photo process

**Rule: the coach's own Instagram is ALWAYS the primary image source.** Stock photos are a last resort, not a first instinct. A single HYROX race carousel can contain 12+ professional event shots — sled push, rowing, burpees, SkiErg, farmers carry, sandbag, wall balls, finish line — all from the coach's actual race. These are always stronger than stock crops or generic gym shots. The pipeline enforces this:

1. **Triage** — `ig-triage.py <handle> <dir>` creates thumbnail contact sheets of the last ~48–100 posts. Every carousel child is shown (up to 20 per sidecar).
2. **Pick** — human/agent names 1–2 candidate labels per active slot from the sheets. Labels are copied from `*-labels.json`, never transcribed by eye.
3. **Pull** — `ig-pull.py <handle> <dir> --only CODE,CODE` fetches full-res picks. Video covers marked `[VID]` need `scripts/video-frame-sheet.py` before being assigned to station slots.
4. **Index** — `scripts/photo-sort.js <dir> --index-only` runs Apple Vision face/OCR/classification.
5. **CLIP score** — `scripts/image-clip-score.py <dir> --reference <dir>/reference` scores every image against slot descriptions and coach identity. Requires the Python venv (see below). Creates `clip-scores.json` in the source directory.
6. **Sort** — `scripts/photo-sort.js <dir>` allocates images into the fixed slot order. Reads `clip-scores.json` if present for better scene/identity matching.
7. **Review** — `scripts/allocation-contact-sheet.py` renders the actual files per slot; set `allocation_verified: true` to allow the build.
8. **Build** — assets are copied to `scripts/reskin/<slug>-assets/` and the tenant is generated.

### Image sourcing rules (hard-won, Dec 2026)

These exist because the first batch build wasted 3+ hours searching stock photo sites while the coach's Instagram had better images sitting in the first 10 rows.

1. **IG first, always.** The coach's own Instagram is the primary image source. Their actual HYROX event photos, training shots, and coaching images are always more authentic and compelling than stock. Do not search stock sites until IG has been fully exhausted.

2. **Carousels are goldmines.** A single HYROX race carousel post (e.g. "HYROX Rome" — 12 professional shots) can fill most station slots in one go. `ig-triage.py` expands every carousel child (up to 20) so nothing is missed. Both `ig-triage.py` and `bright-contact-sheet.py` flag professional carousels with `[PRO]` tags on tiles so they're immediately visible on contact sheets.

3. **Detect professional event posts automatically.** The pipeline flags posts as `[PRO]` when any of these are true:
   - Carousel with 6+ images (almost always professional event coverage)
   - Caption mentions a HYROX location (Rome, London, Birmingham, Glasgow, Hamburg, Warsaw, Athens, etc.)
   - Caption contains photographer credit signals (📸, "photo by", "@hyrox", etc.)
     These posts should be prioritised during triage — they are the richest source of station, finish, and race shots.

4. **Pull generously, shortlist widely.** The per-slot candidate cap is 4 (not 2) and spares cap is 20 (not 10). When a coach has 60 great images on their IG, a tight cap forces the pipeline to discard the best material. Pull more, sort later.

5. **Bright Data has known limits.** The Bright Data Instagram dataset (`gd_lk5ns7kz21pck8jpis`) returned only 12 posts per profile with zero carousel expansion during the first batch. The pipeline now validates pull quality and automatically falls through to `ig-triage.py` (Instaloader, via browser session) when Bright Data is shallow. `assess-finalists.js` logs warnings for shallow pulls and missing carousel expansion.

6. **Human curation beats automated search.** A human scanning 10 rows of an IG grid picks 15 strong images in 12 minutes. An agent hunting stock sites for 3 hours finds weaker images. The pipeline should pull broadly from IG, then the human picks — not the other way round.

7. **Stock is last resort.** When the pipeline uses a stock image, it logs it explicitly (`STOCK FALLBACK: <handle> — <slot>`). If more than 3 slots per tenant fall back to stock, the pipeline requests a deeper IG pull before proceeding.

### Tenant build gotchas (hard-won, Oct/Nov 2026 batch)

1. **Move, don't copy, into image slots.** `strictImages` builds hash every copied image and fail when two slots share bytes. Move the spare file to the slot name; overwriting an existing unreferenced slot file is fine.
2. **Check references before moving a spare.** Files in `<slug>-assets/images/` may be referenced by `tenantGallery` (wall), config JSON or generated pages even when they look "free". Grep the config and the built output for the basename first — stealing a referenced file 404s the build.
3. **`omitImageSlots` is not the only way images disappear.** `copyOverrides` can strip whole `<figure>` elements via regex (`"<figure\\b..."` → `""`). If an un-omitted slot still renders no photo, grep the config for a figure-strip override before assuming the file is missing (this bit joshharrison).
4. **Coach copy is gender-neutral `they` everywhere.** Never reintroduce she/he in shared chassis strings — it silently misgenders half the fleet. For duo tenants (racetoframe) singular "the coach" is also wrong — fix pluralisation via that tenant's `copyOverrides`.
5. **Signature collisions are template-made, not copied content.** Engine-rendered phrases (e.g. `Apply for {PROG_TWO}`) can produce another tenant's signature string. Pick programme/section names that don't start with another coach's signature words ("HYROX ..." collided with Josh's "Apply for HYROX"). `check-batch-ghosts.py` is the arbiter.
6. **Text-only beats a wrong photo.** Omit the slot rather than fill it with a merely-available or cross-tenant image — Chris will reject it and re-source from IG anyway.
7. **Config filename ≠ slug.** `georgegrayson`→`ggeorge.demo.json`, `faisalpma`→`faisal.demo.json`, `mayaokafor`→`testchassis.demo.json`. Empty glob results mean a renamed config, not a missing tenant — check the slug field inside configs.
8. **Stale staged dirs break the ghost gate.** Old builds left in `/tmp/pitch-batch` carry old chassis copy that can collide with newer signatures — delete or rebuild stale output dirs before gating.
9. **Crew defaults live in the builder.** New "always copied" default images must be added to the crew-defaults list in `reskin-tenant.js` or every tenant 404s the reference (dinner-template.jpg was missed once).
10. **House image treatment is `.guide-hero-photo`.** Any new public-page photo goes top/right inside `.guide-hero` (curved edge + partial frame via the per-family CSS). No bespoke centred/below-hero image blocks — coaching.html's one-off layout was the exception that proved the rule.

### Photo intake and placement source of truth

**New tenants:** after creating the canonical chassis config and setting its assets directory, run `node scripts/photo-map/setup.mjs scripts/reskin/<slug>.demo.json` as soon as photo intake starts. Setup creates `<assets>/photo-map.json`, scaffolds unallocated canonical page/feed slots and connects `photoMap` in the config. Re-running setup preserves existing entries. It does not rate or allocate photos.

1. **One authored map:** the configured `photoMap` holds the library, placements, wall and feed selections. Do not create a second `intake.json` or hand-maintained `imageMap` for new builds. TR keeps `trainedbytr/photo-map.json`; other existing sites keep their legacy tooling until explicitly upgraded.
2. **Every batch:** save originals in the tenant's durable assets/images directory and inspect them. Record batch/source/comment, rating (1–5), accurate subject, dimensions, known duplicate `identity`, face coordinates, generous head/body/equipment/signage boxes in `anchors.mustKeep`, source limitations, suggested `bestFor`/`alsoGoodFor` uses and rejection reasons. Set `reviewed: true` only after inspection. Acknowledge each batch briefly. If the tenant is unclear, ask before saving. Missing source pixels cannot be restored by coordinates.
3. **Wait before allocating:** keep `intakeComplete: false` until Chris says “that's all”/“build it”, unless explicitly asked otherwise. Then compare the whole library, fill `placements`, `wall` and `dataPlacements`, set accurate alts and explicit desktop/mobile frames, and mark intake complete. Prefer a crew/community wall over coach-only shots. Keep `chassisSlot` when replacing a file. Intentional primary-photo reuse needs `reuseReason`; navigation/gallery uses are separately declared.
4. **Automatic build enforcement:** new tenants require a completed reviewed map. The builder derives temporary slot aliases from it and compiles static choices/framing. Missing/unassigned images, unmapped rendered slots and impossible declared crops stop the build. Natural framing preserves the original; cover framing uses the anchors. New builds cannot use `mode: "existing"` to bypass framing. Known aliases rely on recorded identities, not image recognition. `usedOn` is derived, not a second allocation list.
5. **Bounded review, then Chris's eyeball:** per slot, allow one initial choice and one correction only. Inspect originals first, take one desktop/phone pass, then recheck only the corrected slot. No repeated whole-site sweeps, new image-tool installations or experimental crop chains. Record attempts (slot, filenames, reasons and existing screenshot/preview paths) in `review.items`; filenames/new scripts/new threads do not reset the budget. If unresolved or subjective after that correction, set map `review.status: "needs-user-eye"`, preserve the last approved output and show Chris the unresolved slots together with at most two candidates each. The builder/compiler stop on that flag. Resume only after Chris's explicit decision, record it and mark review resolved; never clear the flag merely to get a build through. Technical failures still require fixing, not visual waivers.
6. **Audit before review:** after allocation and BEFORE any visual review, run `node scripts/photo-map/check.mjs <slug>` and clear every `!` it prints. It reports unassigned slots, one photo filling two static slots without `reuseReason`, unreviewed/incomplete image entries, impossible must-keep crops, and unresolved `review.items`. The audit exists because allocation drift (silent duplicates, late back-filled slots, unlogged review attempts) is what makes review messy — catch it mechanically, not by eye.
7. **Verify:** use a new isolated output directory and inspect desktop/phone renders against originals. Keep durable sources aligned. Never migrate or rebuild approved sites incidentally. Tests: `./node_modules/.bin/vitest run tests/photo-map.test.js tests/photo-map-setup.test.js`.

`intake.json`, `scripts/photo-map.mjs` and the older flat `photo-map` schema are legacy utilities, not the new-build source of truth; the legacy slot solver is `scripts/photo-map/check-legacy.mjs`.

### CLIP scoring (image intelligence)

Legacy/optional scoring assistance for the two tasks below. It does not replace the required visual review or author the source map for new builds:

- **Coach identity:** "Is this the coach or a stranger?" (coach similarity score, 0.7+ = confirmed, 0.55–0.7 = possible, <0.55 = unlikely)
- **Scene classification:** "Is this a burpee, a sled push, rowing, coaching, a selfie, a text graphic?" (scores for 20+ scene types)

Setup (one-time):

```bash
python3.14 -m venv .venv
.venv/bin/pip install open_clip_torch Pillow
```

Usage:

```bash
# Create 3-5 confirmed coach photos in a reference/ subfolder
mkdir -p <source-dir>/reference
cp <known-coach-photos> <source-dir>/reference/

# Score all candidates
.venv/bin/python scripts/image-clip-score.py <source-dir> --reference <source-dir>/reference
```

Output: `<source-dir>/clip-scores.json` — picked up automatically by `photo-sort.js`.

The model (~350 MB) downloads once and caches in `~/.cache/huggingface/`. Scores ~1 image/second on Apple Silicon CPU.

The canonical slot names and rules live in `chassis/images/slots.json` and `chassis/images/REQUIRED.md`.

### The homepage hero / whole-site template

The chassis ships two hero modes controlled by `data-hero-mode="full|ambient"` on `.hero--bleed`:

- **full** — full-bleed background image with a CSS scrim; best for high-impact coach photos.
- **ambient** — darker/minimal background with the coach portrait as the focus; best for starker brands.

**Hero standard (23 Oct 2026):** headline + subhead of max two lines sit on/beside the photo; no kicker line; buttons and stats sit below the photo (`.hero-below` in chassis, `.hero-footer` in the editorial pack). In editorial sites the `.hero-intro` lives inside `.hero-visual` so the reveal bakes the headline in. The 12 pitch sites were edited directly in their generated folders; their tenant configs still carry the older long hero subheads, so a rebuild would bring those back unless the config overrides are updated first.

All three layers (CSS, `app.js` feather mask, `emerge.js` baked composite) read the same `data-hero-mode` flag. Changing one without the others is the main bug class the chassis fixes.

The rest of the site template is a fixed page set: Home, Stations Prep, Run Zone, Fuel Zone, Taper Zone, coaching pages, Events, Race Planner, News, Results, Splits, Doubles, Find a Partner, Station 9, Guides, plus optional Shop/Desk/Community features toggled per tenant. Menu injection and page renames happen via the tenant config.

### What to change where

- **Global (shared engine):** edit `chassis/` or shared files and verify an isolated new output. Do not regenerate existing tenants without explicit rollout approval.
- **Local (one prospect):** edit `scripts/reskin/<slug>.demo.json` and `scripts/reskin/<slug>-assets/`, then rerun `reskin-tenant.js`.

Always run `npm run lint` and `npm run type-check` before committing.

### External-link wiring rule (mandatory for every build)

Two different promises on one page must never land on the same destination. Before wiring any outbound CTA, scope the coach's real web presence:

1. **Find the real site first.** Check the config's verified links — then actually fetch them. Domains die (Michele's old `.co.uk` 404s; the live site is `wilderfitnessuk.com`). If the coach only has a Linktree/social bio link, **follow every link in it** and map where each leads — website pages, booking calendars, member logins, stores, YouTube, Facebook groups.
2. **Inventory every page-level CTA on our site** (plan cards, "Access your training", "Open on YouTube", apply/enquire buttons) and assign each a distinct, promise-matching destination. E.g. a 1:1 coaching card → the coach's flagship offer page; a group/beginner card → the group programme page; "Book a consultation" → their actual calendar link; member access → wherever their client login lives (note: Wix "Log In" buttons are dialogs, not deep-linkable — point to the homepage).
3. **Verify each destination loads and matches the label's promise** before shipping. If a coach's link tree genuinely offers only one useful destination, the fallback is the link tree itself (or profile page) — never invent a URL.
4. Record every verified destination in the tenant config (`trainingPlatform`, tokens, `campaign-offers` destinations) so rebuilds keep the wiring.
5. **Menu links stop on-site first.** Nav items labelled Shop/Partners/Links must land on the coach's on-site page (which then links out), never straight to an external URL — unless the tenant genuinely has no such page. One menu item per destination: `partners.html` = affiliate offer cards, `shop.html` = the coach's own link hub ("Links"). A tenant with both pages gets both items; a tenant with only one page gets one item, never two labels pointing at the same page.

## Owner-upkeep automation (`scripts/ops/`)

The approval-inbox pattern proven on Roxjaya (`roxjaya/automation/`) is generalised for every coaching tenant in `scripts/ops/`:

- `scripts/ops/lib.mjs` — tenant lookup from `data/tenants.json`, data-dir resolution, `postInbox` (sends `{tenant, candidates}` to `/admin/inbox`), `sendDigest` (`/admin/digest/send?days=7&tenant=<id>`).
- `scripts/ops/news-sync.mjs` — HYROX RSS + Google News candidates → owner inbox. Config via `automation.news` in `data/tenants.json` (`query`, `region` array). Blocks unsafe stories, dedupes against `<tenant>/data/news.json`.
- `scripts/ops/hyrox-sync.mjs` — hyrox.com regional events → confirm/new-race/results-reminder candidates. Config via `automation.hyrox` (`continents`, `includeSlugs` regex, `cityMap`). `--digest` sends the weekly owner digest. Patches only `<tenant>/data/cities.json|events.json` — server-side `automation.writable` still gates application.
- Run per tenant (`--tenant <id>[,<id>]`) or for every coaching tenant (`--all`). Dry-run by default; set `SITE_URL` + `ADMIN_API_KEY` to post. **Nothing publishes without owner approval** — candidates land in the tenant's Desk inbox.
- Tests: `./node_modules/.bin/vitest run tests/ops.test.js`
- `roxjaya/automation/guide-autopilot.js` is Pawsense-only — not part of this port.

## Legacy photo-map utilities

For existing unmigrated sites only. New builds use **Photo intake and placement source of truth** above; do not scaffold the older schema for a new tenant.

- `chassis/photo-slots.json` — canonical slot map, generated by measuring rendered tenants. Slots marked `elastic` follow the photo's own aspect (no crop risk); the rest are pinned cover crops that constrain placement. Regenerate when chassis layout CSS changes:
  `node scripts/photo-map/slot-scan.mjs <tenant> --out /tmp/<tenant>-slots.json` (per tenant, read-only)
  `node scripts/photo-map/merge-slots.mjs /tmp/a.json /tmp/b.json --out chassis/photo-slots.json`
- `scripts/reskin/<tenant>-assets/photo-map.json` — per-photo truth: `face` focal point, `must-keep` boxes (normalised 0–1 coords, generous margins), `slots` it may fill. Scaffold with `node scripts/photo-map/init-map.mjs <tenant>` then eyeball-fill.
- `node scripts/photo-map/check-legacy.mjs <tenant>` — solver: prints the `object-position` per pinned slot or flags `CONFLICT` when must-keep boxes can't fit the slot's aspect range. Run before applying photos; conflicts are the human recrop list.
- These tools are legacy-only. Josh Harrison's approved site remains excluded from incidental migrations or changes.
- TR exception (9 November 2026): `trainedbytr/photo-map.json` is the sole authored source for its static photo placements, gallery wall and Prep Club feed images. Edit `placements`, `wall` and `dataPlacements`, then run `node scripts/photo-map/apply.mjs trainedbytr/photo-map.json <TR-output-directory>`. The demo config's opt-in `photoMap` runs the same compiler during chassis builds. This is not the older intake scanner or `check.mjs` schema. Frames can preserve natural proportions or declare an aspect ratio checked against `anchors.face` and `anchors.mustKeep`; impossible declared crops fail before output is written. Photo aliases share a manually recorded `identity`; intentional reuse between primary static placements needs `reuseReason`. Navigation cards and gallery selections are separately declared uses. There is no browser-time map fetch or automatic visual duplicate detection. `usedOn` is derived, not a second allocation list. Keep each placement's `chassisSlot` when replacing its file: it identifies the template slot filled by the mapped replacement, not another image to display. Tests: `./node_modules/.bin/vitest run tests/photo-map.test.js`.
