// server/pitch.js
// Pitch video pages: view/watch telemetry for cold-outreach videos.
// POST /api/pitch-event records view/play/progress/cta events to Postgres
// (pitch_events, created lazily) and emails PITCH_NOTIFY_TO on the events
// that matter for follow-up timing (first view, play, complete).
// GET /pitch-views?key=<ADMIN_API_KEY> returns a quick per-slug summary.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbQuery } from "../db.js";
import { sendAlertEmail } from "./email.js";

const pitchRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "pitch",
);

const VALID_EVENTS = new Set([
  "view",
  "revisit",
  "play",
  "progress",
  "watch",
  "complete",
  "cta_demo",
  "cta_reply",
  "site_visit",
  "page_view",
]);
const EMAIL_EVENTS = new Set([
  "view",
  "revisit",
  "play",
  "progress",
  "complete",
  "cta_demo",
  "cta_reply",
]);
const SELF_IPS = new Set(
  (process.env.PITCH_SELF_IPS || "152.233.29.1,152.233.29.2,152.233.29.4,152.233.29.5")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const isSelfVisitor = (ip, ua) =>
  SELF_IPS.has(ip) || /selftest|probe-check/i.test(ua);

const VALID_SLUGS = new Set([
  "faisalpma",
  "jadeskillen",
  "elationfitness",
  "underdog",
  "aceperformance",
  "michelewilder",
  "joshharrison",
  "coachedbyzara",
  "trainedbytr",
  "jamiebarker",
  "getfitgabby",
  "paulgillingham",
  "georgegrayson",
  "coachedbykim",
  "racetoframe",
]);

let tableReady = false;
async function ensureTable() {
  if (tableReady) return true;
  try {
    await dbQuery(
      `CREATE TABLE IF NOT EXISTS pitch_events (
        id BIGSERIAL PRIMARY KEY,
        slug TEXT NOT NULL,
        event TEXT NOT NULL,
        pct INTEGER,
        session_id TEXT,
        ua TEXT,
        ip TEXT,
        path TEXT,
        secs INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
    );
    await dbQuery(
      `ALTER TABLE pitch_events
        ADD COLUMN IF NOT EXISTS path TEXT,
        ADD COLUMN IF NOT EXISTS secs INTEGER`,
    );
    tableReady = true;
    return true;
  } catch {
    return false;
  }
}

function cleanStr(v, max = 120) {
  return String(v ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, max);
}

async function notify({ slug, event, pct, self = false }) {
  const to = cleanStr(process.env.PITCH_NOTIFY_TO || "chriswworldwide@outlook.com");
  if (!to) return;
  const label = {
    view: "opened the pitch page",
    revisit: "came back to the pitch page",
    play: "started the video",
    progress: "video progress",
    complete: "watched to the end",
    site_visit: "visited your live platform",
    cta_demo: "tapped Explore your live platform",
    cta_reply: "tapped reply to Chris",
  }[event] || event;
  const body = [
    `Prospect: ${slug}`,
    `Event: ${label}`,
    pct !== null ? `Progress: ${pct}%` : null,
    `Time: ${new Date().toISOString()}`,
    "",
    `Page: https://www.station9studio.co.uk/pitch/${slug}/`,
  ]
    .filter(Boolean)
    .join("\n");
  const result = await sendAlertEmail({
    to,
    subject: `${self ? "TEST · " : ""}Pitch: ${slug} ${label}`,
    body,
  });
  if (!result?.ok)
    console.warn(`[pitch-alert] ${slug} ${event} send failed:`, result);
}

async function notifyViaWeb3Forms({ slug, event, pct, self = false }) {
  const key = cleanStr(process.env.PITCH_WEB3FORMS_KEY);
  if (!key) return false;
  const label = {
    view: "opened the pitch page",
    revisit: "came back to the pitch page",
    play: "started the video",
    progress: "video progress",
    complete: "watched to the end",
    site_visit: "visited your live platform",
    cta_demo: "tapped Explore your live platform",
    cta_reply: "tapped reply to Chris",
  }[event] || event;
  try {
    const r = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_key: key,
        subject: `${self ? "TEST · " : ""}Pitch: ${slug} ${label}`,
        from_name: "Station 9 pitch tracker",
        message: `Prospect: ${slug}\nEvent: ${label}\n${pct !== null ? `Progress: ${pct}%\n` : ""}Time: ${new Date().toISOString()}\n\nhttps://www.station9studio.co.uk/pitch/${slug}/`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function notifyViaNtfy({ slug, event, pct, self = false }) {
  const topic = cleanStr(process.env.PITCH_NTFY_TOPIC, 80);
  if (!topic) return false;
  const label = {
    view: "opened the pitch page",
    revisit: "came back to the pitch page",
    play: "started the video",
    progress: "video progress",
    complete: "watched to the end",
    site_visit: "visited your live platform",
    cta_demo: "tapped Explore your live platform",
    cta_reply: "tapped reply to Chris",
  }[event] || event;
  try {
    const r = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        Title: `${self ? "TEST · " : ""}Pitch: ${slug} ${label}`,
        Priority: event === "complete" ? "4" : "3",
        Tags: event === "complete" ? "eyes,fire" : "eyes",
      },
      body: `${pct !== null ? `Progress: ${pct}%  ` : ""}https://www.station9studio.co.uk/pitch/${slug}/`,
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export function createPitchRouter({ adminApiKey }) {
  const router = express.Router();
  const recentSiteVisits = new Map(); // `${slug}:${ip}` -> last-pinged ms

  // Alert sends are serialised: bursts (e.g. a prospect clicking through
  // several pages, or a batch test) otherwise hit Resend's per-second limit
  // and fail silently — sendViaResend returns a truthy error object, so the
  // sendmail fallback never runs on a failed API call either.
  const alertQueue = [];
  let alertDraining = false;
  function enqueueAlert(send) {
    alertQueue.push(send);
    if (alertDraining) return;
    alertDraining = true;
    (async () => {
      while (alertQueue.length) {
        try {
          await alertQueue.shift()();
        } catch {
          // alert delivery is best-effort; never stall the queue
        }
        await new Promise((r) => setTimeout(r, 600));
      }
      alertDraining = false;
    })();
  }

  // Platform visit beacon: every GET /<slug>/ or /<slug>/<page>.html on a
  // tracked coach logs an event with the path — that gives the pages-clicked
  // count per visit. The front door pings once per IP+slug per hour (each
  // distinct visit, not just the first ever); a returning visitor (seen >24h
  // ago) pings as 'revisit' so you can tell fresh opens from coming back.
  // The middleware only observes — the request falls through to the site.
  router.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const match = req.path.match(/^\/([a-z0-9-]+)\/?((?:index|[a-z0-9-]+)\.html)?$/);
    if (!match || !VALID_SLUGS.has(match[1])) return next();
    const slug = match[1];
    const page = match[2] || null; // null = front door
    const ua = cleanStr(req.headers["user-agent"], 200);
    const ip = cleanStr(req.ip || "", 60);
    if (/bot|crawler|spider|preview|headless|slurp/i.test(ua)) return next();
    const self = isSelfVisitor(ip, ua);

    const dedupeKey = `${slug}:${ip}`;
    const now = Date.now();
    const isVisit = !page || page === "index.html";
    const firstOfVisit =
      now - (recentSiteVisits.get(dedupeKey) || 0) > 3600000;
    recentSiteVisits.set(dedupeKey, now);
    if (recentSiteVisits.size > 5000) recentSiteVisits.clear();

    (async () => {
      let revisit = false;
      if (await ensureTable()) {
        if (isVisit && firstOfVisit) {
          const prior = await dbQuery(
            "SELECT 1 FROM pitch_events WHERE slug=$1 AND ip=$2 AND event IN ('site_visit','page_view') AND created_at < now() - interval '1 day' LIMIT 1",
            [slug, ip],
          ).catch(() => null);
          revisit = !!(prior && prior.rows && prior.rows.length);
        }
        dbQuery(
          "INSERT INTO pitch_events (slug, event, session_id, ua, ip, path) VALUES ($1,$2,$3,$4,$5,$6)",
          [
            slug,
            isVisit && revisit ? "revisit" : isVisit ? "site_visit" : "page_view",
            `site:${ip || ua.slice(0, 40)}`,
            ua || null,
            ip || null,
            page,
          ],
        ).catch(() => {});
      }
      if (isVisit && firstOfVisit) {
        const evt = revisit ? "revisit" : "site_visit";
        enqueueAlert(() =>
          (cleanStr(process.env.PITCH_NTFY_TOPIC) &&
            notifyViaNtfy({ slug, event: evt, pct: null, self })) ||
          (cleanStr(process.env.PITCH_WEB3FORMS_KEY) &&
            notifyViaWeb3Forms({ slug, event: evt, pct: null, self })) ||
          notify({ slug, event: evt, pct: null, self }),
        );
      }
    })().catch(() => {});
    next();
  });

  router.post("/api/pitch-event", async (req, res) => {
    const slug = cleanStr(req.body?.slug, 40);
    const event = cleanStr(req.body?.event, 20);
    const pctRaw = Number(req.body?.pct);
    const pct = Number.isFinite(pctRaw)
      ? Math.max(0, Math.min(100, Math.round(pctRaw)))
      : null;
    const sessionId = cleanStr(req.body?.sid, 64);
    const secsRaw = Number(req.body?.secs);
    const secs = Number.isFinite(secsRaw)
      ? Math.max(0, Math.min(36000, Math.round(secsRaw)))
      : null;

    if (!VALID_SLUGS.has(slug) || !VALID_EVENTS.has(event)) {
      return res.status(400).json({ ok: false });
    }

    const ua = cleanStr(req.headers["user-agent"], 200);
    const ip = cleanStr(req.ip || "", 60);
    const self = isSelfVisitor(ip, ua);

    const ok = await ensureTable();
    if (ok) {
      dbQuery(
        "INSERT INTO pitch_events (slug, event, pct, session_id, ua, ip, secs) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [slug, event, pct, sessionId || null, ua || null, ip || null, secs],
      ).catch(() => {});
    }

    if (
      EMAIL_EVENTS.has(event) &&
      (event !== "progress" || (pct !== null && pct >= 50))
    ) {
      // Fire-and-forget via the queue: Web3Forms when configured (zero-setup
      // delivery to any inbox), otherwise the Resend/sendmail path. Never
      // block the page.
      enqueueAlert(() =>
        (cleanStr(process.env.PITCH_NTFY_TOPIC) &&
          notifyViaNtfy({ slug, event, pct, self })) ||
        (cleanStr(process.env.PITCH_WEB3FORMS_KEY) &&
          notifyViaWeb3Forms({ slug, event, pct, self })) ||
        notify({ slug, event, pct, self }),
      );
    }

    return res.json({ ok: true });
  });

  // Pretty URLs: /pitch/<slug>/ → the per-prospect page. Static middleware
  // doesn't resolve directory indexes, so the route does it.
  router.get(/^\/pitch\/([a-z0-9-]+)\/?$/, (req, res) => {
    const slug = cleanStr(req.params[0], 40);
    if (!VALID_SLUGS.has(slug)) return res.status(404).send("not found");
    res.sendFile(path.join(pitchRoot, slug, "index.html"));
  });

  router.get("/pitch-views", async (req, res) => {
    if (!adminApiKey || cleanStr(req.query.key) !== adminApiKey) {
      return res.status(404).send("not found");
    }
    if (!(await ensureTable())) {
      return res.status(503).json({ ok: false, error: "no db" });
    }
    const rows = await dbQuery(
      `SELECT slug, event, count(*) AS n, max(created_at) AS last_at,
              count(DISTINCT session_id) AS sessions
       FROM pitch_events
       GROUP BY slug, event
       ORDER BY slug, event`,
    );
    const latest = await dbQuery(
      `SELECT slug, event, pct, secs, session_id, ua, ip, path, created_at
       FROM pitch_events ORDER BY created_at DESC LIMIT 40`,
    );
    return res.json({
      ok: true,
      summary: rows?.rows || [],
      latest: latest?.rows || [],
    });
  });

  return router;
}
