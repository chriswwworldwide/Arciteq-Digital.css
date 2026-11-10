// Generic per-tenant HYROX event sync — ported from roxjaya/automation/hyrox-sync.js.
// Reads HYROX's public event listing, keeps races in the tenant's region,
// diffs against <tenant>/data/cities.json + events.json, and posts *candidates*
// to the owner inbox. Nothing publishes until the coach approves it.
//
// Usage:
//   node scripts/ops/hyrox-sync.mjs --tenant underdog           # dry run
//   node scripts/ops/hyrox-sync.mjs --all                       # every coaching tenant, dry run
//   SITE_URL=https://… ADMIN_API_KEY=… node scripts/ops/hyrox-sync.mjs --tenant underdog
//   SITE_URL=… ADMIN_API_KEY=… node scripts/ops/hyrox-sync.mjs --tenant underdog --digest
//
// Per-tenant overrides in data/tenants.json → automation.hyrox:
//   { "continents": ["continent-europe"], "includeSlugs": "dubai|hong-kong",
//     "cityMap": {"hyrox-rimini":"rimini"} }
// Defaults: continent-europe races only.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  getTenant, dataDirFor, readTenantJson, postInbox, sendDigest,
  tenantArgs, SITE_URL, ADMIN_KEY,
} from './lib.mjs';

const API = 'https://hyrox.com/wp-json/wp/v2/event?per_page=100&page=';
const RESULTS_URL = 'https://results.hyrox.com/';

const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12 };
const MONTH_NAMES = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

const decode = (s) => String(s || '')
  .replace(/&amp;/g, '&')
  .replace(/&#8217;|&rsquo;/g, '’')
  .replace(/&#8211;|&ndash;/g, '–')
  .replace(/&#0?39;/g, "'")
  .replace(/&quot;/g, '"');

async function get(url, as = 'text', ua) {
  const r = await fetch(url, { headers: { 'user-agent': ua }, redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === 'json' ? r.json() : r.text();
}

export function parseHyroxDate(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})\.?\s+([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase().slice(0, 4)] ?? MONTHS[m[2].toLowerCase().slice(0, 3)];
  if (!mon) return null;
  return `${m[3]}-${String(mon).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export function rangeLabel(start, end) {
  const [y1, m1, d1] = start.split('-').map(Number);
  if (!end) return `${d1} ${MONTH_NAMES[m1]} ${y1}`;
  const [y2, m2, d2] = end.split('-').map(Number);
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${MONTH_NAMES[m1]} ${y1}`;
  return `${d1} ${MONTH_NAMES[m1].slice(0, 3)} – ${d2} ${MONTH_NAMES[m2].slice(0, 3)} ${y2}`;
}

const FIELD_RE = (name) =>
  new RegExp(`${name}[^>]*>(?:<span class="w-post-elm-before">[^<]*</span>)?<span class="w-post-elm-value">([^<]*)<`);

export function parseEventPage(html) {
  const pick = (name) => {
    const m = String(html).match(FIELD_RE(name));
    return m ? decode(m[1]).trim() : '';
  };
  return {
    start: parseHyroxDate(pick('event_date_1')),
    end: parseHyroxDate(pick('event_date_3')) || parseHyroxDate(pick('event_date_2')),
    address: pick('event_map_address'),
  };
}

async function listEvents({ continents, includeRe, ua }) {
  const out = [];
  for (let page = 1; page <= 3; page += 1) {
    let list;
    try { list = await get(API + page, 'json', ua); }
    catch (err) {
      if (page > 1 && /^400 /.test(err.message)) break;
      throw err;
    }
    if (!Array.isArray(list) || !list.length) break;
    for (const e of list) {
      const classes = Array.isArray(e.class_list) ? e.class_list : [];
      const slug = String(e.slug || '');
      const inRegion = continents.some((c) => classes.includes(c)) || (includeRe && includeRe.test(slug));
      if (!inRegion || !classes.includes('type-adults')) continue;
      out.push({
        slug,
        title: decode(e.title?.rendered || slug),
        link: String(e.link || ''),
        modified: String(e.modified_gmt || ''),
      });
    }
    if (list.length < 100) break;
  }
  return out;
}

// hyrox.com slug "hyrox-hong-kong" → cities.json slug "hong-kong" by default.
export function citySlugFor(hyroxSlug, cities, overrides = {}) {
  if (overrides[hyroxSlug]) return overrides[hyroxSlug];
  const bare = hyroxSlug.replace(/^hyrox-/, '');
  const slugs = (cities?.cities || []).map((c) => c.slug);
  if (slugs.includes(bare)) return bare;
  return slugs.find((s) => bare.includes(s) || s.includes(bare)) || null;
}

export function buildCandidates({ events, cities, today, tenantId, homeNote }) {
  const out = [];
  const rel = (f) => `${tenantId}/data/${f}`;
  const home = String(cities?.home || '');
  const list = Array.isArray(cities?.cities) ? cities.cities : [];
  const overrides = {};
  for (const ev of events) {
    const citySlug = citySlugFor(ev.slug, cities, overrides);
    const idx = list.findIndex((c) => c.slug === citySlug);
    const city = idx >= 0 ? list[idx] : null;
    if (!ev.start) {
      out.push({
        key: `alert:nodates:${ev.slug}`,
        kind: 'alert',
        title: `Couldn't read dates for ${ev.title}`,
        summary: `hyrox.com lists ${ev.title} but the page layout changed and the dates couldn't be read automatically. Open the source and update cities.json by hand if needed.`,
        source: ev.link,
      });
      continue;
    }
    if (ev.start < today) continue;
    const label = rangeLabel(ev.start, ev.end);
    if (!city) {
      const alsoOn = Array.isArray(cities?.alsoOn) ? cities.alsoOn : [];
      const alsoIdx = alsoOn.findIndex((race) => race.source === ev.link || race.name === ev.title);
      if (alsoIdx >= 0 && alsoOn[alsoIdx].start === ev.start) continue;
      const value = {
        name: ev.title,
        city: ev.title.replace(/^.*?HYROX\s+/i, ''),
        flag: '',
        nickname: '',
        dates: label,
        start: ev.start,
        venue: ev.address || 'Venue TBA — confirm on hyrox.com',
        note: 'Race listed by HYROX in your region.',
        source: ev.link,
      };
      const apply = alsoIdx >= 0
        ? [{ file: rel('cities.json'), path: `alsoOn.${alsoIdx}`, value }]
        : [{ file: rel('cities.json'), path: 'alsoOn', op: 'prepend', value }];
      out.push({
        key: `event:${ev.slug}:${ev.start}`,
        kind: 'event',
        title: `${ev.title} — ${label}`,
        summary: `New race on hyrox.com${ev.address ? ` at ${ev.address}` : ''}.`,
        source: ev.link,
        data: { slug: ev.slug, start: ev.start, end: ev.end, address: ev.address },
        apply,
      });
      continue;
    }
    if (city.race?.status === 'confirmed' && city.race?.start === ev.start) continue;
    const apply = [
      { file: rel('cities.json'), path: `cities.${idx}.race.status`, value: 'confirmed' },
      { file: rel('cities.json'), path: `cities.${idx}.race.dates`, value: label },
      { file: rel('cities.json'), path: `cities.${idx}.race.start`, value: ev.start },
      { file: rel('cities.json'), path: `cities.${idx}.race.source`, value: ev.link },
      { file: rel('cities.json'), path: `cities.${idx}.race.sourceLabel`, value: 'hyrox.com event page' },
    ];
    if (ev.address) apply.push({ file: rel('cities.json'), path: `cities.${idx}.race.address`, value: ev.address });
    if (citySlug === home) {
      apply.push({ file: rel('events.json'), path: 'next', value: { name: ev.title, date: ev.start, url: ev.link } });
    }
    const was = city.race?.dates ? `was ${city.race.dates}` : 'was TBC';
    out.push({
      key: `event:${ev.slug}:${ev.start}`,
      kind: 'event',
      title: `${ev.title} — ${label}`,
      summary: `hyrox.com now shows ${ev.title} on ${label} (${was}).${citySlug === home ? ` Approving also updates the ${home} countdown.` : ''} Venue: ${ev.address || city.race?.venue || 'see source'}.`,
      source: ev.link,
      data: { slug: ev.slug, start: ev.start, end: ev.end, address: ev.address },
      apply,
    });
  }
  // Results reminder: a tracked race finished in the last 10 days.
  for (const c of list) {
    const end = c.race?.start;
    if (!end || c.race?.status !== 'confirmed') continue;
    const days = (Date.parse(today) - Date.parse(end)) / 86400000;
    if (days >= 2 && days <= 10) {
      out.push({
        key: `results:${c.slug}:${end}`,
        kind: 'alert',
        title: `${c.race.name} results should be out — copy your athletes' finishers into results.json`,
        summary: `${c.race.name} ran on ${c.race.dates}. Official results block automated access, so this is a reminder: open the results, copy your athletes' finishers into results.json, then post the top finishers on social with the link.`,
        source: RESULTS_URL,
      });
    }
  }
  return out;
}

async function runFor(tenantId) {
  const tenant = getTenant(tenantId);
  const cfg = tenant.automation?.hyrox || {};
  const continents = cfg.continents || ['continent-europe'];
  const includeRe = cfg.includeSlugs ? new RegExp(cfg.includeSlugs, 'i') : null;
  const ua = `Mozilla/5.0 (compatible; Station9Ops/1.0; +https://www.station9studio.co.uk)`;
  const cities = readTenantJson(tenant, 'cities.json', {});
  const today = new Date().toISOString().slice(0, 10);

  if (process.argv.includes('--digest')) {
    if (!SITE_URL || !ADMIN_KEY) throw new Error('SITE_URL and ADMIN_API_KEY required for --digest');
    return sendDigest(tenantId);
  }
  const events = await listEvents({ continents, includeRe, ua });
  const detailed = [];
  for (const ev of events) {
    try { detailed.push({ ...ev, ...parseEventPage(await get(ev.link, 'text', ua)) }); }
    catch (err) { detailed.push({ ...ev, start: null, end: null, address: '', error: err.message }); }
  }
  const candidates = buildCandidates({ events: detailed, cities, today, tenantId });
  console.log(`${tenantId}: ${events.length} regional races, ${candidates.length} candidate(s)`);
  for (const c of candidates) console.log(` - [${c.kind}] ${c.title}`);
  if (!SITE_URL || !ADMIN_KEY) { console.log('dry run (set SITE_URL + ADMIN_API_KEY to post to the inbox)'); return; }
  if (!candidates.length) return;
  const res = await postInbox(tenantId, candidates);
  console.log(`inbox: +${res.added} new, ${res.updated} updated, ${res.pending} pending`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const ids = tenantArgs();
  if (!ids) {
    console.error('Usage: node scripts/ops/hyrox-sync.mjs --tenant <id>[,<id>] | --all [--digest]');
    process.exit(1);
  }
  for (const id of ids) {
    try { await runFor(id); }
    catch (err) { console.error(`${id}: ${err.message}`); }
  }
}
