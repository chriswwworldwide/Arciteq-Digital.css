// src/match.js
// Partner matching ("find a partner") for coaching tenants. Athletes post a
// card via a `partner_search` submission; nothing is public until the owner
// approves the inbox candidate, which prepends a sanitised board row into
// `matchboard.json`. Contact details stay on the desk — intros go through
// the owner over WhatsApp. Pure helpers; no IO.

import crypto from "node:crypto";

const str = (v, max) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const MATCH_FORMATS = {
  open: "Open doubles",
  pro: "Pro doubles",
  mixed: "Mixed doubles",
  relay: "Relay (team of 4)",
  buddies: "Training & race trips",
};

const GENDERS = { f: "woman", m: "man" };

/** "Sarah Kusuma" -> "Sarah K." — enough to recognise, not enough to search. */
export function displayName(raw) {
  const clean = str(raw, 40).replace(/[^A-Za-zÀ-ÿ' -]/g, "");
  const parts = clean.split(" ").filter(Boolean);
  if (!parts.length) return "";
  const last = parts.length > 1 ? `${parts[parts.length - 1][0]}.` : "";
  return (last ? `${parts[0]} ${last}` : parts[0]).slice(0, 42);
}

/** Finish-time estimate (seconds) -> a readable band for the board. */
export function paceBand(total) {
  const s = Number(total);
  if (!Number.isFinite(s) || s <= 0) return "no time yet";
  if (s < 4200) return "sub-1:10";
  if (s < 4800) return "1:10–1:20";
  if (s < 5400) return "1:20–1:30";
  if (s < 6300) return "1:30–1:45";
  if (s < 7200) return "1:45–2:00";
  return "2:00+";
}

const DAY = 24 * 3600 * 1000;

/**
 * Board rows expire so the page never lists a race that's already run:
 * the seeker's own `until` (usually their event date), clamped to [now,
 * now+180d]; absent anything, 120 days out.
 */
function untilFor(payload, now) {
  const raw = Date.parse(str(payload?.until, 12));
  const max = now.getTime() + 180 * DAY;
  if (Number.isFinite(raw) && raw >= now.getTime()) {
    return new Date(Math.min(raw, max)).toISOString().slice(0, 10);
  }
  return new Date(Math.min(now.getTime() + 120 * DAY, max))
    .toISOString()
    .slice(0, 10);
}

/** The row the public sees: no email, no phone, first name + initial only. */
export function publicCard({ email, payload, now = new Date() }) {
  const p = payload || {};
  const format = MATCH_FORMATS[str(p.format, 12)] ? str(p.format, 12) : "";
  const name = displayName(p.name);
  if (!name || !format) return null;
  const id = `pt-${crypto
    .createHash("sha256")
    .update(
      `${String(email || "").toLowerCase()}:${format}:${str(p.event, 40)}`,
    )
    .digest("hex")
    .slice(0, 10)}`;
  return {
    id,
    name,
    gender: GENDERS[str(p.gender, 1)] || "",
    event: str(p.event, 60),
    format,
    pace: paceBand(p.total),
    note: str(p.note, 140),
    posted: now.toISOString().slice(0, 10),
    until: untilFor(p, now),
  };
}

/**
 * The approval-inbox candidate for a partner_search submission. With consent
 * the patch prepends the public card; without it the candidate still reaches
 * the desk (private card — owner can intro by hand). One candidate per
 * athlete: the key dedupes re-submissions.
 */
export function buildPartnerCandidate({ email, payload, boardFile }) {
  if (!boardFile) return null;
  const p = payload || {};
  const card = publicCard({ email, payload: p });
  const consent = str(p.consent, 4) === "yes";
  if (consent && !card) return null;
  const fmt = MATCH_FORMATS[str(p.format, 12)] || str(p.format, 12) || "?";
  const who = card?.name || displayName(p.name) || "An athlete";
  const where = str(p.event, 60) || "any race";
  return {
    key: `partner:${crypto
      .createHash("sha256")
      .update(String(email || "").toLowerCase())
      .digest("hex")
      .slice(0, 16)}`,
    kind: "partner",
    title: `${who} — ${fmt}, ${where}`,
    summary:
      `${paceBand(p.total)}${p.gender ? ` · ${GENDERS[str(p.gender, 1)] || ""}` : ""}` +
      (p.note ? ` — "${str(p.note, 140)}"` : "") +
      (consent ? "" : " · private card (no board listing)"),
    data: {
      email: String(email || ""),
      whatsapp: str(p.whatsapp, 30),
      name: str(p.name, 60),
      gender: GENDERS[str(p.gender, 1)] || "",
      format: fmt,
      event: where,
      pace: paceBand(p.total),
      note: str(p.note, 300),
      consent,
      hint: consent
        ? "Approve to list their card (first name only — no contact). When someone wants the intro, you connect them on WhatsApp."
        : "They didn't ask for a board listing — intro them privately if you spot a match. Approving changes nothing public.",
    },
    apply:
      consent && card
        ? [{ file: boardFile, path: "items", op: "prepend", value: card }]
        : [],
  };
}
