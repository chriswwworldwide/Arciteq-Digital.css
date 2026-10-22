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
  coachedbyzara: ["Zara", "pitch/coachedbyzara/video.mp4"],
  trainedbytr: ["Tom", path.join(desktop, "TR-walkthrough-review-22oct.mp4")],
  jamiebarker: ["Jamie", path.join(desktop, "Jamie-Barker-walkthrough-review-22oct.mp4")],
  getfitgabby: ["Gabby", path.join(desktop, "GetFitGabby-walkthrough-review-22oct.mp4")],
};
const selected = process.argv.slice(2);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
try {
  for (const slug of selected.length ? selected : Object.keys(sources)) {
    if (!sources[slug]) throw new Error(`Unknown pitch: ${slug}`);
    const [name, source] = sources[slug];
    const input = path.resolve(root, source);
    const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input], { encoding: "utf8" }).trim());
    if (!Number.isFinite(duration) || duration < 20) throw new Error(`Invalid video: ${slug}`);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), `s9-${slug}-`));
    const card = path.join(temp, "closing.png");
    const output = path.join(temp, "updated.mp4");
    await page.setContent(`<html><body style="margin:0;background:#0b0b0d;color:#f2f2f4;font-family:Arial,sans-serif;width:1280px;height:720px;display:flex;align-items:center;justify-content:center;text-align:center"><main><p style="font-size:19px;letter-spacing:5px;color:#b7b7c1">STATION 9 · BUILT FOR ${name.toUpperCase()}</p><h1 style="font-size:48px;margin:40px 0 24px">Your platform is ready to explore.</h1><p style="font-size:27px;line-height:1.6;color:#ddd">Tap the <b style="color:#f46c97">Explore your live platform</b><br>button below this video.</p><div style="font-size:48px;color:#f46c97;margin:18px 0">↓</div><p style="font-size:23px;color:#b7b7c1">https://www.station9studio.co.uk/${slug}/</p></main></body></html>`);
    await page.screenshot({ path: card });
    console.log(`Updating ${slug}: ${duration.toFixed(2)}s`);
    execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-n", "-i", input, "-loop", "1", "-framerate", "25", "-i", card, "-filter_complex", `[0:v]fps=25,setsar=1[base];[base][1:v]overlay=0:0:enable='gte(t,${(duration - 14).toFixed(3)})'[out]`, "-map", "[out]", "-t", String(duration), "-c:v", "libx264", "-threads", "4", "-preset", "fast", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output], { stdio: "inherit" });
    const target = path.join(root, "pitch", slug, "video.mp4");
    if (fs.existsSync(target)) fs.copyFileSync(target, path.join(temp, "previous.mp4"));
    fs.copyFileSync(output, target);
    const poster = path.join(root, "pitch", slug, "poster.jpg");
    if (!fs.existsSync(poster)) execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-n", "-ss", "4", "-i", target, "-frames:v", "1", "-q:v", "2", poster]);
    const review = path.join(desktop, `${slug}-walkthrough-published-22oct.mp4`);
    if (fs.existsSync(review)) throw new Error(`Review copy exists: ${review}`);
    fs.copyFileSync(output, review);
    console.log(`Ready: ${target}; backup and closing card: ${temp}`);
  }
} finally {
  await browser.close();
}
