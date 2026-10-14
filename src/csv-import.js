// src/csv-import.js
// Turns a bank statement or booking-app export (CSV) into ledger rows for a
// coach/gym's Money page. Built to cope with:
//  - UK bank exports: one signed Amount column, or separate Money in / Money
//    out (Paid in / Paid out, Credit / Debit) columns; DD/MM/YYYY dates.
//  - BCA (KlikBCA) exports: account/period preamble before the header,
//    day/month dates with the year taken from the "Period" line, amounts
//    like "10,000,000.00" with a separate CR/DB flow column (or "… CR"),
//    pending rows dated "PEND" (skipped until they clear), totals at the end.
//  - Booking/payments apps (GoCardless, Glofox, TeamUp…): generic columns.
// Pure functions only, so the server re-parses on import (never trusting
// client-side numbers) and everything is unit-tested.

import crypto from "node:crypto";

export const MAX_IMPORT_ROWS = 3000;

// RFC4180-ish CSV parser: quoted fields, "" escapes, newlines in quotes,
// BOM, and comma / semicolon / tab delimiters (auto-detected).
export function parseCsv(text) {
  const src = String(text || "").replace(/^\uFEFF/, "");
  const firstLines = src.split(/\r?\n/).slice(0, 15).join("\n");
  const count = (ch) => (firstLines.match(new RegExp(`\\${ch}`, "g")) || []).length;
  const delim = [",", ";", "\t"].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ",");

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ""));
}

const MONTHS = {
  jan: 1, january: 1, januari: 1,
  feb: 2, february: 2, februari: 2, peb: 2,
  mar: 3, march: 3, maret: 3,
  apr: 4, april: 4,
  may: 5, mei: 5,
  jun: 6, june: 6, juni: 6,
  jul: 7, july: 7, juli: 7,
  aug: 8, august: 8, agu: 8, agt: 8, agustus: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, okt: 10, oktober: 10,
  nov: 11, november: 11, nop: 11,
  dec: 12, december: 12, des: 12, desember: 12,
};

const pad = (n) => String(n).padStart(2, "0");

function validDate(y, m, d) {
  if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

// Parses a date cell to YYYY-MM-DD. order: "dmy" (UK/Indonesia, default) or
// "mdy". Day/month-only dates (BCA) take their year from `inferYear(m, d)`.
export function parseDate(raw, { order = "dmy", inferYear } = {}) {
  // A leading apostrophe is Excel's "keep as text" marker (KlikBCA uses it).
  const s = String(raw || "").trim().replace(/^'/, "").toLowerCase();
  if (!s || s === "pend") return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return validDate(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    const [d, mo] = order === "mdy" ? [+m[2], +m[1]] : [+m[1], +m[2]];
    return validDate(y, mo, d);
  }

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m && inferYear) {
    const [d, mo] = order === "mdy" ? [+m[2], +m[1]] : [+m[1], +m[2]];
    return validDate(inferYear(mo, d), mo, d);
  }

  m = s.match(/^(\d{1,2})[\s-]+([a-z]+)\.?[\s-]+(\d{2,4})/);
  if (m && MONTHS[m[2]]) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return validDate(y, MONTHS[m[2]], +m[1]);
  }
  m = s.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1]]) return validDate(+m[3], MONTHS[m[1]], +m[2]);
  return null;
}

// Parses an amount cell. Returns { minor, sign } (sign -1 = money out) or
// null. Handles £/Rp/IDR/GBP, "1,234.56", "1.234.567,00", "(12.00)",
// trailing/leading minus, and CR/DB / credit/debit markers.
export function parseAmount(raw) {
  let s = String(raw || "").trim().replace(/^'/, "");
  if (!s) return null;
  let sign = 1;
  const flow = s.match(/\b(cr|db|dr|credit|debit|kredit|debet)\.?$/i);
  if (flow) {
    sign = /^(db|dr|debit|debet)$/i.test(flow[1]) ? -1 : 1;
    s = s.slice(0, flow.index).trim();
  }
  if (/^\(.*\)$/.test(s)) {
    sign = -sign;
    s = s.slice(1, -1);
  }
  s = s.replace(/(rp|idr|gbp|£|\$|€|\s)/gi, "");
  if (/^-|-$/.test(s)) {
    sign = -sign;
    s = s.replace(/^-|-$/g, "");
  }
  if (s.startsWith("+")) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalised;
  if (lastDot !== -1 && lastComma !== -1) {
    const dec = lastDot > lastComma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    normalised = s.split(thou).join("").replace(dec, ".");
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? "." : ",";
    const parts = s.split(sep);
    const thousands = parts.length > 2 || parts.at(-1).length === 3;
    normalised = thousands ? parts.join("") : parts.join(".");
  } else {
    normalised = s;
  }
  const value = Number(normalised);
  if (!Number.isFinite(value)) return null;
  return { minor: Math.round(value * 100), sign };
}

const HEADER_RULES = {
  date: /^(date|tanggal|tgl|transaction date|posted|posting date|value date|created|charge date|payment date|paid at)\b|date$/,
  description: /desc|keterangan|details?|narrative|memo|payee|particulars|counterparty|customer|member|name|reference|transaction$/,
  credit: /money in|paid in|^in$|credit|kredit|deposit|receipts?/,
  debit: /money out|paid out|^out$|debit|debet|withdraw|payments? out|spent/,
  amount: /amount|jumlah|value|nominal|mutasi|total|net|gross/,
};

// Picks column indexes from a header row (+ a few data rows to spot a
// CR/DB flow column, which BCA often leaves without a header).
export function guessMapping(header, sampleRows = []) {
  const h = header.map((c) => String(c || "").toLowerCase().trim());
  const pick = (rule, avoid = []) =>
    h.findIndex((c, i) => c && !avoid.includes(i) && rule.test(c));
  const date = pick(HEADER_RULES.date);
  const credit = pick(HEADER_RULES.credit, [date]);
  const debit = pick(HEADER_RULES.debit, [date, credit]);
  const used = [date, credit, debit].filter((i) => i >= 0);
  const amount = credit >= 0 && debit >= 0 ? -1 : pick(HEADER_RULES.amount, used);
  const description = pick(HEADER_RULES.description, [...used, amount]);

  const width = Math.max(h.length, ...sampleRows.map((r) => r.length));
  let flow = -1;
  for (let i = 0; i < width; i += 1) {
    if ([date, credit, debit, amount, description].includes(i)) continue;
    const vals = sampleRows.map((r) => String(r[i] || "").trim().toUpperCase()).filter(Boolean);
    if (vals.length && vals.every((v) => ["CR", "DB", "DR", "D", "C"].includes(v))) {
      flow = i;
      break;
    }
  }
  return { date, description, amount, credit, debit, flow };
}

const isUsable = (m) => m.date >= 0 && (m.amount >= 0 || m.credit >= 0 || m.debit >= 0);

// Finds the header row (BCA puts account details above it).
export function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 25); i += 1) {
    const mapping = guessMapping(rows[i], rows.slice(i + 1, i + 8));
    if (isUsable(mapping)) return { index: i, mapping };
  }
  return { index: -1, mapping: null };
}

// Statement period from preamble lines, e.g. "Period : 01/09/2026 - 30/09/2026".
export function findPeriod(rows, headerIndex) {
  const text = rows.slice(0, Math.max(0, headerIndex)).map((r) => r.join(" ")).join(" ");
  const dates = [...text.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)].map((m) =>
    validDate(+m[3], +m[2], +m[1]),
  ).filter(Boolean);
  if (!dates.length) return null;
  dates.sort();
  return { start: dates[0], end: dates.at(-1) };
}

const RULES = [
  [/stripe/i, "income", "site_payout"],
  [/sponsor/i, "income", "sponsorship"],
  [/\b(pt|personal train|coaching|1:1|1-1|private session)/i, "income", "coaching"],
  [/drop.?in|class pass|day pass|casual/i, "income", "class_pass"],
  [/merch|t-?shirt|hoodie|kaos/i, "income", "merch"],
  [/event|race trip|camp|workshop|simulation/i, "income", "event"],
  [/sewa|rent|studio hire|venue|lease|landlord/i, "expense", "venue"],
  [/hyrox|race entry|registration/i, "expense", "race_fees"],
  [/tokopedia|shopee|lazada|amazon|decathlon|rogue|concept2|equipment|alat/i, "expense", "equipment"],
  [/grab|gojek|uber|trainline|lner|rail|airasia|garuda|lion air|citilink|easyjet|ryanair|hotel|agoda|booking\.com|airbnb|parking|fuel|bensin|pertamina|shell/i, "expense", "travel"],
  [/meta|facebook|instagram|google ads|tiktok ads|ads\b|iklan/i, "expense", "marketing"],
  [/truecoach|trainheroic|canva|google workspace|g suite|apple\.com|microsoft|dropbox|zoom|software|subscription|glofox|teamup|mindbody|gocardless fee/i, "expense", "software"],
  [/salary|wages|gaji|honor|coach fee|assistant/i, "expense", "staff"],
];

// Suggests a category for an imported row. "site_payout" means a Stripe
// payout — those are website sales already counted from orders.
export function categorise(description, direction) {
  const hit = RULES.find(([re, dir]) => dir === direction && re.test(String(description || "")));
  if (hit) return hit[2];
  return direction === "income" ? "membership" : "other_expense";
}

export function normaliseDescription(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Stable fingerprint so re-importing an overlapping statement never
// double-counts. `occurrence` separates genuinely identical rows in a file.
export function importFingerprint(tenantId, row, occurrence) {
  return crypto
    .createHash("sha256")
    .update(
      [tenantId, row.date, row.direction, row.amount_minor, normaliseDescription(row.description), occurrence].join("|"),
    )
    .digest("hex");
}

// Full pipeline: CSV text → { headers, mapping, rows, skipped }.
// `mapping` and `order` may be supplied (from the review screen) to
// override the guesses. `today` (YYYY-MM-DD) is used for year inference.
export function buildImportRows(text, { mapping: forced, order, today } = {}) {
  const rows = parseCsv(text);
  const found = findHeader(rows);
  const headerIndex = found.index;
  if (headerIndex < 0 && !forced) {
    return { error: "Couldn't find the date and amount columns in that file." };
  }
  const header = headerIndex >= 0 ? rows[headerIndex] : [];
  const mapping = forced || found.mapping;
  const data = rows.slice(headerIndex + 1);
  if (data.length > MAX_IMPORT_ROWS) {
    return { error: `That file has ${data.length} rows — import up to ${MAX_IMPORT_ROWS} at a time.` };
  }

  const nowIso = today || new Date().toISOString().slice(0, 10);
  const period = findPeriod(rows, headerIndex);
  const inferYear = (mo, d) => {
    const end = period?.end || nowIso;
    const y = Number(end.slice(0, 4));
    return `${y}-${pad(mo)}-${pad(d)}` > end ? y - 1 : y;
  };

  // Date order: day-first unless the file clearly says otherwise.
  let dateOrder = order;
  if (!dateOrder) {
    const cells = data.map((r) => String(r[mapping.date] || ""));
    const mdy = cells.some((c) => {
      const m = c.match(/^(\d{1,2})[-/.](\d{1,2})/);
      return m && +m[1] <= 12 && +m[2] > 12;
    });
    dateOrder = mdy ? "mdy" : "dmy";
  }

  const out = [];
  const skipped = [];
  const seen = new Map();
  data.forEach((r, idx) => {
    const line = headerIndex + 2 + idx;
    const rawDate = String(r[mapping.date] || "").trim();
    const date = parseDate(rawDate, { order: dateOrder, inferYear });
    if (!date) {
      skipped.push({ line, reason: /^pend$/i.test(rawDate) ? "pending (not cleared yet)" : "no date" });
      return;
    }
    let amt = null;
    if (mapping.amount >= 0) {
      amt = parseAmount(r[mapping.amount]);
      const flowCell = mapping.flow >= 0 ? String(r[mapping.flow] || "").trim().toUpperCase() : "";
      if (amt && ["DB", "DR", "D"].includes(flowCell)) amt.sign = -1;
      if (amt && ["CR", "C"].includes(flowCell)) amt.sign = 1;
    } else {
      const cin = mapping.credit >= 0 ? parseAmount(r[mapping.credit]) : null;
      const cout = mapping.debit >= 0 ? parseAmount(r[mapping.debit]) : null;
      if (cin && cin.minor) amt = { minor: cin.minor, sign: 1 };
      else if (cout && cout.minor) amt = { minor: cout.minor, sign: -1 };
    }
    if (!amt || !amt.minor) {
      skipped.push({ line, reason: "no amount" });
      return;
    }
    const direction = amt.sign < 0 ? "expense" : "income";
    const description = mapping.description >= 0
      ? String(r[mapping.description] || "").replace(/\s+/g, " ").trim().slice(0, 300)
      : "";
    const row = {
      line,
      date,
      description,
      direction,
      amount_minor: Math.abs(amt.minor),
      category: categorise(description, direction),
    };
    const key = [row.date, row.direction, row.amount_minor, normaliseDescription(row.description)].join("|");
    const occurrence = (seen.get(key) || 0) + 1;
    seen.set(key, occurrence);
    row.occurrence = occurrence;
    out.push(row);
  });

  return { headers: header, mapping, order: dateOrder, period, rows: out, skipped };
}
