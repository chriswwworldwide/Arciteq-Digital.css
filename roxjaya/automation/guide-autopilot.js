// roxjaya/automation/guide-autopilot.js
// Fortnightly freshness job. Picks an uncovered topic, asks Claude for an
// original guide in Dina's voice, validates it (length, structure, FAQs,
// not a near-duplicate of anything already published) and posts it to the
// site's admin guides API, which stores it in Postgres and serves it at
// /roxjaya/guides/<slug>/ immediately — no redeploy, no owner action.
//
// Usage:
//   SITE_URL=https://roxjaya.com ADMIN_API_KEY=... ANTHROPIC_API_KEY=... node roxjaya/automation/guide-autopilot.js
//   node roxjaya/automation/guide-autopilot.js --dry   # draft + validate, don't publish
//   MIN_DAYS=0 ...                                      # ignore the fortnight gap

import { validateGuide, nearDuplicate } from "../../src/guides.js";

const SITE_URL = String(process.env.SITE_URL || "").replace(/\/+$/, "");
const ADMIN_KEY = String(process.env.ADMIN_API_KEY || "");
const ANTHROPIC_KEY = String(process.env.ANTHROPIC_API_KEY || "");
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MIN_DAYS = Number(process.env.MIN_DAYS ?? 13);
const DRY = process.argv.includes("--dry");

// Topics are deliberately specific so two guides can't drift into the same
// page. Existing static pages (stations, run, fuel, taper, Jakarta event) are
// not repeated here.
export const TOPICS = [
  "Your first HYROX in Jakarta: a 12-week beginner plan for women who already go to the gym",
  "Wall balls for women: 75 reps without failing — height, rhythm and the 'break before you need to' rule",
  "Sled push and sled pull on a slow carpet: how Asian venues differ and how to adjust pacing",
  "HYROX Doubles strategy for mixed and women's pairs: who takes what, and how to hand over",
  "Burpee broad jumps: the technique that saves your lower back and 60 seconds",
  "SkiErg for runners: pacing by damper setting, stroke rate and height",
  "Farmers carry and sandbag lunges: grip, core and the last 200 m",
  "Rowing 1,000 m in HYROX: split targets for Open and Pro women",
  "HYROX Singapore from Jakarta: flights, hotels near the venue, race-week food and timing",
  "HYROX Bangkok from Jakarta: travel, venue, heat and what to pack",
  "HYROX Hong Kong and Seoul for Indonesian athletes: entry, visas and race logistics",
  "Jakarta gyms with HYROX equipment: what to check before you join",
  "Training HYROX during Ramadan: fasting-friendly sessions, hydration and timing",
  "Strength standards for a sub-90 minute women's HYROX: squat, deadlift, press",
  "Hybrid training week: how to combine running, strength and HYROX stations in 5 sessions",
  "From 10K runner to HYROX finisher: what changes in your training",
  "Recovery between HYROX sessions in a hot climate: sleep, electrolytes, deload weeks",
  "Reading your HYROX split times: which station to fix first",
  "Race-day warm-up for HYROX: a 20-minute routine that works in a crowded corral",
  "HYROX Pro vs Open for women: weights, who should move up, and when",
  "Shoes and kit for HYROX: grip for sleds, cushioning for 8 km, what not to buy",
  "Mental skills for HYROX: pacing plans, 'next station only' thinking and the rowing slump",
  "Common HYROX mistakes first-timers in Indonesia make, and the fix for each",
  "Building a HYROX community in your Indonesian city: squad sims, meet-ups and race trips",
];

async function api(pathname, init = {}) {
  const res = await fetch(`${SITE_URL}${pathname}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-admin-key": ADMIN_KEY,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok)
    throw new Error(`${pathname} ${res.status}: ${text.slice(0, 200)}`);
  return json;
}

function daysSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

export function pickTopic(existing, topics = TOPICS) {
  const used = new Set(
    (existing || []).map((g) => String(g.source || "").toLowerCase()),
  );
  return topics.find((t) => !used.has(t.toLowerCase())) || null;
}

export function buildPrompt(topic, existingTitles) {
  return `You are ghost-writing for Dina Rosdiana, HYROX Certified Coach, HYROX podium athlete and personal trainer in Jakarta, Indonesia. She coaches mostly women, in Jakarta and online.

Write an original, practical guide on this exact topic:
"${topic}"

Rules:
- British English, first person as Dina, direct and warm, no hype, no filler. Specific numbers (weights, reps, paces, minutes) wherever honest. Women's Open weights are the default; mention Pro where relevant.
- 700–1100 words of body. Use <h3> for 4–6 sections and <h4> sparingly. Allowed tags: h3, h4, p, ul, ol, li, strong, em, a. No images, no inline styles, no scripts.
- Where natural, link once each to /roxjaya/stations-prep/, /roxjaya/run-zone/, /roxjaya/splits/ or /roxjaya/hyrox-jakarta/ (relative hrefs only).
- Include one or two Indonesian phrases naturally where a Jakarta reader would use them (e.g. "latihan", "pelatih", "jadwal") — do not translate the whole guide.
- Do not repeat these existing guides: ${existingTitles.join("; ") || "(none yet)"}.
- End with a short, honest sentence pointing to Dina's hybrid coaching at /roxjaya/hybrid-coaching-jakarta/.

Return ONLY a JSON object (no markdown fences) with keys:
title (10–110 chars, includes "HYROX"), description (50–160 chars, for the meta tag), eyebrow (2–4 words), lead (one sentence, max 220 chars), body_html (string), faqs (array of 3–5 {q, a} with plain-text answers of 1–3 sentences).`;
}

async function draft(topic, existingTitles) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: buildPrompt(topic, existingTitles) }],
    }),
  });
  if (!res.ok)
    throw new Error(
      `anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || "").join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("model returned no JSON");
  return JSON.parse(text.slice(start, end + 1));
}

async function main() {
  if (!SITE_URL || !ADMIN_KEY)
    throw new Error("SITE_URL and ADMIN_API_KEY are required");
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY is required");
  const { guides: existing = [] } = await api("/admin/guides");
  const newest = existing[0]?.published_at;
  if (daysSince(newest) < MIN_DAYS) {
    console.log(
      `latest guide is ${daysSince(newest).toFixed(1)} days old (< ${MIN_DAYS}); nothing to do`,
    );
    return;
  }
  const topic = pickTopic(existing);
  if (!topic) {
    console.log("all topics covered — add more to TOPICS");
    return;
  }
  console.log(`topic: ${topic}`);
  let published = false;
  for (let attempt = 1; attempt <= 2 && !published; attempt++) {
    const raw = await draft(
      topic,
      existing.map((g) => g.title),
    );
    const checked = validateGuide({ ...raw, source: topic });
    if (checked.error) {
      console.log(`attempt ${attempt}: rejected — ${checked.error}`);
      continue;
    }
    const dup = nearDuplicate(checked.guide, existing);
    if (dup) {
      console.log(
        `attempt ${attempt}: too similar to ${dup.slug} (${dup.score.toFixed(2)})`,
      );
      continue;
    }
    console.log(`draft ok: "${checked.guide.title}" (${checked.guide.slug})`);
    if (DRY) {
      console.log(JSON.stringify(checked.guide, null, 2).slice(0, 1500));
      return;
    }
    const out = await api("/admin/guides", {
      method: "POST",
      body: JSON.stringify(checked.guide),
    });
    console.log(`published: ${out.url}`);
    published = true;
  }
  if (!published) throw new Error("no acceptable draft after 2 attempts");
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].split("/").pop())
) {
  main().catch((err) => {
    console.error(`guide-autopilot failed: ${err.message}`);
    process.exit(1);
  });
}
