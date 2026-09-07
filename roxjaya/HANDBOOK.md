# Dina's handbook — running Roxjaya Warriors Jakarta

Plain English. The same text lives on the private **Coach's desk** page
(`/roxjaya/coach/` → "How to…" tab) so you never need this repo open.

## The Coach's desk

- Go to `/roxjaya/coach/` and enter the coach key once (Chris gives you it; it
  is the server's `ADMIN_API_KEY`). It's remembered on that phone/laptop.
  "Forget key" logs out.
- **Today** — what needs you this week (new leads, wall photos, split analyses,
  payments), each with a link. Plus the week's traffic at a glance.
- **Traffic** — page views and visitors by day (7/30/90 days), which pages
  people read, and where they came from (Instagram, Google, TikTok…). Anonymous:
  the site stores no names, cookies, IPs or devices for this — just the page,
  the referring site, the `utm_source` tag and a random daily visitor code.
- **People** — everyone who has given their email: what they told you (goal,
  days/week, city, the plan the site suggested), what they sent (splits, wall
  photo caption), which pages they read _after_ identifying themselves, and
  their payment timeline. Search by email, or by `paid`, `wall_photo`,
  `race_splits`. Deep links work: `/roxjaya/coach/#people?q=wall_photo`.
- Not shown to anyone: individual race split histories stay behind each
  athlete's own private link; the public only sees anonymous medians.

## Weekly routine (10 minutes)

1. Open Today, work the list top to bottom.
2. Monday IG post: one guide tip with the page link + `?utm_source=ig`.
3. Thursday: one client win from the Results wall (with their OK).
4. After every race: Indonesia top-10 post tagging the athletes, plus a
   "send me your race photo for the Wall" story. This is the habit that makes
   the results board, the wall and the split databank fill up.
5. A week later, check Traffic → "Where people came from" to see what worked.

## Doing things

| Task                          | Where                                                   | Notes                                                                                                                     |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Reply to a lead               | People → newest first → "Reply by email"                | Within 24 h; mention something specific they wrote.                                                                       |
| Approve a wall photo          | People (`wall_photo`) + the photo from WhatsApp/IG      | Check consent and nobody identifiable without their OK. Then see below.                                                   |
| Put a photo on the wall       | `roxjaya/data/gallery.json` + `roxjaya/images/gallery/` | One row: `src`, `caption`, `by`, `event`. Event tabs appear automatically.                                                |
| Add race results              | `roxjaya/data/results.json`                             | From results.hyrox.com; one row per finisher under the division. Sorted auto.                                             |
| Results wall / Dina's week    | `roxjaya/data/wall.json`                                | `athletes` only with consent; `weeks` newest first (latest 3 shown).                                                      |
| Approve a race date           | Today → "Waiting for your OK" → Approve & publish       | The daily check finds new Asia dates on hyrox.com. Tap "Check source" first; approving updates the site + countdown.      |
| Publish a news item           | Today → "Waiting for your OK" → write 2–3 lines → Publish | Daily scan drops up to 4 Hyrox Asia stories in. Your own words only, optional "Dina's take"; nothing publishes without a summary. Appears on /roxjaya/news/. |
| Countdown / next race         | `roxjaya/data/events.json` → `next`                     | Confirmed hyrox.com dates only; `null` hides it. Shows on Events + Jakarta page. Usually set for you by approving above.  |
| Asia race dates / city guides | `roxjaya/data/cities.json`                              | Per city: `race.status` `confirmed` + `dates` + `start` (YYYY-MM-DD), or `tbc`. Update `checked` when you refresh prices. |
| Warriors meet-up at a race    | `roxjaya/data/cities.json` → city → `meetup`            | `{ "when", "where", "note" }` shows a pink meet-up box on that city; `null` hides it.                                     |
| Founding seats                | `roxjaya/data/seats.json` → `taken`                     | Real numbers only; `null` hides the line.                                                                                 |
| TrueCoach login link          | `roxjaya/data/links.json` → `truecoach`                 | Footer "Athlete login" appears once set.                                                                                  |
| WhatsApp number               | Ask Chris (one server value)                            | Powers the Ask Dina / Send-your-shot buttons.                                                                             |

Empty fields never break the page — they just hide that bit.

## What is automatic

Payments, subscriptions and renewals, lead capture and plan recommendation,
split saving and the databank medians, wall-photo requests, traffic counting,
the daily hyrox.com date check (05:15 Jakarta; finds go to "Waiting for your
OK", nothing publishes until you tap Approve), and the Monday digest email
(everything that needs you, each line a link into the desk). Results are the
exception: official results block robots, so once each race finishes the
desk reminds you to copy the Indonesian finishers into `results.json`.
If a number looks wrong, message Chris; don't edit the server.

## What still needs setting up (Chris)

- Production database + run migrations 005–008 (`008_add_page_views.sql` is
  the traffic table).
- `ADMIN_API_KEY` on the server (this is the coach key).
- GitHub secrets `ROXJAYA_SITE_URL` + `ROXJAYA_ADMIN_KEY` so the daily date
  check and Monday digest can reach the live site; Dina's email in
  `tenants.json` → roxjaya → `automation.digestTo` (server needs sendmail or
  `ALERT_EMAIL_TO` fallback).
- Stripe or Xendit keys — until then plan buttons say "message Dina".
- Dina's WhatsApp number, TrueCoach URL, real photos, the exact HYROX
  certificate title, and the 2027 Jakarta date when HYROX publishes it.
