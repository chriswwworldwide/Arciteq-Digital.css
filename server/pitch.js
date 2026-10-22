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
  "play",
  "progress",
  "complete",
  "cta_demo",
  "cta_reply",
]);
const EMAIL_EVENTS = new Set(["view", "play", "complete"]);
const VALID_SLUGS = new Set([
  "faisalpma",
  "jadeskillen",
  "elationfitness",
  "coachedbyzara",
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
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

async function notify({ slug, event, pct }) {
  const to = cleanStr(process.env.PITCH_NOTIFY_TO || "chriswworldwide@outlook.com");
  if (!to) return;
  const label = { view: "opened the pitch page", play: "started the video", complete: "watched to the end" }[event] || event;
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
  await sendAlertEmail({ to, subject: `Pitch: ${slug} ${label}`, body });
}

async function notifyViaWeb3Forms({ slug, event, pct }) {
  const key = cleanStr(process.env.PITCH_WEB3FORMS_KEY);
  if (!key) return false;
  const label = { view: "opened the pitch page", play: "started the video", complete: "watched to the end" }[event] || event;
  try {
    const r = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_key: key,
        subject: `Pitch: ${slug} ${label}`,
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

async function notifyViaNtfy({ slug, event, pct }) {
  const topic = cleanStr(process.env.PITCH_NTFY_TOPIC, 80);
  if (!topic) return false;
  const label = { view: "opened the pitch page", play: "started the video", complete: "watched to the end" }[event] || event;
  try {
    const r = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        Title: `Pitch: ${slug} ${label}`,
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

  router.post("/api/pitch-event", async (req, res) => {
    const slug = cleanStr(req.body?.slug, 40);
    const event = cleanStr(req.body?.event, 20);
    const pctRaw = Number(req.body?.pct);
    const pct = Number.isFinite(pctRaw)
      ? Math.max(0, Math.min(100, Math.round(pctRaw)))
      : null;
    const sessionId = cleanStr(req.body?.sid, 64);

    if (!VALID_SLUGS.has(slug) || !VALID_EVENTS.has(event)) {
      return res.status(400).json({ ok: false });
    }

    const ua = cleanStr(req.headers["user-agent"], 200);
    const ip = cleanStr(req.ip || "", 60);

    const ok = await ensureTable();
    if (ok) {
      dbQuery(
        "INSERT INTO pitch_events (slug, event, pct, session_id, ua, ip) VALUES ($1,$2,$3,$4,$5,$6)",
        [slug, event, pct, sessionId || null, ua || null, ip || null],
      ).catch(() => {});
    }

    if (EMAIL_EVENTS.has(event)) {
      // Fire-and-forget: Web3Forms when configured (zero-setup delivery to
      // any inbox), otherwise the Resend/sendmail path. Never block the page.
      const task =
        (cleanStr(process.env.PITCH_NTFY_TOPIC) &&
          notifyViaNtfy({ slug, event, pct })) ||
        (cleanStr(process.env.PITCH_WEB3FORMS_KEY) &&
          notifyViaWeb3Forms({ slug, event, pct })) ||
        notify({ slug, event, pct });
      task.catch(() => {});
    }

    return res.json({ ok: true });
  });

  // Pretty URLs: /pitch/<slug>/ → the per-prospect page. Static middleware
  // doesn't resolve directory indexes, so the route does it.
  router.get("/pitch/:slug/", (req, res) => {
    const slug = cleanStr(req.params.slug, 40);
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
      `SELECT slug, event, pct, session_id, created_at
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
