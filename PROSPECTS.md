# Roxjaya Platform — Prospect Pipeline

Sales pipeline for the coach community platform (boards, desk, race planner,
meetups/RSVPs, Station 9, results engine). Roxjaya.com is the flagship/showroom.

Updated: Oct 2026 · Owner: Chris

## How scoring works

Gates (fail any = out): independent decision-maker · existing community (any size)
· race-active city (HYROX race within ~2h).

Weighted indicators (max 31 pts):

| Indicator | Weight |
|---|---|---|
| Dated/poor website — proven buyer, upgrade sale | 3 |
| Competitive market, needs an edge beyond floor coaching | 3 |
| Already organises community informally | 3 |
| Active engaged IG | 3 |
| No website at all — green field | 2 |
| Premium pricing (£80+/mo) | 2 |
| Manual admin via WhatsApp/DMs | 2 |
| Personal-brand-led | 2 |
| Travels to races with athletes | 2 |
| Races themselves | 2 |
| Race weekend coming up | 2 |
| New facility / recent expansion (marketing budget live) | 2 |
| DM-responsive | 1 |
| Growing (waitlists, expansion) | 1 |
| Mid-size city | 1 |
| English-speaking market | 1 |
| Complains publicly about admin chaos | 1 |

Thresholds: ≥20 = hot (personalised demo) · 14–19 = warm (DM, reskin on reply)
· <14 = park. Proximity/walk-in access overrides score.

Two pitch lanes:
- **Replace** — dated/no site + established community → full build, normal setup fee
- **Bolt-on** — new gym / decent site → community engine added to what they have,
  low setup + monthly (their cash went into the fit-out; sell post-launch promotion)

## Top 10

| # | Prospect | Location | Lane | Raw | Wtd | Price | Status |
|---|---|---|---|---|---|---|---|
| 1 | Hannah Burgon Fitness | Stockport | Replace | ~10/16 | ~20/31 | £600 + £60/mo | Research done |
| 2 | Hustle (Bobby Harrison) | Norwich + Wymondham | Bolt-on | ~8/16 | ~18/31 | £300 + £70/mo | **WALK-IN FIRST** |
| 3 | Pace Gym (Simon Wenham) | Chichester | Bolt-on/build | — | ~16/31 | £300 + £50/mo | Verify site/IG |
| 4 | Hyrox Doncaster (Nigel) | Doncaster | Replace | ~7/16 | ~13/31 | £800 + £75/mo | Verify IG/races |
| 5 | Ross Fisher — HTC Christchurch | Dorset | Bolt-on | ~8/16 | ~15/31 | £500 + £70/mo | DM |
| 6 | Gym64 | Glenrothes | Bolt-on | ~6/16 | ~12/31 | £500 + £60/mo | DM |
| 7 | NutriFit Gym | Liverpool | Bolt-on | — | ~14/31 | £400 + £60/mo | Verify |
| 8 | KORE | Newport | Bolt-on | — | ~12/31 | £400 + £50/mo | Verify |
| 9 | Fennell Fitness (Dan) | Bedford | Replace | ~7/16 | ~14/31 | £400 + £45/mo | DM |
| 10 | Gregor & Hattie | UK online | Funnel | ~8/16 | ~15/31 | £500 + £50/mo | Wildcard — needs funnel variant |

## Why each

1. **Hannah Burgon** — 3× Worlds qualifier, monthly HYROX sims run off a Gmail
   address, dated Squarespace, personal brand, £89/mo programs. Organised a
   fitness-business networking event Sept 2025 — thinks like an organiser.
   IG @hannahburgon_pt · hannahburgonfitness.com
   Site intel: business est. Mar 2019, site built ~May 2020 (Squarespace CDN
   timestamp), ©2022 footer. Predates her entire HYROX career — pitch is
   "you've outgrown this," NOT "your site is bad" (it's worked fine for her;
   criticising it puts her on defence). The gap is infrastructure, not looks:
   sims run off Gmail, no community space, no results/event tooling — things
   Squarespace can't do at any price.
2. **Hustle** — opened Performance Centre ~Jul/Aug 2026 after documented build.
   Official HYROX affiliate, 5 session types, sims since Jan 2024 (60 athletes).
   Pays a social media manager = live marketing budget; running £1/day trial.
   Has bsport + decent site — sell the community/differentiation layer, not a
   rebuild. Owner: **Bobby Harrison**. doyouhustle.co.uk · @hustle_norwich,
   @hustle_wymondham · Norwich NR7 9AR.
   **Walk-in plan:** weekday mid-morning/mid-afternoon, ask for Bobby, chat first
   (Dina/Jakarta/APAC HYROX story as peer intro), return with laptop + iPhone
   running hustle-branded demo. Founding-client offer in pocket (half-rate
   setup / 90-day pilot for case study + testimonial).
3. **Pace Gym** — opened 1 Oct 2026, independent, founder-built, £139/mo.
   Fresh budget, thin web presence likely — could offer whole thing cheap.
4. **Hyrox Doncaster** — dedicated HYROX gym, 5.0★/34 reviews raving about
   community + Nigel by name. One-page lead funnel = worst web presence,
   biggest upside.
5. **Ross Fisher** — affiliated training club, 60+ athletes coached, elite racer.
   Decent coaching-funnel site — sell Season features (travel board, results).
6. **Gym64** — sims sell out with waitlists. Proven demand, organising gap.
7. **NutriFit Gym** — online coaching brand → new physical space (opened ~Sep
   2026), digitally savvy, own app. Bolt-on only.
8. **KORE** — opened Feb 2026, 132 at launch, packing classes. Small market,
   cheap deal.
9. **Fennell Fitness** — dedicated HYROX coaching brand, phone-and-email ops,
   small operation.
10. **Gregor & Hattie** — certified coaches, Gymshark-sponsored, 700k-view
    TikToks, sell programs via link-in-bio. Need storefront + predictor lead
    magnet, not boards. Different product shape — flag as variant work.

## Watchlist / parked

- J13 Fitness (Worsley) — overlaps Hannah's patch
- Fenix Active / Hyrox Scunthorpe — multi-site deal, longer cycle (round 2)
- Hyrox Ceda (Newry), Black Box Hyrox (Saintfield) — small markets
- HYROCKS Hybrid (Lisburn), Fifth Gym (Stonehouse) — new-gym watchlist
- M Club Stoke — corporate £1m play, enterprise pitch, park
- Simon Graham (Farnborough) — best existing site, weak pitch
- HIIT Gyms (London NW6) — chain, needs owner-level access

## The Roxjaya-clone business

What we're actually selling is roxjaya, productised — the same engine,
reskinned per prospect in under an hour via `scripts/reskin-tenant.js` +
a per-tenant config + an assets folder. Three tenant shapes proven so far:

- **Gym/community** (Hustle) — facility-led: sims, memberships, values wall
- **Ecommerce-adjacent** (Race to Frame) — existing Shopify store stays,
  community layer wraps around it; products embedded as live links
- **Personal coach** (Hannah Burgon) — the original roxjaya shape:
  personality-led, programs + events, community tooling underneath

**The photo gap is the product gap.** Dina's IG is half of why the flagship
looks alive — most prospects won't have a Dina. Two consequences:

- Sales line for weak-photo prospects: "we make what you already post look
  like this" (the template does the heavy lifting — proven on Hustle's
  scraped shots).
- New launch-kit add-on: **community shot list** — the 6 photos every
  tenant needs (packed floor, coach mid-cue, post-class group, race-day
  crew, celebration shot, quiet-recovery). Cheap to produce, +30% perceived
  site quality on day one. Price into launch kit or sell at £50–100.

Reskin discipline: config + assets are source of truth; generated tenant
dirs are outputs. `sharedPack` in config pulls market-level cleanup
(UK language/data sweep) so every tenant inherits it — don't duplicate
fixes per config.

**Hero-effect choice = the buy-in moment.** Every reskin demo should
offer the prospect 2–3 hero entrances to pick from (e.g. via `?fx=`
preview links — roll+sparkle for the celebrants, slit-in/wipe for the
starker brands). The minute a prospect is debating "which one's more
me", they've effectively bought it — the choice makes it theirs. Build
the effect picker into the intake form when it lands (v2): the selected
effect lands in the tenant config alongside colours and voice.

**The end-state intake is a web form, not me.** The config JSON I write by
hand *is* the product — the form just captures the same fields (brand,
coach, city, colours, offer/prices, three voice questions, 5–10 labelled
photos). Form → JSON → `reskin-tenant.js` → preview link. v1: internal
tool I fill after a walk-in/DM. v2: self-serve on the platform site
(see BILLIONS.md — "Station 9"), paywall = publish. Until the form
exists, keep writing configs by hand — every config written defines a
field the form needs.

## Pricing model

- UK: setup £300–800 + £40–80/mo; multi-site higher
- SEA: ~50% of UK (Jakarta ≈ Rp400–800k/mo + Rp3–6m setup)
- Dina: flagship tenant, never invoiced
- Founding clients (first 2–3): halved/waived setup for testimonial + numbers
- Tiers: Site (brochure) → Community (boards + desk) → Season (travel/results/
  guides); add-ons: chatbot (+£25–40/mo); predictor free in every tier (lead magnet)

## Rules of engagement

- Dina is not involved in outreach; her site is the proof case only.
- No cold email intros. DMs from a real human account, or walk-in for local.
- Every prospect gets a personalised reskin before/at first contact.
- New gyms: pitch retention/differentiation, never "replace your new site".
- Verify IG cadence during reskin prep (it happens for free while pulling
  their branding), not as a gate.

## Year-1 revenue arc (estimates, Oct 2026)

Base case — year 1 is validation, not income:

| Months | Activity | Clients | MRR | Cumulative |
|---|---|---|---|---|
| 1–2 | Reskin pipeline, Hustle walk-in, first ~20 DMs | 0–1 | £0–50 | ~£300 |
| 3–4 | First founding clients (discounted) | 1–3 | ~£100 | ~£800 |
| 5–8 | Case studies live; niche referrals start | 3–5 | ~£250 | ~£2,000 |
| 9–12 | Steady drip | 5–8 | ~£400 | ~£4–5k |

- Pessimistic: 3–4 clients total, ~£1.5k year.
- Optimistic: 12–15 + a multi-site deal, ~£10–12k year, ~£1k MRR.
- Year-2 upside only exists if year-1 case studies land; ~30 clients × £60
  ≈ £21k/yr.
- Short-term cash lever: bias toward "Replace" prospects (higher setup fees)
  if early revenue matters more than best-fit.

## Go / no-go gate (month 4, or whichever comes first)

Drop or pause the sales push when ANY of these hit with zero paying clients:

- ~30–40 total outreach touches (walk-in + DMs + follow-ups), OR
- 5 completed demos with zero closes, OR
- end of month 4.

Read the failure mode before the verdict:

- Zero replies after first ~12–15 touches → message/channel problem.
  Rewrite the DM once, try 10 more before concluding.
- Replies/demos but no closes → pain isn't worth money. Kill signal.
- "Too expensive" objections → pricing problem, fixable.
- "Don't need it" → product problem, fatal.
- Zero sales but 3+ free pilots actually using it → keep going; pricing
  issue, not product.
- The first cohort is the best-fit list by design; if they won't buy,
  the long tail won't.

## Market map (weighted, Oct 2026)

Weights: access ×3, language ×3, coach density ×2, market size ×2,
price tolerance ×1, whitespace ×1 (max 60).

| Market | Total | Verdict |
|---|---|---|
| UK | 57 | Launch market — access advantage (walk-ins, timezone, English, boutique gyms), not biggest prize |
| USA | 46 | Biggest prize, worst access — enter via case-study inbound after UK/AUS proof |
| Australia | 45 | Sleeper #2 — English, WA/IG-native, Jakarta timezone overlap, concentrated scene saturates fast |
| Germany | 38 | Structural prize, gated by language localisation — third market after validation |
| Canada | 37 | Never primary — rides US coattails |

Advantage durability: UK first-mover ≈ 6–12 months before copycats;
moat deepens only via client community data lock-in. Order of effort:
UK now → AUS after first case study → USA inbound → Germany post-localisation.

## Add-on menu (month-2 upsells, not day-one pitch)

Rule: every add-on < half a member fee (£99/mo → £15–45 digestible).

| Add-on | Price | Sells |
|---|---|---|
| Receptionist bot | +£30/mo | 11pm logistics answers, hands personal to WhatsApp (~£5–10 our cost) |
| Community launch kit | £200 one-off | Seeded board, first events, announcement posts — kills empty-board risk |
| Booking integration | £150 one-off | bsport/TeamUp/Glofox piped in — priced as labor |
| Predictor Pro readout | £7/report (athlete pays, coach keeps ~30%) | Turns clients into our salespeople |
| Content concierge | +£40/mo | We write their roundups from results they send |
| Second location | +50% of tier | Near-zero cost, pure margin |
| Custom domain + email | £100 one-off | Table stakes |

Free on purpose: base predictor, share tools, boards — traffic + demo
engines. Land cheap, expand inside (bolt-on → kit → bot → upgrade ≈ £95/mo).

## Income model v3 (with add-on uptake)

Per month: adds front-loaded (strong→weak cohort), ~8–9 net clients year 1,
one churn. One-offs = setup + kits + integrations (~60%/40%/50% attach).
MRR = £55 base/client + ~£20/mo per mature client (3+ months: bot 35%,
concierge 15%, tier upgrades, predictor-pro drip).

| Month | Clients | One-offs £ | MRR £ |
|---|---|---|---|
| Nov | 1 | 700 | 55 |
| Dec | 3 | 1,010 | 165 |
| Jan | 4 | 580 | 220 |
| Feb | 5 | 630 | 275 | ← kill gate
| Mar | 5 | 320 | 295 |
| Apr | 6 | 370 | 335 |
| May | 6 | 320 | 382 |
| Jun | 6 | 0 | 395 |
| Jul | 7 | 450 | 450 |
| Aug | 7 | 400 | 463 |
| Sep | 8 | 650 | 518 |
| Oct | 9 | 700 | 586 |

Year 1 ≈ £10,600 (one-offs ~60%). Exit ~£586/mo run-rate, ARPU ~£65.
Two humps: warm-list peak Nov–Jan, dip Mar–Aug, referral engine Sep+.
