// Roxjaya — curated Hyrox Asia news discovery.
//
// Reads a handful of RSS feeds (official hyrox.com plus a Google News search
// scoped to Asia), keeps only recent Hyrox stories, and posts at most a few per
// run to the site's approval inbox as `news` candidates. Nothing is published:
// Dina writes/edits the two-line summary and optional take on the Coach's desk,
// then taps Publish, which prepends the item to roxjaya/data/news.json.
//
// Usage:
//   node roxjaya/automation/news-sync.js           # dry run, prints candidates
//   SITE_URL=https://… ADMIN_API_KEY=… node roxjaya/automation/news-sync.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
const SITE_URL = String(process.env.SITE_URL || "").replace(/\/+$/, "");
const ADMIN_KEY = String(process.env.ADMIN_API_KEY || "");
const UA = "Mozilla/5.0 (compatible; RoxjayaSync/1.0; +https://roxjaya.com)";

export const FEEDS = [
  { url: "https://hyrox.com/feed/", name: "HYROX" },
  {
    url:
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent(
        'hyrox (asia OR jakarta OR indonesia OR singapore OR bangkok OR "hong kong" OR seoul OR "kuala lumpur" OR manila OR taipei OR tokyo)',
      ) +
      "&hl=en-SG&gl=SG&ceid=SG:en",
    name: "Google News",
  },
];

export const MAX_PER_RUN = 4;
export const MAX_AGE_DAYS = 14;

const ASIA_RE =
  /\b(asia|jakarta|indonesia|bali|singapore|bangkok|thailand|hong kong|seoul|korea|kuala lumpur|malaysia|manila|philippines|taipei|taiwan|tokyo|japan|dubai|melbourne|sydney|australia)\b/i;
// Steer clear of stories Dina would never want on a coaching site.
const BLOCK_RE =
  /\b(dies?|died|death|dead|killed|collapse[sd]?|lawsuit|sued|arrest|assault|scandal|doping|banned|cheat|fraud|steroid|hospitali[sz]ed)\b/i;

const decode = (s) =>
  String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
};

export function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&[a-z#0-9]+;/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

/** Parse an RSS 2.0 feed into plain items. Malformed input yields []. */
export function parseFeed(xml, feedName = "") {
  const out = [];
  const src = String(xml || "");
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(src))) {
    const it = m[1];
    let title = tag(it, "title");
    let sourceName = tag(it, "source") || feedName;
    // Google News formats titles as "Headline - Publisher".
    if (feedName === "Google News") {
      const cut = title.lastIndexOf(" - ");
      if (cut > 10) {
        if (!tag(it, "source")) sourceName = title.slice(cut + 3).trim();
        title = title.slice(0, cut).trim();
      }
    }
    const link = tag(it, "link") || tag(it, "guid");
    const dateMs = Date.parse(tag(it, "pubDate"));
    if (!title || !/^https?:\/\//i.test(link) || !Number.isFinite(dateMs))
      continue;
    out.push({
      title: title.slice(0, 160),
      link,
      date: new Date(dateMs).toISOString().slice(0, 10),
      sourceName: sourceName.slice(0, 60),
      excerpt: tag(it, "description").slice(0, 400),
    });
  }
  return out;
}

/**
 * Keep recent, on-topic, non-sensitive stories; drop anything already
 * published or whose headline we've seen. Returns at most `max` items, newest
 * first.
 */
export function selectNews(
  items,
  { today, published = [], max = MAX_PER_RUN },
) {
  const now = Date.parse(today);
  const seen = new Set(published.map((p) => slug(p.title)));
  const picked = [];
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  for (const it of sorted) {
    const ageDays = (now - Date.parse(it.date)) / 86400000;
    if (!(ageDays >= -1 && ageDays <= MAX_AGE_DAYS)) continue;
    const text = `${it.title} ${it.excerpt}`;
    if (!/hyrox/i.test(text)) continue;
    if (!ASIA_RE.test(text) && !/hyrox\.com/i.test(it.link)) continue;
    if (BLOCK_RE.test(it.title)) continue;
    const key = slug(it.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    picked.push(it);
    if (picked.length >= max) break;
  }
  return picked;
}

/** Turn selected stories into inbox candidates with an editable summary/take. */
export function buildNewsCandidates(items) {
  return items.map((it) => {
    const id = `${it.date}-${slug(it.title).slice(0, 50)}`;
    return {
      key: `news:${id}`,
      kind: "news",
      title: it.title,
      summary: "",
      source: it.link,
      editable: ["summary", "take"],
      data: {
        date: it.date,
        sourceName: it.sourceName,
        summary: "",
        take: "",
        hint: "Write 2–3 lines in your own words (facts only), add your take if you like, then Publish.",
      },
      apply: [
        {
          file: "roxjaya/data/news.json",
          path: "items",
          op: "prepend",
          value: {
            id,
            date: it.date,
            title: it.title,
            summary: "",
            take: "",
            source: it.link,
            sourceName: it.sourceName,
          },
        },
      ],
    };
  });
}

async function fetchFeed(feed) {
  const r = await fetch(feed.url, {
    headers: { "user-agent": UA, accept: "application/rss+xml, text/xml, */*" },
  });
  if (!r.ok) throw new Error(`${feed.name} ${r.status}`);
  return parseFeed(await r.text(), feed.name);
}

async function main() {
  const published = (() => {
    try {
      const j = JSON.parse(
        fs.readFileSync(path.join(dataDir, "news.json"), "utf8"),
      );
      return Array.isArray(j.items) ? j.items : [];
    } catch {
      return [];
    }
  })();
  const items = [];
  for (const feed of FEEDS) {
    try {
      const got = await fetchFeed(feed);
      console.log(`${feed.name}: ${got.length} item(s)`);
      items.push(...got);
    } catch (err) {
      console.warn(`${feed.name}: skipped (${err.message})`);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const picked = selectNews(items, { today, published });
  const candidates = buildNewsCandidates(picked);
  for (const c of candidates)
    console.log(` - [news] ${c.title} (${c.data.sourceName}, ${c.data.date})`);
  if (!candidates.length) console.log("nothing new worth a look");
  if (!SITE_URL || !ADMIN_KEY) {
    console.log("dry run (set SITE_URL + ADMIN_API_KEY to post to the inbox)");
    return;
  }
  if (!candidates.length) return;
  const r = await fetch(`${SITE_URL}/admin/inbox`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": ADMIN_KEY },
    body: JSON.stringify({ candidates }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`inbox ${r.status}: ${JSON.stringify(body)}`);
  console.log(
    `inbox: +${body.added} new, ${body.updated} updated, ${body.pending} pending`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
