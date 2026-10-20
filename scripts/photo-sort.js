#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const slotsPath = path.join(root, "chassis", "images", "slots.json");
const manifest = JSON.parse(fs.readFileSync(slotsPath, "utf8"));
const cuesPath = path.join(root, "chassis", "images", "station-cues.json");
const stationCues = fs.existsSync(cuesPath)
  ? JSON.parse(fs.readFileSync(cuesPath, "utf8"))
  : null;
const slots = manifest.slots;
const allocationOrder = manifest.allocationOrder || Object.keys(slots);
const allocatableSlots = Object.entries(slots)
  .filter(([, slot]) => !slot.protectedDefault)
  .map(([name]) => name);
const missingOrder = allocatableSlots.filter(
  (name) => !allocationOrder.includes(name),
);
const duplicateOrder = allocationOrder.filter(
  (name, index) => allocationOrder.indexOf(name) !== index,
);
if (missingOrder.length || duplicateOrder.length) {
  console.error(
    `bad image allocationOrder — missing: ${missingOrder.join(", ") || "none"}; duplicates: ${[...new Set(duplicateOrder)].join(", ") || "none"}`,
  );
  process.exit(1);
}
const args = process.argv.slice(2);
const srcDir = args[0];
if (!srcDir || !fs.existsSync(srcDir)) {
  console.error(
    "usage: node scripts/photo-sort.js <assetsDir> [--apply <outDir>] [--strict] [--pin slot=file ...]",
  );
  process.exit(1);
}
const applyDir = args.includes("--apply")
  ? args[args.indexOf("--apply") + 1]
  : null;
const strict = args.includes("--strict");
const indexOnly = args.includes("--index-only");
const pins = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--pin" && args[i + 1]) {
    const [slot, file] = args[i + 1].split("=");
    pins[slot] = file;
    i++;
  }
}

const IMG = /\.(jpe?g|png|webp|heic)$/i;
const PERSON_WORDS =
  /\b(i|me|my|we|us|he|she|coach|athlete|partner|team|squad|client|race|finish|pb|proud|won|first)\b/i;
const CROP_RISK_WORDS = /\b(nature|food|view|skyline|equipment|product)\b/i;
const files = fs
  .readdirSync(srcDir)
  .filter((file) => IMG.test(file))
  .sort();
if (!files.length) {
  console.error(`no images found in ${srcDir}`);
  process.exit(1);
}

function visionIndex(imagePaths) {
  if (process.platform !== "darwin") return [];
  try {
    const output = execFileSync(
      "swift",
      [path.join(root, "scripts", "image-vision.swift"), ...imagePaths],
      { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 },
    );
    return JSON.parse(output);
  } catch (error) {
    console.error(`vision metadata unavailable: ${error.message}`);
    return [];
  }
}

const visualIndexPath = path.join(srcDir, "visual-index.json");
const legacyAnnotationsPath = path.join(srcDir, "annotations.json");
const visualIndex = fs.existsSync(visualIndexPath)
  ? JSON.parse(fs.readFileSync(visualIndexPath, "utf8"))
  : null;
const annotations = visualIndex?.images
  ? visualIndex.images
  : fs.existsSync(legacyAnnotationsPath)
    ? JSON.parse(fs.readFileSync(legacyAnnotationsPath, "utf8"))
    : {};
const fullPaths = files.map((file) => path.join(srcDir, file));
const vision = visionIndex(fullPaths);
const visionByPath = new Map(
  vision.map((item) => [path.resolve(item.path), item]),
);
const photos = files.map((file) => {
  const full = path.join(srcDir, file);
  const metadata = visionByPath.get(path.resolve(full)) || {};
  const sidecar = full.replace(IMG, ".txt");
  const metaPath = full.replace(IMG, ".meta.json");
  const mediaMeta = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, "utf8"))
    : { media_count: 1, caption_applies_to_carousel: false };
  const annotation = annotations[file] || {};
  const caption = fs.existsSync(sidecar)
    ? fs.readFileSync(sidecar, "utf8").toLowerCase()
    : "";
  const labels = (metadata.labels || [])
    .filter((label) => label.confidence >= 0.15)
    .map((label) => label.label.toLowerCase());
  const texts = (metadata.texts || []).filter(
    (text) => text.confidence >= 0.25,
  );
  const textArea = texts.reduce(
    (total, text) => total + Number(text.area || 0),
    0,
  );
  const textCharacters = texts.reduce(
    (total, text) => total + String(text.text || "").length,
    0,
  );
  const faces = metadata.faces || [];
  const faceCropRisk = faces.some(
    (face) =>
      face.x < 0.025 ||
      face.y < 0.025 ||
      face.x + face.width > 0.975 ||
      face.y + face.height > 0.975,
  );
  return {
    file,
    full,
    w: metadata.width || 0,
    h: metadata.height || 0,
    ratio:
      metadata.width && metadata.height ? metadata.width / metadata.height : 1,
    caption,
    captionTrusted:
      !mediaMeta.caption_applies_to_carousel && !mediaMeta.is_video_frame,
    mediaMeta,
    annotation,
    labels,
    visionText: labels.join(" ").toLowerCase(),
    annotationText: [
      ...(annotation.subjects || []),
      annotation.suitability || "",
    ]
      .join(" ")
      .toLowerCase(),
    text: `${file.toLowerCase()} ${caption} ${(annotation.subjects || []).join(" ")}`.toLowerCase(),
    trustedText:
      `${file.toLowerCase()} ${mediaMeta.caption_applies_to_carousel || mediaMeta.is_video_frame ? "" : caption} ${(annotation.subjects || []).join(" ")}`.toLowerCase(),
    hasPerson:
      annotation.creatorVisible === true ||
      faces.length > 0 ||
      PERSON_WORDS.test(caption),
    faceCount: faces.length,
    cropRisk:
      annotation.faceCropSafe === true
        ? false
        : faceCropRisk || CROP_RISK_WORDS.test(caption),
    textOverlay:
      !annotation.allowText &&
      (textArea >= 0.035 || (textArea >= 0.015 && textCharacters >= 18)),
    recognizedText: texts.map((text) => text.text),
    duplicatePaths: new Set(
      (metadata.duplicates || []).map((duplicate) =>
        path.basename(duplicate.path),
      ),
    ),
  };
});
fs.writeFileSync(
  path.join(srcDir, "photo-index.json"),
  `${JSON.stringify(
    photos.map(({ full: _full, duplicatePaths, ...photo }) => ({
      ...photo,
      duplicateFiles: [...duplicatePaths],
    })),
    null,
    2,
  )}\n`,
);
console.log(
  `indexed ${photos.length} photos (Vision faces, OCR, labels, near-duplicates)`,
);
if (indexOnly) {
  const stub = (photo) => ({
    subjects: [...photo.labels],
    station: null,
    stationVerified: Boolean(photo.mediaMeta.station_verified),
    verificationSource:
      photo.mediaMeta.verification_source ||
      (photo.mediaMeta.station_verified ? "stock" : "none"),
    quality: 0,
    brandFit: 0,
    allowOffBrandFallback: false,
    heroScore: 0,
    venue: "",
    event: photo.mediaMeta.event || "",
    eventVerified: Boolean(photo.mediaMeta.event),
    textOverlay: photo.textOverlay,
    allowText: false,
    creatorVisible: photo.faceCount > 0,
    faceCropSafe: !photo.cropRisk,
    allowedSlots: [],
    rejected: null,
    notes: `AUTO INDEX ONLY — review required. OCR: ${photo.recognizedText.join(" | ")}`,
  });
  const existing = fs.existsSync(visualIndexPath)
    ? JSON.parse(fs.readFileSync(visualIndexPath, "utf8"))
    : null;
  const images = { ...(existing?.images || {}) };
  for (const photo of photos) {
    images[photo.file] = images[photo.file]
      ? {
          ...images[photo.file],
          textOverlay: photo.textOverlay,
          creatorVisible:
            images[photo.file].creatorVisible || photo.faceCount > 0,
          faceCropSafe: images[photo.file].faceCropSafe && !photo.cropRisk,
          event: images[photo.file].event || photo.mediaMeta.event || "",
          eventVerified:
            images[photo.file].eventVerified ||
            Boolean(photo.mediaMeta.event),
        }
      : stub(photo);
  }
  fs.writeFileSync(
    visualIndexPath,
    `${JSON.stringify(
      {
        status: existing?.status || "PENDING",
        schema: "scripts/photo-visual-index.schema.json",
        images,
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

function evidence(photo, slot) {
  const captionHits = photo.captionTrusted
    ? (slot.keywords || []).filter((keyword) => photo.caption.includes(keyword))
    : [];
  const annotationHits = (slot.keywords || []).filter((keyword) =>
    photo.annotationText.includes(keyword),
  );
  const visualHits = (slot.visualKeywords || []).filter((keyword) =>
    photo.visionText.includes(keyword),
  );
  return {
    captionHits,
    annotationHits,
    visualHits,
    total: captionHits.length + annotationHits.length + visualHits.length,
  };
}

function score(photo, slot, slotName) {
  const proof = evidence(photo, slot);
  if (photo.annotation.rejected)
    return { score: -Infinity, proof, reason: "visually rejected" };
  if (
    Array.isArray(photo.annotation.allowedSlots) &&
    photo.annotation.allowedSlots.length &&
    !photo.annotation.allowedSlots.includes(slotName)
  )
    return { score: -Infinity, proof, reason: "slot not visually approved" };
  const forbidden = (slot.forbiddenKeywords || []).some(
    (keyword) =>
      photo.trustedText.includes(keyword) ||
      photo.visionText.includes(keyword),
  );
  const semanticCritical =
    slot.page === "stations-prep" || slot.page === "run-zone";
  const stationSlot = slotName.startsWith("images/station-");
  if (forbidden)
    return { score: -Infinity, proof, reason: "forbidden subject evidence" };
  if (
    stationSlot &&
    (photo.annotation.stationVerified !== true ||
      !["fullres", "framesheet", "stock"].includes(
        photo.annotation.verificationSource || "none",
      ))
  )
    return {
      score: -Infinity,
      proof,
      reason: "station not verified from actual file or frame sheet",
    };
  // Station claims made from real files/frames must name the visual cues they
  // matched (stationEvidence) — a bare "verified" boolean is how StairMasters
  // ship as SkiErgs. Stock is exempt (its .meta.json is the evidence).
  if (
    stationSlot &&
    stationCues &&
    photo.annotation.verificationSource !== "stock"
  ) {
    const evidence = photo.annotation.stationEvidence;
    const minEvidence = Number(stationCues.minEvidence) || 2;
    if (!Array.isArray(evidence) || evidence.length < minEvidence)
      return {
        score: -Infinity,
        proof,
        reason: `station claim lacks ${minEvidence}+ recorded visual cues (stationEvidence — see chassis/images/station-cues.json)`,
      };
  }
  if (semanticCritical && proof.total === 0)
    return {
      score: -Infinity,
      proof,
      reason: "no slot-specific subject evidence",
    };
  if (
    slot.requireEvent &&
    photo.annotation.eventVerified !== true &&
    photo.annotation.verificationSource !== "stock"
  )
    return {
      score: -Infinity,
      proof,
      reason: "slot requires a verified event photo",
    };
  if (slot.noTextOverlay && photo.textOverlay)
    return { score: -Infinity, proof, reason: "visible text overlay" };
  if (slot.faceCritical && !photo.hasPerson)
    return { score: -Infinity, proof, reason: "no person/face evidence" };
  if (slot.faceCritical && photo.cropRisk)
    return { score: -Infinity, proof, reason: "face/crop risk" };
  const minimumBrandFit =
    slot.minBrandFit ??
    (slot.position === "hero" || slot.page === "stations-prep" ? 8 : 6);
  const brandFit = Number(photo.annotation.brandFit || 0);
  if (brandFit < minimumBrandFit && !photo.annotation.allowOffBrandFallback)
    return {
      score: -Infinity,
      proof,
      reason: `off brand (${brandFit}/10; needs ${minimumBrandFit})`,
    };

  let value = 0;
  const wantAspect = slot.aspect || "any";
  if (wantAspect === "landscape")
    value += photo.ratio >= 1.15 ? 3 : photo.ratio >= 0.9 ? 1 : -3;
  else if (wantAspect === "portrait")
    value += photo.ratio <= 0.85 ? 3 : photo.ratio <= 1.0 ? 1 : -3;
  value += Math.min(proof.annotationHits.length, 2) * 8;
  value += Math.min(proof.captionHits.length, 2) * 5;
  value += Math.min(proof.visualHits.length, 2) * 3;
  value += Number(photo.annotation.quality || 0);
  value += Number(photo.annotation.brandFit || 0);
  value += Number(photo.annotation.framing || 0);
  if (slot.eventPreferred && photo.annotation.eventVerified === true)
    value += 12;
  if (slot.position === "hero")
    value += Number(photo.annotation.heroScore || 0) * 2;
  if (slot.faceCritical && photo.faceCount) value += 4;
  return {
    score: value,
    proof,
    reason: "",
    offBrandFallback: brandFit < minimumBrandFit,
  };
}

const order = allocationOrder
  .filter((name) => slots[name] && !slots[name].protectedDefault)
  .map((name) => [name, slots[name]]);
const used = new Set();
const assignments = {};
const review = [];
const failures = [];
function conflictsWithUsed(photo) {
  return [...used].some(
    (usedFile) => usedFile === photo.file || photo.duplicatePaths.has(usedFile),
  );
}

for (const [slotName, file] of Object.entries(pins)) {
  const photo = photos.find((candidate) => candidate.file === file);
  if (!photo) {
    failures.push({ slot: slotName, reason: `pinned file missing: ${file}` });
    continue;
  }
  if (conflictsWithUsed(photo)) {
    failures.push({ slot: slotName, reason: `pinned duplicate: ${file}` });
    continue;
  }
  assignments[slotName] = { photo: photo.file, score: 99, pinned: true };
  used.add(photo.file);
}

for (const [slotName, slot] of order) {
  if (assignments[slotName]) continue;
  const candidates = photos
    .filter((photo) => !conflictsWithUsed(photo))
    .map((photo) => ({ photo, result: score(photo, slot, slotName) }))
    .filter((candidate) => Number.isFinite(candidate.result.score))
    .sort((left, right) => right.result.score - left.result.score);
  const best = candidates[0];
  if (!best) {
    failures.push({
      slot: slotName,
      reason: "no semantically valid unique image",
    });
    continue;
  }
  assignments[slotName] = {
    photo: best.photo.file,
    score: best.result.score,
    offBrandFallback: best.result.offBrandFallback,
    evidence: [
      ...best.result.proof.annotationHits.map((hit) => `annotation:${hit}`),
      ...best.result.proof.captionHits.map((hit) => `caption:${hit}`),
      ...best.result.proof.visualHits.map((hit) => `vision:${hit}`),
    ],
  };
  used.add(best.photo.file);
  if (best.result.score < 4 || best.result.offBrandFallback)
    review.push({
      slot: slotName,
      photo: best.photo.file,
      score: best.result.score,
      label: slot.label,
    });
}

console.log("\n=== ASSIGNMENTS (slot ← photo · score · evidence) ===");
for (const [slot, assignment] of Object.entries(assignments)) {
  const flag = assignment.pinned
    ? "PIN"
    : assignment.score < 4
      ? "REVIEW"
      : "ok";
  console.log(
    `  ${flag.padEnd(6)} ${slot.padEnd(40)} ← ${assignment.photo}  (${assignment.score}) ${(assignment.evidence || []).join(", ")}`,
  );
}
if (review.length) {
  console.log("\n=== NEEDS HUMAN EYES ===");
  for (const item of review)
    console.log(`  ${item.slot}: "${item.label}" ← ${item.photo}`);
}
if (failures.length) {
  console.log("\n=== UNFILLED / REJECTED SLOTS ===");
  for (const failure of failures)
    console.log(`  ${failure.slot}: ${failure.reason}`);
}
const unused = photos
  .filter((photo) => !used.has(photo.file))
  .map((photo) => photo.file);
console.log(`\nunused: ${unused.length} photos`);

if (applyDir && (!strict || (!failures.length && !review.length))) {
  for (const [slot, assignment] of Object.entries(assignments)) {
    const source = path.join(srcDir, assignment.photo);
    const target = path.join(applyDir, slot);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  console.log(`\napplied → ${applyDir}`);
}
if (strict && (failures.length || review.length)) process.exit(2);
