// Same card/intro/concat recipe as refresh-pitch-videos.mjs, for the Nov-10 seven.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktop = path.join(os.homedir(), "Desktop");
const sources = {
  underdog:       ["Fabien",  "/tmp/underdog-pitch.webm",       "£495 setup, then £145 a month."],
  aceperformance: ["Adam",    "/tmp/aceperformance-pitch.webm", "£495 setup, then £145 a month."],
  jadeskillen:    ["Jade",    "/tmp/jadeskillen-pitch.webm",    "£995 setup, then £195 a month."],
  elationfitness: ["Graham",  "/tmp/elationfitness-pitch.webm", "£995 setup, then £145 a month."],
  michelewilder:  ["Michele", "/tmp/michelewilder-pitch.webm",  "£145 a month — nothing else to pay."],
  joshharrison:   ["Josh",    "/tmp/joshharrison-pitch.webm",   "£595 setup, then £125 a month."],
  trainedbytr:    ["Tom",     "/tmp/trainedbytr-pitch.webm",    "£95 a month — nothing else to pay."],
  faisalpma:      ["Faisal",  "/tmp/faisalpma-pitch.webm",      "£4,950 setup + £495 a month — bespoke partnership.", null, true],
};
const HELD_UNTIL = "Thursday 12 November";
const selected = process.argv.slice(2);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
try {
  for (const slug of selected.length ? selected : Object.keys(sources)) {
    if (!sources[slug]) throw new Error(`Unknown pitch: ${slug}`);
    const [name, source, offerPrice, offerLine, agentMode] = sources[slug];
    const input = path.resolve(root, source);
    if (!fs.existsSync(input)) { console.log(`SKIP ${slug}: no recording at ${input}`); continue; }
    const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input], { encoding: "utf8" }).trim());
    if (!Number.isFinite(duration) || duration < 20) throw new Error(`Invalid video: ${slug}`);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), `s9-${slug}-`));
    const card = path.join(temp, "closing.png");
    const intro = path.join(temp, "intro.png");
    const intro2 = path.join(temp, "intro2.png");
    const cred = path.join(temp, "cred.png");
    const output = path.join(temp, "updated.mp4");
    const bg = `margin:0;background:#0b0b0d;color:#f2f2f4;font-family:Arial,sans-serif;width:1280px;height:720px;display:flex;align-items:center;justify-content:center;text-align:center`;
    const closingHtml = agentMode
      ? `<html><body style="${bg}"><main style="max-width:980px"><p style="font-size:18px;letter-spacing:5px;color:#b7b7c1;margin:0">STATION 9 · BUILT FOR FAISAL</p><h1 style="font-size:38px;margin:18px 0 14px">Vicky — this was built for Faisal.</h1><p style="font-size:22px;line-height:1.55;color:#ddd;margin:0">A working preview, built bespoke: booking, race tools, community and<br>sponsor inventory under his own brand — shaped in collaboration with you.</p><p style="font-size:21px;color:#b7b7c1;margin:14px 0 0">https://www.station9studio.co.uk/${slug}/</p><p style="font-size:25px;margin:22px 0 0;color:#f2f2f4">Designed, built and maintained by Station 9.<br>${offerPrice}</p><p style="font-size:20px;line-height:1.5;color:#b7b7c1;margin:14px 0 0">If it's of interest, I'd love to hear by <b style="color:#f2f2f4">Thursday 26 November</b> —<br>that gives it time to reach Faisal and back.</p><p style="font-size:18px;color:#b7b7c1;margin:14px 0 0">— Chris Wood · founder, Station 9 · the digital studio of Arciteq Digital</p></main></body></html>`
      : `<html><body style="${bg}"><main><p style="font-size:18px;letter-spacing:5px;color:#b7b7c1;margin:0">STATION 9 · BUILT FOR ${name.toUpperCase()}</p><h1 style="font-size:42px;margin:18px 0 14px">Your platform is ready to explore.</h1><p style="font-size:24px;line-height:1.5;color:#ddd;margin:0">Tap the <b style="color:#f46c97">Explore your live platform</b> button below this video.</p><div style="font-size:36px;color:#f46c97;margin:8px 0">↓</div><p style="font-size:21px;color:#b7b7c1;margin:0">https://www.station9studio.co.uk/${slug}/</p><p style="font-size:25px;margin:26px 0 0;color:#f2f2f4">${offerPrice}</p><p style="font-size:20px;line-height:1.5;color:#b7b7c1;margin:10px 0 0">${offerLine || `Offered to ${name === "Adam" || name === "Fabien" ? "one gym in your area" : "one coach in your area"}. Held for you until <b style="color:#f2f2f4">${HELD_UNTIL}</b> —<br>if it's not a fit, no drama, it goes to the next ${name === "Adam" || name === "Fabien" ? "gym" : "coach"} in your area.`}</p><p style="font-size:18px;color:#b7b7c1;margin:16px 0 0">— Chris · Station 9</p></main></body></html>`;
    await page.setContent(closingHtml);
    await page.screenshot({ path: card });
    const introSub = agentMode
      ? `A working platform, built for him alone.<br>This preview is private — not published, not indexed.`
      : `A working platform, made for you alone.<br>This link is private — not published, not indexed.`;
    await page.setContent(`<html><body style="${bg}"><main><p style="font-size:19px;letter-spacing:5px;color:#f46c97">STATION 9 · PRIVATE PREVIEW</p><h1 style="font-size:52px;margin:40px 0 24px">Built for ${name}.</h1><p style="font-size:27px;line-height:1.6;color:#ddd">${introSub}</p></main></body></html>`);
    await page.screenshot({ path: intro });
    const insideH1 = agentMode ? "A complete platform for Faisal's coaching<br>and business life." : "A complete platform for your coaching<br>and business life.";
    const insideBody = agentMode
      ? `Not only his digital brand and his social and coaching hub —<br>it manages his calendar and schedules,<br>generates new leads via social media campaigns at the tap of a button,<br>and the finance desk tracks his incomings and outgoings.`
      : `Not only your digital brand and your social and coaching hub —<br>it manages your calendar and schedules,<br>generates new leads via social media campaigns at the tap of a button,<br>and the finance desk tracks your incomings and outgoings.`;
    await page.setContent(`<html><body style="${bg}"><main style="max-width:900px"><p style="font-size:19px;letter-spacing:5px;color:#f46c97;margin:0">WHAT'S INSIDE</p><h1 style="font-size:38px;margin:22px 0 26px;line-height:1.25">${insideH1}</h1><p style="font-size:24px;line-height:1.7;color:#ddd;margin:0">${insideBody}</p></main></body></html>`);
    await page.screenshot({ path: intro2 });
    console.log(`Updating ${slug}: ${duration.toFixed(2)}s`);
    if (agentMode) {
      await page.setContent(`<html><body style="${bg}"><main style="max-width:920px"><p style="font-size:19px;letter-spacing:5px;color:#f46c97;margin:0">WHO BUILT THIS</p><h1 style="font-size:34px;margin:20px 0 18px">Chris Wood — founder of Station 9,<br>the digital studio of Arciteq Digital.</h1><p style="font-size:23px;line-height:1.65;color:#ddd;margin:0">Media professional: former Editor of <i>Post</i> magazine at the<br>South China Morning Post and Editor-in-Chief of contract<br>publishing at Tatler Asia.</p><p style="font-size:23px;line-height:1.65;color:#ddd;margin:18px 0 0">Won and ran multi-million-dollar commercial briefs for clients<br>including Las Vegas Sands Corp., Hong Kong Land, HSBC and Cathay Pacific.</p><p style="font-size:21px;line-height:1.5;color:#f46c97;margin:20px 0 0"><i>Every platform is built one at a time — this one is for Faisal.</i></p></main></body></html>`);
      await page.screenshot({ path: cred });
      execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-n",
        "-loop", "1", "-t", "4.9", "-i", intro,
        "-loop", "1", "-t", "9.5", "-i", intro2,
        "-i", input,
        "-loop", "1", "-t", "10", "-i", cred,
        "-loop", "1", "-t", "14", "-i", card,
        "-filter_complex", `[0:v]format=yuv420p,fps=25,setsar=1,fade=t=in:st=0:d=0.3,fade=t=out:st=4.5:d=0.4[c1];[1:v]format=yuv420p,fps=25,setsar=1,fade=t=in:st=0:d=0.4,fade=t=out:st=8.9:d=0.6[c2];[2:v]format=yuv420p,fps=25,setsar=1[ft];[3:v]format=yuv420p,fps=25,setsar=1,fade=t=in:st=0:d=0.4,fade=t=out:st=9.4:d=0.6[c3];[4:v]format=yuv420p,fps=25,setsar=1,fade=t=in:st=0:d=0.5[c4];[c1][c2][ft][c3][c4]concat=n=5:v=1[out]`,
        "-map", "[out]", "-c:v", "h264_videotoolbox", "-b:v", "5000k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output], { stdio: "inherit" });
    } else {
      const total = duration + 12.2;
      execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-n",
        "-loop", "1", "-t", "4.9", "-i", intro,
        "-loop", "1", "-t", "7.3", "-i", intro2,
        "-i", input,
        "-loop", "1", "-i", card,
        "-filter_complex", `[0:v]format=yuv420p,fps=25,setsar=1,fade=t=in:st=0:d=0.3,fade=t=out:st=4.5:d=0.4[c1];[1:v]format=yuv420p,fps=25,setsar=1,fade=t=in:st=0:d=0.4,fade=t=out:st=6.8:d=0.5[c2];[2:v]format=yuv420p,fps=25,setsar=1[ft];[c1][c2][ft]concat=n=3:v=1[joined];[joined][3:v]overlay=0:0:shortest=1:enable='gte(t,${(total - 14).toFixed(3)})'[out]`,
        "-map", "[out]", "-c:v", "h264_videotoolbox", "-b:v", "5000k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output], { stdio: "inherit" });
    }
    const review = path.join(desktop, `${slug} - pitch - LATEST - 10 Nov 2026.mp4`);
    fs.copyFileSync(output, review);
    console.log(`Desktop: ${review}`);
  }
} finally {
  await browser.close();
}
