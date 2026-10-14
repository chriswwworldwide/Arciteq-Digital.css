// server/receptionist.js
// AI phone receptionist for trades clients: Twilio voice webhooks
// (/voice/incoming, /voice/step — signature-verified), lead + caller SMS,
// admin client/call management, weekly summaries, and the client's private
// dashboard (/r/:slug/:token).

import { dbQuery } from "../db.js";
import fs from "node:fs";
import path from "path";
import {
  verifyTwilioSignature,
  rejectTwiml,
  leadSms,
  isUkMobile,
  callerSms,
  normalisePhone,
  gatherTwiml,
  prompt,
  sayHangupTwiml,
  advance,
  validateClient,
  weeklySummarySms,
  renderDashboard,
} from "../src/receptionist.js";
import express from "express";
import crypto from "node:crypto";
import { requireAdmin } from "./tenancy.js";
import { ROOT_DIR } from "./data-files.js";

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

// ---- AI phone receptionist (trades) -------------------------------------
// Twilio rings /voice/incoming for a client's number; each <Gather> posts to
// /voice/step. On completion the owner gets a lead SMS (and the caller a
// confirmation). Admin manages clients; clients view calls via a token URL.
let receptionistReady = false;

async function ensureReceptionistTables() {
  if (receptionistReady) return;
  await dbQuery(
    fs.readFileSync(
      path.join(ROOT_DIR, "migrations", "010_add_receptionist.sql"),
      "utf8",
    ),
  );
  receptionistReady = true;
}

function publicUrl(req) {
  const proto = String(
    req.headers["x-forwarded-proto"] || req.protocol || "https",
  ).split(",")[0];
  const host = String(
    req.headers["x-forwarded-host"] || req.headers.host || "",
  );
  return `${proto}://${host}${req.originalUrl}`;
}

function twilioAuthOk(req, res) {
  const token = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  const ok = verifyTwilioSignature(
    token,
    publicUrl(req),
    req.body || {},
    req.headers["x-twilio-signature"],
  );
  if (!ok) res.status(403).type("text/xml").send(rejectTwiml());
  return ok;
}

async function sendSms(to, body) {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  const from = String(process.env.TWILIO_SMS_FROM || "").trim();
  if (!sid || !token || !from) {
    console.warn("receptionist: SMS not configured; would send", { to, body });
    return { ok: false, skipped: true };
  }
  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("receptionist: SMS failed", r.status, data?.message);
    return { ok: false, error: data?.message || `twilio ${r.status}` };
  }
  return { ok: true, sid: data?.sid || null };
}

async function receptionistClientByNumber(number) {
  await ensureReceptionistTables();
  const r = await dbQuery(
    "SELECT * FROM receptionist_clients WHERE twilio_number = $1 AND status IN ('trial','active') LIMIT 1",
    [number],
  );
  return r?.rows?.[0] || null;
}

async function finishReceptionistCall(client, call) {
  const ownerSms = await sendSms(client.owner_mobile, leadSms(client, call));
  let callerText = null;
  const callerNumber = call.answers?.phone || call.caller;
  if (client.options?.callerText !== false && isUkMobile(callerNumber)) {
    callerText = await sendSms(callerNumber, callerSms(client, call));
  }
  await dbQuery(
    `UPDATE receptionist_calls SET status = 'complete', step = 'done', answers = $2::jsonb, emergency = $3,
       owner_notified_at = CASE WHEN $4 THEN now() ELSE owner_notified_at END,
       caller_notified_at = CASE WHEN $5 THEN now() ELSE caller_notified_at END,
       updated_at = now() WHERE id = $1`,
    [
      call.id,
      JSON.stringify(call.answers || {}),
      Boolean(call.emergency),
      Boolean(ownerSms?.ok),
      Boolean(callerText?.ok),
    ],
  );
}

export function createReceptionistRouter(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
  router.post(
    "/voice/incoming",
    express.urlencoded({ extended: false }),
    async (req, res) => {
      if (!twilioAuthOk(req, res)) return;
      res.type("text/xml");
      try {
        const to = normalisePhone(req.body?.To);
        const client = await receptionistClientByNumber(to);
        if (!client) return res.send(rejectTwiml());
        const callSid = String(req.body?.CallSid || "").slice(0, 64);
        const caller = normalisePhone(req.body?.From) || null;
        await dbQuery(
          `INSERT INTO receptionist_calls (id, client_id, call_sid, caller)
           VALUES ($1, $2, $3, $4) ON CONFLICT (call_sid) DO NOTHING`,
          [crypto.randomUUID(), client.id, callSid, caller],
        );
        const action = `/voice/step?call=${encodeURIComponent(callSid)}`;
        return res.send(
          gatherTwiml({
            say: `${prompt("greeting", client)} ${prompt("name", client)}`,
            action,
            step: "name",
          }),
        );
      } catch (err) {
        console.error("receptionist incoming failed", err);
        return res.send(
          sayHangupTwiml(
            "Sorry, we can't take your details right now. Please try again shortly.",
          ),
        );
      }
    },
  );

  router.post(
    "/voice/step",
    express.urlencoded({ extended: false }),
    async (req, res) => {
      if (!twilioAuthOk(req, res)) return;
      res.type("text/xml");
      try {
        const callSid = String(req.query.call || req.body?.CallSid || "").slice(
          0,
          64,
        );
        await ensureReceptionistTables();
        const r = await dbQuery(
          `SELECT c.*, cl.business_name, cl.owner_name, cl.owner_mobile, cl.website, cl.options
             FROM receptionist_calls c JOIN receptionist_clients cl ON cl.id = c.client_id
            WHERE c.call_sid = $1 LIMIT 1`,
          [callSid],
        );
        const row = r?.rows?.[0];
        if (!row || row.status === "complete")
          return res.send(sayHangupTwiml(prompt("goodbye", row)));
        const client = {
          business_name: row.business_name,
          owner_name: row.owner_name,
          owner_mobile: row.owner_mobile,
          website: row.website,
          options: row.options || {},
        };
        const next = advance(
          row,
          { speech: req.body?.SpeechResult, digits: req.body?.Digits },
          client,
        );
        const call = { ...row, ...next, answers: next.answers };
        if (next.done) {
          await finishReceptionistCall(client, call);
          const urgent =
            call.emergency && client.options?.emergencyFlag !== false;
          return res.send(
            sayHangupTwiml(
              prompt(urgent ? "goodbye_emergency" : "goodbye", client),
            ),
          );
        }
        await dbQuery(
          `UPDATE receptionist_calls SET step = $2, attempts = $3, answers = $4::jsonb, emergency = $5, updated_at = now() WHERE id = $1`,
          [
            row.id,
            next.step,
            next.attempts,
            JSON.stringify(next.answers),
            Boolean(next.emergency),
          ],
        );
        const action = `/voice/step?call=${encodeURIComponent(callSid)}`;
        return res.send(
          gatherTwiml({
            say: prompt(next.step, client, next.attempts),
            action,
            step: next.step,
          }),
        );
      } catch (err) {
        console.error("receptionist step failed", err);
        return res.send(
          sayHangupTwiml(
            "Sorry, something went wrong on our side. Please try again shortly.",
          ),
        );
      }
    },
  );

  router.get("/admin/receptionist/clients", async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;
    try {
      await ensureReceptionistTables();
      const r = await dbQuery(
        `SELECT cl.*, (SELECT count(*) FROM receptionist_calls c WHERE c.client_id = cl.id AND c.status = 'complete')::int AS calls
           FROM receptionist_clients cl ORDER BY created_at DESC`,
      );
      return res.json({ clients: r?.rows || [] });
    } catch (err) {
      console.error("receptionist clients failed", err);
      return res.status(500).json({ error: "Failed to list clients" });
    }
  });

  router.post(
    "/admin/receptionist/clients",
    express.json(),
    async (req, res) => {
      const denied = requireAdmin(req, res);
      if (denied) return denied;
      const checked = validateClient(req.body);
      if (checked.error) return res.status(400).json({ error: checked.error });
      const c = checked.client;
      try {
        await ensureReceptionistTables();
        const token = crypto.randomBytes(18).toString("base64url");
        const r = await dbQuery(
          `INSERT INTO receptionist_clients (id, slug, business_name, trade, owner_name, owner_mobile, twilio_number, website, dashboard_token, options, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
         ON CONFLICT (slug) DO UPDATE SET business_name = EXCLUDED.business_name, trade = EXCLUDED.trade,
           owner_name = EXCLUDED.owner_name, owner_mobile = EXCLUDED.owner_mobile, twilio_number = EXCLUDED.twilio_number,
           website = EXCLUDED.website, options = EXCLUDED.options, status = EXCLUDED.status, updated_at = now()
         RETURNING slug, dashboard_token`,
          [
            crypto.randomUUID(),
            c.slug,
            c.business_name,
            c.trade,
            c.owner_name,
            c.owner_mobile,
            c.twilio_number,
            c.website,
            token,
            JSON.stringify(c.options),
            c.status,
          ],
        );
        const row = r?.rows?.[0] || { slug: c.slug, dashboard_token: token };
        return res.json({
          ok: true,
          slug: row.slug,
          dashboard: `/r/${row.slug}/${row.dashboard_token}`,
        });
      } catch (err) {
        console.error("receptionist client save failed", err);
        return res.status(500).json({ error: "Failed to save client" });
      }
    },
  );

  router.get("/admin/receptionist/calls", async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;
    try {
      await ensureReceptionistTables();
      const slug = String(req.query.client || "").trim();
      const r = await dbQuery(
        `SELECT c.*, cl.slug, cl.business_name FROM receptionist_calls c JOIN receptionist_clients cl ON cl.id = c.client_id
          WHERE ($1 = '' OR cl.slug = $1) ORDER BY c.created_at DESC LIMIT 500`,
        [slug],
      );
      return res.json({ calls: r?.rows || [] });
    } catch (err) {
      console.error("receptionist calls failed", err);
      return res.status(500).json({ error: "Failed to list calls" });
    }
  });

  // Weekly "calls caught" text to every live client (run by a scheduled job).
  router.post("/admin/receptionist/weekly", async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;
    try {
      await ensureReceptionistTables();
      const until = new Date();
      const since = new Date(until.getTime() - 7 * 86400000);
      const clients =
        (
          await dbQuery(
            "SELECT * FROM receptionist_clients WHERE status IN ('trial','active')",
          )
        )?.rows || [];
      const sent = [];
      for (const client of clients) {
        const calls =
          (
            await dbQuery(
              "SELECT * FROM receptionist_calls WHERE client_id = $1 AND status = 'complete' AND created_at >= $2 ORDER BY created_at DESC",
              [client.id, since.toISOString()],
            )
          )?.rows || [];
        const out = await sendSms(
          client.owner_mobile,
          weeklySummarySms(client, calls, { since, until }),
        );
        sent.push({
          slug: client.slug,
          calls: calls.length,
          ok: Boolean(out?.ok),
        });
      }
      return res.json({ ok: true, sent });
    } catch (err) {
      console.error("receptionist weekly failed", err);
      return res.status(500).json({ error: "Weekly summary failed" });
    }
  });

  router.get("/r/:slug/:token", async (req, res) => {
    try {
      await ensureReceptionistTables();
      const r = await dbQuery(
        "SELECT * FROM receptionist_clients WHERE slug = $1 AND dashboard_token = $2 LIMIT 1",
        [
          String(req.params.slug).slice(0, 80),
          String(req.params.token).slice(0, 80),
        ],
      );
      const client = r?.rows?.[0];
      if (!client) return res.status(404).type("text/plain").send("Not found");
      const calls =
        (
          await dbQuery(
            "SELECT * FROM receptionist_calls WHERE client_id = $1 AND status = 'complete' ORDER BY created_at DESC LIMIT 200",
            [client.id],
          )
        )?.rows || [];
      res.setHeader("X-Robots-Tag", "noindex");
      return res.type("html").send(renderDashboard(client, calls));
    } catch (err) {
      console.error("receptionist dashboard failed", err);
      return res.status(500).type("text/plain").send("Dashboard unavailable");
    }
  });
  return router;
}
