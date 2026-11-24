# Roxjaya SEO & content state — 24 Nov 2026

Reference doc for the next Search Console / growth conversation.
Context: site ~3 months old, GSC showed the textbook new-domain curve
(spike late Sep → settle Oct → impressions climbing again mid-Nov).
Strongest query: "hyrox jakarta 2027" avg position ~9.4.
Traffic is ~83% direct/typed — mostly Dina's Instagram, not Google.

## Automation (all live on main)

- **Daily 05:15 WIB** — `hyrox-sync.js` (race discovery/dates),
  `news-sync.js` (Google News → Bahasa summary + "Kata Dina" take).
  Per-story isolation: a malformed story is skipped+logged, never
  blocks the batch. Locale-aware number check (32,000 = 32.000).
- **Weekly Monday** — `guide-autopilot.js` publishes a guide if newest
  is ≥7 days old (MIN_DAYS=7). ~32 topics queued incl. two women's-
  training topics (postpartum return, beginner strength — Bahasa).
  Pregnancy-medical topics deliberately NOT autopiloted.
- **Results reminders** — alert-only candidates post to the site inbox
  and surface in the Monday digest → chriswworldwide@outlook.com
  (redirected from Dina while she's pregnant). Results themselves stay
  manual — HYROX 403s bots.
- **Sitemap** regenerates automatically at deploy; no manual entry.

## Internal linking (audited 24 Nov — confirmed done)

- 46/62 live news items carry `link`/`linkLabel` internal links.
- Routing: results-type → /results/ · Jakarta → /hyrox-jakarta/ ·
  cities → /race-planner/#city · training → /stations-prep/.
- All targets verified 200. Zero current stories match the results
  rule — absence correct, not a bug; first results story picks it up.

## The Dina silo (built 24 Nov, all live)

| Page | Targets |
|---|---|
| `/roxjaya/dina-bawden/` | "Dina Bawden" / "Dina Rosdiana" name searches; Person schema (both names + "Dina Ida Rosdiana"); credentials, results, photo montage |
| `/roxjaya/dina-jrf-2026/` | JRF 2026 viral story, press collage, honest debate framing |
| `/roxjaya/personal-trainer-wanita-jakarta/` | "PT wanita Jakarta" searches; FAQ schema |
| `/roxjaya/olahraga-saat-hamil/` | "olahraga saat hamil" searches; doctor-first, human-edited |

Wiring: "Meet Dina" nav item on all 27 site pages; homepage #story +
#pelatih link the silo; hybrid-coaching links both new pages; every
page links both ways.

## Key facts (verified, cite freely)

- Dina Rosdiana / Dina Bawden (@dinabawden87, ~16.1K followers),
  full competition name Dina Ida Rosdiana.
- NASM PT, certified HYROX Group Instructor, STOTT Pilates, Zumba®;
  coaches at Arc Train + Recover, Jakarta.
- HYROX Jakarta 2026: Podium 1 Doubles Women 35–39 w/ Aiko, 1:11:20.
- NPC Showdown Singapore 2023: 3 medals in her first comp.
- JRF 2026: 10K in 1:02:29 at six months pregnant → national media.
- Hybridrace Jakarta 2026: Single Woman finisher 44:41 while pregnant.
- Expecting baby late January; reduced coaching schedule until ~Mar.

## Open items

- Dina's IG bio link → roxjaya.com (biggest lever; when she's back).
- Request indexing in GSC for the four new pages (sitemap will get
  there anyway; manual nudge speeds name searches).
- Watch: Monday digest arrival, guide #2 auto-publish, next race's
  results reminder, GSC impressions curve through Dec.
- If more hyresults detail wanted: HYROX blocks bots — needs a
  manual screenshot from Chris.
