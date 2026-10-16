# Billions

The venture file. Named for the destination; built for the journey.
Everything here is observation from the Oct 2026 strategy sessions —
what the machine is, what the maths says, and what the real competition
is doing.

## What we're actually building

Not a website company. Not a website generator. **A machine that produces
niche community platforms** — the factory (`reskin-tenant.js` + config +
assets) is the wedge; the community graph inside each tenant is the moat.

The pitch in one line: *"Your business's platform, already built — see it
before you pay."* Demo-first, never promise-first.

## Station 9 — the platform's front door

Name: **Station 9**. ("The 9th station is the community" — the name *is*
the pitch.) Needs its own site — the product's window display — housing:

- The pitch + the three live demos as proof (Hustle, RTF, Hannah —
  *that's what the demos are for*)
- Pricing + the intake form as the CTA
- The walk-in/DM follow-through: *"here's what I'd build you → fill this in"*

Distribution hack: subtle "Site by Station 9" footer credit on every
tenant — every member of every client gym is a lead. Keep it subtle —
Bobby's demo must feel like *his* site, not our ad.

## The intake pipeline (form → site)

Today: ~1 hour of skilled labour per reskin (research IG, screenshot
photos, hand-write config, run script). Pipeline drops that to watching
a dashboard:

1. **Intake** — form fields map 1:1 onto config JSON (brand, coach, city,
   colours, offer/prices, three voice questions)
2. **Assets** — photo *uploads* over IG scraping: prospects know their
   best shots, better quality, zero ToS-grey. Slot by role (hero, coach
   portrait, action, group), not content
3. **Voice** — the hard bit. LLM drafts brand-voiced copy from their bio
   + three answers; eyeball once before publish
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

| Years | Stage | Shape | Money |
|---|---|---|---|
| 0–0.5 | Validation | UK HYROX blitz — 100+ demo pitches (build is no longer the constraint), 20–50 clients, conversion-rate proof | £15–60k |
| 0.5–1.5 | Niche domination | UK+EU HYROX, self-serve live, remote-close motion proven | £100–400k/yr |
| 1.5–4 | Category expansion | All boutique fitness (~30–60k gyms) | £1–10M ARR |
| 4–7 | Platform | What gyms *run on* — member graph, payments | £10–50M ARR |
| 7–12 | Billion or bust | Default OS for an industry segment | £125M+ ARR |

**Revision (post-factory proof):** the original 0–1 year assumed builds
paced the pipeline — wrong. Seven full tenant demos shipped in ~20
minutes of machine time; ~30 pitch-ready sites in 3 days is now
conservative, and Europe becomes a *weeks* decision, not a year-two
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
early — *if* the first ten demos convert at all. Sequence stays:
Hannah → Bobby → the seven → blitz.

The billionaire fork is ~year 3, and requires the product to mutate
twice: sites → community OS → industry infrastructure. "Very rich"
(£10–100M exit, 5–8 yrs) is achievable on this asset; billion needs the
second mutation.

## The solo-operator stack (what the machine needs)

Working backwards from "one person, giant P&L":

1. **Marginal cost ≈ zero** — template + config + AI labour (reskin script
   is exactly this). Trillion version automates *everything*; human only
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
   *hold* the revenue (why the four commerce gaps are being built
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
- **The ongoing system** — we sell what the site *runs*, not the site.
  Churn inverts when the community lives in it

Window: the "done-for-you niche platform" claim is rare for maybe
**6–12 months**, not forever — speed matters only if it fills the
pipeline; a head start without clients is just a head start.

## Shopify: steal, don't sidekick

Two lanes, both real:

- **Bolt-on** (Trojan horse): fast SEO storefront as the marketing layer,
  checkout stays Shopify. Operators already pay $40–200/mo for landing
  builders that do *worse*. Zero migration risk; every bolt-on is a
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
*count* what a faster site is worth and already feel the same-box pain.

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
  *"your £25/mo receptionist"* — payroll framing at our scale.
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
   past their own natural range. *"Sound like me but 20% funnier"* =
   baseline + wit +2. Never breaks recognisability, lets them be a
   better version of themselves.

UX: not sliders — three draft variants per message (*like me* /
*funnier* / *funnier still*), pick = setting. Approval gate is always
"sounds like me." Plugs into: receptionist bot (first surface), email
nudges, caption lab (new drafting surface), reskin copy.

## The chat-plugin insight — redirected

Insight (real): chat history is the richest voice corpus that exists —
DMs are the *actual* voice, not the performed one. And consumer demand
for "50% funnier" is proven (rizz apps: millions of downloads, 2023).

Consumer version rejected: WhatsApp/IG are closed (no API — the only
doors are keyboards that can't see incoming messages, or upload-your-
history GDPR friction), Meta is already baking AI into WhatsApp
(landlord eats feature — the rizz apps all died in ~18 months), and
"50% sexier" carries manipulation optics.

**Redirect (adopted):** WhatsApp *Business* has a real API — and a gym's
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
builders or visibly app-bloated — they can *count* the pain), demo-first
(rebuilt storefront they can't unsee + their Lighthouse vs ours),
bolt-on first (replace a Shogun/GemPages budget line, not their
checkout). It fails as generic "replace Shopify" cold DMs — that pitch
is the most crowded channel in e-commerce, and speed alone doesn't
close without a case study. Pawsense must produce numbers, or the first
commerce client *becomes* the case study.

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
*channel*, not the buyer. Pickaxe stays ours until the hole's dug.

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
