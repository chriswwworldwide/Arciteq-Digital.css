#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imageSlots = Object.entries(
  JSON.parse(
    fs.readFileSync(path.join(root, "chassis", "images", "slots.json"), "utf8"),
  ).slots,
)
  .filter(([, slot]) => !slot.protectedDefault)
  .map(([name]) => name);
const args = process.argv.slice(2);
const resumeIndex = args.indexOf("--resume");
const completeIndex = args.indexOf("--complete");
const runArg = args.find((arg) => arg.startsWith("--run="));
const postsArg = args.find((arg) => arg.startsWith("--posts="));
const dryRun = args.includes("--dry-run");
const posts = Number(postsArg?.split("=")[1] || 60);
const python = fs.existsSync("/tmp/igenv/bin/python")
  ? "/tmp/igenv/bin/python"
  : "python3";

function cleanHandle(value) {
  return value
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
}

function run(command, commandArgs, options = {}) {
  if (dryRun) {
    console.log([command, ...commandArgs].join(" "));
    return options.mock || "";
  }
  return execFileSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "inherit"],
    maxBuffer: 50 * 1024 * 1024,
  });
}

function readHandles() {
  const fileArg = args.find((arg) => arg.startsWith("--file="));
  const direct = args.filter(
    (arg) => !arg.startsWith("--") && arg !== "prepare",
  );
  const fromFile = fileArg
    ? fs
        .readFileSync(path.resolve(root, fileArg.split("=")[1]), "utf8")
        .split(/[\n,]/)
    : [];
  return [
    ...new Set([...direct, ...fromFile].map(cleanHandle).filter(Boolean)),
  ];
}

function safeRunId(value) {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(value))
    throw new Error("run id must contain only letters, numbers, _ or -");
  return value;
}

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function deepCachePath(handles, postCount = posts) {
  const dir = path.join(root, "data", "prospect-cache", "deep-posts");
  const prefix = `${[...handles].sort().join("_")}--`;
  const cached = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
        .map((file) => Number(file.slice(prefix.length, -5)))
        .filter((count) => Number.isFinite(count) && count >= postCount)
        .sort((a, b) => a - b)
    : [];
  const best = cached.length ? cached[0] : postCount;
  return path.join(dir, `${prefix}${best}.json`);
}

function prepare() {
  const handles = readHandles();
  if (!handles.length)
    throw new Error(
      "usage: node scripts/prospect-pipeline.js prepare <handles...> [--run=name] [--posts=60]",
    );
  const runId = safeRunId(
    runArg?.split("=")[1] ||
      `prospects-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );
  const runDir = path.join(root, "scripts", "reskin", "prospects", runId);
  fs.mkdirSync(runDir, { recursive: true });
  const startedAt = new Date();
  writeJson(path.join(runDir, "pipeline.json"), {
    run_id: runId,
    stage: "preparing",
    started_at: startedAt.toISOString(),
    handles,
    metrics: { rework_seconds: 0, corrections: [] },
  });

  const qualificationText = run(
    "node",
    ["scripts/qualify-prospects.js", ...handles, "--json"],
    { mock: "[]" },
  );
  const qualification = dryRun
    ? handles.map((handle) => ({ handle, status: "PASS", dry_run: true }))
    : JSON.parse(qualificationText || "[]");
  writeJson(path.join(runDir, "qualification.json"), qualification);
  // --force=handle1,handle2 admits handles the qualifier scored REVIEW/REJECT
  // when a human has already cleared them manually (e.g. side-business the
  // bio scan can't see). Forced handles are recorded in pipeline.json.
  const forced = new Set(
    (args.find((arg) => arg.startsWith("--force="))?.split("=")[1] || "")
      .split(",")
      .map(cleanHandle)
      .filter(Boolean),
  );
  const finalists = qualification
    .filter(
      (result) =>
        result.status === "PASS" ||
        (forced.has(result.handle) && result.status !== "ERROR"),
    )
    .map((result) => result.handle);
  if (!finalists.length) {
    writeJson(path.join(runDir, "pipeline.json"), {
      run_id: runId,
      stage: "no_qualified_prospects",
      handles,
      finalists: [],
    });
    console.log(
      `No PASS candidates. Review ${path.relative(root, runDir)}/qualification.json`,
    );
    return;
  }

  const assessmentText = run(
    "node",
    ["scripts/assess-finalists.js", ...finalists, `--posts=${posts}`],
    { mock: "[]" },
  );
  const assessment = JSON.parse(assessmentText || "[]");
  writeJson(path.join(runDir, "assessment.json"), assessment);
  const records = deepCachePath(finalists);

  for (const handle of finalists) {
    const prospectDir = path.join(runDir, handle);
    run(python, [
      "scripts/bright-contact-sheet.py",
      records,
      path.join(prospectDir, "contact-sheets"),
      handle,
      "--max",
      String(posts),
    ]);
    writeJson(path.join(prospectDir, "shortlist.json"), {
      status: "PENDING",
      instructions: [
        "Set approval.json config_path first so stripped/omitted slots leave the roster.",
        "Review thumbnails only; assign 1-2 candidate labels per active slot.",
        "Canonical labels live in contact-sheets/*-labels.json — copy label strings from there, never transcribe from sheet tiles.",
        "Labels marked [VID] are video COVERS only. Before shortlisting a video for a semantic slot (stations/run-zone), run scripts/video-frame-sheet.py on its shortcode and rate the actual frames.",
        "Keep no more than 10 unique spares. Full-resolution export happens only after this gate.",
        "Crew dinner/dance are protected template defaults and never belong in this roster.",
        "If final QA exposes a gap, backfill that one slot rather than reopening the whole profile.",
      ],
      slots: {},
      spares: [],
      images: {},
    });
    writeJson(path.join(prospectDir, "approval.json"), {
      approved: false,
      decision: "REVIEW",
      config_path: "",
      notes: [
        "First complete source/visual-index.json from the contact sheets before allocation runs.",
        "Rate quality, brand fit and hero strength; identify station, venue, overlays, face/crop safety and allowed slots.",
        "Then inspect photo-sort.txt and approve/reject the ranked assignments.",
        `Set decision to BUILD or REJECT. BUILD requires all ${imageSlots.length} slots plus config_path.`,
      ],
      rework_seconds: 0,
      corrections: [],
      slots: {},
    });
  }

  writeJson(path.join(runDir, "pipeline.json"), {
    run_id: runId,
    stage: "thumbnail_triage",
    started_at: startedAt.toISOString(),
    prepared_at: new Date().toISOString(),
    handles,
    finalists,
    forced: [...forced],
    posts,
    metrics: { rework_seconds: 0, corrections: [] },
    next_command: `node scripts/prospect-pipeline.js --resume ${runId}`,
  });
  console.log(`\nREADY FOR THUMBNAIL TRIAGE → ${path.relative(root, runDir)}`);
  console.log(`Resume: node scripts/prospect-pipeline.js --resume ${runId}`);
}

function resume(runId) {
  const safeId = safeRunId(runId);
  const runDir = path.join(root, "scripts", "reskin", "prospects", safeId);
  const statePath = path.join(runDir, "pipeline.json");
  if (!fs.existsSync(statePath))
    throw new Error(`unknown pipeline run: ${safeId}`);
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const results = [];

  for (const handle of state.finalists || []) {
    const prospectDir = path.join(runDir, handle);
    const approvalPath = path.join(prospectDir, "approval.json");
    const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
    if (approval.decision === "REJECT") {
      results.push({ handle, status: "REJECTED_AT_VISUAL_GATE" });
      continue;
    }
    const configPath = approval.config_path
      ? path.resolve(root, approval.config_path)
      : null;
    const config = configPath
      ? JSON.parse(fs.readFileSync(configPath, "utf8"))
      : null;
    const omittedSlots = new Set(config?.omitImageSlots || []);
    const requiredImageSlots = imageSlots.filter(
      (slot) => !omittedSlots.has(slot),
    );
    const shortlistPath = path.join(prospectDir, "shortlist.json");
    const shortlist = fs.existsSync(shortlistPath)
      ? JSON.parse(fs.readFileSync(shortlistPath, "utf8"))
      : null;
    if (shortlist?.status === "NEEDS_MORE_THUMBNAILS") {
      const requestedPosts = Math.min(
        Number(shortlist.requestedPosts || state.posts + 40),
        200,
      );
      run("node", [
        "scripts/assess-finalists.js",
        handle,
        `--posts=${requestedPosts}`,
      ]);
      run(python, [
        "scripts/bright-contact-sheet.py",
        deepCachePath([handle], requestedPosts),
        path.join(prospectDir, `contact-sheets-backfill-${requestedPosts}`),
        handle,
        "--max",
        String(requestedPosts),
      ]);
      shortlist.status = "PENDING";
      shortlist.backfills ||= [];
      shortlist.backfills.push({
        posts: requestedPosts,
        created_at: new Date().toISOString(),
      });
      writeJson(shortlistPath, shortlist);
      results.push({
        handle,
        status: "THUMBNAILS_BACKFILLED",
        posts: requestedPosts,
      });
      continue;
    }
    if (shortlist?.status !== "COMPLETE") {
      results.push({ handle, status: "WAITING_FOR_THUMBNAIL_SHORTLIST" });
      continue;
    }
    if (!config && !shortlist.legacy) {
      results.push({ handle, status: "WAITING_FOR_CONFIG_BEFORE_SHORTLIST" });
      continue;
    }
    if (!shortlist.legacy) {
      const shortlistSlots = shortlist.slots || {};
      const missingShortlists = requiredImageSlots.filter(
        (slot) =>
          !Array.isArray(shortlistSlots[slot]) ||
          shortlistSlots[slot].length < 1,
      );
      const oversizedShortlists = Object.entries(shortlistSlots)
        .filter(([, labels]) => !Array.isArray(labels) || labels.length > 2)
        .map(([slot]) => slot);
      const spares = shortlist.spares || [];
      const allLabels = [...Object.values(shortlistSlots).flat(), ...spares];
      if (
        missingShortlists.length ||
        oversizedShortlists.length ||
        spares.length > 10 ||
        new Set(allLabels).size > requiredImageSlots.length + 10
      ) {
        results.push({
          handle,
          status: "INVALID_THUMBNAIL_SHORTLIST",
          error: [
            missingShortlists.length
              ? `no candidate: ${missingShortlists.join(", ")}`
              : "",
            oversizedShortlists.length
              ? `more than 2 candidates: ${oversizedShortlists.join(", ")}`
              : "",
            spares.length > 10 ? "more than 10 spares" : "",
            new Set(allLabels).size > requiredImageSlots.length + 10
              ? `more than ${requiredImageSlots.length + 10} unique downloads`
              : "",
          ]
            .filter(Boolean)
            .join("; "),
        });
        continue;
      }
    }
    const sourceDir = path.join(prospectDir, "source");
    const visualIndexPath = path.join(sourceDir, "visual-index.json");
    const shortlistHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          slots: shortlist.slots || {},
          spares: shortlist.spares || [],
          images: shortlist.images || {},
        }),
      )
      .digest("hex");
    const shortlistHashPath = path.join(sourceDir, "shortlist.sha256");
    if (
      fs.existsSync(visualIndexPath) &&
      fs.existsSync(shortlistHashPath) &&
      fs.readFileSync(shortlistHashPath, "utf8").trim() !== shortlistHash
    ) {
      results.push({
        handle,
        status: "SHORTLIST_CHANGED_USE_TARGETED_BACKFILL",
      });
      continue;
    }
    if (!fs.existsSync(visualIndexPath)) {
      run(python, [
        "scripts/bright-export-assets.py",
        deepCachePath(state.finalists || []),
        handle,
        sourceDir,
        "--max",
        String(
          Math.max(
            new Set([
              ...Object.values(shortlist.slots || {}).flat(),
              ...(shortlist.spares || []),
              ...(shortlist.candidates || []).map((item) => item.label),
            ]).size * 3,
            20,
          ),
        ),
        "--selection",
        shortlistPath,
      ]);
      run("node", ["scripts/photo-sort.js", sourceDir, "--index-only"]);
      run("node", [
        "scripts/apply-thumbnail-index.js",
        visualIndexPath,
        shortlistPath,
      ]);
      fs.writeFileSync(shortlistHashPath, `${shortlistHash}\n`);
    }
    const visualIndex = JSON.parse(fs.readFileSync(visualIndexPath, "utf8"));
    if (visualIndex?.status !== "COMPLETE") {
      results.push({ handle, status: "WAITING_FOR_VISUAL_INDEX" });
      continue;
    }
    const requiredFields = JSON.parse(
      fs.readFileSync(
        path.join(root, "scripts", "photo-visual-index.schema.json"),
        "utf8",
      ),
    ).requiredImageFields;
    const indexedImages = Object.entries(visualIndex.images || {});
    const invalidImages = indexedImages
      .filter(([, image]) => requiredFields.some((field) => !(field in image)))
      .map(([file]) => file);
    const sourceImages = fs
      .readdirSync(sourceDir)
      .filter((file) => /\.(?:jpe?g|png|webp|heic)$/i.test(file));
    const indexedNames = new Set(indexedImages.map(([file]) => file));
    const unindexedImages = sourceImages.filter(
      (file) => !indexedNames.has(file),
    );
    const uncoveredSlots = requiredImageSlots.filter(
      (slot) =>
        !indexedImages.some(
          ([, image]) =>
            !image.rejected &&
            Array.isArray(image.allowedSlots) &&
            image.allowedSlots.includes(slot),
        ),
    );
    if (
      invalidImages.length ||
      unindexedImages.length ||
      uncoveredSlots.length
    ) {
      results.push({
        handle,
        status: "INVALID_VISUAL_INDEX",
        error: [
          invalidImages.length
            ? `missing required fields: ${invalidImages.join(", ")}`
            : "",
          unindexedImages.length
            ? `not visually indexed: ${unindexedImages.join(", ")}`
            : "",
          uncoveredSlots.length
            ? `no approved candidate for: ${uncoveredSlots.join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("; "),
      });
      continue;
    }
    const sortOutput = run("node", ["scripts/photo-sort.js", sourceDir]);
    if (!dryRun)
      fs.writeFileSync(path.join(prospectDir, "photo-sort.txt"), sortOutput);
    if (!approval.approved || approval.decision !== "BUILD") {
      results.push({ handle, status: "WAITING_FOR_VISUAL_APPROVAL" });
      continue;
    }
    if (!config) {
      results.push({ handle, status: "WAITING_FOR_CONFIG" });
      continue;
    }
    const slotEntries = Object.entries(approval.slots || {}).filter(
      ([slot]) => !omittedSlots.has(slot),
    );
    const approvedSlotNames = new Set(slotEntries.map(([slot]) => slot));
    // IG-first rule: the coach's own Instagram is ALWAYS the primary image
    // source. Stock fallback is a last resort after a deeper IG pull has been
    // attempted. The pipeline must try to fill every slot from the coach's
    // content before touching stock photos. Auto-fills are recorded in the
    // result so the log stays honest about what came from stock.
    const unapprovedSlots = requiredImageSlots.filter(
      (slot) => !approvedSlotNames.has(slot),
    );
    if (unapprovedSlots.length) {
      // Check if a deeper IG pull was already attempted for this prospect
      const deeperPullMarker = path.join(prospectDir, "deeper-pull.json");
      if (!fs.existsSync(deeperPullMarker)) {
        // First pass: request a deeper IG pull before falling back to stock
        const deeperPosts = Math.min((state.posts || posts) + 60, 200);
        writeJson(deeperPullMarker, {
          reason: "unfilled_slots_from_ig",
          unfilled: unapprovedSlots,
          original_posts: state.posts || posts,
          deeper_posts: deeperPosts,
          created_at: new Date().toISOString(),
        });
        console.log(
          `  IG-FIRST: ${handle} has ${unapprovedSlots.length} unfilled slot(s) — pulling ${deeperPosts} posts before stock fallback`,
        );
        console.log(`    unfilled: ${unapprovedSlots.join(", ")}`);
        results.push({
          handle,
          status: "DEEPER_IG_PULL_REQUESTED",
          unfilled: unapprovedSlots,
          deeper_posts: deeperPosts,
        });
        continue;
      }
    }
    const stockDir = path.join(root, "scripts", "reskin", "stock");
    const stockFor = (slot) => {
      const base = path.basename(slot, ".jpg");
      for (const name of [`${base}.jpg`, `stock-${base.replace(/^station-/, "")}.jpg`]) {
        const p = path.join(stockDir, name);
        if (fs.existsSync(p)) return p;
      }
      return null;
    };
    const autoFilled = [];
    for (const slot of requiredImageSlots) {
      if (approvedSlotNames.has(slot)) continue;
      const stock = stockFor(slot);
      if (stock) {
        console.log(`  STOCK FALLBACK: ${handle} — ${path.basename(slot)} filled from stock (no IG image found after deeper pull)`);
        slotEntries.push([slot, path.relative(sourceDir, stock)]);
        autoFilled.push(path.basename(slot));
      }
    }
    const missingSlots = requiredImageSlots.filter(
      (slot) => !approvedSlotNames.has(slot) && !autoFilled.includes(path.basename(slot)),
    );
    const unknownSlots = slotEntries
      .map(([slot]) => slot)
      .filter((slot) => !imageSlots.includes(slot));
    const sourceNames = slotEntries.map(([, source]) => source);
    if (
      missingSlots.length ||
      unknownSlots.length ||
      new Set(sourceNames).size !== sourceNames.length
    ) {
      results.push({
        handle,
        status: "INVALID_APPROVAL",
        error: [
          missingSlots.length ? `missing: ${missingSlots.join(", ")}` : "",
          unknownSlots.length ? `unknown: ${unknownSlots.join(", ")}` : "",
          new Set(sourceNames).size !== sourceNames.length
            ? "same source photo assigned more than once"
            : "",
        ]
          .filter(Boolean)
          .join("; "),
      });
      continue;
    }
    const photoIndexPath = path.join(prospectDir, "source", "photo-index.json");
    if (fs.existsSync(photoIndexPath)) {
      const photoIndex = JSON.parse(fs.readFileSync(photoIndexPath, "utf8"));
      const selected = new Set(sourceNames);
      const nearDuplicates = photoIndex.flatMap((photo) =>
        (photo.duplicateFiles || [])
          .filter(
            (duplicate) =>
              selected.has(photo.file) &&
              selected.has(duplicate) &&
              photo.file < duplicate,
          )
          .map((duplicate) => `${photo.file} ≈ ${duplicate}`),
      );
      if (nearDuplicates.length) {
        results.push({
          handle,
          status: "INVALID_APPROVAL",
          error: `near-duplicate photos selected: ${nearDuplicates.join(", ")}`,
        });
        continue;
      }
    }
    if (!approval.allocation_verified) {
      run(python, [
        "scripts/allocation-contact-sheet.py",
        approvalPath,
        sourceDir,
        path.join(prospectDir, "allocation"),
      ]);
      results.push({
        handle,
        status: "WAITING_FOR_ALLOCATION_REVIEW",
        note: "Review allocation/*.jpg — sheets show the ACTUAL files per slot. Set allocation_verified: true in approval.json to build.",
      });
      continue;
    }
    const assetsDir = path.join(
      root,
      "scripts",
      "reskin",
      `${config.slug}-assets`,
    );
    for (const [slot, sourceName] of slotEntries) {
      const source = path.join(sourceDir, sourceName);
      if (!fs.existsSync(source))
        throw new Error(`approved source missing for ${handle}: ${sourceName}`);
      const target = path.join(assetsDir, slot);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }

    config.assets = path.relative(root, assetsDir);
    writeJson(configPath, config);
    run("node", ["scripts/reskin-tenant.js", path.relative(root, configPath)], {
      inherit: true,
    });
    results.push({ handle, status: "BUILT", slug: config.slug });
  }

  state.stage = results.some((result) => result.status === "BUILT")
    ? "built_pending_browser_qc"
    : results.some((result) =>
          [
            "WAITING_FOR_THUMBNAIL_SHORTLIST",
            "THUMBNAILS_BACKFILLED",
            "INVALID_THUMBNAIL_SHORTLIST",
            "SHORTLIST_CHANGED_USE_TARGETED_BACKFILL",
          ].includes(result.status),
        )
      ? "thumbnail_triage"
      : results.some((result) =>
            ["WAITING_FOR_VISUAL_INDEX", "INVALID_VISUAL_INDEX"].includes(
              result.status,
            ),
          )
        ? "visual_index"
        : "visual_review";
  state.updated_at = new Date().toISOString();
  state.results = results;
  state.metrics = {
    rework_seconds: (state.finalists || []).reduce((total, handle) => {
      const approval = JSON.parse(
        fs.readFileSync(path.join(runDir, handle, "approval.json"), "utf8"),
      );
      return total + Number(approval.rework_seconds || 0);
    }, 0),
    corrections: (state.finalists || []).flatMap((handle) => {
      const approval = JSON.parse(
        fs.readFileSync(path.join(runDir, handle, "approval.json"), "utf8"),
      );
      return (approval.corrections || []).map((correction) => ({
        handle,
        correction,
      }));
    }),
  };
  if (state.stage === "built_pending_browser_qc") {
    state.built_at = new Date().toISOString();
    state.metrics.start_to_build_seconds = Math.round(
      (new Date(state.built_at) - new Date(state.started_at)) / 1000,
    );
  }
  // Append-only status timeline per handle so stage durations are derivable:
  // diff consecutive entries for the same handle to time triage, backfill,
  // export/index, allocation review and rework separately.
  state.stage_log ||= [];
  const loggedAt = new Date().toISOString();
  for (const result of results) {
    const last = [...state.stage_log]
      .reverse()
      .find((entry) => entry.handle === result.handle);
    if (!last || last.status !== result.status)
      state.stage_log.push({
        handle: result.handle,
        status: result.status,
        at: loggedAt,
      });
  }
  writeJson(statePath, state);
  console.log(JSON.stringify(results, null, 2));
}

function complete(runId) {
  const safeId = safeRunId(runId);
  const statePath = path.join(
    root,
    "scripts",
    "reskin",
    "prospects",
    safeId,
    "pipeline.json",
  );
  if (!fs.existsSync(statePath))
    throw new Error(`unknown pipeline run: ${safeId}`);
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  if (state.stage !== "built_pending_browser_qc")
    throw new Error(`run is not waiting for browser QC: ${state.stage}`);
  state.stage = "pitch_ready";
  state.completed_at = new Date().toISOString();
  state.metrics ||= {};
  state.metrics.start_to_finish_seconds = Math.round(
    (new Date(state.completed_at) - new Date(state.started_at)) / 1000,
  );
  writeJson(statePath, state);
  console.log(JSON.stringify(state.metrics, null, 2));
}

try {
  if (completeIndex !== -1) {
    const runId = args[completeIndex + 1];
    if (!runId) throw new Error("--complete requires a run id");
    complete(runId);
  } else if (resumeIndex !== -1) {
    const runId = args[resumeIndex + 1];
    if (!runId) throw new Error("--resume requires a run id");
    resume(runId);
  } else {
    prepare();
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
