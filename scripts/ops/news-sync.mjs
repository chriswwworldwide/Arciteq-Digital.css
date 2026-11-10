// Generic per-tenant HYROX news sync — ported from roxjaya/automation/news-sync.js.
// Reads the official HYROX feed plus a Google News query, keeps recent
// on-topic stories for the tenant's region, and posts up to MAX_PER_RUN draft
// `news` candidates to the owner inbox. Nothing publishes until the coach
// edits/approves — the candidate lands with an editable summary.
//
// Usage:
//   node scripts/ops/news-sync.mjs --tenant underdog           # dry run
//   node scripts/ops/news-sync.mjs --all
//   SITE_URL=https://… ADMIN_API_KEY=… node scripts/ops/news-sync.mjs --tenant underdog
//
// Per-tenant overrides in data/tenants.json → automation.news:
//   { "query": "hyrox (uk OR england OR london)", "region": ["uk","england","london"] }
// Defaults: query 'hyrox', no region filter (all HYROX stories accepted).

import { pathToFileURL } from 'node:url';
import { getTenant, readTenantJson, postInbox, tenantArgs, SITE_URL, ADMIN_KEY } from './lib.mjs';

const UA = 'Mozilla/5.0 (compatible; Station9Ops/1.0; +https://www.station9studio.co.uk)';
const MAX_PER_RUN = 4;
const MAX_AGE_DAYS = 14;

// Stories a coaching site should never carry.
const BLOCK_RE =
  /\b(dies?|died|death|dead|killed|collapse[sd]?|lawsuit|sued|arrest|assault|scandal|doping|banned|cheat|fraud|steroid|hospitali[sz]ed)\b/i;

const decode = (s) =>
  String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
};

export function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&[a-z#0-9]+;/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

export function parseFeed(xml, feedName = '') {
  const out = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(String(xml || '')))) {
    const it = m[1];
    let title = tag(it, 'title');
    let sourceName = tag(it, 'source') || feedName;
    if (feedName === 'Google News') {
      const cut = title.lastIndexOf(' - ');
      if (cut > 10) {
        if (!tag(it, 'source')) sourceName = title.slice(cut + 3).trim();
        title = title.slice(0, cut).trim();
      }
    }
    const link = tag(it, 'link') || tag(it, 'guid');
    const dateMs = Date.parse(tag(it, 'pubDate'));
    if (!title || !/^https?:\/\//i.test(link) || !Number.isFinite(dateMs)) continue;
    out.push({
      title: title.slice(0, 160),
      link,
      date: new Date(dateMs).toISOString().slice(0, 10),
      sourceName: sourceName.slice(0, 60),
      excerpt: tag(it, 'description').slice(0, 400),
    });
  }
  return out;
}

function feedsFor(cfg) {
  const query = cfg.query || 'hyrox';
  const feeds = [{ url: 'https://hyrox.com/feed/', name: 'HYROX' }];
  if (query) {
    feeds.push({
      url:
        'https://news.google.com/rss/search?q=' +
        encodeURIComponent(query) +
        '&hl=en-GB&gl=GB&ceid=GB:en',
      name: 'Google News',
    });
  }
  return feeds;
}

export function selectNews(items, { today, published = [], max = MAX_PER_RUN, regionRe = null }) {
  const now = Date.parse(today);
  const seen = new Set(published.map((p) => slug(p.title)));
  const picked = [];
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  for (const it of sorted) {
    const ageDays = (now - Date.parse(it.date)) / 86400000;
    if (!(ageDays >= -1 && ageDays <= MAX_AGE_DAYS)) continue;
    const text = `${it.title} ${it.excerpt}`;
    if (!/hyrox/i.test(text)) continue;
    if (regionRe && !regionRe.test(text) && !/hyrox\.com/i.test(it.link)) continue;
    if (BLOCK_RE.test(it.title)) continue;
    const key = slug(it.title);
    const topic = key.includes('youngstars') ? 'hyrox-youngstars' : key;
    if (!key || seen.has(key) || picked.some((p) => p.topic === topic)) continue;
    seen.add(key);
    picked.push({ ...it, topic });
    if (picked.length >= max) break;
  }
  return picked;
}

export function plainExcerpt(html) {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return `${text.slice(0, 280)}${text.length > 280 ? '…' : ''} (via source)`;
}

export function buildNewsCandidates(items, tenantId, coachName) {
  return items.map((it) => {
    const id = `${it.date}-${slug(it.title).slice(0, 50)}`;
    const excerpt = plainExcerpt(it.excerpt);
    const summary =
      excerpt.length > it.title.length + 30
        ? excerpt
        : `Recent HYROX coverage from ${it.sourceName}. Open the source for the full story.`;
    return {
      key: `news:${id}`,
      kind: 'news',
      title: it.title,
      summary,
      source: it.link,
      editable: ['summary', 'take'],
      data: {
        date: it.date,
        sourceName: it.sourceName,
        summary,
        take: '',
        hint: `Write 2–3 lines in your own words (facts only), add your take if you like, then Publish.`,
      },
      apply: [
        {
          file: `${tenantId}/data/news.json`,
          path: 'items',
          op: 'prepend',
          value: {
            id,
            date: it.date,
            title: it.title,
            summary,
            take: '',
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
    headers: { 'user-agent': UA, accept: 'application/rss+xml, text/xml, */*' },
  });
  if (!r.ok) throw new Error(`${feed.name} ${r.status}`);
  return parseFeed(await r.text(), feed.name);
}

async function runFor(tenantId) {
  const tenant = getTenant(tenantId);
  const cfg = tenant.automation?.news || {};
  const regionRe = Array.isArray(cfg.region) && cfg.region.length
    ? new RegExp(`\\b(${cfg.region.join('|')})\\b`, 'i')
    : null;
  const published = (readTenantJson(tenant, 'news.json', { items: [] }).items) || [];

  const items = [];
  for (const feed of feedsFor(cfg)) {
    try { items.push(...await fetchFeed(feed)); console.log(`${tenantId} ${feed.name}: ${items.length} item(s)`); }
    catch (err) { console.warn(`${tenantId} ${feed.name}: skipped (${err.message})`); }
  }
  const today = new Date().toISOString().slice(0, 10);
  const picked = selectNews(items, { today, published, regionRe });
  const candidates = buildNewsCandidates(picked, tenantId);
  for (const c of candidates) console.log(` - [news] ${c.title} (${c.data.sourceName}, ${c.data.date})`);
  if (!candidates.length) { console.log(`${tenantId}: nothing new worth a look`); return; }
  if (!SITE_URL || !ADMIN_KEY) { console.log('dry run (set SITE_URL + ADMIN_API_KEY to post to the inbox)'); return; }
  const res = await postInbox(tenantId, candidates);
  console.log(`${tenantId} inbox: +${res.added} new, ${res.updated} updated, ${res.pending} pending`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const ids = tenantArgs();
  if (!ids) {
    console.error('Usage: node scripts/ops/news-sync.mjs --tenant <id>[,<id>] | --all');
    process.exit(1);
  }
  for (const id of ids) {
    try { await runFor(id); }
    catch (err) { console.error(`${id}: ${err.message}`); }
  }
}
