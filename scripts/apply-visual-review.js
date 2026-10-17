#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const [indexPath, reviewPath] = process.argv.slice(2);
if (!indexPath || !reviewPath) {
  console.error(
    "usage: node scripts/apply-visual-review.js <visual-index.json> <visual-review.json>",
  );
  process.exit(1);
}
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "..",
      "chassis",
      "images",
      "slots.json",
    ),
    "utf8",
  ),
);
const inheritedAssignments = review.approvalPath
  ? JSON.parse(
      fs.readFileSync(
        path.resolve(path.dirname(reviewPath), review.approvalPath),
        "utf8",
      ),
    ).slots || {}
  : {};
const assignmentDecisions = {};
for (const [slot, file] of Object.entries(inheritedAssignments)) {
  const definition = manifest.slots[slot];
  if (!definition?.protectedDefault)
    assignmentDecisions[file] = {
      subjects: definition?.keywords || [],
      station:
        definition?.page === "stations-prep"
          ? definition.position.replace(/^station-\d+-/, "")
          : definition?.page === "run-zone"
            ? "running"
            : null,
      quality: 6,
      brandFit: 6,
      allowOffBrandFallback: false,
      heroScore: definition?.position === "hero" ? 6 : 0,
      venue: "",
      event: "",
      textOverlay: Boolean(index.images?.[file]?.textOverlay),
      allowText: false,
      creatorVisible: Boolean(index.images?.[file]?.creatorVisible),
      faceCropSafe: Boolean(index.images?.[file]?.faceCropSafe),
      allowedSlots: [slot],
      rejected: false,
      notes: `Visually retained for ${slot}; detailed overrides take precedence.`,
    };
}
for (const [file, image] of Object.entries(index.images || {})) {
  const decision = {
    ...(assignmentDecisions[file] || {}),
    ...(review.images?.[file] || {}),
  };
  const selected = Boolean(assignmentDecisions[file] || review.images?.[file]);
  if (selected) {
    index.images[file] = {
      ...image,
      allowOffBrandFallback: false,
      ...decision,
      rejected: false,
    };
  } else {
    index.images[file] = {
      ...image,
      quality: Number(image.quality || 0),
      brandFit: Number(image.brandFit || 0),
      allowOffBrandFallback: Boolean(image.allowOffBrandFallback),
      heroScore: Number(image.heroScore || 0),
      venue: image.venue || "",
      event: image.event || "",
      allowedSlots: [],
      rejected: true,
      notes:
        image.notes && !image.notes.startsWith("AUTO INDEX ONLY")
          ? image.notes
          : "Rejected after contact-sheet review: not stronger or more suitable than the shortlisted pool.",
    };
  }
}
for (const file of Object.keys(review.images || {})) {
  if (!index.images?.[file])
    throw new Error(`reviewed image missing from index: ${file}`);
}
index.status = "COMPLETE";
index.reviewed_at = new Date().toISOString();
index.review_method =
  "AI visual review of labelled contact sheets plus full-size inspection of shortlisted images";
fs.writeFileSync(
  path.resolve(indexPath),
  `${JSON.stringify(index, null, 2)}\n`,
);
console.log(
  `visual index complete: ${Object.values(index.images || {}).filter((image) => !image.rejected).length} shortlisted, ${Object.values(index.images || {}).filter((image) => image.rejected).length} rejected`,
);
