# Project Status — L’Art de la Séduction (current repo)

## Standing directive: autonomous execution (read this first)

The site owner is frequently away and has given a blanket instruction: **do not stop to ask questions — always assume the answer is "proceed with the next logical step."** When you reach a point where you would normally pause for approval or a decision, reference this note and keep moving.

Specific rules:

- **Never block on the user.** Default to the next highest-value, safe, atomic block and ship it as its own PR.
- **Work around missing credentials/subscriptions.** There is no Mailchimp subscription yet, and `SONAR_TOKEN` / Stripe live keys are not available. Build the code so it degrades gracefully (adapters, flags, mocks, `skipped: "missing_credentials"`) and simply **flag the credential-blocked bit inside the PR** rather than stopping. The known CI red X is the empty `SONAR_TOKEN` repo secret — expected, not a code problem.
- **Keep each block green locally** (test / lint / type-check / build / format) before opening a PR.
- **Only surface a decision** if a change is genuinely destructive or irreversible (see git guardrails). Otherwise proceed and report in the PR.
- Guardrails still apply: no destructive commands, no secrets in code, explain global-file impact in the PR.

## What this project is

This repository currently contains a static website (multiple HTML pages + theme CSS files) and a small Node/Express server used to run the site locally. It’s evolving toward a multi-site e‑commerce platform.

## Origins (how it was built)

- Built from a “human in the loop orchestrating AI” workflow.
- A lot of code was created by iterating with AI, copying code between browser/editor, and patching issues as they appeared.
- This explains why the project historically accumulated:
  - placeholder files
  - backup folders
  - duplicated structures
  - partially-integrated features

On 2026-04-28 we performed an aggressive cleanup by archiving redundant content locally (not committed) to reduce clutter and make the project easier to evolve.

## Current goals (where this is going)

High-level objective:

- Build a curated expert shop e‑commerce engine with a private trust/QA layer.
- Run ~14 branded storefronts from one shared codebase.
- Each storefront has its own branding + SEO content and focuses on two niches.
- Pivot category focus from lingerie toward home tech.
- Use Stripe (or similar) for checkout.
- Add memberships with tiered perks (membership is optional; customers can still buy without it).
- Optimize for mobile + desktop performance and SEO.
- Support marketing workflows (TikTok/IG) via Gumloop and other automation.

Operating model (for now):

- Fulfilment is dropship (no staff). Overheads are mainly domains + hosting + payment processing fees + lightweight SaaS (e.g. email tool).

### Standing goal: fully data-stitch the site (single customer view)

Every visitor/buyer should be tracked as one stitched record across the whole funnel, so we can measure real pick-up/profit and later plug marketing tools (Mailchimp first) straight in. This is now an active goal (previously parked under "Later"):

- One `customers` record per person (per tenant) as the source of truth: email, first/last seen, order count + total spend, first-touch UTM, subscribe state.
- A unified `email_events` timeline stitching `cart_captured` → `nudge_sent` → `order_completed`, so each nudge and each sale ties back to the same person and cart.
- Link the currently-disconnected pieces: `cart_emails` (capture) and `orders` (Stripe webhook) share only an email today; add conversion attribution (`converted_at`, `converted_order_id`, which nudge won).
- Build the outbound sender as a provider adapter so **Mailchimp** (and others) can be wired in later without touching the funnel logic.
- Add a 3rd, later "payday" win-back nudge (gated, no/low discount, suppress purchasers) once tracking exists to measure it.
- Keep it privacy-safe and tenant-scoped so all 14 sites share one dashboard.

### Standing requirement: site-wide speed (no compromises)

Everything on the site must feel instant — click-throughs, page loads, images, and video — across desktop and mobile, and this is a hard gate, not a nice-to-have. Build for speed without sacrificing features or trust:

- Hold every page to the 2025 Core Web Vitals targets already in the rules: **LCP < 2.0s, CLS < 0.1, INP < 200ms**.
- No feature ships if it regresses performance — performance is part of "done", checked before merge.
- Techniques (add as blocks): responsive/lazy images (AVIF/WebP + width-based srcset), lazy-loaded + poster-first video (never autoplay heavy assets), route/click prefetch on intent (hover/touchstart), code-splitting and deferring non-critical JS, critical-CSS inlining, HTTP caching + CDN edge delivery, and font-display swap.
- Measure continuously: a CWV/pulse dashboard + budget check in CI so regressions are caught automatically.
- Video specifically: adaptive/compressed sources, lazy mount, and schema markup — rich media must not cost us load speed.

### Standing goal (later): tiered rewards / loyalty programme

Add a membership-style rewards ladder to drive signups, repeat purchases, and an owned audience:

- **Bronze** — awarded on first signup when the customer subscribes and provides their email (unlocks personalised email blasts).
- **Silver → Gold → Platinum → Black** — higher tiers earned by spend/orders/engagement, with escalating perks (free shipping, early access, bigger discounts, concierge).
- Sits directly on top of the data-stitch `customers` record (spend/order totals already tracked there) and feeds the email tool (Mailchimp) for tier-based segmentation.
- Keep it lightweight at first (no heavy account system); privacy-safe and tenant-scoped so all 14 sites can share the engine.

### Standing goal (later): Breeders track (prestige + higher AOV)

Add a trade/breeder tier to give the site real prestige and lift order value:

- **Breeder's Starter Kit** — a curated multi-pet / bulk bundle SKU (e.g. whelping/new-litter comfort + monitoring essentials) using the existing bundle engine.
- **Breeder bundles** — tiered bulk bundles (small cattery/kennel → professional breeder) with trade-appropriate pricing hooks (guardrailed dynamic pricing / trade discount, display-layer only — never a display↔charge mismatch).
- **Breeders landing page** — dedicated trade positioning page: credibility/trust cues (quality control, safety, warehouse/dispatch), bulk value proposition, and a breeder application / trade-enquiry capture wired into the data-stitch (`customers` + `email_events`, tagged `segment=breeder`) so it feeds tiered email segmentation later.
- Sits on the same catalog + data-stitch + email-provider seams already built; no new credentials required to scaffold. Real trade pricing/terms and any verification step are a later, user-gated decision.

### Standing goal (later): Show Dog track + specialist/segment landing pages

Mirror the Breeders track with a **Show Dog** landing page and, more broadly, treat specialist segments as first-class:

- **Show Dog landing page** — speciality content + curated bundles + pro/specialist equipment (show grooming & conditioning, ring kit, transport/crates, coat care), value→premium ladder.
- **Show Cat landing page** — cat shows are a real prestige scene (TICA/CFA/GCCF, "Supreme" shows): specialist content + bundles + kit (show grooming/coat conditioning, benching pens/show cages, transport carriers, calming aids for the show hall), value→premium ladder.
- **Breeders page** gets the same specialist-equipment treatment (whelping, monitoring, bulk husbandry kit).
- **Broaden beyond the pets themselves** — merchandise for _the people and the products they use_, not only the animals: a full range from **value to premium** (everyday shampoos/consumables → elite collars, leads, show equipment). Position clear "good / better / best" tiers per category.
- Reuse the shared landing-page template + bundle engine + data-stitch (segment tags: `show`, `breeder`, `pro-groomer`, etc.) so each segment page is content + collection config, not bespoke code.
- Real specialist SKUs, pricing and supplier sourcing are a later, user-gated decision; scaffold the pages, collections and bundles first.

### Standing goal (later): more audience landing pages (dog walkers, pet sitters, multi-pet)

Extend the segment-landing-page engine to more real-world audiences, each with tailored content + bundles:

- **Dog Walkers** — pro kit for people walking multiple/other people's dogs (multi-lead systems, hi-vis/night-walk safety, waste/hygiene, weatherproofing, GPS/ID).
- **Pet Sitters** — kit for looking after clients' pets (monitoring cameras, feeding/scheduling aids, calming, safety/containment, handover checklists).
- **Multi-Pet Harmony (cats + dogs together)** — products that reduce conflict and encourage safe co-existence and mutual play/engagement (separate feeding stations, high perches/escape routes for cats, gates/zoning, scent-neutral introductions, interactive/co-play toys, calming aids).
- Same pattern as Breeders/Show Dog: shared landing template + bundle engine + data-stitch segment tags (`dog-walker`, `pet-sitter`, `multi-pet`), value→premium tiers, enquiry/email capture. Content + collections, not bespoke code.

### Sub-plan: Roxjaya / Hyrox Warriors Jakarta (coaching tenant, PR #42)

A coaching business (not a product shop) running on the same engine: tenant config, Stripe checkout + webhooks, Postgres orders → customers data-stitch, email capture, UTM attribution, SEO tooling. Owner: Dina (Hyrox podium athlete, Jakarta PT, ~16 clients). Deadline driver: baby due 1 Feb — she needs floor hours off her plate before then. Launch small, bill monthly, let SEO build the premium tier.

What exists (PR #42): static landing pages `roxjaya/index.html` (Roxjaya Warriors, split hero) and `roxjaya/alt.html` (Hyrox Warriors, full-bleed sled-pull hero — recommended as the home page), Dina's own photos, Ask Dina form posting to `/api/capture-email`, nav (Ask Dina, Chat Zone, Upcoming Events, Stations Prep, Run Zone, Subscriptions, Merchandise). No tenant entry, no billing, no chat/events/merch backend yet.

Pricing ladder (positioning hypotheses, IDR/month; anchored to her current Rp 350k/session local and Rp 750k/session expat rates):

- Warrior Program (self-serve programming) — Rp 599k
- Hybrid Coaching (online + 2 floor sessions) — Rp 2.5m (migration path for current clients)
- Elite Race Prep (12-week build, 3-month minimum) — Rp 6m (SEO-led, no hard sell)
- Athlete Mum (pre/postnatal Hyrox) — after Feb; her own story is the content

Delineation rule (agreed): Roxjaya may only touch the shared engine through seams that already exist for multiple sites (tenant entry, checkout/webhooks, email capture, sitemap). Everything else — pages, CSS, images, copy — lives under `/roxjaya/`. Any engine change made for Roxjaya must be generic (e.g. a recurring-billing mode, not a "Roxjaya subscription"). If it ever needs more than that, fork it into its own repo rather than intertwine.

Build blocks (atomic, in order — each ends with a preview check and 3-step browser test):

1. **Tenant + home page** — DONE (PR #42). Add `roxjaya` to `data/tenants.json` (IDR, brand, SEO meta, `vertical: "coaching"`); promote the chosen layout to `/roxjaya/` home; retire the unused layout to a comparison page. Global touch: tenant loader must tolerate a non-pet vertical (skip petType/safety validators). _Local_ otherwise.
2. **Recurring billing** — DONE (PR #42): `kind: "service"` products with `billing.interval`; checkout picks `mode: "subscription"` when every item is recurring (mixed carts rejected); `subscriptions` table (migration 005) + renewals land as paid orders; Program/Hybrid buttons live, Elite stays enquiry-only. **Stripe deferred (Chris's call, to revisit when he has time to get a key):** untested against a real Stripe account; needs `STRIPE_SECRET_KEY` + webhook secret and migrations 005/006 run on the DB. Until then plan buttons show a friendly "checkout isn't open yet" note. Original spec: Stripe Checkout `mode: "subscription"` on the shared engine + `customer.subscription.created/updated/deleted` and `invoice.paid/payment_failed` webhooks; plans as tenant-scoped price IDs; orders/customers stitched exactly like one-time orders. Global change (also unlocks "membership tiers" for the pet sites). Guardrail: server-authoritative prices, integer minor units.
3. **Payment adapter for locals** — Xendit (QRIS / e-wallet recurring) behind the same checkout interface; Stripe stays for cards/expats. Blocked until Dina/Chris choose the entity + provide sandbox keys — do not fake it.
4. **Ask Dina capture → data-stitch** — DONE (PR #42): `/api/capture-email` now accepts a generic `profile` object (sanitised: bounded strings/lists/numbers/booleans, max 24 keys) and a `message`; profile merges key-by-key into `customers.profile` (jsonb, migration 006); non-cart captures log a `lead_captured` event (profile + message + medium) instead of `cart_captured`. Roxjaya: Ask Dina posts email + question, then reveals a 30-second questionnaire (goal, race date, experience, days/week, city, handle, injuries/pregnancy notes) posted as `profile`. UTMs from TikTok/IG links pass through. Not yet: confirmation email via the provider seam.
5. **Zones as content silos** — DONE (PR #42): `/roxjaya/stations-prep/` (all 8 stations, women's Open/Pro standards, pacing, one cue each), `/roxjaya/run-zone/` (8 × 1 km pacing, compromised running, Jakarta heat, sample week), `/roxjaya/events/` (confirmed dates only — inaugural Jakarta 27–28 Jun 2026; later dates TBC; meet-ups; 12-week cohorts). Article/Breadcrumb/FAQ JSON-LD, interlinked, home nav/zone cards point at them. Engine (generic): tenants may declare `seo.staticPages` for their sitemap (pet default list unchanged); `/roxjaya/:slug/` serves `roxjaya/<slug>.html` with a strict slug check + 301 to trailing slash. Not yet: Indonesian-language versions, `Person`/`Service` JSON-LD, per-tenant robots.
6. **Athlete dashboard (thin)** — logged-in page showing plan, next payment, programme link (Google Sheets / TrueCoach / WhatsApp — coaching delivery is NOT built here), cancel/pause via Stripe customer portal.
7. **Chat Zone + Merchandise** — PARTLY DONE (PR #42): Chat Zone links carry `data-whatsapp=""`; `app.js` turns them into a `wa.me` deep link the moment Dina's number (international format) is put in that attribute — until then they fall back to Ask Dina. Merchandise section has a responsive photo slot + "tell me when it drops" CTA; SKUs not built. Pending: Dina's WhatsApp number.
8. **Ops + automation** — subscription health in the admin dashboard (MRR, churn, failed payments), alerts on `payment_failed`, CWV check for `/roxjaya/` in the existing pulse job.
9. **Premium sports-site features** (approved by Chris) — IN PROGRESS (PR #42):
   - **Indonesia Results board** — DONE: `/roxjaya/results/` ranks Indonesian finishers by time for Women, Men, Women Doubles, Men Doubles, Mixed, Relay; data lives in `roxjaya/data/results.json` (one row per finish; page sorts, empty divisions show "send us your time"); name search; Dataset/FAQ/Breadcrumb JSON-LD; source credited (official Hyrox results) + correction/removal route via Ask Dina/IG. Seeded with Dina's confirmed results only. **Data blocker:** results.hyrox.com and hyresult.com both return 403 to automated access — do not scrape around it; populate manually from the official boards (copy Indonesian finishers into the JSON) or ask Hyrox/hyresult for an export.
   - **Pace calculator + next-race target** — DONE: Run Zone has 5k → Hyrox run pace / station estimate / finish window, and a "last two races → safe / realistic / stretch target" tool (rule of thumb, not a promise).
   - **Split analyser + databank** — DONE: `/roxjaya/splits/` takes 8 runs + 8 stations (+ Roxzone), flags strengths / weak stations vs the split profile your finish time predicts, run fade and hot start, and maps each weakness to what Dina coaches (guide anchor + plan). Every race is saved against the athlete's customer record (generic engine seam: migration 007 `submissions` + `customers.access_token`, `POST/GET /api/submissions`, anonymous `GET /api/submissions/stats`, kinds whitelisted per tenant in `tenants.json`). Athletes get a private bookmark link (no passwords) to compare their own races; everyone else sees anonymous medians per division, shown only once a division has ≥5 races. Tenant is resolved by hostname, so locally test at `roxjaya.localhost`. Dina sees submissions on the lead record (`email_events` type `submission`). Migration 007 must run in production alongside 005/006.
   - **Founding-member seats** — DONE: `roxjaya/data/seats.json` (Hybrid 12, Elite 4); line stays hidden until Dina sets `taken` to a real number — no fake scarcity.
   - **Fuel Zone** — DONE: `/roxjaya/fuel-zone/` (race week, night before, race morning, during, cramps, recovery, racing abroad; not-medical-advice note; Dina to approve).
   - **Per-plan SEO pages** — DONE: `/roxjaya/warrior-program/`, `/roxjaya/hybrid-coaching-jakarta/`, `/roxjaya/elite-race-prep/` (who it's for, included, typical week, FAQ; Service+Offer/Breadcrumb/FAQ JSON-LD; checkout button + seats on page; product canonicalPaths point here; linked from plan cards + sitemap).
   - **Brand: Roxjaya Warriors Jakarta** (was "Rox Zone Warriors Jakarta") — "Rox Zone" is HYROX's generic term for the transition area and is already taken by roxzone.training (Porto online Hyrox coaching), rox.zone® (equipment) and roxzone-og.com (Hamburg gym). "Roxjaya" (Rox + _jaya_ = victory) is a unique string; roxjaya.com unregistered and @roxjaya free at time of check — register before announcing. Tenant id, folder and URLs are now `/roxjaya/`; the word "Roxzone" survives only where it means the race transition area (splits payload key `roxzone`, guide copy). Masthead carries a script "by Dina Rosdiana" signature (Caveat via Google Fonts); Person JSON-LD uses her full name.
   - **Warriors Wall** — DONE: IG-style photo wall on the home page (`#wall-photos`), tilted polaroids with the athlete's own caption in script, grouped by event tabs, tap → lightbox. Data: `roxjaya/data/gallery.json` (Dina adds a row once she has the photo + OK; empty list hides the section). "Send your shot" form saves caption/name/event/consent as generic submission kind `wall_photo` on the lead record, then opens WhatsApp (once the Chat Zone number is set) for the photo itself — no public uploads, nothing goes live unmoderated. Photos into `roxjaya/images/gallery/`.
   - **Language** — English only at launch (Jakarta Hyrox crowd is English-comfortable; avoids splitting SEO). Ask Dina carries a Bahasa invite line. Revisit at 3 months: Bahasa keyword pages ("latihan hyrox", "pelatih hyrox jakarta") if enquiries skew Bahasa.
   - **Taper Zone** — DONE: `/roxjaya/taper-zone/` (why taper, two weeks out, race-week day-by-day, what to keep sharp, sleep + travel, race-week checklist; links Fuel Zone / Run Zone / Split analyser; Article + FAQ + Breadcrumb JSON-LD; Dina to approve).
   - **Strength Zone** — DONE: carry-over lifts per station on Stations Prep (Bulgarian split squat, trap-bar DL, suitcase carry, hip thrust, etc.); Dina to approve.
   - **TrueCoach delivery** — DECIDED (Chris): coaching delivery lives in TrueCoach (stock video library + Dina's own clips). Plan cards say "delivered in the TrueCoach app"; footer "Athlete login" link reads `roxjaya/data/links.json` → set `truecoach` to her login URL once the account exists (hidden until then). Dina to run the free trial first.
   - **HYROX Certified Coach badge** — DONE (provisional): hero, bio, plan cards, guide bylines and Person JSON-LD say "HYROX Certified Coach". **Dina to confirm the exact certificate title** (Chris: "pretty sure it's the certified coach"); it's plain text in the roxjaya HTML files, one find-and-replace to correct.
   - **Maternity window** — DONE: Hybrid card note + "How does coaching work while Dina is pregnant?" FAQ under the plans (floor sessions → live video form reviews or banked, ~Jan–mid-Mar 2027; Program/Online unchanged).
   - **Results wall + Dina's week** — DONE: home `#wall` section driven by `roxjaya/data/wall.json` (`athletes`: consented before/after results; `weeks`: dated notes, latest 3). Section hidden when both lists are empty. Seeded with Dina's own doubles progression only — add clients only with their OK.
   - **Race countdown** — DONE: `/roxjaya/events/` shows a days/hours/min countdown when `roxjaya/data/events.json` → `next` has a confirmed `{ name, date, url }`; `null` keeps it hidden. Confirmed dates only.
   - **Analytics + Coach's desk** — DONE: generic, tenant-opt-in page-view log (Global: migration 008 `page_views`, `src/analytics.js`, `POST /api/pageview` — no cookies/IP/UA, daily-rotating random visitor code, path + referrer host + utm only; email stitched onto a view only when the browser holds the athlete's own private submissions token). Admin endpoints `GET /admin/traffic?days=` (views/visitors by day, top pages, top sources) and `GET /admin/people?days=&limit=` (each customer: profile, submissions, events, subscriptions, identified page journeys). Only `roxjaya` has `analytics.pageviews: true` in `tenants.json`; pet tenant unchanged. Roxjaya: beacon in `roxjaya/app.js`; private `/roxjaya/coach/` (noindex; coach key = `ADMIN_API_KEY`, stored on device) with Today action list, Traffic, People and a plain-English "How to…" handbook (mirrored in `roxjaya/HANDBOOK.md`). Deep links `#people?q=wall_photo` etc. are the targets for the weekly digest. Migration 008 must run in production.
   - **Start-here quiz** — DONE: submitting the Ask Dina questionnaire shows a "Your zone" card (Program / Hybrid / Elite + one-line reason, CTA to `#plans`, recommended card outlined) and stores `recommended_plan` on the lead profile. Rules live in `roxjaya/app.js` (`recommend()`): elite for podium goal or racers <16 weeks out; Hybrid for Jakarta-area first-timers/PB/doubles/pregnancy; Program otherwise or for 2 days/week.
   - **Asia Race Planner** — DONE: `roxjaya/data/cities.json` (Jakarta home race + Singapore, Seoul, Hong Kong, Bangkok; race dates only when `status: confirmed`, each with source URL and a `checked` stamp; hotels/fares/food are labelled approximate ranges; per-city `meetup` slot hidden until set). `roxjaya/planner.js` renders `/roxjaya/hyrox-jakarta/` (dedicated home-race page: existing `events.json` countdown + guide + "train for it") and `/roxjaya/race-planner/` (next-race banner, season list, tabbed city guides, `#slug` deep links). Both in nav/footer/sitemap. Jakarta 2027 date not announced — page says so; countdown lights up via `events.json`.
   - **Automation: approve queue + daily date check + Monday digest** — DONE (Global, generic, tenant-opt-in via `tenants.json` → `automation`): `src/inbox.js` (candidate kinds `event|news|alert|sponsor`, stable keys, dedupe, ignored items re-open only if they change, JSON patches restricted to `automation.writable` files); admin routes `GET/POST /admin/inbox`, `POST /admin/inbox/:id` (approve applies patches, ignore), `GET /admin/digest`, `POST /admin/digest/send` (uses existing alert-email path; `automation.digestTo` → `ALERT_EMAIL_TO` fallback; no-ops safely without mail). Only `roxjaya` opts in (`roxjaya/data/inbox.json`; writable = `events.json`, `cities.json`); pet tenant unchanged. `roxjaya/automation/hyrox-sync.js` (`.github/workflows/roxjaya-sync.yml`, daily 22:15 UTC + Monday digest; needs secrets `ROXJAYA_SITE_URL`, `ROXJAYA_ADMIN_KEY`, dry-run otherwise) reads the official `hyrox.com/wp-json/wp/v2/event` list, filters Asia-Pacific adult races, parses `event_date_*`/address from each official event page, and posts candidates: new/changed race → event candidate with city-guide patch (+ `events.json` countdown patch for Jakarta only); unparseable page → alert (fail-loud, never guesses); once a tracked race has finished (checked for 10 days) → results reminder (official results block bots; manual copy stays the rule). Nothing touches public data until Dina taps "Approve & publish" on the Coach's desk (Today → "Waiting for your OK", `#inbox`). News and sponsor candidates ride the same queue later.
   - **Hyrox Asia news feed** — DONE: `/roxjaya/news/` (`news.html`/`news.js`, renders `roxjaya/data/news.json`, newest first, headline + summary + optional "Dina's take" + source link with `nofollow`). `roxjaya/automation/news-sync.js` (daily, same workflow) reads `hyrox.com/feed/` + a Google News RSS search scoped to Asia cities, keeps ≤14-day Hyrox stories that mention Asia, drops sensitive headlines (deaths/doping/lawsuits…), dedupes against published + seen headlines, caps at 4/run, and posts `news` candidates with `editable: [summary, take]` and a `prepend` patch into `news.json`. Engine additions (Global, generic): candidate `editable` fields, `applyEdits(item, edits)` (only declared fields, land on `data` + patch values), patch `op: set|prepend` (prepend replaces by `id`, capped 200); `POST /admin/inbox/:id` accepts `{ action, edits }` and refuses to publish a news item with an empty summary. Coach's desk shows textareas for the editable fields on the card; Dina writes the 2–3 lines herself (Google-safe: curated, her words, a handful a week — no auto-rewriting). Summaries can't be auto-drafted because Google News links don't expose article text to a bot.
   - **Jakarta Hybrid Scene** — DONE: `/roxjaya/jakarta-hybrid-scene/` (`jakarta-hybrid-scene.html`/`scene.js`, FAQ JSON-LD) renders `roxjaya/data/scene.json` with All / Race it / Watch it filters (`#race`/`#watch` deep links). Items are typed `race|sim|brand|venue`; dated ones sort first, past editions greyed with a "kept for reference" line; `date` only when seen on the organiser's page, otherwise blank + `when` text. Seeded from verified sources (checked 2026-09): AirAsia HYROX Jakarta (27–28 Jun 2026, NICE PIK2; 2027 TBC), Jakarta Hybrid Race @ Indonesia Sports Summit (20FIT × Kemenpora, 11–13 Sep 2026, JICC GBK Hall A, half-sim), PUMA Road to HYROX (selection team + 20FIT Arena sims; dates TBC), 20FIT Arena Menteng, Fitopia Meruya hybrid arena (announced Q4 2026), Roxjaya squad sim. No Amazfit event listed — only watch/partner marketing found, no Jakarta event. `scene.json` is not yet on the approve-queue `writable` list; add it when a scene-sync job exists. Shape test: `tests/roxjaya-scene.test.js`.
   - **Sponsorship rails** — DONE: 3 monthly `kind: service` products in `data/products.json` (`attributes.sponsorSlot` = `results|planner|partner`, IDR 3.5m/2.5m/1.5m working hypotheses) sold through the normal subscription checkout. `/roxjaya/advertise/` (`advertise.html`/`advertise.js`) lists slots from products.json, saves brand/link/logo/tagline as a `sponsor` submission, then starts checkout with the same email. Global (generic, tenant-opt-in via `automation.partners`): `src/sponsors.js`; on `checkout.session.completed` a paid order containing a sponsor product becomes a `sponsor` inbox candidate (editable name/url/logo/tagline; approve refuses an invalid link), approve prepends a row to `roxjaya/data/partners.json` with `until` = paid+31d; `invoice.paid` renewals extend `until`; lapse = row hides itself. `roxjaya/partners.js` renders `[data-partners=slot]` mounts (results/splits, planner/Jakarta, footer strip on every page) and beacons `/roxjaya/out/<id>` clicks; `summarizePageviews` now returns `outbound` (shown as "Sponsor clicks" on the desk). Pet tenant unaffected (no `automation.partners`).
   - Queue: "Book Dina" page (appearances list + inquiry form) — agreed light version, not started.

Open decisions (user-gated): confirm public prices (599k / 2.5m / 6m are working hypotheses); real hero stats (podiums, athletes coached); payment entity (UK/SG Stripe vs Xendit); real domain; IG/TikTok handles; event dates. Do not invent any of these.

Definition of "launched": tenant live on its domain, one Hybrid subscription taken by a real current client end-to-end, Ask Dina capture landing in `customers`, LCP < 2.0s on the home page mobile.

Direction note:

- We have pivoted away from the “mini‑Amazon” framing. The target experience is curated (limited, quality-controlled catalog), trust-first (clear safety/fit/shipping/returns), and automation-first (dashboards + guardrails so it runs with minimal day-to-day involvement).

## Visual system (current direction)

The storefront's look is driven by ONE shared template so changes cascade site-wide:

- **`styles/premium.css`** — design tokens + component styles (fonts, palette, spacing/framing, buttons, cards). Every page links it; edit here to restyle the whole site.
- **`styles/premium.js`** — progressive enhancement only: `pawObserveReveals` (staggered scroll reveal) and `pawDisplayTitle` (strips functional `(Demo)`/`(Placeholder)` tags from displayed product names).

Design decisions (2026-08, after a full reset from a blank slate — the earlier Fraunces/warm-paper/teal-amber/paw-burst "premium" system was discarded):

- **Neutral base** — system font stack, greyscale ink/paper palette, clean framing tokens. Simple and elegant, not "functional".
- **Single accent — oxblood red** (`--accent: #9b3b32`, `--accent-600`, `--accent-100`). Used sparingly: primary buttons, button-outline hovers, links, kicker/eyebrow labels. Re-tint the whole site by swapping those three tokens.
- **Buttons** — clean white/outline with a hint of shadow; primary = solid oxblood fill.
- **Homepage hero** — responsive two-column: copy + a framed pet photo (`/images/hero-pet.jpg`, hairline border + soft drop shadow). Photo is a self-hosted, license-safe placeholder → swap for real photography later.
- **Hero motion** — the photo slides in from the right + fades in once on load (GPU transform/opacity, zero CLS); disabled under `prefers-reduced-motion` (photo simply shown). Gated behind `body.js-reveal` so no-JS/reduced-motion users always see it.

Guardrails kept: `/images2/` legacy assets untouched but guarded from rendering as product photography; reduced-motion + no-JS safe; CWV budgets (LCP < 2.0s, CLS < 0.1, INP < 200ms) respected.

## What works right now (confirmed)

Stripe checkout is working end-to-end locally:

- Shop page renders products and can add to cart.
- Cart page shows items and has a working Checkout button.
- Clicking Checkout creates a Stripe Checkout Session server-side.
- Stripe redirects back to a local success page.

Pages:

- Home: http://localhost:3000/
- Shop: http://localhost:3000/shop.html
- Cart: http://localhost:3000/cart.html
- Success: http://localhost:3000/success.html

## How to run locally

1. Install dependencies

- npm install

2. Create a local env file (DO NOT commit)

- Create .env.local in the project root:
  STRIPE*SECRET_KEY=sk_test*...

3. Run the server

- npm start

## Local Stripe checkout runbook (repeatable test)

Terminal setup:

- Terminal A: npm start (server)
- Terminal B: stripe listen --forward-to localhost:3000/stripe/webhook (webhooks)
- Terminal C: free terminal for curl commands

Happy-path browser flow:

- Open: http://localhost:3000/shop.html
- Add item(s) to cart
- Open: http://localhost:3000/cart.html
- Click Checkout and pay with Stripe test card 4242 4242 4242 4242

Confirm in terminal (admin API):

- List orders:
  curl -i -H "x-admin-key: <ADMIN_API_KEY>" "http://localhost:3000/admin/orders"
- List paid orders only (clean view):
  curl -i -H "x-admin-key: <ADMIN_API_KEY>" "http://localhost:3000/admin/orders?status=paid"
- Inspect one order (replace <ORDER_ID>):
  curl -i -H "x-admin-key: <ADMIN_API_KEY>" "http://localhost:3000/admin/orders/<ORDER_ID>"

Env / secret sanity check (admin-only):

- Confirm which secrets are set (does not reveal secret values):
  curl -i -H "x-admin-key: <ADMIN_API_KEY>" "http://localhost:3000/admin/env"

Admin key rotation (local):

- Generate a new random key
- Update ADMIN_API_KEY in .env.local
- Restart the server
- In the browser, open /admin.html and click “Clear saved key”, then paste the new key and click “Save key”

What “good” looks like:

- Stripe CLI shows 200 POST http://localhost:3000/stripe/webhook
- /admin/orders returns HTTP/1.1 200 OK
- The newest order shows status: paid

## Project framework (current structure)

- index.html
  - Current landing/brand page (does not run the store).
- shop.html
  - Simple product listing page that uses script.js to render products.
- cart.html
  - Cart UI wired to script.js; includes Checkout and Clear cart buttons.
- success.html
  - Return page used by Stripe Checkout success_url.
- script.js
  - Product list rendering, cart storage (localStorage), and checkout trigger (calls /create-checkout-session).
- server.js
  - Local Express server.
  - Serves static files.
  - Implements POST /create-checkout-session using Stripe.
  - Loads STRIPE_SECRET_KEY from .env.local.
- themes/
  - Theme CSS files for branded variants.
- public/, images/, images2/
  - Static assets.
- PROJECT_STATUS.md
  - This file.

## Security / hardening (current state)

- Repo includes linting/formatting/testing tooling and CI workflow configuration.
- Secrets are kept out of code by using .env.local (gitignored).

## Recent cleanup (archive)

A local-only archive was created at:

- archive/2026-04-28/

It contains backups, generated outputs, placeholder files, and other redundant content moved out of the project root.

## Known constraints / caveats

- The current store/cart implementation is minimal and uses localStorage.
- A persistent order database is implemented (Postgres).
- Stripe webhooks are implemented for reliable payment confirmation.
- Many pages still contain placeholder content and will be redesigned for the home-tech pivot.

## SEO resilience (plan)

- Expect SEO volatility and design the platform to be resilient.
- Build real topical authority per site/niche (not thin product pages).
- Maintain strong technical SEO foundations: canonical URLs, structured data (Product/Review/FAQ), and fast mobile performance (CWV).
- Build an “owned audience” early (email capture + lifecycle emails) to reduce dependence on search.
- Diversify discovery over time (SEO + light paid validation + organic social), without relying on any single channel.
- Treat supplier/merchandising automation as drafts-first with guardrails to avoid publishing low-quality pages at scale.

## Agentic operations (automation + dashboards) (plan)

Goal: make the business runnable with minimal day-to-day involvement by adding automation + dashboards (not risky “AI chat” that can hallucinate promises to customers).

Recommended order (safe and high ROI):

1. Ops dashboard + alerts

- Surface what needs attention: stuck pending orders, webhook missed, paid but not reconciled, payment failed.
- Daily digest summary: new orders, abandoned checkouts, failures.
- One-click actions for admin: reconcile order, mark shipped, view Stripe IDs.

2. Catalog QA autopilot (pre-publish checks)

- Block publishing unless required fields exist (petType, lifeStage, sizeRequirement).
- Enforce guardrails: integer minor-unit prices, safetyDisclaimer for tech, materials for wellness, warehouseLocation.
- Produce a simple “ready to publish” vs “blocked (missing X)” list.

3. Import + scoring automation (draft-first)

- Supplier feeds import to drafts.
- Hard filters + weighted scoring.
- Human approval required before publish.

4. Customer support triage (human-approved)

- Draft replies and categorize issues, but keep approval required to avoid wrong refunds/delivery promises.

Optional later blocks (only if/when we want them):

- Reviews + UGC system (upload/moderation, verified buyer, rich snippets)
- Community/social discovery (lists/boards, share flows, creator-style collections)
- Multi-seller marketplace layer (seller profiles, per-seller shipping, dispute flows)

Reminder note: revisit these optional blocks once the core store has stable traffic + reliable fulfilment + low support load.

## Implemented building blocks (open PRs, pending merge to `main`)

These are pure, tested modules already built and opened as focused PRs. They are
listed here so future sessions (and the iPhone read-only assistant) discover them
and do NOT rebuild them. Each is off `main` and independent unless noted.

Coverage / test foundation:

- src/product-utils.js, src/sitemap-utils.js + widened coverage gate (PR #9 supersedes #5-#8).

Data-stitch + lifecycle:

- migrations/004_add_customers_and_email_events.sql, src/data-stitch.js, capture + Stripe webhook wiring (PR #11).
- Gated 3rd "payday" win-back nudge, off by default (WINBACK_ENABLED, NUDGE_WINBACK_DAYS), logs to email_events (PR #13, stacked on #11).
- src/email-provider.js - console/mock/Mailchimp-stub adapter, no creds needed yet (PR #14).
- src/attribution.js + scripts/attribution-report.js - nudge to conversion last-touch report (PR #18).

SEO / marketing:

- robots.txt + src/robots.js generator (PR #16).
- src/related-products.js - relatedness ranking for internal linking / cross-sell (PR #22).
- src/product-feed.js - Google Merchant / Meta catalog items + RSS XML (PR #23).

Ops / quality / performance:

- src/catalog-qa.js + scripts/catalog-qa.js - pre-publish product validation (PR #15).
- src/order-health.js + scripts/order-health.js - stuck / at-risk order alerts (PR #20).
- src/perf-budget.js + scripts/perf-budget.js - client asset byte budgets, report-only (PR #19).

Experimentation / logistics:

- src/ab-test.js - deterministic weighted A/B assignment (PR #21).
- src/shipping.js - ships-from + delivery-window estimates by region (PR #24).

### Integration wiring backlog (unlocks once the above merge to main)

Most further value is wiring, not new modules - it needs the blocks above on
main first, otherwise CLIs/tests cannot import them:

- Route real nudge sends through email-provider (currently console-only).
- Render related products + ships-from label + delivery estimate on product/shop pages.
- Add a scheduled job/workflow to regenerate the product feed (mirror the sitemap workflow).
- Wire order-health and attribution into an ops dashboard / daily digest.
- Re-enable the widened coverage gate once the tested modules are on main.
- Revisit the server.js data-stitch path so a stitch DB error cannot 500 a paid checkout.

### Known external blockers (do not stop work - see autonomous-execution directive)

- Empty SONAR_TOKEN Actions secret is the only red X on every PR (SonarCloud step).
- No Mailchimp account/keys, no live Stripe keys, no live DB migration verification this session.

## Next milestones (in order)

Note: this layout is a working path, not a strict sequence. We will adapt as we learn what customers respond to, what SEO rewards, and what ops load looks like.

Next build block (queued):

- Content hub v2: build 2–3 more topical guides and interlink them from the shop and product pages. Then resume with local landing pages and ops dashboards.

Recently completed:

- Speed-to-profit: email capture + abandoned cart recovery with 1-day and 7-day nudges (email provider to be wired later).
- Checkout friction: payment methods are now configurable from env, and the trust strip accurately reflects Stripe + PayPal only when PayPal is enabled.
- Ads tracking + attribution: UTM capture, persistence, order/Stripe metadata, and admin visibility were already in place; plan updated to reflect this.
- SEO resilience v1: per-tenant sitemap.xml and robots.txt, product JSON-LD with reviews, UGC review videos, and one "Senior Dog Mobility" content hub page.

Future execution (not next; revisit after sitemap / schema):

- See AGENTS.md for the full SEO + nudge + automation backlog.
- Priority candidates: reviews on product cards (already partially in place), local landing pages, ops dashboard + alerts.

Speed-to-profit module (build blocks, in recommended order):

- Offer + trust strip across key pages (shop, product, cart): delivery window, returns promise, support response time, secure checkout
- Cart AOV lift: free-shipping threshold progress + 2–4 relevant add-ons (rule-based, pet-layer safe)
- Curated bundles / starter kits (problem-based: travel safety, home safety, anxiety, hygiene)
- Reduce checkout friction (when available in Stripe Checkout): enable Apple Pay + Google Pay + PayPal
  - Guardrail: only mention payment methods in the trust strip if they are actually enabled and visible at checkout
  - Risk note (future): dynamic pricing (frequent price changes, per-user pricing, inconsistent totals) can trigger fraud/risk flags at the payment gateway
    - Mitigation: price is always server-authoritative and signed; keep line items + shipping + taxes deterministic; avoid changing totals between cart and checkout; log/audit price rules; roll out gradually per tenant
- Ads tracking + attribution (minimal, privacy-safe):
  - Capture UTM params on landing (utm_source, utm_campaign, utm_content, utm_term) and persist per tenant
  - Attach attribution to orders + Stripe metadata (source of truth for paid ROI)
  - Track funnel events: add_to_cart, begin_checkout, purchase (server-side where possible)
  - Admin visibility: show utm_source/utm_campaign on orders list to spot what’s actually working
- SEO follow-on for bundles/kits (so bundles become real growth pages):
  - Create 1–3 kit landing pages (one page per kit) with problem-first copy and internal links to included products
  - Add dynamic kit FAQs (product-safe, pet-safe) + FAQ schema on kit pages for long-tail capture
  - Add ItemList schema on kit pages and strong internal linking (shop -> kits -> products)
- SEO machine v1 (2–3 solid pages/week, minimal ongoing effort):
  - Standard page templates:
    - Kit landing page template (problem -> solution -> included products -> FAQs)
    - Problem page template (single concern page that links to 3–6 relevant products)
    - Comparison page template (only where factual; avoid claims)
  - Publishing cadence:
    - Target 2–3 pages/week for Site #1 until first 30–60 pages are live
    - Start with kits + problem pages in the first niche silo
  - Measurement loop (low overhead):
    - Weekly check: Google Search Console impressions/clicks + top pages gaining traction
    - Track: pages published/week, pages indexed, top 10 queries per silo
- Build-your-own bundle tiers (e.g. 3 items = 10% off, 4 = 15%, 5 = 20% — only if margins allow)
- Proof stack on product pages (guarantee/warranty badges + “why trust this” claims; add real reviews/UGC later)
- Lead magnet + email capture (pet safety checklist / travel safety guide) + welcome email
- First-order incentive OR free-shipping threshold (choose one primary offer to avoid confusion)
- Problem-based collection navigation (shop by problem, not just product type)
- Abandoned cart email automation (delay + dedupe + 1–2 touches; provider: Mailchimp once onboarded)

Speed-to-profit module (extra tactics from UK/US leaders):

- Guided bundles (problem/concern-first): choose a goal first, then recommend a kit (avoid “pick anything” overwhelm)
- Gift-with-purchase thresholds (simple freebies at spend thresholds; often better than % discounts)
- Shipping protection toggle (optional add-on; choose provider later; keep wording careful)
- Proof upgrades: quantified claims (where justified), “as seen in”/awards (only when real), and clearer warranty/guarantee terms
- Membership-lite perks (later): free shipping + small extra discount; avoid heavy account complexity early
- Pet Passport (later, safe V1): no-login profile stored in browser + used for recommendations/segments
- BYO box / subscription-style bundles (later): discovery + repeats model; only after core store is stable

14-site viability foundations (bake in early, in logical order):

- Tenant/site separation (brand name, support email, currency, catalog allowlists) so each site can differ without forking code
- Canonical + redirect discipline so cloned sites don’t create duplicate-index chaos
- Shared ops events/flags so one dashboard can run the whole portfolio (orders + order_events + needs-attention)
- Offer system as configuration (free-shipping threshold, trust strip copy, first-order offer) so future sites can vary safely
- Product data guardrails stay strict (pet layer, safety/materials, warehouse/shipping) to prevent a low-trust “dropship farm” outcome

Later (only once traffic + ops are stable):

- Community/chat and engagement points
- Advanced personalisation (“others bought”), heavy AI recommenders
- Full single-customer-view CDP-style data stitching — NOW ACTIVE, see "Standing goal: fully data-stitch the site" near the top
- Tiered rewards / loyalty programme (Bronze → Silver → Gold → Platinum → Black) — see "Standing goal (later): tiered rewards / loyalty programme" near the top

Note: implement these as small, safe blocks. The exact order can adapt, but the general principle is: trust first, then AOV lift, then automation.

## Profit milestones (updated with shipping progress + add-ons + starter kits)

These features typically increase AOV and reduce checkout drop-off. They do not create traffic by themselves, but they improve the value of each visitor and make paid experiments/SEO traffic more profitable.

- $1k/month profit (Site #1): target month 4–6 after launch if publishing cadence (2–3 pages/week) is sustained and fulfilment/support is stable
- $2k/month profit (Site #1): target month 7–9 after launch once kit pages + problem pages begin ranking consistently (SEO machine v1)

Wallet payments impact note (Apple Pay + Google Pay + PayPal): if enabled and used by the audience, expect roughly ~0–1 month faster to $1k and ~1–2 months faster to $2k due to reduced mobile checkout friction.

1. Membership tiers (Stripe subscriptions)

- Decide tier count, names, pricing, and perks.
- Add a membership page and Stripe subscription checkout flow.
- Add a webhook endpoint (later) to confirm subscription status reliably.

2. Multi-site engine (14 sites from one codebase)

- Per-domain configuration: theme, copy, niche selection, SEO meta.
- Clear separation between "site config" vs "engine".

3. SEO + marketing foundation

- Unique landing pages per site/niche.
- Structured data (JSON-LD) strategy.
- Sitemap strategy for multi-site.

4. Dropshipper product ingestion (curated launch)

- Start with curated product lists (20–50 per niche).
- Upgrade to automated feeds after v1.

## Quick troubleshooting

- If checkout fails:
  - Confirm .env.local exists and contains STRIPE*SECRET_KEY=sk_test*...
  - Restart npm start
  - Retry: shop.html -> add to cart -> cart.html -> checkout
