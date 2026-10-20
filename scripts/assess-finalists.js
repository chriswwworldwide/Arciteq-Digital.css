#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
const cacheDir = path.join(root, "data", "prospect-cache", "deep-posts");
const handles = process.argv
  .slice(2)
  .filter((arg) => !arg.startsWith("--"))
  .map((handle) => handle.replace(/^@/, "").toLowerCase());
const postCount = Number(
  process.argv.find((arg) => arg.startsWith("--posts="))?.split("=")[1] || 60,
);

if (!handles.length) {
  console.error(
    "usage: node scripts/assess-finalists.js <handle...> [--posts=60]",
  );
  process.exit(1);
}
if (!process.env.BRIGHT_DATA_API_KEY) {
  console.error("BRIGHT_DATA_API_KEY is missing from .env.local");
  process.exit(1);
}

const HYROX = /\bhyrox\b/i;
const COACHING =
  /\b(coach|coaching|client|programme|program|cohort|membership|apply|book|discovery call|training plan)\b/i;
const DESK =
  /\b(code\b|affiliate|sponsor|ambassador|shop|store|merch|seminar|cohort|membership|founder|book)\b/i;
const eventWindowConfig = JSON.parse(
  fs.readFileSync(
    path.join(root, "scripts", "reskin", "hyrox-event-windows.json"),
    "utf8",
  ),
);
const eventDates = eventWindowConfig.events.map(({ name, date }) => ({
  name,
  time: new Date(`${date}T00:00:00Z`).getTime(),
}));
const eventWindowMs = Number(eventWindowConfig.windowDays || 21) * 86400000;

const headers = { Authorization: `Bearer ${process.env.BRIGHT_DATA_API_KEY}` };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function recordHandle(record) {
  const input = record.discovery_input?.url || record.profile_url || "";
  const fromUrl = input.match(/instagram\.com\/([^/?#]+)/i)?.[1];
  return String(
    record.user_posted || record.account || fromUrl || "",
  ).toLowerCase();
}

function text(record) {
  return [record.description, ...(record.hashtags || [])]
    .filter(Boolean)
    .join(" ");
}

function eventFor(record) {
  const time = new Date(record.date_posted || record.datetime || 0).getTime();
  if (!Number.isFinite(time)) return null;
  return (
    eventDates
      .map((event) => ({ ...event, distance: Math.abs(time - event.time) }))
      .filter((event) => event.distance <= eventWindowMs)
      .sort((a, b) => a.distance - b.distance)[0]?.name || null
  );
}

function assess(handle, records) {
  const posts = records.filter((record) => recordHandle(record) === handle);
  const hyrox = posts.filter((post) => HYROX.test(text(post)));
  const eventPosts = posts.filter(eventFor);
  const eventHyrox = eventPosts.filter((post) => HYROX.test(text(post)));
  const coaching = posts.filter((post) => COACHING.test(text(post)));
  const desk = posts.filter((post) => DESK.test(text(post)));
  const events = {};
  for (const post of eventHyrox) {
    const name = eventFor(post);
    events[name] = (events[name] || 0) + 1;
  }
  return {
    handle,
    posts: posts.length,
    date_range: posts.length
      ? [
          posts
            .map((post) => post.date_posted)
            .filter(Boolean)
            .sort()[0],
          posts
            .map((post) => post.date_posted)
            .filter(Boolean)
            .sort()
            .at(-1),
        ]
      : [],
    hyrox_posts: hyrox.length,
    hyrox_rate: posts.length
      ? Math.round((hyrox.length / posts.length) * 100)
      : 0,
    event_window_posts: eventPosts.length,
    event_window_hyrox: eventHyrox.length,
    event_window_hyrox_rate: eventPosts.length
      ? Math.round((eventHyrox.length / eventPosts.length) * 100)
      : 0,
    uk_events: events,
    coaching_posts: coaching.length,
    desk_posts: desk.length,
  };
}

fs.mkdirSync(cacheDir, { recursive: true });
const cacheKey = `${handles.sort().join("_")}--${postCount}.json`;
const cachePath = path.join(cacheDir, cacheKey);
let records;
if (fs.existsSync(cachePath)) {
  records = JSON.parse(fs.readFileSync(cachePath, "utf8"));
} else {
  const url = new URL("https://api.brightdata.com/datasets/v3/trigger");
  url.searchParams.set("dataset_id", "gd_lk5ns7kz21pck8jpis");
  url.searchParams.set("type", "discover_new");
  url.searchParams.set("discover_by", "url");
  url.searchParams.set("include_errors", "true");
  const response = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: handles.map((handle) => ({
        url: `https://www.instagram.com/${handle}`,
        num_of_posts: postCount,
        start_date: "01-01-2026",
        end_date: "11-30-2026",
        post_type: "",
      })),
      limit_per_input: null,
    }),
  });
  const job = await response.json();
  if (!response.ok || !job.snapshot_id)
    throw new Error(`Bright Data trigger failed: ${JSON.stringify(job)}`);
  console.error(`snapshot ${job.snapshot_id} running in background`);
  for (;;) {
    await sleep(10000);
    const progress = await fetch(
      `https://api.brightdata.com/datasets/v3/progress/${job.snapshot_id}`,
      { headers },
    );
    const state = await progress.json();
    if (state.status === "failed")
      throw new Error(state.error_message || "Bright Data snapshot failed");
    if (state.status !== "ready") continue;
    const result = await fetch(
      `https://api.brightdata.com/datasets/v3/snapshot/${job.snapshot_id}?format=json`,
      { headers },
    );
    records = await result.json();
    break;
  }
  fs.writeFileSync(cachePath, `${JSON.stringify(records, null, 2)}\n`);
}

// Validate Bright Data pull quality — flag shallow pulls and missing carousels
for (const handle of handles) {
  const posts = records.filter((r) => {
    const owner = (r.user_posted || r.account || "").toString().toLowerCase()
      || (r.profile_url || "").split("instagram.com/")[1]?.split("/")[0]?.toLowerCase();
    return owner === handle;
  });
  const carousels = posts.filter((r) => (r.post_content || []).length > 1);
  const expandedChildren = posts.reduce((sum, r) => sum + (r.post_content || []).length, 0);
  if (posts.length < postCount * 0.5) {
    console.error(
      `⚠ SHALLOW PULL: ${handle} — requested ${postCount} posts, got ${posts.length}. ` +
      `Bright Data may have hit a limit. Use ig-triage.py + ig-pull.py as fallback.`
    );
  }
  if (posts.length > 0 && carousels.length === 0) {
    console.error(
      `⚠ NO CAROUSEL EXPANSION: ${handle} — ${posts.length} posts but zero carousel children. ` +
      `HYROX race carousels (often 6-12 professional shots) are invisible. ` +
      `Use ig-triage.py which expands every sidecar.`
    );
  } else if (carousels.length > 0 && expandedChildren / posts.length < 1.5) {
    console.error(
      `⚠ LOW CAROUSEL DEPTH: ${handle} — ${carousels.length} carousels but only ${expandedChildren} total children. ` +
      `Some carousel children may be missing.`
    );
  }
}

console.log(
  JSON.stringify(
    handles.map((handle) => assess(handle, records)),
    null,
    2,
  ),
);
