import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktop = path.join(os.homedir(), "Desktop");
const sources = {
  faisalpma: ["Faisal", "pitch/faisalpma/video.mp4"],
  jadeskillen: ["Jade", "pitch/jadeskillen/video.mp4"],
  elationfitness: ["Graham", "pitch/elationfitness/video.mp4"],
  trainedbytr: ["Tom", path.join(desktop, "TR-walkthrough-review-22oct.mp4")],
  jamiebarker: ["Jamie", path.join(desktop, "Jamie-Barker-walkthrough-review-22oct.mp4")],
  getfitgabby: ["Gabby", "/tmp/getfitgabby-pitch-r2.webm"],
  paulgillingham: ["Paul", "/tmp/paulgillingham-pitch-r2.webm", "£95 a month — nothing else to pay.", "one coach in Crawley"],
  coachedbykim: ["Kim", "/tmp/coachedbykim-pitch-r2.webm", "£995 setup, then £95 a month."],
  coachedbyzara: ["Zara", "/tmp/coachedbyzara-pitch-r2.webm"],
  georgegrayson: ["George", "/tmp/georgegrayson-pitch-r2.webm", "£95 a month — nothing else to pay.", "one coach in Sheffield"],
  racetoframe: ["Gregor & Hattie", "/tmp/racetoframe-pitch-reshoot2.webm", "£995 setup, then £145 a month — for both of you.", "one coaching business", "the next coaching business"],
};
const OFFER = { getfitgabby: ["£145 a month — the paired founders rate.", "one coaching pair", "the next coaching pair"], coachedbyzara: ["£145 a month — the paired founders rate.", "one coaching pair", "the next coaching pair"] };
const HELD_UNTIL = "Thursday 12 November";
const selected = process.argv.slice(2);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
try {
  for (const slug of selected.length ? selected : Object.keys(sources)) {
    if (!sources[slug]) throw new Error(`Unknown pitch: ${slug}`);
    const [name, source, price = "", place = "one coach in your area", next = "the next coach in your area"] = sources[slug];
    const [offerPrice, offerPlace, offerNext] = OFFER[slug] || [price, place, next];
    const input = path.resolve(root, source);
    const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input], { encoding: "utf8" }).trim());
    if (!Number.isFinite(duration) || duration < 20) throw new Error(`Invalid video: ${slug}`);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), `s9-${slug}-`));
    const card = path.join(temp, "closing.png");
    const intro = path.join(temp, "intro.png");
    const intro2 = path.join(temp, "intro2.png");
    const output = path.join(temp, "updated.mp4");
    await page.setContent(`<html><body style="margin:0;background:#0b0b0d;color:#f2f2f4;font-family:Arial,sans-serif;width:1280px;height:720px;display:flex;align-items:center;justify-content:center;text-align:center"><main><p style="font-size:18px;letter-spacing:5px;color:#b7b7c1;margin:0">STATION 9 · BUILT FOR ${name.toUpperCase()}</p><h1 style="font-size:42px;margin:18px 0 14px">Your platform is ready to explore.</h1><p style="font-size:24px;line-height:1.5;color:#ddd;margin:0">Tap the <b style="color:#f46c97">Explore your live platform</b> button below this video.</p><div style="font-size:36px;color:#f46c97;margin:8px 0">↓</div><p style="font-size:21px;color:#b7b7c1;margin:0">https://www.station9studio.co.uk/${slug}/</p><p style="font-size:25px;margin:26px 0 0;color:#f2f2f4">${offerPrice}</p><p style="font-size:20px;line-height:1.5;color:#b7b7c1;margin:10px 0 0">Offered to ${offerPlace}. Held for you until <b style="color:#f2f2f4">${HELD_UNTIL}</b> —<br>if it's not a fit, no drama, it goes to ${offerNext}.</p><p style="font-size:18px;color:#b7b7c1;margin:16px 0 0">— Chris · Station 9</p></main></body></html>`);
    await page.screenshot({ path: card });
    await page.setContent(`<html><body style="margin:0;background:#0b0b0d;color:#f2f2f4;font-family:Arial,sans-serif;width:1280px;height:720px;display:flex;align-items:center;justify-content:center;text-align:center"><main><p style="font-size:19px;letter-spacing:5px;color:#f46c97">STATION 9 · PRIVATE PREVIEW</p><h1 style="font-size:52px;margin:40px 0 24px">Built for ${name}.</h1><p style="font-size:27px;line-height:1.6;color:#ddd">A working platform, made for you alone.<br>This link is private — not published, not indexed.</p></main></body></html>`);
    await page.screenshot({ path: intro });
    await page.setContent(`<html><body style="margin:0;background:#0b0b0d;color:#f2f2f4;font-family:Arial,sans-serif;width:1280px;height:720px;display:flex;align-items:center;justify-content:center;text-align:center"><main style="max-width:900px"><p style="font-size:19px;letter-spacing:5px;color:#f46c97;margin:0">WHAT'S INSIDE</p><h1 style="font-size:38px;margin:22px 0 26px;line-height:1.25">A complete platform for your coaching<br>and business life.</h1><p style="font-size:24px;line-height:1.7;color:#ddd;margin:0">Not only your digital brand and your social and coaching hub —<br>it manages your calendar and schedules,<br>generates new leads via social media campaigns at the tap of a button,<br>and the finance desk tracks your incomings and outgoings.</p></main></body></html>`);
    await page.screenshot({ path: intro2 });
    console.log(`Updating ${slug}: ${duration.toFixed(2)}s`);
    const total = duration + 12.2;
    execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-n",
      "-loop", "1", "-t", "4.9", "-i", intro,
      "-loop", "1", "-t", "7.3", "-i", intro2,
      "-i", input,
      "-loop", "1", "-i", card,
      "-filter_complex", `[0:v]format=yuv420p,fps=25,setsar=1,fade=t=in:st=0:d=0.3,fade=t=out:st=4.5:d=0.4[c1];[1:v]format=yuv420p,fps=25,setsar=1,fade=t=in:st=0:d=0.4,fade=t=out:st=6.8:d=0.5[c2];[2:v]format=yuv420p,fps=25,setsar=1[ft];[c1][c2][ft]concat=n=3:v=1[joined];[joined][3:v]overlay=0:0:enable='gte(t,${(total - 14).toFixed(3)})'[out]`,
      "-map", "[out]", "-c:v", "libx264", "-threads", "4", "-preset", "fast", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output], { stdio: "inherit" });
    const target = path.join(root, "pitch", slug, "video.mp4");
    if (fs.existsSync(target)) fs.copyFileSync(target, path.join(temp, "previous.mp4"));
    fs.copyFileSync(output, target);
    const poster = path.join(root, "pitch", slug, "poster.jpg");
    execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-y", "-ss", "14", "-i", target, "-frames:v", "1", "-q:v", "2", poster]);
    const review = path.join(desktop, `${slug} - walkthrough - LATEST - 5 Nov 2026 v4.mp4`);
    if (fs.existsSync(review)) throw new Error(`Review copy exists: ${review}`);
    fs.copyFileSync(output, review);
    console.log(`Ready: ${target}; backup and closing card: ${temp}`);
  }
} finally {
  await browser.close();
}
