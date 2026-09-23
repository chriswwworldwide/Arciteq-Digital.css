// roxjaya/automation/hyrox-sync.js
// Daily discovery job for Roxjaya. Reads HYROX's public event listing, finds
// Asia-Pacific races, compares them with roxjaya/data/cities.json and
// events.json, and posts *candidates* to the site's owner inbox. Nothing is
// published until Dina approves it from the Coach's desk. Anything this script
// can't read is posted as an alert instead of being silently skipped.
//
// Usage:
//   SITE_URL=https://roxjaya.com ADMIN_API_KEY=... node roxjaya/automation/hyrox-sync.js
//   node roxjaya/automation/hyrox-sync.js            # dry run: prints candidates
//   node roxjaya/automation/hyrox-sync.js --digest   # asks the site to send the weekly digest

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
const SITE_URL = String(process.env.SITE_URL || "").replace(/\/+$/, "");
const ADMIN_KEY = String(process.env.ADMIN_API_KEY || "");
const UA = "Mozilla/5.0 (compatible; RoxjayaSync/1.0; +https://roxjaya.com)";
const API = "https://hyrox.com/wp-json/wp/v2/event?per_page=100&page=";
const RESULTS_URL = "https://results.hyrox.com/";

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "\u2019")
    .replace(/&#8211;|&ndash;/g, "\u2013")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"');

const readJson = (f) =>
  JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf8"));

async function get(url, as = "text") {
  const r = await fetch(url, {
    headers: { "user-agent": UA },
    redirect: "follow",
  });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === "json" ? r.json() : r.text();
}

/** "11. Feb. 2027" | "7 January 2027" -> "2027-02-11" */
export function parseHyroxDate(s) {
  const m = String(s || "")
    .trim()
    .match(/^(\d{1,2})\.?\s+([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  if (!m) return null;
  const mon =
    MONTHS[m[2].toLowerCase().slice(0, 4)] ??
    MONTHS[m[2].toLowerCase().slice(0, 3)];
  if (!mon) return null;
  return `${m[3]}-${String(mon).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** "2027-02-11","2027-02-14" -> "11–14 February 2027" */
export function rangeLabel(start, end) {
  const [y1, m1, d1] = start.split("-").map(Number);
  if (!end) return `${d1} ${MONTH_NAMES[m1]} ${y1}`;
  const [y2, m2, d2] = end.split("-").map(Number);
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${MONTH_NAMES[m1]} ${y1}`;
  return `${d1} ${MONTH_NAMES[m1].slice(0, 3)} – ${d2} ${MONTH_NAMES[m2].slice(0, 3)} ${y2}`;
}

const FIELD_RE = (name) =>
  new RegExp(
    `${name}[^>]*>(?:<span class="w-post-elm-before">[^<]*</span>)?<span class="w-post-elm-value">([^<]*)<`,
  );

/** Pull start/end/address out of a hyrox.com event page. */
export function parseEventPage(html) {
  const pick = (name) => {
    const m = String(html).match(FIELD_RE(name));
    return m ? decode(m[1]).trim() : "";
  };
  const start = parseHyroxDate(pick("event_date_1"));
  const end =
    parseHyroxDate(pick("event_date_3")) ||
    parseHyroxDate(pick("event_date_2"));
  const address = pick("event_map_address");
  return { start, end, address };
}

async function listAsiaEvents() {
  const out = [];
  for (let page = 1; page <= 3; page += 1) {
    let list;
    try {
      list = await get(API + page, "json");
    } catch (err) {
      if (page > 1 && /^400 /.test(err.message)) break;
      throw err;
    }
    if (!Array.isArray(list) || !list.length) break;
    for (const e of list) {
      const classes = Array.isArray(e.class_list) ? e.class_list : [];
      const slug = String(e.slug || "");
      const asia =
        classes.includes("continent-asia-pacific") || /dubai/.test(slug);
      if (!asia || !classes.includes("type-adults")) continue;
      out.push({
        slug,
        title: decode(e.title?.rendered || slug),
        link: String(e.link || ""),
        modified: String(e.modified_gmt || ""),
      });
    }
    if (list.length < 100) break;
  }
  return out;
}

/** Map hyrox slugs to our city slugs in cities.json. */
const CITY_BY_HYROX = {
  "hyrox-jakarta": "jakarta",
  "hyrox-singapore": "singapore",
  "hyrox-seoul": "seoul",
  "hyrox-hong-kong": "hong-kong",
  "hyrox-bangkok": "bangkok",
};

export function buildCandidates({ events, cities, eventsJson, today }) {
  const out = [];
  const home = String(cities?.home || "jakarta");
  const list = Array.isArray(cities?.cities) ? cities.cities : [];
  for (const ev of events) {
    const citySlug = CITY_BY_HYROX[ev.slug];
    const idx = list.findIndex((c) => c.slug === citySlug);
    const city = idx >= 0 ? list[idx] : null;
    if (!ev.start) {
      out.push({
        key: `alert:nodates:${ev.slug}`,
        kind: "alert",
        title: `Couldn't read dates for ${ev.title}`,
        summary: `hyrox.com lists ${ev.title} but the page layout changed and the dates couldn't be read automatically. Open the source and update cities.json by hand if needed.`,
        source: ev.link,
      });
      continue;
    }
    if (ev.start < today) continue;
    const label = rangeLabel(ev.start, ev.end);
    if (!city) {
      out.push({
        key: `event:${ev.slug}:${ev.start}`,
        kind: "event",
        title: `${ev.title} — ${label}`,
        summary: `New Asia-Pacific race on hyrox.com${ev.address ? ` at ${ev.address}` : ""}. Not one of our city guides yet — approve to mark as seen, or add a city in cities.json.`,
        source: ev.link,
        data: {
          slug: ev.slug,
          start: ev.start,
          end: ev.end,
          address: ev.address,
        },
      });
      continue;
    }
    const same =
      city.race?.status === "confirmed" && city.race?.start === ev.start;
    if (same) continue;
    const apply = [
      {
        file: "roxjaya/data/cities.json",
        path: `cities.${idx}.race.status`,
        value: "confirmed",
      },
      {
        file: "roxjaya/data/cities.json",
        path: `cities.${idx}.race.dates`,
        value: label,
      },
      {
        file: "roxjaya/data/cities.json",
        path: `cities.${idx}.race.start`,
        value: ev.start,
      },
      {
        file: "roxjaya/data/cities.json",
        path: `cities.${idx}.race.source`,
        value: ev.link,
      },
      {
        file: "roxjaya/data/cities.json",
        path: `cities.${idx}.race.sourceLabel`,
        value: "hyrox.com event page",
      },
    ];
    if (ev.address) {
      apply.push({
        file: "roxjaya/data/cities.json",
        path: `cities.${idx}.race.address`,
        value: ev.address,
      });
    }
    if (citySlug === home) {
      apply.push({
        file: "roxjaya/data/events.json",
        path: "next",
        value: { name: ev.title, date: ev.start, url: ev.link },
      });
    }
    const was = city.race?.dates ? `was ${city.race.dates}` : "was TBC";
    out.push({
      key: `event:${ev.slug}:${ev.start}`,
      kind: "event",
      title: `${ev.title} — ${label}`,
      summary: `hyrox.com now shows ${ev.title} on ${label} (${was}).${citySlug === home ? " Approving also starts the countdown on the Jakarta page." : ""} Venue: ${ev.address || city.race?.venue || "see source"}.`,
      source: ev.link,
      data: {
        slug: ev.slug,
        start: ev.start,
        end: ev.end,
        address: ev.address,
      },
      apply,
    });
  }

  // Results reminder: a tracked race finished in the last 10 days.
  for (const c of list) {
    const end = c.race?.start;
    if (!end || c.race?.status !== "confirmed") continue;
    const days = (Date.parse(today) - Date.parse(end)) / 86400000;
    if (days >= 2 && days <= 10) {
      out.push({
        key: `results:${c.slug}:${end}`,
        kind: "alert",
        title: `${c.race.name} results should be out — copy Indonesian finishers into results.json`,
        summary: `${c.race.name} ran on ${c.race.dates}. Official results block automated access, so this is a reminder: open the results, copy any Indonesian finishers into roxjaya/data/results.json, then post the top 10 on IG with the link.`,
        source: RESULTS_URL,
      });
    }
  }
  void eventsJson;
  return out;
}

async function postInbox(candidates) {
  const r = await fetch(`${SITE_URL}/admin/inbox`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": ADMIN_KEY },
    body: JSON.stringify({ candidates }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`inbox ${r.status}: ${JSON.stringify(body)}`);
  return body;
}

async function sendDigest() {
  const r = await fetch(`${SITE_URL}/admin/digest/send?days=7`, {
    method: "POST",
    headers: { "x-admin-key": ADMIN_KEY },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`digest ${r.status}: ${JSON.stringify(body)}`);
  console.log(
    `digest: ${body.sent ? "sent" : `not sent (${body.reason || body.error || "?"})`} — ${body.subject}`,
  );
}

async function main() {
  if (process.argv.includes("--digest")) {
    if (!SITE_URL || !ADMIN_KEY)
      throw new Error("SITE_URL and ADMIN_API_KEY are required for --digest");
    return sendDigest();
  }
  const cities = readJson("cities.json");
  const eventsJson = readJson("events.json");
  const today = new Date().toISOString().slice(0, 10);
  const events = await listAsiaEvents();
  const detailed = [];
  for (const ev of events) {
    try {
      const html = await get(ev.link);
      detailed.push({ ...ev, ...parseEventPage(html) });
    } catch (err) {
      detailed.push({
        ...ev,
        start: null,
        end: null,
        address: "",
        error: err.message,
      });
    }
  }
  const candidates = buildCandidates({
    events: detailed,
    cities,
    eventsJson,
    today,
  });
  console.log(
    `hyrox.com: ${events.length} Asia-Pacific races, ${candidates.length} candidate(s)`,
  );
  for (const c of candidates) console.log(` - [${c.kind}] ${c.title}`);
  if (!SITE_URL || !ADMIN_KEY) {
    console.log("dry run (set SITE_URL + ADMIN_API_KEY to post to the inbox)");
    return;
  }
  const res = await postInbox(candidates);
  console.log(
    `inbox: +${res.added} new, ${res.updated} updated, ${res.pending} pending`,
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main().catch((err) => {
    console.error(`hyrox-sync failed: ${err.message}`);
    process.exit(1);
  });
}
