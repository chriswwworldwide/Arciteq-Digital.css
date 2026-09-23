// src/inbox.js
// Owner approval queue for any tenant. Automated jobs (event-date pullers,
// news discovery, sponsor requests) drop *candidates* here; nothing reaches
// the public site until the owner approves. Approving may apply small JSON
// patches to tenant data files the tenant has declared writable. Pure helpers
// plus one small file-IO function; no network.

const KINDS = ["event", "news", "alert", "sponsor"];
const STATUSES = ["pending", "approved", "ignored"];
const KEY_RE = /^[a-z0-9][a-z0-9:_./-]{1,119}$/;
const PATH_RE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;
const OPS = ["set", "prepend"];
const FIELD_RE = /^[a-z][a-zA-Z0-9_]{0,30}$/;
const LIST_CAP = 200;

function str(v, max) {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function httpUrl(v) {
  const s = String(v ?? "").trim();
  return /^https?:\/\/[^\s"'<>]{4,500}$/.test(s) ? s : "";
}

export function emptyInbox() {
  return { schemaVersion: 1, updatedAt: "", items: [] };
}

export function normalizeInbox(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return {
    schemaVersion: 1,
    updatedAt: str(raw?.updatedAt, 40),
    items: items.filter(
      (i) => i && typeof i === "object" && KEY_RE.test(String(i.key || "")),
    ),
  };
}

function normalizePatch(p) {
  const file = str(p?.file, 200);
  const path = str(p?.path, 120);
  if (!file || !PATH_RE.test(path) || !("value" in (p || {}))) return null;
  if (file.includes("..") || file.startsWith("/")) return null;
  const op = OPS.includes(p?.op) ? p.op : "set";
  return { file, path, op, value: p.value };
}

/** Validate one automated candidate into a storable item, or return null. */
export function validateCandidate(c) {
  const key = str(c?.key, 120).toLowerCase();
  const kind = str(c?.kind, 20).toLowerCase();
  const title = str(c?.title, 160);
  if (!KEY_RE.test(key) || !KINDS.includes(kind) || !title) return null;
  const patches = (Array.isArray(c?.apply) ? c.apply : [])
    .map(normalizePatch)
    .filter(Boolean)
    .slice(0, 10);
  return {
    key,
    kind,
    title,
    summary: str(c?.summary, 600),
    source: httpUrl(c?.source),
    data: c?.data && typeof c.data === "object" ? c.data : {},
    editable: (Array.isArray(c?.editable) ? c.editable : [])
      .map((f) => str(f, 40))
      .filter((f) => FIELD_RE.test(f))
      .slice(0, 5),
    apply: patches,
  };
}

/**
 * Owner edits before approving (e.g. rewrite a news summary, add their take).
 * Only fields the candidate declared `editable` are touched; they land on
 * `item.data` and on every patch whose value is an object with that key.
 */
export function applyEdits(item, edits) {
  if (!item || !edits || typeof edits !== "object") return item;
  for (const f of item.editable || []) {
    if (!(f in edits)) continue;
    const v = str(edits[f], 1200);
    item.data = { ...(item.data || {}), [f]: v };
    if (f === "summary") item.summary = v.slice(0, 600);
    for (const p of item.apply || []) {
      if (p.value && typeof p.value === "object" && !Array.isArray(p.value)) {
        p.value = { ...p.value, [f]: v };
      }
    }
  }
  return item;
}

/**
 * Merge new candidates into the inbox. Dedupe by key: an existing item keeps
 * its status (so an ignored date isn't re-asked every day) but gets fresh
 * title/summary/patches. Returns { inbox, added, updated }.
 */
export function upsertCandidates(inbox, candidates, now = new Date()) {
  const next = normalizeInbox(inbox);
  const at = now.toISOString();
  let added = 0;
  let updated = 0;
  for (const raw of Array.isArray(candidates) ? candidates : []) {
    const c = validateCandidate(raw);
    if (!c) continue;
    const existing = next.items.find((i) => i.key === c.key);
    if (existing) {
      const changed =
        existing.title !== c.title ||
        existing.summary !== c.summary ||
        JSON.stringify(existing.apply) !== JSON.stringify(c.apply);
      Object.assign(existing, c, { seenAt: at });
      if (changed) {
        existing.updatedAt = at;
        if (existing.status === "ignored" && c.kind !== "alert") {
          existing.status = "pending";
          existing.decidedAt = "";
        }
        updated += 1;
      }
    } else {
      next.items.push({
        id: `${c.kind}-${Math.random().toString(36).slice(2, 10)}`,
        ...c,
        status: "pending",
        createdAt: at,
        updatedAt: at,
        seenAt: at,
        decidedAt: "",
      });
      added += 1;
    }
  }
  next.items = next.items.slice(-500);
  next.updatedAt = at;
  return { inbox: next, added, updated };
}

export function pendingItems(inbox) {
  return normalizeInbox(inbox)
    .items.filter((i) => i.status === "pending")
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** Record an approve/ignore decision. Returns { inbox, item } or { error }. */
export function decide(inbox, id, action, now = new Date()) {
  const next = normalizeInbox(inbox);
  const status =
    action === "approve" ? "approved" : action === "ignore" ? "ignored" : "";
  if (!STATUSES.includes(status)) return { error: "Unknown action" };
  const item = next.items.find((i) => String(i.id) === String(id));
  if (!item) return { error: "Not found" };
  item.status = status;
  item.decidedAt = now.toISOString();
  next.updatedAt = item.decidedAt;
  return { inbox: next, item };
}

function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function prependPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  const last = parts[parts.length - 1];
  const list = Array.isArray(cur[last]) ? cur[last] : [];
  const id = value && typeof value === "object" ? value.id : undefined;
  const rest = id === undefined ? list : list.filter((x) => !x || x.id !== id);
  cur[last] = [value, ...rest].slice(0, LIST_CAP);
}

/**
 * Apply an approved item's patches through the given read/write functions.
 * Only files in `allowedFiles` (tenant → automation.writable) may change.
 * Returns { applied: [file...], skipped: [{file, reason}] }.
 */
export function applyPatches(item, { allowedFiles, readJson, writeJson }) {
  const allowed = new Set((allowedFiles || []).map(String));
  const applied = [];
  const skipped = [];
  const byFile = new Map();
  for (const p of item?.apply || []) {
    if (!allowed.has(p.file)) {
      skipped.push({ file: p.file, reason: "not_writable" });
      continue;
    }
    if (!byFile.has(p.file)) byFile.set(p.file, []);
    byFile.get(p.file).push(p);
  }
  for (const [file, patches] of byFile) {
    const json = readJson(file);
    if (!json || typeof json !== "object") {
      skipped.push({ file, reason: "unreadable" });
      continue;
    }
    for (const p of patches) {
      if (p.op === "prepend") prependPath(json, p.path, p.value);
      else setPath(json, p.path, p.value);
    }
    writeJson(file, json);
    applied.push(file);
  }
  return { applied, skipped };
}

/**
 * Turn counts + pending items into the owner's weekly action list. Every line
 * carries a deep link so the owner never has to hunt. `links` come from the
 * tenant config (coach desk path) so this stays generic.
 */
export function buildDigest({
  brand = "",
  siteUrl = "",
  coachPath = "/",
  days = 7,
  pending = [],
  counts = {},
  traffic = null,
}) {
  const base = String(siteUrl || "").replace(/\/+$/, "");
  const desk = `${base}${coachPath}`;
  const actions = [];
  const n = (k) => Number(counts?.[k] || 0);
  const events = pending.filter((i) => i.kind === "event");
  const news = pending.filter((i) => i.kind === "news");
  const sponsors = pending.filter((i) => i.kind === "sponsor");
  const alerts = pending.filter((i) => i.kind === "alert");
  if (n("bank_transfer"))
    actions.push({
      text: `${n("bank_transfer")} bank transfer${n("bank_transfer") === 1 ? "" : "s"} to check in your account, then invite them to TrueCoach`,
      href: `${desk}#people?q=bank_transfer`,
    });
  if (n("wall_photo"))
    actions.push({
      text: `${n("wall_photo")} wall photo${n("wall_photo") === 1 ? "" : "s"} waiting for your OK`,
      href: `${desk}#people?q=wall_photo`,
    });
  if (n("leads"))
    actions.push({
      text: `${n("leads")} new lead${n("leads") === 1 ? "" : "s"} to reply to`,
      href: `${desk}#people`,
    });
  if (n("paid"))
    actions.push({
      text: `${n("paid")} payment${n("paid") === 1 ? "" : "s"} came in — say hi`,
      href: `${desk}#people?q=paid`,
    });
  if (n("race_splits"))
    actions.push({
      text: `${n("race_splits")} race split${n("race_splits") === 1 ? "" : "s"} analysed`,
      href: `${desk}#people?q=race_splits`,
    });
  for (const i of events)
    actions.push({
      text: `Race date found: ${i.title} — confirm?`,
      href: `${desk}#inbox`,
    });
  for (const i of news)
    actions.push({
      text: `News: ${i.title} — publish?`,
      href: `${desk}#inbox`,
    });
  for (const i of sponsors)
    actions.push({
      text: `Sponsor request: ${i.title} — approve?`,
      href: `${desk}#inbox`,
    });
  for (const i of alerts)
    actions.push({ text: `Heads-up: ${i.title}`, href: `${desk}#inbox` });

  const subject = actions.length
    ? `${brand}: ${actions.length} thing${actions.length === 1 ? "" : "s"} need${actions.length === 1 ? "s" : ""} you this week`
    : `${brand}: nothing needs you this week`;
  const body = actions.length
    ? actions.map((a, i) => `${i + 1}. ${a.text}\n   ${a.href}`).join("\n\n")
    : `All quiet over the last ${days} days. Your desk: ${desk}`;
  const t = traffic && typeof traffic === "object" ? traffic : null;
  const stats = t
    ? [
        `Site, last ${days} days: ${Number(t.views || 0)} page views from ${Number(t.unique_visitors ?? t.visitors ?? 0)} visitors` +
          (t.returning ? `, ${Number(t.returning)} came back` : "") +
          ".",
        Array.isArray(t.pages) && t.pages.length
          ? `Most read: ${t.pages
              .slice(0, 3)
              .map((p) => `${p.key} (${p.count})`)
              .join(", ")}.`
          : "",
        Array.isArray(t.sources) && t.sources.length
          ? `Where they came from: ${t.sources
              .slice(0, 3)
              .map((s) => `${s.key} (${s.count})`)
              .join(", ")}.`
          : "",
        `Full numbers: ${desk}#traffic`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const text = stats ? `${body}\n\n${stats}` : body;
  return { subject, text, actions, desk, traffic: t };
}
