// Replace the homepage, partners and planner sections of an existing walkthrough
// with fresh recordings, cutting at the natural page-load boundaries.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
const work = path.join("/tmp/s9-rerecord", slug);
fs.mkdirSync(work, { recursive: true });
const ocr = "/tmp/s9-rerecord/video-text";
if (!fs.existsSync(ocr)) execFileSync("swiftc", [path.join(root, "scripts/video-text.swift"), "-o", ocr]);
const input = path.join(root, "pitch", slug, "video.mp4");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "scripts/reskin/planner-video-splices.json"), "utf8"))[slug];
const scenes = JSON.parse(fs.readFileSync(path.join(root, "scripts/reskin", `${slug}.pitch.json`), "utf8"));
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function framesText(file, times) {
  const imgs = times.map((t, i) => {
    const out = path.join(work, `o-${i}-${Math.round(t * 1000)}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "crop=1280:200:0:520", out]);
    return out;
  });
  const rows = JSON.parse(execFileSync(ocr, imgs, { encoding: "utf8", maxBuffer: 64 << 20 }));
  imgs.forEach((f) => fs.rmSync(f));
  return rows.map((r) => norm(r.texts.map((x) => x.text).join(" ")));
}
function captionStart(text, from, to) {
  const key = norm(text).slice(0, 22);
  const times = [];
  for (let t = from; t <= to; t += 1) times.push(t);
  const rows = framesText(input, times);
  const i = rows.findIndex((r) => r.includes(key));
  if (i < 0) throw new Error(`${slug}: caption not found: ${text.slice(0, 40)}`);
  let lo = times[i] - 1, hi = times[i];
  for (let k = 0; k < 6; k++) {
    const mid = (lo + hi) / 2;
    if (framesText(input, [mid])[0].includes(key)) hi = mid; else lo = mid;
  }
  return hi;
}
function captionEnd(text, from, to) {
  const key = norm(text).slice(0, 22);
  const times = [];
  for (let t = to; t >= from; t -= 0.5) times.push(t);
  const rows = framesText(input, times);
  const i = rows.findIndex((r) => r.includes(key));
  if (i < 0) throw new Error(`${slug}: caption end not found: ${text.slice(0, 40)}`);
  let lo = times[i], hi = times[i] + 0.5;
  for (let k = 0; k < 5; k++) {
    const mid = (lo + hi) / 2;
    if (framesText(input, [mid])[0].includes(key)) lo = mid; else hi = mid;
  }
  return lo;
}
// The page switch is the biggest frame change shortly before the caption shows.
function pageSwitch(captionAt) {
  const from = Math.max(0, captionAt - 2.6);
  const r = spawnSync("ffmpeg", ["-v", "error", "-ss", String(from), "-t", "2.3", "-i", input, "-vf", "scdet=threshold=0:sc_pass=0,metadata=print:key=lavfi.scd.score:file=-", "-f", "null", "-"], { encoding: "utf8" });
  let best = { score: -1, t: null };
  let t = null;
  for (const line of r.stdout.split("\n")) {
    const pt = line.match(/pts_time:([\d.]+)/);
    if (pt) t = Number(pt[1]);
    const sc = line.match(/lavfi\.scd\.score=([\d.]+)/);
    if (sc && Number(sc[1]) > best.score) best = { score: Number(sc[1]), t: from + t };
  }
  if (best.t === null || best.score < 3) throw new Error(`${slug}: weak page switch near ${captionAt} (${best.score})`);
  return { t: Math.round(best.t * 25) / 25, score: best.score };
}
function lumas(file, seconds) {
  const out = execFileSync("ffmpeg", ["-v", "error", "-t", String(seconds), "-i", file, "-vf", "fps=25,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-f", "null", "-"], { encoding: "utf8" });
  return out.split("\n").filter((l) => l.includes("YAVG")).map((l) => Number(l.split("=")[1]));
}
function lead(file, darkStart) {
  const y = lumas(file, 4);
  const i = darkStart ? y.findIndex((v) => v < 35) : y.findIndex((v) => v < 215);
  if (i < 0) throw new Error(`${slug}: could not find segment start in ${file}`);
  return i / 25;
}
function record(name, sceneList) {
  const file = path.join(work, `${name}.webm`);
  const sceneFile = path.join(work, `${name}.json`);
  fs.writeFileSync(sceneFile, JSON.stringify(sceneList));
  execFileSync("node", ["scripts/record-demo.mjs", slug, "http://localhost:3000", file], { cwd: root, env: { ...process.env, PITCH_SCENES_FILE: sceneFile, PITCH_NO_END_CARD: "1", PITCH_STRICT: "1" }, stdio: "inherit" });
  return file;
}

const total = dur(input);
const cut = manifest.cutBeforeDesk, ins = manifest.insertedDuration;
const coachIdx = scenes.findIndex((s) => s.path === "coaching.html");
const partIdx = scenes.findIndex((s) => s.path === "partners.html");
const listIdx = partIdx + 1;
const tCoach = captionStart(scenes[coachIdx].subs[0].text, 15, 140);
const H = { t: Math.round((tCoach - 0.7) * 25) / 25 };
const tPart = captionStart(scenes[partIdx].subs[0].text, Math.max(H.t + 30, cut - 110), cut);
const prevSubs = scenes[partIdx - 1].subs;
const tPrevEnd = captionEnd(prevSubs[prevSubs.length - 1].text, tPart - 12, tPart);
const P0 = { t: Math.round((tPrevEnd + 0.5) * 25) / 25 };
const tList = captionStart(scenes[listIdx].subs[0].text, tPart + 5, cut);
const P1 = { t: Math.round((tList - 0.7) * 25) / 25 };
const marks = { total, H, P0, P1, cut, plannerEnd: cut + ins };
console.log(JSON.stringify(marks));
if (!(H.t < P0.t && P0.t < P1.t && P1.t < cut)) throw new Error(`${slug}: marks out of order`);

const home = record("home", [scenes[0]]);
const part = record("partners", [scenes[partIdx]]);
const planner = record("planner", JSON.parse(fs.readFileSync(path.join(root, "scripts/reskin/planner.segment.json"), "utf8")));
const lh = lead(home, true), lp = lead(part, false), lq = lead(planner, false);
const dq = dur(planner) - lq;
const output = path.join(work, "updated.mp4");
const v = "setpts=PTS-STARTPTS,fps=25,setsar=1";
const filters = [
  `[1:v]trim=start=${lh},${v}[h]`,
  `[0:v]trim=start=${H.t}:end=${P0.t},${v}[a]`,
  `[2:v]trim=start=${lp},${v}[p]`,
  `[0:v]trim=start=${P1.t}:end=${cut},${v}[b]`,
  `[3:v]trim=start=${lq},${v},fade=t=in:st=0:d=0.16,fade=t=out:st=${(dq - 0.16).toFixed(3)}:d=0.16[q]`,
  `[0:v]trim=start=${cut + ins},${v}[c]`,
  `[h][a][p][b][q][c]concat=n=6:v=1:a=0[out]`,
].join(";");
execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-y", "-i", input, "-i", home, "-i", part, "-i", planner, "-filter_complex", filters, "-map", "[out]", "-c:v", "libx264", "-threads", "4", "-preset", "fast", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output], { stdio: "inherit" });
execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-i", output, "-f", "null", "-"]);
const dh = dur(home) - lh, dp = dur(part) - lp;
const joins = { home: dh, partStart: dh + (P0.t - H.t), listStart: dh + (P0.t - H.t) + dp, plannerStart: dh + (P0.t - H.t) + dp + (cut - P1.t) };
joins.deskStart = joins.plannerStart + dq;
for (const [k, t] of Object.entries(joins))
  for (const [s, o] of [["a", -0.2], ["b", 0.3]])
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.max(0, t + o)), "-i", output, "-frames:v", "1", "-vf", "scale=640:360", path.join(work, `join-${k}-${s}.jpg`)]);
fs.writeFileSync(path.join(work, "marks.json"), JSON.stringify({ marks, leads: { lh, lp, lq }, joins, final: dur(output) }, null, 2));
console.log(`READY ${slug} ${dur(output).toFixed(2)}s`, JSON.stringify(joins));
