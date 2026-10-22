# Handover — Station 9 Pitch Pipeline (Oct 2026)

This file catches a new session up on exactly where we are, what is live, and what must happen next.

## 1. Current operational state

### Microsoft 365 email setup — INCOMPLETE

**Do not send outreach from `chris@station9studio.co.uk` yet.**

Live DNS check (authoritative Namecheap nameservers):

| Record | Expected | Current state |
|---|---|---|
| MX | `station9studio-co-uk.mail.protection.outlook.com` priority 0 | Still pointing to 5 old `eforward*.registrar-servers.com` records |
| TXT verification | `MS=ms84635686` | Correct and present |
| SPF TXT | `v=spf1 include:spf.protection.outlook.com -all` | Still old `v=spf1 include:spf.efwd.registrar-servers.com ~all` |
| Autodiscover CNAME | `autodiscover` → `autodiscover.outlook.com` | Missing |

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

## 2. The live demo sites

All pitch demos are static folders under `https://www.station9studio.co.uk/<slug>/`. Railway serves the `main` branch.

**URL rule for pitches (Oct 22):** always send `https://www.station9studio.co.uk/<slug>` — WITH the `www`. The apex domain (`station9studio.co.uk`, no www) points at a dead Namecheap parking IP (192.64.119.235) and times out. Bare-domain links in emails will silently fail for recipients. Permanent fix queued: Namecheap Advanced DNS → replace apex A record with URL Redirect to `https://www.station9studio.co.uk/`.

| Slug | Public URL | Prospect | Status |
|---|---|---|---|
| `station9` | https://www.station9studio.co.uk/station9/ | Station 9 hub / product front door | Live |
| `racetoframe` | https://www.station9studio.co.uk/racetoframe/ | Gregor & Hattie / Race to Frame | Live, not yet pitched by email |
| `jadeskillen` | https://www.station9studio.co.uk/jadeskillen/ | Jade Skillen | Live; original Instagram pitch sent before account deactivation |
| `joshharrison` | https://www.station9studio.co.uk/joshharrison/ | Josh Harrison | Live; original Instagram pitch sent before account deactivation |
| `faisalpma` | https://www.station9studio.co.uk/faisalpma/ | Faisal Abdalla / PMA Fitness | Live, not yet pitched |
| `georgegrayson` | https://www.station9studio.co.uk/georgegrayson/ | George Grayson / GG Coaching | Live, not yet pitched |
| `burgonfitness` | https://www.station9studio.co.uk/burgonfitness/ | Hannah Burgon / Burgon Fitness | Live, not yet pitched |
| `htcfisher` | https://www.station9studio.co.uk/htcfisher/ | Ross Fisher / HTCC Christchurch | Live; already pitched on Instagram |
| `jamiebarker` | https://www.station9studio.co.uk/jamiebarker/ | Jamie Barker / Edge | Live; only verified route is Edge support |
| `coachedbyzara` | https://www.station9studio.co.uk/coachedbyzara/ | Zara Piergianni | Live; no verified business email yet |
| `elationfitness` | `/elationfitness/` (local) | Graham Halliday / Elation Gym Glasgow | Built locally, fully reskinned with his own IG event photography — pitch-ready pending deploy |
| `getfitgabby` | `/getfitgabby/` (local) | Gabby Moriarty | Built locally with her real station imagery |
| `trainedbytr` | `/trainedbytr/` (local) | Tom Redmond / TransFit Widnes | Built locally; coaching-page photo moved above plan cards |

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
- **No analogy/justification lines.** Coaches know whether they want a platform and why — the "you need a website like you need a phone" framing was dropped as salesy. Open with "I've already built your platform" and let the demo do the persuading.
- **Two asks max:** attached video + demo link. Everything else is supporting detail.
- **Proof lives in the P.S.:** Dina's live site (`roxjaya.com`) as the "already out in the wild" line — it's evidence, not a third ask.
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
- **Core angle — "a celebration of the athlete", not a coaching site.** Every image is his own professional HYROX race photography; the quote in The Athlete section is his own words from his 114K-like "AGAIN" post. The line: *"This isn't a website — it's what your Instagram should have been building towards all along."*
- **Image map worth naming in the walkthrough:** hero = his actual finish-line shot (arms wide, HYROX FINISH, Red Bull stage); Athlete = "AGAIN" sled image + his own quote; splits = face-down on the arena floor; all 8 stations = his real event shots (sled push/pull, SkiErg, row, burpees, farmers carry, sandbag lunges, wall balls); predictor = his 54:42 finish board; results = him and Hannah (@elationhannah, team member, NOT his girlfriend — girlfriend is Jen) at the 1:00:41 board; find-a-partner = running with Hannah.
- **Chassis notes:** Watch page stripped and links removed via copyOverrides (header + footer regexes). Coaching page photo moved above plan cards (global chassis change). `.guide-hero-photo img` now uses `object-fit: contain` + `max-height: 520px` so full-body images don't crop heads (global change).

### Gabby Moriarty and Tom Redmond
- Local demos `getfitgabby/` and `trainedbytr/` built via the same chassis. Gabby's station roster is all real imagery from her own reels. Tom's is thinner — his station content is caption-overlay coaching reels, several slots use explicit stock.

## 6. Roxjaya and Dina’s role

- `roxjaya/` is the **original tenant** built for Dina Rosdiana — the flagship proof case.
- Intended live domain: `roxjaya.com` (also `www.roxjaya.com`).
- Dina’s digest goes to `dinazumba1987@gmail.com`.
- **Dina is not involved in outreach.** Her site exists only as the proof case: "this is what it looks like when a coach already has the platform."
- All new prospect demos are generated as separate tenants using the same engine, not by editing `roxjaya/`.

## 7. What a new session should do first

1. **Finish the mailbox.** Check DNS again; do not pitch before bidirectional mail works.
2. **Deploy the new tenants** — `elationfitness`, `getfitgabby`, `trainedbytr` are committed to `main` but verify they render on Railway before sending links.
3. **Record Graham's walkthrough** using `scripts/reskin/elationfitness.pitch.json` as the script. It is the strongest demo yet — every image is his own.
4. **Pick the top un-pitched prospects** and prepare personalised 45–90 second video scripts using the angles above.
5. **Excavate the HYROX UK ambassador list** — see `PROSPECTS.md` "HYROX UK & Ireland ambassadors" section. ~25+ ambassadors, no public list; best route is pulling `@hyroxuk`'s followees via Instaloader once the IG session cools off (it was rate-limited 401 during this session).
6. For batch demo production, read `AGENTS.md` → "Start here for batch tenant builds" and `scripts/reskin/CHASSIS.md`.

## 7a. Image pipeline — what was fixed this session (Oct 20)

The root cause of "3 hours of stock-photo hunting while 15 better images sat in the prospect's IG grid" was found and fixed:

- **Bright Data was returning exactly 12 posts per profile** for a 120-post request, with zero carousel children expanded. The "HYROX Rome" 12-shot professional carousel was never in the data — the visual selector couldn't pick what it never received.
- **`assess-finalists.js`** now validates pull quality: warns on shallow pulls (<50% of requested) and zero carousel expansion.
- **`prospect-pipeline.js`** auto-falls through to `ig-triage.py` (Instaloader via Chrome session) when Bright Data is shallow or unexpanded. Deeper-IG retry happens before any stock fallback; every stock fill is logged.
- **`ig-triage.py` `MAX_CAROUSEL` raised 6 → 20.** Both triage paths now tag professional event carousels with `[PRO]` — detected via 6+ children, HYROX location keywords in captions (Rome, London, Warsaw, Athens, etc.) or photographer credit signals (📸, "photo by", @hyrox).
- **Candidate caps widened:** 4 candidates per slot (was 2), 20 spares (was 10).
- **Broken envs:** `/tmp/igenv` venv has a broken `browser_cookie3` (only a `__pycache__` stub) and wrong site-packages path. The repo `.venv` now has `instaloader` + `browser-cookie3` + `rembg[cpu]` (rembg is broken on Python 3.14 via numba; use the Apple Vision Swift cutout at `/tmp/cutout` instead — `swiftc` source was inline in this session, recreate if needed).
- **IG session was rate-limited (401)** at end of session. Followees pull for the ambassador excavation needs a cooled-down session — wait 30+ min.

Everything is committed to `main` and pushed.

## 8. Files changed but not committed

STALE — cleared Oct 21. Everything is now committed; `git status` is clean on `main`.
This section may safely be deleted the next time this file is touched.
