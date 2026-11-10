// Measures every rendered image slot in a tenant build at multiple widths
// and writes a slot map: page, selector signature, aspect range, fit mode.
// Usage: node scripts/photo-map/slot-scan.mjs <tenant> [--out chassis/photo-slots.json]
import { chromium } from 'playwright-core';
import { writeFileSync, readdirSync } from 'fs';
import path from 'path';

const tenant = process.argv[2] || 'joshharrison';
const outIdx = process.argv.indexOf('--out');
const out = outIdx > -1 ? process.argv[outIdx + 1] : `chassis/photo-slots.json`;
const WIDTHS = [360, 768, 1024, 1440];
const root = path.resolve(process.cwd());
const pages = readdirSync(path.join(root, tenant))
  .filter(f => f.endsWith('.html')).map(f => f.replace('.html', ''));

const browser = await chromium.launch();
const page = await browser.newPage();
const slots = {};

for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 1000 });
  for (const p of pages) {
    try {
      await page.goto(`http://localhost:3000/${tenant}/${p}.html?audience=public`,
        { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(500);
      const imgs = await page.evaluate(() =>
        [...document.querySelectorAll('main img, .hero img, .guide-hero img, figure img, section img')]
          .map(i => {
            const r = i.getBoundingClientRect();
            if (r.width < 40 || r.height < 40) return null;
            const s = getComputedStyle(i);
            const fig = i.closest('figure') || i.parentElement;
            return {
              figClass: (fig.className || '').split(/\s+/).filter(c => c && !/reveal|in/.test(c)).join('.'),
              imgClass: (i.className || ''),
              src: i.src.split('/').pop().split('?')[0],
              w: Math.round(r.width), h: Math.round(r.height),
              fit: s.objectFit, pos: s.objectPosition
            };
          }).filter(Boolean));
      for (const m of imgs) {
        // slot identity = page + figure class + img class (+ index among twins)
        const key = `${p}|${m.figClass}|${m.imgClass}`;
        slots[key] ??= { page: p, figure: m.figClass, imgClass: m.imgClass,
          src: m.src, fit: m.fit, pos: m.pos, aspects: [] };
        slots[key].aspects.push({ w, a: +(m.w / m.h).toFixed(3) });
      }
    } catch (e) { /* page may not exist on server */ }
  }
}
await browser.close();

const out2 = {
  generated: new Date().toISOString().slice(0, 10),
  tenant, widths: WIDTHS,
  note: 'aspect = rendered w/h. cover slots crop; must-keep boxes must fit min->max aspect range.',
  slots: Object.entries(slots).map(([key, s]) => {
    const a = s.aspects.map(x => x.a);
    return { key, ...s, aspectMin: Math.min(...a), aspectMax: Math.max(...a) };
  })
};
writeFileSync(out, JSON.stringify(out2, null, 2));
console.log(`${out}: ${out2.slots.length} slots across ${pages.length} pages`);
