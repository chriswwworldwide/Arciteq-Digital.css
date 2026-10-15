# Gregor & Hattie / Race to Frame — Prospect Dossier

Reference case for the creator-commerce tier. Keep this file; every
audience-led business we pitch later reuses this pattern.

## Status

- Demo tenant: `racetoframe` → https://www.station9studio.co.uk/racetoframe/
- Current demo is a stale city-gym clone — **not pitch-ready**, do not send.
- Source pack indexed: `scripts/reskin/racetoframe-source/` (49 files +
  SOURCE_NOTES.md). Photos gh-*.jpg; caption/post screenshots gh-*.png.

## Who they are

- Gregor & Hattie — HYROX creator couple, UK. ~370k TikTok followers,
  strong Instagram. Gregor & Hattie podcast.
- Voice: self-aware deadpan humour ("will they know I podiumed?",
  "who's your gym crush"), zero corporate polish, real results underneath
  (Cardiff podium flags, sub-60 finishes).
- Race to Frame = their Shopify product business (racetoframe.com).

## Business map (what they own vs partners)

Own: Race to Frame shop (HYROX/hybrid frames, keyrings, medal/podium frames,
~£11.99–£72.99, bundles ~£46.99), SheBuilds 1:1 coaching (Hattie),
Sculpt & Shape 8-week programme, GJ HYROX Programming & Testing
(beginner/advanced/doubles/1:1), podcast + "Tell Your Story" (Nozzle Media
form), mailing list.

Partner/affiliate only — never present as theirs: TRYKA tickets (code GREG),
Gymshark (GREGORHATTIE10), DFYNE (GREGORHATTIE). Castore/TRYKA clothing is
Life Style Sports stock, not theirs.

Linktree today routes to: Shopify, Typeforms (SheBuilds, GJ testing,
Sculpt & Shape), Nozzle podcast form, mailing list page, affiliate links.

## The pain (why this is the strongest prospect)

For local gyms we're a nice-to-have. For G&H we fix real problems:

- Linktree is a leaky bucket — 370k followers hit a bare link list, no
  brand, no retention.
- Revenue fragmented across Shopify + forms + affiliate links; no shared
  view of who did what.
- They can't see the business: a frame buyer and a Gymshark click never meet.
- The audience isn't owned — IG/TikTok own the relationship; email capture
  is one lonely Shopify page.

## Architecture decision (locked)

- Umbrella brand = **Gregor & Hattie**; Race to Frame is a product line
  inside it. Ideal: gregorandhattie domain later, racetoframe.com keeps
  Shopify. Demo lives on our slug.
- Shopify stays: products, stock, cart, checkout, payments, fulfilment.
  Our shop section = styled cards deep-linking to their product pages.
- Typeform/Nozzle links stay — don't rebuild their forms for the demo.
- Stripe migration: a real option we can offer later (our commerce engine
  exists), but DO NOT pitch it upfront — it turns an easy yes into a
  migration decision. One line max: "keep Shopify, swap later if it ever
  stops earning its keep."

## New information architecture (replaces city-gym clone)

1. Home — hero (gh-11 sled push), three doors: Shop / Coaching / Podcast
2. Shop — real catalogue from public Shopify audit
3. Coaching — SheBuilds, Sculpt & Shape, GJ programmes/testing → Typeforms
4. Race Tools — Predictor, Split Analyser, Results Board
5. Podcast — episodes + Tell Your Story (Nozzle link)
6. Community — race-mate finder, athlete stories, mailing list
7. Partners — TRYKA/Gymshark/DFYNE, clearly labelled codes/links

Drop: city scene page, local guide, coach-desk framing, invented prices,
any "exclusive to city" copy (they're national — no city lock).

## Imagery map

- Hero: gh-11 (Gregor sled push)
- Podium proof: gh-19 (Cardiff flags)
- Shop section: gh-37 (frame on wall) + Shopify catalogue images
- About/podcast: gh-40 (B&W duo), gh-27 (kit duo)
- Coaching/action: gh-22, gh-31, gh-42, gh-48
- Personality: gh-32
- Feed cards: captioned IG post screenshots (295x640 — cards, not photos)

## Pricing recommendation

- **£995 setup + £129/month** — founding client rate.
- Payment: £500 on acceptance, £495 at launch, monthly from launch.
- Year 1 ≈ £2,543.
- Money Desk add-on (bookkeeping dashboard: Shopify + coaching + affiliate
  income, VAT tracking, accountant export): **+£200 setup, +£49/mo** →
  £1,195 setup, £178/mo. ~£3,331 year 1.
- Post-case-study standard for this tier: £1,500–£2,500 + £149–£249/mo.
- Rationale: they only need a few extra frame sales or one coaching client
  a month to cover the fee; for them it's recovered leak, not discretionary
  spend. No revenue-share, rolling monthly.

## Pitch angle

Not "we built you a site." → "Your audience is huge and your funnel is
held together with a Linktree — here's what it looks like as an actual
business." Demo shows the consolidated Money Desk (clearly labelled
synthetic data — never their real numbers). Feel like relief, not a pitch.

## Market context

This bracket (audience-led HYROX/creator businesses, UK): maybe 30–80 real
prospects. Small pool, high value — the template built here repeats.
Local-gym tier is hundreds-strong but £45–60/mo each. Strategy: 2–3
creator-tier builds for margin + proof, local clones as repeatable filler.

## Risks / honesty rules

- "Linktree+Shopify is fine" objection is real — the demo must visibly fix
  fragmentation, not just look prettier.
- Never present affiliate products as theirs; never use real financial
  figures; keep demo noindex/unlaunched.
- High bar: with 370k followers, a rough clone actively hurts. Polish or
  don't send.
- Shopify creds/domain access only AFTER they respond positively.
