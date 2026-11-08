# Outreach learnings log — night of 5 Nov 2026

Everything learned/measured in the deliverability session, in one place.
Referenced from HANDOVER.md.

## 1. Delivery measurement (mail-tester + Mailreach spam checker)

- mail-tester score: **9.5/10** on a real pitch (Kim's email). Content,
  links, subject are clean; not the problem.
- mail-tester "-0.5 broken link" was a false positive (their DNS hiccup on
  roxjaya.com; the 301 is normal https redirect). All pitch links 200.
- **Mailreach seed panel (real pitch sent to seed inboxes):**
  - Google Workspace (professional): **Inbox, all**
  - Office 365 (professional): **Inbox, all**
  - Gmail personal: **Inbox, all**
  - Hotmail: pending at time of check
  - **Outlook.com personal: Spam, all three seeds**
- **Diagnosis: ~95% healthy everywhere EXCEPT consumer Microsoft
  (outlook.com/hotmail.com), which junks a brand-new domain.**
  Same signature seen earlier when tracker pings hit Chris's own junk.
- Implication: this week's five pitches (Gmail address, custom domains on
  GWS/M365) very likely LANDED in inbox. Silence = unopened, not junked.
- Folder placement is fundamentally invisible to senders — seed panels are
  the only measurement; they are an upper bound, not ground truth.

## 2. Domain reputation reality

- Reputation attaches to the DOMAIN (station9studio.co.uk), scored per
  mailbox provider; days-old domain = cold start.
- Warmth is earned by opens/replies/not-junk actions; 1 reply/week is
  glacial (months). Warmup services compress to ~3-4 weeks.
- Provider match matters: M365→M365 inboxes ~91-94%, GWS→Gmail ~92-96%;
  cross-provider is worse both ways (Lemlist 46M-email dataset).
- Stay on Microsoft 365 — right provider already. Proton worse.
  Pre-warmed mailbox services send from THEIR domains — wrong for a
  brand-anchored pitch. Recommended: **Mailreach ~£20-25/mo** as the
  standalone warmup (best-in-class per comparisons; includes spam tests);
  retest outlook.com rows in ~4 weeks to verify.

## 3. Coach recipient behaviour model

- Coaches are phone-first, NOT desk workers. Evening = sessions (6-9pm),
  not email time. Junk folder on a phone is essentially invisible —
  junk = never existed. Inbox-placed mail gets a notification glance:
  subject + first ~8 words of preview text carry the whole game.
- Admin "sit-downs" are batched/prompted: Sunday night or Monday morning
  typically. Junk-checking is a prompted, rare, pattern-matching behaviour
  (they scan for known form-notification senders — Paperform/Typeform —
  not unknown names).
- Coaches with enquiry-form funnels (George, G&H, Paul, Josh) DO trawl
  junk occasionally because they've lost leads there. DM-funnel coaches
  (Zara, Gabby, Jamie) never look.
- Our subject "Coaching enquiry" pattern-matches a lead in a junk trawl —
  accidental advantage.
- Email = filing cabinet for the offer (permanent, searchable); DM =
  the pointer that makes them look.

## 4. Channel map and coverage (12 built pitch sites)

- WhatsApp numbers held/verifiable: **Gabby** (+44 7745 733364, sent),
  **Kim** (+44 7471 581970), **Tom/trainedbytr** (+44 7769 695943, HYROX
  coach directory + Fresha), **Elation** (07555 236806 on PlaySport;
  07472 677727 scraped — verify which is live). ~1/3 of board.
- No numbers: Zara (DM/form only), George, Jade, Jamie, Josh, Paul, G&H
  (Typeform-gated), Faisal (agent: Becca Barr office 020 3137 2980).
- Link-in-bio check (linktr.ee/liinks) found NO wa.me links on Zara,
  Elation, George, Josh, Paul, G&H pages.
- IG DM without a link is the safe nudge: text-only DMs don't trip spam
  filters; a reply moves the thread out of requests. Pace ~5-8/day,
  varied wording. NEVER send links in cold DMs (account-killing pattern).
- WhatsApp > email for delivery certainty (ticks show delivered).

## 5. Funnel timing model

- Realistic arc: opens days 1-4 (Fri-morning coffee, Sun-night admin),
  replies days 4-10 clustered around the deadline.
- Inbox burial (reverse-chronological) is the residual failure mode now
  that junk is largely ruled out; the Thursday deadline counteracts it.
- Nudge timing: ~48-72h after send, ONLY to prospects with zero tracking
  hits (surgical, not blanket). Wording preserves the "coaching enquiry"
  intrigue — "sent you something Thursday about your coaching, may have
  landed in junk".
- Send days: Thursday edges Tuesday for coach-direct (3 days to the
  Sunday-night sit-down vs 5). Agent-routed (Faisal): Tue-Wed ~9-10am
  office timing, deadline ~14 days not 9 (two people's latency).
- Cadence: build 1/day, send Tue+Thu ~11am-1pm, deadline Thursday of the
  FOLLOWING week (~9 days). Nudges Fri/Mon before each batch's deadline.

## 6. Funnel conversion model (honest, unproven)

Stages: lands ~95% → opens ~55% (75-85% with nudges) → click ~75% →
genuinely engaged ~50-65% → buy ~30%.
- Blended ~10-13% of sends ≈ **1 in 8**; optimistic ~1 in 5-6.
- Chris's 1-in-3 applies to ENGAGED readers; multiplied stages pull the
  blended number down. Tracker per-stage data settles it after 2 batches.
- Levers: platform-first click + "watch walkthrough" banner on demo
  (loop not fork), video cover showing THEIR brand not a dark card,
  90-sec cut above the full tour, "built for you/private" context carried
  in the email text, social proof logos as customers land.
- Financial arc (7 sends/wk): MRR ~£300 end Nov → ~£750 end Dec →
  **~£1,100-1,400 end Jan**, banked ~£5-6.5k cum. Year-1: ~£5k MRR,
  ~£50k banked, churn-adj ~46 customers. Faisal is an out-of-model
  lottery (halo + inbound + £495/mo).

## 7. Pitch-page change shipped tonight

- All six sent pitch pages gained a `pitch__skip` line above the video:
  "See your platform — and a guided tour here." Platform link = instant
  gratification for skimmers; video keeps the pitch for watchers.
- Deployed to station9studio.co.uk (commit 27de5fda on publish branch);
  mirrored to main repo (commit 482877aa).
- Tracking reads skimmers: view → site_visit with no play.

## 8. Email standard going forward

- ONE link: the pitch URL. Platform reachable from pitch page.
- roxjaya proof demoted to plain-text "roxjaya dot com".
- Price + deadline IN the email (skimmers who never watch still see the
  offer); "held until Thursday, then another coach in your area, no drama".
- "Built for you / private preview / only you have this link" context in
  the body — required if platform becomes the first click.
- Drafts being refreshed to this standard (elationfitness.email.md done;
  jadeskillen, jamiebarker, faisalpma pending Chris approval).
