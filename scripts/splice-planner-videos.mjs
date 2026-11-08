import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slugs = [
  "faisalpma",
  "jadeskillen",
  "elationfitness",
  "coachedbyzara",
  "trainedbytr",
  "jamiebarker",
  "getfitgabby",
];
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const targets = requested.length ? requested : slugs;
if (targets.some((slug) => !slugs.includes(slug)))
  throw new Error("Unknown video slug");
const analyzeOnly = process.argv.includes("--analyze");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "s9-planner-splices-"));
const ocr = path.join(work, "video-text");
execFileSync("swiftc", [
  path.join(root, "scripts/video-text.swift"),
  "-o",
  ocr,
]);
const manifestPath = path.join(
  root,
  "scripts/reskin/planner-video-splices.json",
);
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : {};
const hash = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const probe = (file) =>
  JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_format", "-show_streams", "-of", "json", file],
      { encoding: "utf8" },
    ),
  );
const run = (command, args, env = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
function isDesk(row) {
  return row.texts.some(
    (item) =>
      /^the\s*desk\.?$/i.test(item.text.trim()) &&
      item.area > 0.004 &&
      item.y > 0.2,
  );
}
function still(input, time, output) {
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-nostdin",
    "-y",
    "-ss",
    String(Math.max(0, time)),
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    "scale=960:540",
    "-q:v",
    "3",
    output,
  ]);
}
function textAt(input, time, dir) {
  const image = path.join(dir, `at-${Math.round(time * 1000)}.jpg`);
  still(input, time, image);
  return isDesk(
    JSON.parse(execFileSync(ocr, [image], { encoding: "utf8" }))[0],
  );
}
async function analyze(slug) {
  const input = path.join(root, "pitch", slug, "video.mp4");
  const sourceHash = hash(input);
  if (!analyzeOnly && manifest[slug]) {
    if (manifest[slug].outputSha256 !== sourceHash)
      throw new Error(
        `${slug}: video changed after an earlier planner splice; review the source before inserting again`,
      );
    console.log(`${slug}: already contains planner; skipping`);
    return null;
  }
  const dir = path.join(work, slug);
  fs.mkdirSync(dir);
  const meta = probe(input);
  if (meta.streams.some((stream) => stream.codec_type === "audio"))
    throw new Error(
      `${slug}: audio detected; preserve it with a dedicated edit`,
    );
  const duration = Number(meta.format.duration);
  const start = Math.max(0, duration - 85);
  await run("ffmpeg", [
    "-v",
    "error",
    "-nostdin",
    "-n",
    "-ss",
    String(start),
    "-i",
    input,
    "-t",
    "85",
    "-vf",
    "fps=1,scale=960:540",
    "-q:v",
    "4",
    path.join(dir, "scan-%03d.jpg"),
  ]);
  const frames = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith("scan-"))
    .sort()
    .map((file) => path.join(dir, file));
  const rows = JSON.parse(
    execFileSync(ocr, frames, {
      encoding: "utf8",
      maxBuffer: 12 * 1024 * 1024,
    }),
  );
  const first = rows.findIndex(isDesk);
  if (first < 0)
    throw new Error(
      `${slug}: could not locate the Desk heading; inspect ${dir}`,
    );
  const rough = start + first + 0.5;
  let low = rough - 1.5;
  let high = rough + 0.6;
  if (!textAt(input, high, dir)) high = rough;
  if (!textAt(input, high, dir))
    throw new Error(`${slug}: could not refine Desk transition`);
  for (let i = 0; i < 7; i++) {
    const mid = (low + high) / 2;
    if (textAt(input, mid, dir)) high = mid;
    else low = mid;
  }
  const cut = Math.max(0, (Math.floor(high * 25) - 1) / 25);
  if (cut <= duration - 85 || cut >= duration - 14)
    throw new Error(`${slug}: unsafe cut ${cut}`);
  still(input, cut - 0.12, path.join(dir, "before-desk.jpg"));
  still(input, cut + 0.28, path.join(dir, "desk-start.jpg"));
  console.log(
    `${slug}: Desk starts at ${cut.toFixed(2)} / ${duration.toFixed(2)}s; review ${dir}`,
  );
  return { slug, input, sourceHash, duration, cut, dir };
}
async function splice(item) {
  const { slug, input, sourceHash, duration, cut, dir } = item;
  const original = path.join(dir, "original.mp4");
  fs.copyFileSync(input, original);
  const segment = path.join(dir, "planner.webm");
  await run(
    "node",
    ["scripts/record-demo.mjs", slug, "http://localhost:3000", segment],
    {
      PITCH_SCENES_FILE: path.join(root, "scripts/reskin/planner.segment.json"),
      PITCH_NO_END_CARD: "1",
      PITCH_STRICT: "1",
    },
  );
  const segmentDuration = Number(probe(segment).format.duration);
  if (segmentDuration < 45 || segmentDuration > 105)
    throw new Error(
      `${slug}: unexpected planner segment duration ${segmentDuration}`,
    );
  const lead = 0.4;
  const inserted = segmentDuration - lead;
  const output = path.join(dir, "with-planner.mp4");
  const filters = [
    `[0:v]split=2[before][after]`,
    `[before]trim=end=${cut},setpts=PTS-STARTPTS,fps=25,setsar=1,fade=t=out:st=${Math.max(0, cut - 0.16)}:d=0.16[a]`,
    `[1:v]trim=start=${lead},setpts=PTS-STARTPTS,fps=25,setsar=1,fade=t=in:st=0:d=0.16,fade=t=out:st=${inserted - 0.16}:d=0.16[b]`,
    `[after]trim=start=${cut},setpts=PTS-STARTPTS,fps=25,setsar=1,fade=t=in:st=0:d=0.16[c]`,
    `[a][b][c]concat=n=3:v=1:a=0[out]`,
  ].join(";");
  await run("ffmpeg", [
    "-v",
    "error",
    "-nostdin",
    "-n",
    "-i",
    original,
    "-i",
    segment,
    "-filter_complex",
    filters,
    "-map",
    "[out]",
    "-c:v",
    "libx264",
    "-threads",
    "4",
    "-preset",
    "fast",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    output,
  ]);
  const finalDuration = Number(probe(output).format.duration);
  if (Math.abs(finalDuration - duration - inserted) > 0.2)
    throw new Error(`${slug}: duration mismatch after splice`);
  await run("ffmpeg", [
    "-v",
    "error",
    "-nostdin",
    "-i",
    output,
    "-f",
    "null",
    "-",
  ]);
  if (textAt(output, cut + 1.3, dir))
    throw new Error(
      `${slug}: planner did not occupy the intended insertion point`,
    );
  if (!textAt(output, cut + inserted + 0.7, dir))
    throw new Error(`${slug}: Desk transition was not preserved`);
  const joins = [
    cut - 0.3,
    cut + 1.3,
    cut + inserted - 1.0,
    cut + inserted + 0.5,
    finalDuration - 5,
  ];
  for (let i = 0; i < joins.length; i++)
    still(output, joins[i], path.join(dir, `join-${i}.jpg`));
  const review = path.join(
    os.homedir(),
    "Desktop",
    `${slug}-walkthrough-with-planner.mp4`,
  );
  if (fs.existsSync(review))
    throw new Error(`Review copy already exists: ${review}`);
  fs.copyFileSync(output, review);
  fs.copyFileSync(output, input);
  manifest[slug] = {
    sourceSha256: sourceHash,
    outputSha256: hash(output),
    sourceDuration: duration,
    cutBeforeDesk: cut,
    insertedDuration: inserted,
    finalDuration,
    review,
    workDirectory: dir,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `READY ${slug}: planner ${cut.toFixed(2)}–${(cut + inserted).toFixed(2)}s, total ${finalDuration.toFixed(2)}s; ${review}`,
  );
}
const queue = [...targets];
const results = [];
async function worker() {
  while (queue.length) {
    const slug = queue.shift();
    const result = await analyze(slug);
    if (result) {
      results.push(result);
      if (!analyzeOnly) await splice(result);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(3, targets.length) }, worker));
console.log(
  JSON.stringify(
    {
      work,
      analyzed: results.map(({ slug, cut, duration, dir }) => ({
        slug,
        cut,
        duration,
        dir,
      })),
    },
    null,
    2,
  ),
);
