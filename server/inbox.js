// server/inbox.js
// Owner approval inbox + weekly digest: candidates queued from orders,
// sponsor renewals, partner/travel submissions; approve/decline/edit on
// the coach desk (desk-key scoped); auto-approve rules; the weekly digest
// email and its scheduler.

import path from "path";
import {
  autoApprove,
  applyPatches,
  normalizeInbox,
  emptyInbox,
  upsertCandidates,
  pendingItems,
  decide,
  applyEdits,
  buildDigest,
} from "../src/inbox.js";
import {
  sanitizeSponsor,
  sponsorItems,
  buildSponsorCandidate,
  addDays,
  extendPartner,
} from "../src/sponsors.js";
import {
  safeReadJsonFile,
  safeWriteJsonFile,
  loadTenantsData,
  loadProductsData,
  ROOT_DIR,
} from "./data-files.js";
import { dbQuery } from "../db.js";
import { normalizeEmail } from "../src/data-stitch.js";
import { buildPartnerCandidate, buildTravelCandidate } from "../src/match.js";
import express from "express";
import { requireAdmin, resolveTenantFromRequest } from "./tenancy.js";
import { summarizePageviews } from "../src/analytics.js";
import { sendAlertEmail } from "./email.js";
import { rangeDays } from "./http-utils.js";

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

function tenantAutomation(tenant) {
  const a = tenant?.automation;
  const rel = String(a?.inbox || "").trim();
  if (!rel || rel.includes("..") || rel.startsWith("/")) return null;
  return {
    inboxRel: rel,
    inboxPath: path.join(ROOT_DIR, rel),
    writable: Array.isArray(a?.writable)
      ? a.writable.map(String).filter((f) => !f.includes(".."))
      : [],
    coachPath: String(a?.coachPath || "/"),
    digestTo: String(a?.digestTo || "").trim(),
    digestDayUtc: Number.isInteger(a?.digestDayUtc) ? a.digestDayUtc : 1,
    digestHourUtc: Number.isInteger(a?.digestHourUtc) ? a.digestHourUtc : 0,
    welcomePath: String(a?.welcomePath || "").trim(),
    welcomeIntro: String(a?.welcomeIntro || "").trim(),
    autoApprove:
      a?.autoApprove === true
        ? true
        : Array.isArray(a?.autoApprove)
          ? a.autoApprove.map(String)
          : [],
  };
}

// Owner-free mode: approve pending items of the configured kinds straight
// away and apply their patches. Decisions stay in the inbox for audit.
function runAutoApprove(cfg, inbox) {
  const kinds = cfg.autoApprove;
  if (kinds !== true && !(Array.isArray(kinds) && kinds.length)) return inbox;
  const { inbox: next } = autoApprove(inbox, kinds, (item) => {
    if (item.kind === "sponsor") {
      const check = sanitizeSponsor(item.apply?.[0]?.value);
      if (check.error)
        return { applied: [], skipped: [{ reason: check.error }] };
    }
    return applyPatches(item, {
      allowedFiles: cfg.writable,
      readJson: (rel) => safeReadJsonFile(path.join(ROOT_DIR, rel), null),
      writeJson: (rel, json) =>
        safeWriteJsonFile(path.join(ROOT_DIR, rel), json),
    });
  });
  return next;
}

function readInbox(cfg) {
  return normalizeInbox(safeReadJsonFile(cfg.inboxPath, emptyInbox()));
}

function tenantById(tenantId) {
  try {
    return (
      loadTenantsData().list.find(
        (t) => String(t?.tenant_id || "default") === String(tenantId),
      ) || null
    );
  } catch {
    return null;
  }
}

// Sponsorship rails: a paid order containing sponsor-slot products drops a
// `sponsor` candidate into the tenant's inbox (owner approves before anything
// shows). Sponsor details come from the buyer's latest `sponsor` submission.
export async function queueSponsorCandidates({ tenantId, orderId, email }) {
  const tenant = tenantById(tenantId);
  const cfg = tenantAutomation(tenant);
  const partnersFile = String(tenant?.automation?.partners || "").trim();
  if (!cfg || !partnersFile || !cfg.writable.includes(partnersFile)) return;
  const order = await dbQuery(
    "SELECT items, customer_email FROM orders WHERE order_id = $1",
    [orderId],
  );
  const row = order?.rows?.[0];
  if (!row) return;
  const { byId } = loadProductsData();
  const products = sponsorItems(row.items, byId);
  if (!products.length) return;
  const buyer = email || normalizeEmail(row.customer_email);
  const sub = buyer
    ? await dbQuery(
        "SELECT payload FROM submissions WHERE tenant_id = $1 AND lower(email) = lower($2) AND kind = 'sponsor' ORDER BY created_at DESC LIMIT 1",
        [tenantId, buyer],
      )
    : null;
  const raw = sub?.rows?.[0]?.payload || {};
  const checked = sanitizeSponsor(raw);
  const sponsor = checked.sponsor || {
    name: String(raw?.name || buyer || "Sponsor").slice(0, 60),
    url: "",
    logo: "",
    tagline: "",
  };
  const candidates = products
    .map((product) =>
      buildSponsorCandidate({
        orderId,
        email: buyer,
        product,
        sponsor,
        until: addDays(new Date(), 31),
        partnersFile,
      }),
    )
    .filter(Boolean);
  if (!candidates.length) return;
  const { inbox } = upsertCandidates(readInbox(cfg), candidates);
  safeWriteJsonFile(cfg.inboxPath, runAutoApprove(cfg, inbox));
}

// Partner matching: a `partner_search` submission queues a `partner`
// candidate so the owner approves a sanitised board card. Contact details
// stay in the inbox data (desk only); intros happen over WhatsApp.
export function queuePartnerCandidate({ tenant, email, payload }) {
  const cfg = tenantAutomation(tenant);
  const boardFile = String(tenant?.automation?.matchboard || "").trim();
  if (!cfg || !boardFile || !cfg.writable.includes(boardFile)) return;
  const candidate = buildPartnerCandidate({ email, payload, boardFile });
  if (!candidate) return;
  const { inbox } = upsertCandidates(readInbox(cfg), [candidate]);
  safeWriteJsonFile(cfg.inboxPath, runAutoApprove(cfg, inbox));
}

// Travel board: a `travel_party` submission queues a `travel` candidate —
// same pattern as partner cards: approve prepends a sanitised public row.
export function queueTravelCandidate({ tenant, email, payload }) {
  const cfg = tenantAutomation(tenant);
  const boardFile = String(tenant?.automation?.travelboard || "").trim();
  if (!cfg || !boardFile || !cfg.writable.includes(boardFile)) return;
  const candidate = buildTravelCandidate({ email, payload, boardFile });
  if (!candidate) return;
  const { inbox } = upsertCandidates(readInbox(cfg), [candidate]);
  safeWriteJsonFile(cfg.inboxPath, runAutoApprove(cfg, inbox));
}

// Renewal paid: push the live partner's `until` forward. No owner step —
// they already approved this sponsor.
export function renewSponsor({ tenantId, orderId, periodEnd }) {
  if (!orderId) return;
  const tenant = tenantById(tenantId);
  const partnersFile = String(tenant?.automation?.partners || "").trim();
  if (!partnersFile || partnersFile.includes("..")) return;
  const abs = path.join(ROOT_DIR, partnersFile);
  const json = safeReadJsonFile(abs, null);
  if (!json) return;
  const until = periodEnd
    ? String(periodEnd).slice(0, 10)
    : addDays(new Date(), 31);
  if (extendPartner(json, orderId, until)) safeWriteJsonFile(abs, json);
}

// Everything that needs the owner this week, as an action list with deep
// links into their desk. DB counts degrade to zero when no DB is configured.
function siteUrlFromRequest(req) {
  const proto = String(
    req.headers["x-forwarded-proto"] || req.protocol || "https",
  );
  const host = String(req.headers.host || "");
  return `${proto}://${host}`;
}

async function collectDigest(siteUrl, tenant, cfg, days) {
  const tenantId = String(tenant?.tenant_id || "default");
  const counts = {
    leads: 0,
    wall_photo: 0,
    race_splits: 0,
    bank_transfer: 0,
    partner_search: 0,
    race_result: 0,
    predictor: 0,
    paid: 0,
  };
  let traffic = null;
  try {
    const [leads, subs, paid, views] = await Promise.all([
      dbQuery(
        "SELECT count(*)::int AS n FROM email_events WHERE tenant_id = $1 AND type = 'lead_captured' AND at >= now() - ($2::int * interval '1 day')",
        [tenantId, days],
      ),
      dbQuery(
        "SELECT kind, count(*)::int AS n FROM submissions WHERE tenant_id = $1 AND created_at >= now() - ($2::int * interval '1 day') GROUP BY kind",
        [tenantId, days],
      ),
      dbQuery(
        "SELECT count(*)::int AS n FROM orders WHERE tenant_id = $1 AND status = 'paid' AND created_at >= now() - ($2::int * interval '1 day')",
        [tenantId, days],
      ),
      tenant?.analytics?.pageviews
        ? dbQuery(
            "SELECT path, referrer_host, utm_source, visitor, email, at FROM page_views WHERE tenant_id = $1 AND at >= now() - ($2::int * interval '1 day') ORDER BY at DESC LIMIT 50000",
            [tenantId, days],
          )
        : null,
    ]);
    if (views) traffic = summarizePageviews(views.rows || [], { top: 5 });
    counts.leads = Number(leads?.rows?.[0]?.n || 0);
    counts.paid = Number(paid?.rows?.[0]?.n || 0);
    for (const r of subs?.rows || []) {
      if (r.kind in counts) counts[r.kind] = Number(r.n || 0);
    }
  } catch {
    counts.db = "unavailable";
  }
  const digest = buildDigest({
    brand: String(tenant?.seo?.brandName || tenantId),
    siteUrl,
    coachPath: cfg.coachPath,
    days,
    pending: pendingItems(readInbox(cfg)),
    counts,
    traffic,
  });
  if (cfg.welcomePath && !(await digestSentBefore(tenantId))) {
    const url = `${String(siteUrl).replace(/\/+$/, "")}${cfg.welcomePath}`;
    digest.first = true;
    digest.subject = `${digest.subject.split(":")[0]}: your new website — start here`;
    digest.text = `${String(cfg.welcomeIntro || "Your welcome guide:").trim()}\n${url}\n\n— This week —\n\n${digest.text}`;
  }
  return digest;
}

async function digestSentBefore(tenantId) {
  try {
    const r = await dbQuery(
      "SELECT 1 FROM email_events WHERE tenant_id = $1 AND type = 'digest_sent' LIMIT 1",
      [tenantId],
    );
    return Boolean(r?.rows?.length);
  } catch {
    return true;
  }
}

async function lastDigestAt(tenantId) {
  try {
    const r = await dbQuery(
      "SELECT max(at) AS at FROM email_events WHERE tenant_id = $1 AND type = 'digest_sent'",
      [tenantId],
    );
    const at = r?.rows?.[0]?.at;
    return at ? new Date(at).getTime() : 0;
  } catch {
    return Date.now();
  }
}

async function sendDigestFor(siteUrl, tenant, cfg, days = 7) {
  const tenantId = String(tenant?.tenant_id || "default");
  const to = cfg.digestTo || ctx.alertEmailTo;
  const digest = await collectDigest(siteUrl, tenant, cfg, days);
  if (!to) return { sent: false, reason: "no_recipient", ...digest };
  const email = await sendAlertEmail({
    to,
    subject: digest.subject,
    body: digest.text,
  });
  if (email.ok) {
    try {
      await dbQuery(
        "INSERT INTO email_events (tenant_id, email, type, data) VALUES ($1, $2, 'digest_sent', $3::jsonb)",
        [
          tenantId,
          to,
          JSON.stringify({
            subject: digest.subject,
            first: Boolean(digest.first),
            provider: email.provider || "sendmail",
          }),
        ],
      );
    } catch (err) {
      console.error("digest_sent record failed", err);
    }
  }
  return { sent: Boolean(email.ok), error: email.error || "", ...digest };
}

// Weekly digest scheduler: every tenant with automation.digestTo gets the
// digest on Monday morning (automation.digestHourUtc, default 00:00 UTC =
// 07:00 Jakarta). Checks hourly; the DB record makes it safe across restarts
// and multiple instances. Needs PUBLIC_BASE_URL for links.
async function runDigestSchedulerOnce(now = new Date()) {
  if (!ctx.publicBaseUrl || !String(process.env.DATABASE_URL || "").trim())
    return;
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  for (const tenant of loadTenantsData().list) {
    const cfg = tenantAutomation(tenant);
    if (!cfg?.digestTo) continue;
    if (day !== cfg.digestDayUtc || hour !== cfg.digestHourUtc) continue;
    const last = await lastDigestAt(String(tenant.tenant_id));
    if (now.getTime() - last < 6 * 864e5) continue;
    try {
      const r = await sendDigestFor(ctx.publicBaseUrl, tenant, cfg, 7);
      console.log(
        `[digest] ${tenant.tenant_id} -> ${cfg.digestTo}: ${r.sent ? "sent" : "not sent"} ${r.error || ""}`,
      );
    } catch (err) {
      console.error("[digest] failed", tenant.tenant_id, err);
    }
  }
}

export function startDigestScheduler() {
  setTimeout(() => void runDigestSchedulerOnce(), 30 * 1000);
  setInterval(() => void runDigestSchedulerOnce(), 60 * 60 * 1000);
}

export function createInboxRouter(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
  router.get("/admin/inbox", async (req, res) => {
    const access = await ctx.requireDeskAccess(req, res).catch(() => {
      res.status(500).json({ error: "Desk access check failed" });
      return null;
    });
    if (!access) return undefined;
    const tenant = access.tenant;
    const cfg = tenantAutomation(tenant);
    if (!cfg) return res.status(404).json({ error: "Inbox not enabled" });
    const inbox = readInbox(cfg);
    const decided = inbox.items
      .filter((i) => i.status !== "pending")
      .sort((a, b) => String(b.decidedAt).localeCompare(String(a.decidedAt)))
      .slice(0, 50);
    return res.json({
      ok: true,
      tenant_id: String(tenant?.tenant_id || "default"),
      updatedAt: inbox.updatedAt,
      pending: pendingItems(inbox),
      decided,
    });
  });

  router.post("/admin/inbox", express.json({ limit: "512kb" }), (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;
    const tenant = resolveTenantFromRequest(req);
    const cfg = tenantAutomation(tenant);
    if (!cfg) return res.status(404).json({ error: "Inbox not enabled" });
    const candidates = Array.isArray(req.body?.candidates)
      ? req.body.candidates.slice(0, 200)
      : [];
    try {
      const {
        inbox: merged,
        added,
        updated,
      } = upsertCandidates(readInbox(cfg), candidates);
      const inbox = runAutoApprove(cfg, merged);
      safeWriteJsonFile(cfg.inboxPath, inbox);
      return res.json({
        ok: true,
        added,
        updated,
        pending: pendingItems(inbox).length,
      });
    } catch (err) {
      console.error("Inbox upsert failed", err);
      return res.status(500).json({ error: "Failed to save inbox" });
    }
  });

  router.post("/admin/inbox/:id", express.json(), async (req, res) => {
    const access = await ctx.requireDeskAccess(req, res).catch(() => {
      res.status(500).json({ error: "Desk access check failed" });
      return null;
    });
    if (!access) return undefined;
    const tenant = access.tenant;
    const cfg = tenantAutomation(tenant);
    if (!cfg) return res.status(404).json({ error: "Inbox not enabled" });
    const action = String(req.body?.action || "").toLowerCase();
    try {
      const result = decide(readInbox(cfg), req.params.id, action);
      if (result.error) return res.status(400).json({ error: result.error });
      let applied = { applied: [], skipped: [] };
      if (action === "approve") {
        applyEdits(result.item, req.body?.edits);
        if (result.item.kind === "news" && !result.item.summary) {
          return res
            .status(400)
            .json({ error: "Write a short summary before publishing" });
        }
        if (result.item.kind === "sponsor") {
          const p = result.item.apply?.[0]?.value;
          const check = sanitizeSponsor(p);
          if (check.error) {
            return res
              .status(400)
              .json({ error: `${check.error} — fix it above, then approve` });
          }
        }
        applied = applyPatches(result.item, {
          allowedFiles: cfg.writable,
          readJson: (rel) => safeReadJsonFile(path.join(ROOT_DIR, rel), null),
          writeJson: (rel, json) =>
            safeWriteJsonFile(path.join(ROOT_DIR, rel), json),
        });
        result.item.applied = applied;
      }
      safeWriteJsonFile(cfg.inboxPath, result.inbox);
      return res.json({ ok: true, item: result.item, ...applied });
    } catch (err) {
      console.error("Inbox decision failed", err);
      return res.status(500).json({ error: "Failed to update inbox" });
    }
  });

  router.get("/admin/digest", async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;
    const tenant = resolveTenantFromRequest(req);
    const cfg = tenantAutomation(tenant);
    if (!cfg) return res.status(404).json({ error: "Inbox not enabled" });
    const digest = await collectDigest(
      siteUrlFromRequest(req),
      tenant,
      cfg,
      rangeDays(req, 7),
    );
    return res.json({ ok: true, ...digest });
  });

  router.post("/admin/digest/send", async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;
    const tenant = resolveTenantFromRequest(req);
    const cfg = tenantAutomation(tenant);
    if (!cfg) return res.status(404).json({ error: "Inbox not enabled" });
    const result = await sendDigestFor(
      siteUrlFromRequest(req),
      tenant,
      cfg,
      rangeDays(req, 7),
    );
    return res.json({ ok: true, ...result });
  });
  return router;
}
