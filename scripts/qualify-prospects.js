#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });

const PROFILE_DATASET = "gd_l1vikfch901nx3by4";
const cacheDir = path.join(root, "data", "prospect-cache");
const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const jsonOutput = args.includes("--json");
const handles = args.filter((arg) => !arg.startsWith("--")).map(cleanHandle);

if (!handles.length) {
  console.error(
    "usage: node scripts/qualify-prospects.js <handle...> [--refresh] [--json]",
  );
  process.exit(1);
}
if (!process.env.BRIGHT_DATA_API_KEY) {
  console.error("BRIGHT_DATA_API_KEY is missing from .env.local");
  process.exit(1);
}

const LINK_TOOLS = [
  "linktr.ee",
  "beacons.ai",
  "bio.site",
  "linkin.bio",
  "koji.to",
  "stan.store",
  "hoo.be",
  "campsite.bio",
  "msha.ke",
  "typeform.com",
  "forms.gle",
  "wa.me",
  "calendly.com",
  "fitr.training",
  "buy.stripe.com",
  "strava.app.link",
  "liinks.co",
];
const UK =
  /\b(uk|united kingdom|england|scotland|wales|british|london|birmingham|manchester|glasgow|cardiff|bristol|leeds|liverpool|newcastle|nottingham|sheffield|stockport|herts|essex|surrey|kent|yorkshire)\b/i;
const WRONG_GEO =
  /\b(australia|australian|gold coast|melbourne|melbs|brisbane|sydney|port douglas|dubai|uae|united arab emirates|united states|usa|canada)\b/i;
const HYROX = /\bhyrox\b/i;
const SELLER =
  /\b(coach|coaching|1:1|one[- ]to[- ]one|personal train|online train|programme|program|membership|community|cohort|apply|enrol|book|clients?)\b/i;
const NUTRITION =
  /\b(nutrition|nutritionist|dietitian|dietician|macros?|meal plan)\b/i;
const NEGATIVE_SPORTS = {
  triathlon: /\b(triathlon|ironman|swim|swimming|cycling|cyclist|bike leg)\b/i,
  bodybuilding:
    /\b(bodybuild\w*|physique|muscle gain|contest prep|fat loss transformation)\b/i,
  "running-only": /\b(marathon|half marathon|running coach|run club|5k|10k)\b/i,
};
const DESK =
  /\b(affiliate|code\b|sponsor|ambassador|shop|store|merch|founder|program coordinator|gym owner|community|membership|cohort)\b/i;

function cleanHandle(value) {
  return value
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
}

function values(value) {
  if (Array.isArray(value)) return value.flatMap(values);
  return value == null ? [] : [String(value)];
}

function postText(post) {
  return [post.caption, ...(post.post_hashtags || [])]
    .filter(Boolean)
    .join(" ");
}

function latestPostDate(posts) {
  const dates = posts
    .map((post) => new Date(post.datetime || post.timestamp || 0))
    .filter((date) => Number.isFinite(date.getTime()));
  return dates.length ? new Date(Math.max(...dates)) : null;
}

function classify(profile) {
  const posts = Array.isArray(profile.posts) ? profile.posts.slice(0, 12) : [];
  const bio = profile.biography || "";
  const captions = posts.map(postText);
  const external = values(profile.external_url || profile.external_urls);
  const linktool = LINK_TOOLS.find((tool) =>
    external.some((url) => url.toLowerCase().includes(tool)),
  );
  const ownedUrls = external.filter(
    (url) =>
      !LINK_TOOLS.some((tool) => url.toLowerCase().includes(tool)) &&
      !/instagram\.com|youtube\.com|youtu\.be|tiktok\.com|threads\.net/i.test(
        url,
      ),
  );
  const ukExternal = external.some((url) =>
    /(?:\.co\.uk\b|wa\.me\/44|country(?:name|code)=(?:GB|UK))/i.test(url),
  );
  const ukSignals =
    captions.filter((text) => UK.test(text)).length +
    (UK.test(bio) ? 2 : 0) +
    (ukExternal ? 2 : 0);
  const wrongGeoSignals =
    captions.filter((text) => WRONG_GEO.test(text)).length +
    (WRONG_GEO.test(bio) ? 2 : 0);
  const hyroxPosts = captions.filter((text) => HYROX.test(text)).length;
  const sellerPosts = captions.filter((text) => SELLER.test(text)).length;
  const sellerBio = SELLER.test(bio);
  const negative = Object.entries(NEGATIVE_SPORTS)
    .map(([name, pattern]) => ({
      name,
      count: captions.filter((text) => pattern.test(text)).length,
    }))
    .sort((a, b) => b.count - a.count)[0];
  const latest = latestPostDate(posts);
  const daysSincePost = latest
    ? Math.max(0, Math.floor((Date.now() - latest.getTime()) / 86400000))
    : null;

  const rejects = [];
  const reviews = [];
  if (profile.is_private) rejects.push("private account");
  if (wrongGeoSignals >= 2 && wrongGeoSignals > ukSignals)
    rejects.push("outside UK launch geography");
  else if (!ukSignals) reviews.push("UK geography not confirmed");
  if (hyroxPosts < 3) {
    if (negative?.count >= 3)
      rejects.push(`${negative.name}-dominant; not HYROX-specific`);
    else reviews.push(`only ${hyroxPosts}/12 recent HYROX captions`);
  }
  if (!sellerBio && !sellerPosts)
    rejects.push("no coaching/programme offer found");
  if (daysSincePost == null) reviews.push("activity date unavailable");
  else if (daysSincePost > 60)
    rejects.push(`inactive for ${daysSincePost} days`);
  if (ownedUrls.length)
    reviews.push("owned/external site needs manual quality check");

  const deskSignals =
    captions.filter((text) => DESK.test(text)).length +
    (DESK.test(bio) ? 2 : 0);
  const score =
    (linktool ? 3 : 0) +
    Math.min(sellerPosts + (sellerBio ? 2 : 0), 5) +
    Math.min(hyroxPosts, 4) +
    Math.min(deskSignals, 4) +
    (profile.followers >= 5000 && profile.followers <= 250000 ? 2 : 0);
  const status = rejects.length ? "REJECT" : reviews.length ? "REVIEW" : "PASS";

  return {
    handle: profile.account || profile.user_name,
    name: profile.full_name,
    status,
    followers: profile.followers,
    latest_post: latest?.toISOString().slice(0, 10) || null,
    uk_signals: ukSignals,
    wrong_geo_signals: wrongGeoSignals,
    hyrox_posts: hyroxPosts,
    seller_signals: sellerPosts + (sellerBio ? 2 : 0),
    desk_signals: deskSignals,
    linktool: linktool || null,
    nutrition_led: NUTRITION.test(bio),
    commercial_score: status === "REJECT" ? null : score,
    rejects,
    reviews,
    thumbnails: posts.map((post) => ({
      url: post.url,
      image_url: post.image_url,
      caption: post.caption,
      datetime: post.datetime,
    })),
  };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProfile(handle) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, `${handle}.json`);
  if (!refresh && fs.existsSync(cachePath))
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));

  const url = new URL("https://api.brightdata.com/datasets/v3/scrape");
  url.searchParams.set("dataset_id", PROFILE_DATASET);
  url.searchParams.set("format", "json");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.BRIGHT_DATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ url: `https://www.instagram.com/${handle}` }]),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Bright Data ${response.status}: ${text.slice(0, 160)}`);
  }
  if (!response.ok)
    throw new Error(`Bright Data ${response.status}: ${text.slice(0, 160)}`);

  if (response.status === 202) {
    const snapshotId = data.snapshot_id;
    for (let attempt = 0; attempt < 36; attempt++) {
      await sleep(5000);
      const progress = await fetch(
        `https://api.brightdata.com/datasets/v3/progress/${snapshotId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.BRIGHT_DATA_API_KEY}`,
          },
        },
      );
      const state = await progress.json();
      if (state.status === "failed")
        throw new Error(state.error_message || "Bright Data snapshot failed");
      if (state.status !== "ready") continue;
      const result = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
        {
          headers: {
            Authorization: `Bearer ${process.env.BRIGHT_DATA_API_KEY}`,
          },
        },
      );
      data = await result.json();
      break;
    }
  }
  if (!Array.isArray(data) || !data[0])
    throw new Error(`No profile returned for @${handle}`);
  fs.writeFileSync(cachePath, `${JSON.stringify(data[0], null, 2)}\n`);
  return data[0];
}

const results = new Array(handles.length);
let nextHandle = 0;
async function qualifyNext() {
  while (nextHandle < handles.length) {
    const index = nextHandle++;
    const handle = handles[index];
    try {
      const profile = await fetchProfile(handle);
      results[index] = classify(profile);
    } catch (error) {
      results[index] = { handle, status: "ERROR", error: error.message };
    }
  }
}
await Promise.all(
  Array.from({ length: Math.min(3, handles.length) }, () => qualifyNext()),
);

if (jsonOutput) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const result of results) {
    console.log(
      `\n${result.status.padEnd(6)} @${result.handle} — ${result.name || "unknown"}`,
    );
    if (result.error) {
      console.log(`       ${result.error}`);
      continue;
    }
    console.log(
      `       HYROX ${result.hyrox_posts}/12 · UK ${result.uk_signals} · seller ${result.seller_signals} · desk ${result.desk_signals} · ${result.followers || 0} followers`,
    );
    if (result.linktool)
      console.log(`       fragmented stack: ${result.linktool}`);
    if (result.nutrition_led)
      console.log("       nutrition-led: fuel-page review gate required");
    for (const reason of result.rejects)
      console.log(`       reject: ${reason}`);
    for (const reason of result.reviews)
      console.log(`       review: ${reason}`);
    if (result.commercial_score != null)
      console.log(`       commercial score: ${result.commercial_score}`);
  }
}
