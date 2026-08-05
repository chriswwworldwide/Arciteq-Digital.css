import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SPONSORS_PATH = path.resolve("./public/generated/sponsors.json");

const FORMATS = {
  csv: { extension: "csv", contentType: "text/csv" },
  excel: { extension: "xls", contentType: "application/vnd.ms-excel" },
};

/**
 * Compare two secrets without leaking their contents through timing.
 */
function secretsMatch(provided, expected) {
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isAuthorised(req) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return false;

  const header = req.headers?.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return false;

  return secretsMatch(token, expected);
}

/**
 * Escape a value for CSV and neutralise spreadsheet formula injection.
 */
function toCsvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function buildCsv(sponsor) {
  const impressions = Number(sponsor.impressions) || 0;
  const clicks = Number(sponsor.clicks) || 0;
  const ctr = ((clicks / (impressions || 1)) * 100).toFixed(1);
  return [
    "Creative,Impressions,Clicks,CTR%",
    [sponsor.copy, impressions, clicks, ctr].map(toCsvCell).join(","),
  ].join("\n");
}

export default async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  if (!isAuthorised(req)) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const { id, format = "csv" } = req.body ?? {};
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return res.status(400).json({ error: "Invalid sponsor id" });
  }
  if (!Object.prototype.hasOwnProperty.call(FORMATS, format)) {
    return res.status(400).json({ error: "Invalid format" });
  }

  let sponsors;
  try {
    sponsors = JSON.parse(fs.readFileSync(SPONSORS_PATH, "utf8"));
  } catch {
    return res.status(500).json({ error: "Sponsor data unavailable" });
  }

  const sponsor = Array.isArray(sponsors)
    ? sponsors.find((s) => s.id === id)
    : undefined;
  if (!sponsor) return res.status(404).json({ error: "Not found" });

  const { extension, contentType } = FORMATS[format];
  const fileName = `report-${id}.${extension}`;

  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Type", contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(buildCsv(sponsor));
};
