# Billions

The venture file. Named for the destination; built for the journey.
Everything here is observation from the Oct 2026 strategy sessions —
what the machine is, what the maths says, and what the real competition
is doing.

## What we're actually building

Not a website company. Not a website generator. **A machine that produces
niche community platforms** — the factory (`reskin-tenant.js` + config +
assets) is the wedge; the community graph inside each tenant is the moat.

The pitch in one line: _"Your business's platform, already built — see it
before you pay."_ Demo-first, never promise-first.

## Station 9 — the platform's front door

Name: **Station 9**. ("The 9th station is the community" — the name _is_
the pitch.) Needs its own site — the product's window display — housing:

- The pitch + the three live demos as proof (Hustle, RTF, Hannah —
  _that's what the demos are for_)
- Pricing + the intake form as the CTA
- The walk-in/DM follow-through: _"here's what I'd build you → fill this in"_

Distribution hack: subtle "Site by Station 9" footer credit on every
tenant — every member of every client gym is a lead. Keep it subtle —
Bobby's demo must feel like _his_ site, not our ad.

## The intake pipeline (form → site)

Today: ~1 hour of skilled labour per reskin (research IG, screenshot
photos, hand-write config, run script). Pipeline drops that to watching
a dashboard:

1. **Intake** — form fields map 1:1 onto config JSON (brand, coach, city,
   colours, offer/prices, three voice questions)
2. **Assets** — photo _uploads_ over IG scraping: prospects know their
   best shots, better quality, zero ToS-grey. Slot by role (hero, coach
   portrait, action, group), not content
3. **Voice** — the hard bit. LLM drafts brand-voiced copy from their bio
   - three answers; eyeball once before publish
4. **Build** — form → JSON → reskin script → job queue →
   `prospectslug.yourdomain.com` (DEMO_BASE_DOMAIN mechanism already works)
5. **Preview → pay → publish** — free to look and tinker; Stripe checkout
   unlocks publish. Money enters before we ever spoke to them
6. **The platform bit** — RSVPs, results, boards live inside the site →
   £60/mo becomes switching cost, not hosting

Staging: **v1 concierge automation** (form → config draft → I check →
script → hand-sent link — kills 80% of my time, everything exists except
the form) → **v2 self-serve** (scrape/upload + LLM voice + Stripe publish
gate) → **v3 operator** (tenant dashboards, churn alerts, add-on
self-serve; I'm the frame observer, exceptions only).

## The trillion-dollar backwards maths

£1B outcome ≈ £125M ARR at ~8× ≈ **~175,000 clients at £720/yr**.
There are maybe 5–10k HYROX-affiliated gyms on Earth → HYROX alone tops
out at **£3–7M ARR**. The niche is the wedge, not the prize.

| Years   | Stage              | Shape                                                                                                        | Money        |
| ------- | ------------------ | ------------------------------------------------------------------------------------------------------------ | ------------ |
| 0–0.5   | Validation         | UK HYROX blitz — 100+ demo pitches (build is no longer the constraint), 20–50 clients, conversion-rate proof | £15–60k      |
| 0.5–1.5 | Niche domination   | UK+EU HYROX, self-serve live, remote-close motion proven                                                     | £100–400k/yr |
| 1.5–4   | Category expansion | All boutique fitness (~30–60k gyms)                                                                          | £1–10M ARR   |
| 4–7     | Platform           | What gyms _run on_ — member graph, payments                                                                  | £10–50M ARR  |
| 7–12    | Billion or bust    | Default OS for an industry segment                                                                           | £125M+ ARR   |

**Revision (post-factory proof):** the original 0–1 year assumed builds
paced the pipeline — wrong. Seven full tenant demos shipped in ~20
minutes of machine time; ~30 pitch-ready sites in 3 days is now
conservative, and Europe becomes a _weeks_ decision, not a year-two
one — the reskin machinery is already language-proven (extraPairs
carried Bahasa→English; a German/French/Spanish pack is config work,
not engineering). The binding constraint moved entirely to three
things: **conversion** (assume 10–20% of warmed demo pitches until real
data says otherwise — a great site is proof, not a signature),
**close-mode** (train-visit drop-ins are high-conviction but ~1/day;
EU scale needs the remote close — demo link + video call — to actually
work), and **retention load** (every yes is a site you now host,
monitor and keep alive — automation before volume, or churn eats the
arc). Revised honest ceiling for year one: 40–80 paying tenants if
conversion holds, which lands the niche-domination ARR a full year
early — _if_ the first ten demos convert at all. Sequence stays:
Hannah → Bobby → the seven → blitz.

The billionaire fork is ~year 3, and requires the product to mutate
twice: sites → community OS → industry infrastructure. "Very rich"
(£10–100M exit, 5–8 yrs) is achievable on this asset; billion needs the
second mutation.

## The solo-operator stack (what the machine needs)

Working backwards from "one person, giant P&L":

1. **Marginal cost ≈ zero** — template + config + AI labour (reskin script
   is exactly this). Trillion version automates _everything_; human only
   approves exceptions
2. **Sell outcomes, not tools** — nobody buys a website; they buy a gym
   that keeps members. £60/mo is retention infrastructure, not hosting
3. **Distribution through proof** — every shipped site advertises the
   next one; build the pull-in into the product (results walls, footer
   marks, community graphs)
4. **Moat = data + reputation, not code** — "AI builds sites" is already
   table stakes. Can't-clone: Hannah's podium record, Dina's voice, the
   accumulated member graph
5. **Boring rails early** — payments, onboarding, monitoring, inventory,
   tax. The part everyone skips; the part that determines whether you can
   _hold_ the revenue (why the four commerce gaps are being built
   properly now, not under client pressure)

## Why form→site hasn't worked for the big players

It exists: Wix ADI (2016), Durable, 10Web, Framer AI, Squarespace
Blueprint, Shopify's own AI onboarding. It's mostly **disappointed** —
generated brochure that does nothing, brutal churn, a graveyard of
"AI website builder" startups. The generation was never the product.

Our edges that generic builders can't copy:

- **Demo-first** — "here's YOUR site, built" beats "describe your
  business" every time; selling artifacts beats selling promises
- **Niche depth** — split analyser, race-mate boards, sim RSVPs. A HYROX
  coach sees their sport, not a tool
- **The ongoing system** — we sell what the site _runs_, not the site.
  Churn inverts when the community lives in it

Window: the "done-for-you niche platform" claim is rare for maybe
**6–12 months**, not forever — speed matters only if it fills the
pipeline; a head start without clients is just a head start.

## Shopify: steal, don't sidekick

Two lanes, both real:

- **Bolt-on** (Trojan horse): fast SEO storefront as the marketing layer,
  checkout stays Shopify. Operators already pay $40–200/mo for landing
  builders that do _worse_. Zero migration risk; every bolt-on is a
  replace candidate once trusted
- **Replacement**: simple merchants (domestic shipping, Stripe, no POS).
  Migration = a weekend. The gap list (tax, stock, discounts, accounts,
  order emails) is the floor for credibility — built ahead of first
  client, not after

Honest scoreboard — where we win: speed/CWV (structural, they can't fix
it without breaking the app ecosystem), SEO, cost shape (real Shopify
bill = plan + £100–300/mo of apps vs £60 all-in), multi-tenant by design,
automation-first. Where they still win: the long tail ("there's an app"
vs "I'll build it"), Shop Pay's saved-details edge, ecosystem momentum —
the real moat is gravity, not features.

Flagship symmetry: **Roxjaya proves community, Pawsense proves commerce.**
Shopify operators are the best possible demo-first market — they can
_count_ what a faster site is worth and already feel the same-box pain.

Don't build the rest of the gap speculatively — clients tell you which
10% matters. But make the Pawsense storefront tenant-parameterised like
the gym template so commerce reskins at gym speed.

**Steal customers, not features.** Feature-parity is a trap (8k apps, a
decade of edge cases). Nobody out-Shopify'd Shopify — the wins came from
wedges. Shopify won't notice for ≥6 months; the real enemy is our own
sales motion vs merchant trust (a broken checkout on our stack costs the
client revenue forever — hence boring-rails-first).

## Which trillion tracks we take (decided)

Verdict: stay on our path — niche platform with a data moat — but borrow
where it's free:

- **Track 1 (labour pricing): TAKE.** The receptionist bot isn't a
  "£25 chatbot add-on" — it's a front-desk hire. Reprice/repitch as
  _"your £25/mo receptionist"_ — payroll framing at our scale.
- **Track 4 (zero per-customer work): STEER INTO.** The reskin is our
  only per-customer cost; the intake form + voice engine + automation
  pipeline exist to zero it. Pushing there takes us ~3 of 4 trillion
  properties without a pivot.
- **Track 3 (outcome pricing): partial borrow.** Once we can measure
  RSVPs/leads captured, add a performance component to pricing.
- **Tracks 2 (machine customers), 5 (fully-digital markets): skip.**
  Physical gyms can't be digital — that's the moat's source.
- **Track 6 (distribution-first): already have** — demo-first IS
  distribution thinking; footer credit compounds it.

## Voice engine (planned)

Two layers — the separation is the product:

1. **Baseline** (learned): LLM pass over the client's IG captions, site
   copy, and intake answers → structured `voice.json` per tenant
   (vocabulary, rhythm, emoji habits, humour style, never-says).
   `VOICE.md` for Dina is the hand-written ancestor of this file.
2. **Dials** (declared): axes on top of the baseline — wit, warmth,
   energy, directness, polish. Their posts set zero; they push any axis
   past their own natural range. _"Sound like me but 20% funnier"_ =
   baseline + wit +2. Never breaks recognisability, lets them be a
   better version of themselves.

UX: not sliders — three draft variants per message (_like me_ /
_funnier_ / _funnier still_), pick = setting. Approval gate is always
"sounds like me." Plugs into: receptionist bot (first surface), email
nudges, caption lab (new drafting surface), reskin copy.

## The chat-plugin insight — redirected

Insight (real): chat history is the richest voice corpus that exists —
DMs are the _actual_ voice, not the performed one. And consumer demand
for "50% funnier" is proven (rizz apps: millions of downloads, 2023).

Consumer version rejected: WhatsApp/IG are closed (no API — the only
doors are keyboards that can't see incoming messages, or upload-your-
history GDPR friction), Meta is already baking AI into WhatsApp
(landlord eats feature — the rizz apps all died in ~18 months), and
"50% sexier" carries manipulation optics.

**Redirect (adopted):** WhatsApp _Business_ has a real API — and a gym's
members actually talk to the coach on WhatsApp, not the website.
Feature: **the receptionist answers the tenant's WhatsApp Business DMs
in the coach's voice** (booking, "what time is Saturday sim," trials) —
every reply deepens the voice profile. Turns the insight into a paid
tenant feature nobody else in the niche has, payroll-priced, and it
compounds the voice engine + community graph instead of renting Meta's
land. v3 pipeline piece.

## Shopify pitch — sanity check result

Conditional yes, not a blanket one. It works if: narrow target
(frustrated growth-stage D2C operators already paying for landing
builders or visibly app-bloated — they can _count_ the pain), demo-first
(rebuilt storefront they can't unsee + their Lighthouse vs ours),
bolt-on first (replace a Shogun/GemPages budget line, not their
checkout). It fails as generic "replace Shopify" cold DMs — that pitch
is the most crowded channel in e-commerce, and speed alone doesn't
close without a case study. Pawsense must produce numbers, or the first
commerce client _becomes_ the case study.

## Idea log — consumer outriggers (cheap experiments, never the core)

### Outrigger #2 — personalized AI newscaster

The pitch: pick the news you want, an anchor reads it — and knows you.
"It's Katie's birthday — happy birthday from all of us here at the
desk." The audience personalization (birthday sign-offs, your town,
your team) is the emotional hook nobody else has.

Validation: Channel 1 (channel1.ai) is literally building this —
personalized virtual anchors, adaptive story depth. Viral pilot
(#2 video on Crackle that weekend, 5M Twitter impressions day 1) but
their consumer product (Project Exo) still hasn't shipped ~2 years
later. Real broadcasters already run AI anchors (Aaj Tak Sana, Mexico
NAT, Doordarshan). So the idea is real — and it's a funded race where
the bottleneck is content licensing, not avatar tech.

Walls: BBC-style branding/content = trademark + licensing problem.
Video avatars cost real $/min/user. Deepfake optics — an app that puts
words in a newscaster's mouth is misinformation-shaped by design.

The moat version: **weekly community newscast per tenant, read in the
coach's voice/avatar.** "Three PBs at Saturday's sim, Maya turns 30
Sunday, Jakarta entries close Friday." We already own the data
(scene/events/results/matchboard) and there are zero rights issues —
it's the gym's own community. Content automation no website builder
offers; audio-first is cheap, avatar later. Same engine, owned
audience.

Decision: consumer version = outrigger idea, parked. Tenant bulletin =
real feature candidate after the voice engine exists.

### Outrigger #3 — sell the build service to agencies, not products to gyms

The pitch (as floated): agencies survive on cold DMs + homepage mockup
PDFs; we can ship a working reskin in under an hour. Sell them the
leverage.

Verdict — **parked, stay direct.** Three real problems:

1. Agencies smart enough to buy this are smart enough to see the engine
   and want it in-house. Revealing the turnaround speed starts a
   "hire/acquire/rebuild" negotiation, not a subscription.
2. Agencies buy capability, not outcomes — they'd want tooling, docs,
   SLAs. That's a B2B software pivot, not a pitch tweak; their roadmap
   becomes ours.
3. The direct model hasn't been tested yet (zero paying gym clients at
   time of writing). Abandoning the thesis on the first serious
   prospect isn't a pivot, it's a guess.

Middle path worth keeping: **freelance designers/marketers** who win
gym work and need a site built could pay a project fee per reskin —
productised freelancing, doesn't cannibalise the recurring play.

Revisit if: the go/no-go gates in PROSPECTS.md trigger with zero
closes, OR the template economics prove out and agencies reappear as a
_channel_, not the buyer. Pickaxe stays ours until the hole's dug.

### Outrigger #4 — rival race brands chasing HYROX

The pitch (as floated): race formats trying to gain footing against
HYROX need to look bigger than they are — our engine (events, results,
leaderboards, community, desk) is exactly the kit that makes an upstart
league look established. Buyer = the league itself, white-label, not
the gyms.

Verdict — **parked, enterprise arm.** Real fit, but it's a different
sale: B2B/white-label, longer cycle, handful of brands not a market.
Not a pipeline — a nice high-ticket bolt-on once the gym playbook has
case studies to point at. Revisit when a rival format (ATHX, DEKA,
whatever's ascendant) is visibly scaling and under-tooled.

Related pool note (bigger than the outrigger): coaches straddle sports.
G&H-types coach athletes who race HYROX, Spartan, DEKA, CrossFit — the
platform's coaching/community/shop/desk core is race-format-agnostic.
So the real prospect pool isn't "HYROX gyms," it's "hybrid-fitness
coaches with a community." HYROX stays the sharpest pitch (predictor +
stations prep land as-is); Spartan/CrossFit coaches are the same
product with a reskinned race-tools layer — viable, slightly thinner
demo. Expands the addressable pool well beyond the ~30–80 creator /
hundreds-of-gyms HYROX-only estimate.

## The chassis pipeline — done, committed (2a4bec0, devin/gh-dossier)

The "clone" machine is real now. End state: scan → pull → build → QC → pitch.

- **`scripts/build-chassis.js`** — regenerates Josh, copies to `chassis/`,
  swaps every Josh-string for `{{TOKEN}}` (recipe: `chassis.tokens.json`),
  strips dead files (7 dead js/css + 5 orphaned data jsons), emits
  `images/REQUIRED.md` (31 slots) + a tokenised `tenant.record.json`.
  **Fails loudly if any persona string survives.** No ghosts — this is the
  thing we could never do to Dina's site because you can't grep for
  "sentences about being pregnant."
- **`mode:"chassis"` in `reskin-tenant.js`** — config = ~60 lines: tokens,
  assets dir, `heroMode`, optional `news` array + `copyOverrides`. Fails on
  unfilled tokens AND missing referenced images. Tenant record built from
  the tokenised template — never touches the roxjaya record.
- **Hero = one attribute.** `data-hero-mode="full|ambient"` on `.hero--bleed`;
  CSS selectors + app.js mask check both key off it. The three hidden
  switches are dead.
- **Voice is contractual.** `{{VOICE_DOUBLES_HOOK}}`, `{{VOICE_WEDDING}}`,
  `{{VOICE_NEWS_TAKE}}`, `{{TAGLINE}}`, `{{HERO_TITLE_HTML}}` are required
  tokens; `cfg.news` carries 3 owner-voice feed items; chassis ships 3
  generic ones so the feed never launches empty. All copy gender-neutral
  by default (13 he/his/she/her leftovers neutralised + one Dina "her"
  found in links.json). Division names (Men/Women) stay — HYROX categories.
- **Test tenant:** `mayaokafor` (fictional, ambient hero) — all pages 200,
  zero tokens, zero ghosts, lint/type-check clean.

**Lead search and qualification — gates before scores:**

The first scanner was too permissive: it added points for audience,
Linktree and coaching language, so an Australian HYROX coach, a UK
triathlete and a general transformation coach could all rank highly. Those
are commercially interesting people but wrong first-wave chassis targets.
Never mine media until all hard gates pass.

**Hard gates (failure = reject, not fewer points):**

1. **Geography:** currently UK. Confirm from bio, location, linked business
   and recent captions; do not infer from appearance. EU/Australia enter
   their own later locale queues.
2. **Sport:** HYROX must be explicit and current — bio/category or at least
   ~3 of the latest 12 posts about HYROX races, stations, programming or
   clients. "Hybrid athlete" alone is insufficient.
3. **Seller:** must sell coaching, programmes, cohorts, memberships or a
   community. Athlete/influencer without an offer is not this product's
   buyer.
4. **Activity/access:** public, recently active (normally within 30 days),
   contactable and suitable for a private demo.
5. **Site gap:** no strong owned platform already solving the problem. A
   Linktree/Beacons/Stan or visibly fragmented stack is positive evidence.

**Negative classifications (reject or route to another future chassis):**
triathlon/IRONMAN dominant, bodybuilding/transformation dominant,
running-only, general lifestyle influencer, athlete with no coaching
business, wrong geography, or a mature owned platform already in place.
Do not force HYROX station pages onto a commercially attractive person in
the wrong category.

**Rank only after the gates pass:**

- Linktree/Beacons/Stan or multiple disconnected booking/store/community links
- 1:1 coaching plus group programmes/cohorts
- Gym, programme-coordinator or community role
- Affiliate codes, sponsors, merchandise or ecommerce
- Multiple revenue streams (strong **desk-first** pitch)
- Active race/community content (network/race-mate pitch)
- Race analysis content (predictor/splits pitch)
- Useful audience size and genuine engagement
- Strong recent photography and no proper website
- Nutrition-led creators trigger the chassis nutrition review gate; generic
  fuel copy is never silently attributed to them

**Desk-first ordering:** prioritise prospects juggling coaching, programme,
affiliate, sponsor, merchandise or gym income. The desk is strongest where
money currently lives across several tabs; a single-offer coach receives a
different lead feature.

**Staged data budget (cheap rejection first):**

1. Profile record only: geography, bio, external stack, activity.
2. 10–12 text/metadata post records: HYROX density and negative-sport check.
3. 20–30 thumbnails only for qualified prospects: verify hero, portrait,
   coaching, race/station, doubles/community and lifestyle coverage.
4. Pull 10–15 selected full assets/video frames only after image viability.
5. Build, automated QA, one visual review, then pitch.

Target monthly shape: ~200 profile gates → ~80 sport checks → ~30 visual
triages → ~15–20 full speculative builds initially. Increase full builds
only when conversion data proves they outperform lighter outreach.

**Production data source:** use a paid public-data provider rather than a
logged-in Instagram account. Current recommendation: Bright Data Instagram
Scraper API (public profile/post records, no Station 9 cookies; advertised
5,000 free records/month and pay-as-you-go thereafter). Apify is the backup.
Free anonymous viewers are manual/emergency fallback, not infrastructure.
Station 9's IG account is for normal posting, engagement and outreach only.
Cache every fetched record; never scan the same profile twice unnecessarily.

**Local tooling:** `scripts/qualify-prospects.js` is the production first gate:
`node scripts/qualify-prospects.js handle1 handle2` fetches one Bright Data
profile record per uncached handle, classifies it PASS/REVIEW/REJECT and prints
reasons plus desk/nutrition signals. Responses cache locally under ignored
`data/prospect-cache/`; `--refresh` explicitly spends a new record and `--json`
emits pipeline output. `ig-scan.py` is retained only as an early prototype and
its old additive ranking must not drive pitches. `ig-triage.py`, `ig-pull.py`
and `photo-sort.js` remain useful after qualification: contact sheets expose
carousel/video candidates; selected full assets and video frames flow into
31 labelled, priority-ordered, non-duplicating image slots.

**Combined prospect pipeline (decided and automated):**

```bash
node scripts/prospect-pipeline.js prepare handle1 handle2 --run=sunday-batch
```

One resumable command now coordinates the existing tools: cached Bright Data
profile qualification → PASS-only 60-post/event-window assessment → contact
sheets → local asset export → priority/no-duplicate photo sort → review pack.
Each candidate lands under ignored
`scripts/reskin/prospects/<run>/<handle>/` with `qualification.json`,
`assessment.json`, labelled contact sheets, source assets, photo-sort report
and an `approval.json` template.

The pipeline then stops deliberately at **READY FOR VISUAL REVIEW**. This is an
AI visual gate, not manual work for the founder: inspect identity, cropped
heads, finish-clock readability, station correctness, hero quality and visual
duplicates; fill all 31 slot assignments; set `decision: BUILD`; supply the
generated config path. Reject weak candidates without building. Captions and
aspect ratios propose; vision approves.

```bash
node scripts/prospect-pipeline.js --resume sunday-batch
```

Resume applies the approved images, points the tenant config at those assets
and runs the chassis build. It refuses incomplete approvals, missing files or
missing configs, and ends at `built_pending_browser_qc` rather than pretending
visual QA happened. Final desktop/mobile browser review remains required before
a pitch enters the send queue. The pipeline never invents race results and
never publishes without an explicit gate.

Future automation can add face matching, OCR, blur/crop scoring and perceptual
deduplication, trained from approved/rejected slot decisions. Do not remove the
visual gate until 20–30 real builds show those checks match human judgement.

**Throughput:** builds are no longer the constraint. Qualified leads and
final visual QA are. Optimise for the number of correctly targeted pitches,
not raw sites generated.

**Market sequencing:** exhaust HYROX-adjacent creators (anyone coaching
athletes who race — the tools land as-is), then adjacent niches reuse the
chassis with a token flavour pack (CrossFit boxes, running coaches).
Each buyer becomes a node: footer credit + cross-linked community features
= a network a Linktree can't copy. Move markets when reply rate drops,
not when lists empty.

**Honest gaps:** Josh/G&H stay on pair-mode until they buy (migrating
working demos risks regressions for zero gain — migrate at purchase).
token map will leak a few strings on tenant #1; expect one patch round.
Deeper symbol-level dead-code pass inside app.js/styles.css deferred.

## The full arc — sites → rails → network (agreed)

Income model: 75% base tier (£450 + £45/mo), 25% commercial (£1k + £180/mo);
conversion ~8% on hottest prospects decaying to ~5% (spec-work outreach
rates, not cold-email rates — the demo is the pitch).

Year 1: ~£95k, ~84 clients, ~£7k/mo exit run-rate (~1,850 pitches).
Falsifiable test: 60 hottest pitches → expect ~5 sales in month 1;
≤1 after the channel fix = diagnose the offer, not the volume.

Peak HYROX-only: ~300 clients ≈ £23k/mo ≈ month 30–36, then churn≈adds.
Adjacent markets (CrossFit, running, DEKA) restart the front-loaded phase —
same chassis, new token flavour pack.

De-shopify phase: {{STORE_URL}} seam already points at our engine. Once
~40% migrate (store bolt-on £30–50/mo commercial, £15–25 base, or
"same as your Shopify bill"), peak ≈ £28–30k/mo and churn collapses —
nobody leaves the platform their revenue runs through.

Coaching-ops annex: TrueCoach/Calendly/invoicing replacement on the desk
data that's already there. Rail fee on coached GMV (~£40–60k/mo ceiling
on the 300-tenant base).

## The billion thesis (and what it actually requires)

The coach business tops out at an excellent £20–50M company — not £1B.
The billion only exists via the athlete network: ~1,000 tenants × ~300
athletes = ~300k athletes acquired B2B2C for free (Strava spent a decade
and £150M doing that B2C). Then the consumer layer (Station 9) monetises
events, entries, sponsor reach — the "owns the athlete relationship layer"
valuation, ~£1–2B comparable, ~yr 6–8, honest odds 5–15%.

Non-negotiable foundations (decided, bake in now):

- Every athlete record: tenant_id + global athlete_id in central Postgres
  — never per-tenant files/localStorage. Retrofit kills networks.
- Station 9 = the consumer-facing product brand. Coach sites are front-ends;
  athlete accounts are Station 9 accounts powered through the coach's site.
- Coach trust rule: athletes' visible relationship stays with the coach's
  site; network features only ship when they make the coach's offering
  better that day (opt-in federation at ~50–80 tenants; Station 9 public
  face at 150+). Contract line: coach keeps their athlete relationships.

Non-negotiables for later, deliberately NOT now: cross-tenant boards, SSO,
event discovery (federation of 5 sites = a group chat), commerce build,
locale packs (first German bite triggers it), GDPR hygiene path (consent
copy on boards + real deletion route — needed before federation, not before
first pitch).

## Brand structure (decided)

Arciteq Digital = parent/holding entity — trading name, contracts,
invoicing, the agency face when needed. Station 9 = the product brand:
coaches' sites are "powered by Station 9", the athlete network is Station 9.
Do NOT split into a third consumer brand later — that re-fragments the one
asset that compounds. Structure: Arciteq Digital owns the pipeline;
Station 9 owns the network.

## Chat notes

- **Tone: dry British sarcasm, on tap.** Not sitcom energy — deadpan,
  underplayed, the kind of funny that's easy to miss if you're skimming.
  Deploy it in the back-and-forth: questions, answers, ideas, banter.
- **Banter is a feature, not a bug.** We trade it back and forth — the
  user throws an idea, it gets volleyed back with a raised eyebrow.
  Honest disagreement delivered straight-faced is the house style.
- **But the brakes exist and are load-bearing:** no humour mid-debug,
  none during complex or risky moments, clarity always wins. Funny is
  the seasoning, not the meal.
- Check this section at session start — it's how we talk.

## Open questions

- Station 9 site — build next (it's another reskin: our own brand)
- Storefront parameterisation scope — what it takes to reskin Pawsense
  like Hannah
- The second mutation — what "industry OS" looks like is a £10M-business
  problem; noted, not solved

## Fallback track: white-label agency supply (decided — stays in drawer)

If the direct-coach pitch path fails, the asset is still sellable: agencies
can sell the sites; we build them in ~15 min off a client's Instagram.
Structure agreed as a fallback deal, not a live track:

- **Capacity retainer:** £500–£1,500/mo (never under £400). £750–1,000 is
  the defensible opening position. Non-refundable, paid whether they sell
  or not — it reserves our availability, and filters out window-shoppers.
- **Per-sale cut:** 20–30% of the sale price (of _sale price_, not their
  fantasy internal cost). At ~£2k/site that's £400–600 to us per build.
- **Support bound:** retainer covers availability; revisions capped
  (e.g. 2 rounds per site, then hourly). White-label profit dies in
  unbounded tweaks.
- **Minimum term:** 3–6 months — otherwise they take one site, learn the
  speed, and walk.
- **We own the engine.** They license the output; the chassis, tokens and
  tooling stay ours. Sites either migrate to them at a price or stay on
  our hosting at MRR — never handed over free.
- **Income shape:** 3 sites/mo ≈ £2.5k/mo; 2 agencies at 4 sites each ≈
  £6k/mo. Real money fast, but zero network, zero enterprise value.

**Decision: sequence, don't run both.** Agency work and the platform
compete for the same hours and pull the chassis in opposite directions
(variety vs sameness). White-label also sells away the "Station 9" brand
accumulation the network thesis needs. Tripwire to pull this out of the
drawer: month-1 pitch conversion < ~3% = agencies become the customer,
platform becomes the side bet. Inbound agency interest is still worth one
coffee — real pull beats the plan. If ever forced to run both: agencies
live on the legacy pair-mode engine, the platform keeps the chassis +
tenants. Never let an agency client touch Station 9's infrastructure.

## Perspective note (Nov 2026)

The "suspiciously easy" two days weren't zero→ecosystem — they were the
mountain-top view of ~14 months: ecommerce build since Aug 2025, Dina's
site as the accidental product research, Josh's site compressing it into
a pipeline. The chassis exists because every creator site is the same
organism in different skin — tokenisation is only possible because the
organism is already understood. Unproven ≠ unbuilt: sales conversion,
paying-tenant ops and churn are the untested legs, not the platform.

## Open questions

- Station 9 site — live at / (apex) + /station9/, studio copy pass done;
  remaining: real photography/assets, deeper-page copy polish
- Storefront parameterisation scope — what it takes to reskin Pawsense
  like Hannah
- The second mutation — what "industry OS" looks like is a £10M-business
  problem; noted, not solved
