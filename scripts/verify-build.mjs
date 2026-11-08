// Post-build mechanical verification — pass/fail checks a human shouldn't
// have to hunt for. Usage:
//   node scripts/verify-build.mjs coachedbyzara            # repo dir via own server
//   node scripts/verify-build.mjs /tmp/build-out/zara      # any output dir
//   node scripts/verify-build.mjs coachedbyzara --pages=index.html,planner.html
//   node scripts/verify-build.mjs coachedbyzara --widths=390
// Checks: broken/unloaded images, heavy-crop candidates, horizontal page
// overflow, known-risk elements spilling off-viewport (masthead sig,
// ask-circle portrait), zero-size content sections, JS page errors,
// failed same-origin asset requests, missing fold toggles.
// Severities: FAIL = provably broken. WARN = informational.
// EYE = suspicious but unprovable — a cropped screenshot is saved into
// --shots dir (default ./verify-shots/) and MUST be viewed by a human or
// the reporting agent before sign-off.
// Face detection (macOS, Apple Vision via facedetect.swift): PARTIALLY cut
// faces (edge caught in frame) are EYE-flagged — almost never good. Faces
// entirely out of frame are WARN-noted for handover — often intentional.
// Zero faces = "can't prove safe," never a pass.
// Exit 1 on any FAIL. Aesthetic judgement is deliberately NOT attempted.
import { chromium } from "playwright-core";
import { spawnSync } from "node:child_process";
import http from "http";
import fs from "fs";
import path from "path";
import url from "url";

const arg = process.argv[2];
if (!arg) { console.error("usage: verify-build.mjs <dir-or-slug> [--pages=a,b] [--widths=390,1440]"); process.exit(2); }
const root = path.resolve(arg.startsWith("/") ? arg : path.join(process.cwd(), arg));
if (!fs.existsSync(root)) { console.error("not found:", root); process.exit(2); }
const opt = (k, d) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split("=")[1] : d; };
const WIDTHS = opt("widths", "390,1440").split(",").map(Number);
const SHOTS = opt("shots", "verify-shots");
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".mp4": "video/mp4", ".ico": "image/x-icon" };

// Serve the dir itself; absolute "/slug/asset" paths resolve via prefix strip,
// so it works whether the dir is named like the slug or is a staged output dir.
const serveRoot = root;
const slug = opt("slug", path.basename(root));
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(url.parse(req.url).pathname);
  if (p.startsWith(`/${slug}/`)) p = p.slice(slug.length + 1);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(serveRoot, p);
  if (!f.startsWith(serveRoot) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/${slug}`;

const pages = opt("pages", "").split(",").filter(Boolean);

// Resolve a served "/slug/path?x" URL to the file under `root`.
const srcToFile = (src) => {
  const p = decodeURIComponent(String(src).split("?")[0]).replace(new RegExp(`^/${slug}/`), "");
  const f = path.join(root, p);
  return fs.existsSync(f) ? f : null;
};

// Apple Vision face detection, one batch call per run. macOS-only; degrades
// to empty results elsewhere (rule: detection may escalate, never clear).
function faceDetect(srcs) {
  const byFile = {};
  for (const s of srcs) { const f = srcToFile(s); if (f && !byFile[f]) byFile[f] = s; }
  const files = Object.keys(byFile);
  const out = {};
  if (!files.length) return out;
  try {
    const r = spawnSync("swift", [path.join(path.dirname(new URL(import.meta.url).pathname), "facedetect.swift"), ...files], { encoding: "utf8", timeout: 60000 });
    if (r.status !== 0) return out;
    for (const line of r.stdout.trim().split("\n")) {
      try { const d = JSON.parse(line); if (d.file && byFile[d.file]) out[byFile[d.file]] = d; } catch { /* noop */ }
    }
  } catch { /* noop */ }
  return out;
}

// Face rule (agreed): a PARTIALLY cropped face — ear/chin caught at the edge —
// is almost never good → always flagged. A face entirely out of frame can be
// optimal (action torsos, background shots) → handover note only, no alert.
// Zero faces = "can't prove safe," never a pass.
function faceCropCheck(im, det) {
  if (!det || det.error || !det.faces) return { cut: [], kept: [], out: 0, note: "no detection" };
  const [px, py] = (im.pos || "50% 50%").match(/[\d.]+/g).map(Number);
  const scale = Math.max(im.w / det.w, im.h / det.h);
  const visW = (im.w / scale) / det.w, visH = (im.h / scale) / det.h;
  const x0 = (1 - visW) * px / 100, y0 = (1 - visH) * py / 100, t = 0.02;
  const cut = [], kept = []; let out = 0;
  for (const f of det.faces) {
    const overlaps = f.x < x0 + visW - t && f.x + f.w > x0 + t && f.y < y0 + visH - t && f.y + f.h > y0 + t;
    const inside = f.x >= x0 - t && f.x + f.w <= x0 + visW + t && f.y >= y0 - t && f.y + f.h <= y0 + visH + t;
    if (inside) kept.push(`${Math.round((f.x + f.w / 2) * 100)}%,${Math.round((f.y + f.h / 2) * 100)}%`);
    else if (overlaps) cut.push(`${Math.round((f.x + f.w / 2) * 100)}%,${Math.round((f.y + f.h / 2) * 100)}%`);
    else out++;
  }
  const note = det.faces.length ? `${kept.length}/${det.faces.length} face(s) retained${out ? `, ${out} fully out` : ""}` : "no faces detected — can't prove safe";
  return { cut, kept, out, note };
}
const html = pages.length ? pages : fs.readdirSync(root).filter(f => f.endsWith(".html")).sort();
const findings = [];
const flag = (sev, page, vw, msg) => findings.push({ sev, page, vw, msg });

// Selectors with known overflow history + generic card/panel shapes.
const RISK = [".masthead .sig", ".masthead h1", ".coach-portrait", ".capture",
  ".polaroid", ".plan", ".ev-card", ".pitch-tool-main", ".wordmark"];

const browser = await chromium.launch();
for (const w of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: w, height: 844 }, isMobile: w < 500, hasTouch: w < 500 });
  for (const f of html) {
    const jsErrs = [], bad404 = [];
    page.on("pageerror", e => jsErrs.push(String(e).slice(0, 120)));
    page.on("response", r => { if (r.status() >= 400 && r.url().startsWith(BASE)) bad404.push(r.url().replace(BASE, "")); });
    try {
      await page.goto(`${BASE}/${f}`, { timeout: 20000, waitUntil: "networkidle" });
      // trigger lazy loads
      await page.evaluate(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } scrollTo(0, 0); });
      await page.waitForTimeout(300);
      const d = await page.evaluate((RISK) => {
        const imgs = [...document.querySelectorAll("img")].map((i, idx) => {
          const s = getComputedStyle(i), r = i.getBoundingClientRect();
          return { src: i.getAttribute("src"), loc: `img:${idx}`, ok: i.complete && i.naturalWidth > 0,
            nw: i.naturalWidth, nh: i.naturalHeight, w: Math.round(r.width), h: Math.round(r.height),
            fit: s.objectFit, pos: s.objectPosition, hidden: s.display === "none" || s.visibility === "hidden" };
        });
        const vw = innerWidth;
        const risk = RISK.flatMap(sel => [...document.querySelectorAll(sel)].map((el, n) => {
          const r = el.getBoundingClientRect();
          return { sel, loc: `${sel}:${n}`, txt: el.textContent.trim().slice(0, 30), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), hid: r.width === 0 && r.height === 0 };
        })).filter(e => !e.hid);
        const spills = risk.filter(e => e.l < -4 || e.r > vw + 4);
        const edgeNear = risk.filter(e => !(e.l < -4 || e.r > vw + 4) && (e.r - e.l) < vw - 60 && (e.l < 6 || e.r > vw - 6));
        const sections = [...document.querySelectorAll("main section, main .panel")].map((s, n) => ({ id: s.id || s.className.split(" ")[0], loc: `main section, main .panel:${n}`, h: Math.round(s.getBoundingClientRect().height), hid: getComputedStyle(s).display === "none" })).filter(s => !s.hid && s.h < 12);
        const fold = { raceCards: document.querySelectorAll("#race-cards > *").length, raceMore: !!document.querySelector(".events-more"), plansMore: !!document.querySelector(".plans-more") };
        return { imgs, spills, edgeNear, sections, fold, overflow: document.documentElement.scrollWidth - vw };
      }, RISK);
      // lazy images may not have entered the viewport — pull them in and re-check
      const lazySrcs = d.imgs.filter(i => !i.ok && i.src).map(i => i.src);
      if (lazySrcs.length) {
        await page.evaluate(async (srcs) => {
          for (const i of document.querySelectorAll("img")) {
            if (srcs.includes(i.getAttribute("src"))) { i.loading = "eager"; i.scrollIntoView(); await new Promise(r => setTimeout(r, 60)); }
          }
        }, lazySrcs);
        await page.waitForTimeout(800);
        d.imgs = await page.evaluate(() => [...document.querySelectorAll("img")].map((i, idx) => {
          const s = getComputedStyle(i), r = i.getBoundingClientRect();
          return { src: i.getAttribute("src"), loc: `img:${idx}`, ok: i.complete && i.naturalWidth > 0,
            nw: i.naturalWidth, nh: i.naturalHeight, w: Math.round(r.width), h: Math.round(r.height),
            fit: s.objectFit, pos: s.objectPosition, hidden: s.display === "none" || s.visibility === "hidden" };
        }));
      }
      // face check: run Apple Vision once on all cover-cropped sources, then
      // test whether each rendered crop window keeps every detected face.
      const coverImgs = d.imgs.filter(i => i.src && i.ok && !i.hidden && i.w && i.h && i.fit === "cover");
      const faces = faceDetect(coverImgs.map(i => i.src));
      const eyes = [];
      for (const im of d.imgs) {
        if (!im.src) continue;
        if (!im.ok && !im.hidden) flag("FAIL", f, w, `broken image: ${im.src}`);
        else if (im.ok && im.w && im.h && im.fit === "cover") {
          const crop = Math.max((im.nw / im.nh) / (im.w / im.h), (im.w / im.h) / (im.nw / im.nh));
          const face = faceCropCheck(im, faces[im.src]);
          if (face.cut.length) eyes.push({ loc: im.loc, src: im.src, msg: `crop TRIMS face edge: ${im.src.split("/").pop()} — partial face at ${face.cut[0]}, keeps ${face.kept.length} whole` });
          else if (crop > 1.7) eyes.push({ loc: im.loc, src: im.src, msg: `heavy crop x${crop.toFixed(1)}: ${im.src.split("/").pop()} (${face.note}) — compare with original: what did the lost band contain? Clear only if it's empty space/background; if people or distinctive detail are lost, escalate` });
          else if (face.out) flag("WARN", f, w, `${face.out} face(s) entirely out of frame in ${im.src.split("/").pop()} — often intentional (action/bg shot), confirm at final eye`);
        }
      }
      for (const s of d.spills) flag("FAIL", f, w, `off-viewport: ${s.sel} "${s.txt}" l=${s.l} r=${s.r} (vw ${w})`);
      for (const s of d.edgeNear) eyes.push({ loc: s.loc, msg: `near edge: ${s.sel} "${s.txt}" l=${s.l} r=${s.r}` });
      for (const s of d.sections) eyes.push({ loc: s.loc, msg: `near-empty section: ${s.id} (${s.h}px)` });
      // EYE items: save a cropped screenshot — must be eyeballed before sign-off
      let eyeN = 0;
      for (const e of eyes) {
        const [css, nth] = [e.loc.slice(0, e.loc.lastIndexOf(":")), +e.loc.slice(e.loc.lastIndexOf(":") + 1)];
        try {
          const shot = `${SHOTS}/${slug}-${f.replace(".html", "")}-${w}-eye${++eyeN}.png`;
          await page.locator(css).nth(nth).screenshot({ path: shot });
          // for image crops: also save the source photo so the lost region is visible
          let srcNote = "";
          if (e.src) {
            const srcPath = path.join(root, decodeURIComponent(e.src.replace(BASE, "").split("?")[0]).replace(new RegExp(`^/${slug}/`), ""));
            if (fs.existsSync(srcPath)) {
              const srcShot = shot.replace(".png", `-src${path.extname(srcPath)}`);
              fs.copyFileSync(srcPath, srcShot);
              srcNote = ` (original: ${srcShot})`;
            }
          }
          flag("EYE", f, w, `${e.msg}  ->  ${shot}${srcNote}`);
        } catch { flag("WARN", f, w, `${e.msg} (no shot)`); }
      }
      if (d.overflow > 4) flag("FAIL", f, w, `horizontal page overflow ${d.overflow}px`);
      if (d.fold.raceCards > 1 && !d.fold.raceMore) flag("WARN", f, w, `${d.fold.raceCards} race cards, no collapse fold`);
      for (const e of jsErrs) flag("FAIL", f, w, `JS error: ${e}`);
      for (const u of [...new Set(bad404)]) flag("FAIL", f, w, `asset ${u.split("?")[0]}`);
    } catch (e) { flag("FAIL", f, w, `nav fail: ${String(e).slice(0, 80)}`); }
  }
  await page.close();
}
await browser.close();
server.close();

const fails = findings.filter(x => x.sev === "FAIL"), warns = findings.filter(x => x.sev === "WARN"), eyes = findings.filter(x => x.sev === "EYE");
for (const x of findings) console.log(`${x.sev.padEnd(4)} ${x.page} @${x.vw}px  ${x.msg}`);
console.log(`\n${path.basename(root)}: ${fails.length} FAIL, ${eyes.length} EYE (screenshots in ${SHOTS}/ — view each before sign-off), ${warns.length} WARN, ${html.length} page(s) x ${WIDTHS.length} width(s)`);
process.exit(fails.length ? 1 : 0);
