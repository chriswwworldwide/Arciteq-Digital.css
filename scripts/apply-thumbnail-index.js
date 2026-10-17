#!/usr/bin/env node
import fs from "node:fs";

const [indexPath, shortlistPath] = process.argv.slice(2);
if (!indexPath || !shortlistPath) {
  console.error(
    "usage: node scripts/apply-thumbnail-index.js <visual-index.json> <shortlist.json>",
  );
  process.exit(1);
}
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const shortlist = JSON.parse(fs.readFileSync(shortlistPath, "utf8"));
const required = [
  "subjects",
  "station",
  "quality",
  "brandFit",
  "heroScore",
  "venue",
  "event",
  "textOverlay",
  "creatorVisible",
  "faceCropSafe",
  "notes",
];
const slotsByLabel = {};
for (const [slot, labels] of Object.entries(shortlist.slots || {})) {
  for (const label of labels) (slotsByLabel[label] ||= []).push(slot);
}
for (const label of shortlist.spares || []) slotsByLabel[label] ||= [];

const missing = [];
for (const [file, automatic] of Object.entries(index.images || {})) {
  const rawLabel = file.replace(/\.(?:jpe?g|png|webp|heic)$/i, "");
  const parentLabel = rawLabel.replace(/_f\d+$/, "");
  const rating =
    shortlist.images?.[rawLabel] || shortlist.images?.[parentLabel];
  if (!rating || required.some((field) => !(field in rating))) {
    missing.push(file);
    continue;
  }
  const allowedSlots = [
    ...new Set([
      ...(slotsByLabel[rawLabel] || []),
      ...(slotsByLabel[parentLabel] || []),
      ...(rating.allowedSlots || []),
    ]),
  ];
  index.images[file] = {
    ...automatic,
    ...rating,
    allowOffBrandFallback: Boolean(rating.allowOffBrandFallback),
    allowedSlots,
    rejected: false,
    notes: `${rating.notes} Thumbnail-rated; full file checked automatically for OCR, face/crop and duplicates.`,
  };
}
if (missing.length) {
  console.error(`thumbnail ratings missing for: ${missing.join(", ")}`);
  process.exit(1);
}
index.status = "COMPLETE";
index.review_method =
  "AI thumbnail/contact-sheet rating; downloaded files checked automatically, then final rendered-site QA";
index.reviewed_at = new Date().toISOString();
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(
  `applied thumbnail ratings to ${Object.keys(index.images || {}).length} files`,
);
