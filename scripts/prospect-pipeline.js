#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

function deepCachePath(handles) {
  return path.join(
    root,
    "data",
    "prospect-cache",
    "deep-posts",
    `${[...handles].sort().join("_")}--${posts}.json`,
  );
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
  const finalists = qualification
    .filter((result) => result.status === "PASS")
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
    const sourceDir = path.join(prospectDir, "source");
    run(python, [
      "scripts/bright-contact-sheet.py",
      records,
      path.join(prospectDir, "contact-sheets"),
      handle,
      "--max",
      String(posts),
    ]);
    run(python, [
      "scripts/bright-export-assets.py",
      records,
      handle,
      sourceDir,
      "--max",
      "80",
    ]);
    const sortOutput = run("node", ["scripts/photo-sort.js", sourceDir]);
    if (!dryRun)
      fs.writeFileSync(path.join(prospectDir, "photo-sort.txt"), sortOutput);
    writeJson(path.join(prospectDir, "approval.json"), {
      approved: false,
      decision: "REVIEW",
      config_path: "",
      notes: [
        "Inspect every contact sheet and the proposed photo-sort assignments.",
        "Confirm subject identity, intact faces, readable clocks, station accuracy and no visual duplicates.",
        "Set decision to BUILD or REJECT. BUILD requires all 31 slots plus config_path.",
      ],
      rework_seconds: 0,
      corrections: [],
      slots: {},
    });
  }

  writeJson(path.join(runDir, "pipeline.json"), {
    run_id: runId,
    stage: "visual_review",
    started_at: startedAt.toISOString(),
    prepared_at: new Date().toISOString(),
    handles,
    finalists,
    posts,
    metrics: { rework_seconds: 0, corrections: [] },
    next_command: `node scripts/prospect-pipeline.js --resume ${runId}`,
  });
  console.log(`\nREADY FOR VISUAL REVIEW → ${path.relative(root, runDir)}`);
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
    if (!approval.approved || approval.decision !== "BUILD") {
      results.push({ handle, status: "WAITING_FOR_VISUAL_APPROVAL" });
      continue;
    }
    const slotEntries = Object.entries(approval.slots || {});
    if (slotEntries.length !== 31) {
      results.push({
        handle,
        status: "INVALID_APPROVAL",
        error: "exactly 31 image slots required",
      });
      continue;
    }
    if (!approval.config_path) {
      results.push({ handle, status: "WAITING_FOR_CONFIG" });
      continue;
    }

    const configPath = path.resolve(root, approval.config_path);
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const sourceDir = path.join(prospectDir, "source");
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
