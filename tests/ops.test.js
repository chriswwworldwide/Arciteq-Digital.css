import { describe, it, expect } from 'vitest';
import { parseHyroxDate, rangeLabel, citySlugFor, buildCandidates } from '../scripts/ops/hyrox-sync.mjs';
import { parseFeed, selectNews, slug } from '../scripts/ops/news-sync.mjs';

describe('hyrox-sync', () => {
  it('parses hyrox.com date strings', () => {
    expect(parseHyroxDate('7 Nov 2025')).toBe('2025-11-07');
    expect(parseHyroxDate('14 Dec. 2025')).toBe('2025-12-14');
    expect(parseHyroxDate('27 Febr. 2026')).toBe('2026-02-27');
    expect(parseHyroxDate('TBC')).toBeNull();
  });

  it('labels date ranges', () => {
    expect(rangeLabel('2025-11-07', '2025-11-09')).toBe('7–9 November 2025');
    expect(rangeLabel('2025-11-07')).toBe('7 November 2025');
  });

  it('maps hyrox slugs to tenant city slugs', () => {
    const cities = { cities: [{ slug: 'london' }, { slug: 'hong-kong' }] };
    expect(citySlugFor('hyrox-london', cities)).toBe('london');
    expect(citySlugFor('hyrox-hong-kong', cities)).toBe('hong-kong');
    expect(citySlugFor('hyrox-basel', cities)).toBeNull();
    expect(citySlugFor('hyrox-rimini', cities, { 'hyrox-rimini': 'rimini' })).toBe('rimini');
  });

  it('builds confirm candidates for tracked cities and skips past races', () => {
    const cities = {
      home: 'london',
      cities: [{ slug: 'london', race: { name: 'HYROX London', status: 'tbc' } }],
    };
    const events = [
      { slug: 'hyrox-london', title: 'HYROX London', link: 'https://x/1', start: '2025-12-20', end: '2025-12-21', address: 'ExCeL' },
      { slug: 'hyrox-old', title: 'Old race', link: 'https://x/2', start: '2020-01-01' },
      { slug: 'hyrox-new', title: 'HYROX Nowhere', link: 'https://x/3', start: '2026-06-01' },
    ];
    const out = buildCandidates({ events, cities, today: '2025-11-14', tenantId: 'demo' });
    expect(out).toHaveLength(2);
    const london = out.find((c) => c.key.includes('london'));
    expect(london.kind).toBe('event');
    const files = london.apply.map((a) => a.path);
    expect(files).toContain('cities.0.race.status');
    expect(files).toContain('next'); // home city updates events.json countdown
    expect(london.apply.every((a) => a.file === 'demo/data/cities.json' || a.file === 'demo/data/events.json')).toBe(true);
    const novel = out.find((c) => c.key.includes('hyrox-new'));
    expect(novel.apply[0].op).toBe('prepend');
  });

  it('warns when dates cannot be parsed rather than guessing', () => {
    const cities = { cities: [] };
    const events = [{ slug: 'hyrox-x', title: 'HYROX X', link: 'https://x', start: null }];
    const out = buildCandidates({ events, cities, today: '2025-11-14', tenantId: 'demo' });
    expect(out[0].kind).toBe('alert');
    expect(out[0].title).toMatch(/Couldn't read dates/);
  });
});

describe('news-sync', () => {
  const feed = `<?xml version="1.0"?><rss><channel>
    <item><title>HYROX London sells out</title><link>https://example.com/a</link><pubDate>Wed, 12 Nov 2025 09:00:00 +0000</pubDate><description>&lt;p&gt;Record demand.&lt;/p&gt;</description></item>
    <item><title>Athlete hospitalised after race</title><link>https://example.com/b</link><pubDate>Wed, 12 Nov 2025 09:00:00 +0000</pubDate></item>
    <item><title>Unrelated news</title><link>https://example.com/c</link><pubDate>Wed, 12 Nov 2025 09:00:00 +0000</pubDate></item>
    <item><title>HYROX story from 2020</title><link>https://example.com/d</link><pubDate>Wed, 12 Nov 2020 09:00:00 +0000</pubDate></item>
  </channel></rss>`;

  it('parses RSS items', () => {
    const items = parseFeed(feed, 'Test');
    expect(items).toHaveLength(4);
    expect(items[0].title).toBe('HYROX London sells out');
    expect(items[0].date).toBe('2025-11-12');
  });

  it('selects recent safe hyrox stories only', () => {
    const items = parseFeed(feed, 'Test');
    const picked = selectNews(items, { today: '2025-11-14' });
    expect(picked).toHaveLength(1);
    expect(picked[0].title).toBe('HYROX London sells out');
  });

  it('dedupes against published items', () => {
    const items = parseFeed(feed, 'Test');
    const published = [{ title: 'HYROX London sells out' }];
    expect(selectNews(items, { today: '2025-11-14', published })).toHaveLength(0);
  });

  it('region filter keeps hyrox.com links regardless', () => {
    const items = [
      { title: 'HYROX Seoul recap', excerpt: 'hyrox', link: 'https://hyrox.com/races/seoul', date: '2025-11-12' },
      { title: 'HYROX random thing', excerpt: 'hyrox', link: 'https://other.com/x', date: '2025-11-12' },
    ];
    const re = /\b(uk|england|london)\b/i;
    const picked = selectNews(items, { today: '2025-11-14', regionRe: re });
    expect(picked).toHaveLength(1);
    expect(picked[0].link).toContain('hyrox.com');
  });
});
