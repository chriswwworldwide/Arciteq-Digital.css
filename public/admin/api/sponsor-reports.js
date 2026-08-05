/* global console */
import fs from "fs";

const SPONSORS_PATH = "./public/generated/sponsors.json";

function loadSponsors() {
  let raw;
  try {
    raw = fs.readFileSync(SPONSORS_PATH, "utf8");
  } catch (err) {
    throw new Error(`Unable to read sponsors data: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`sponsors.json is not valid JSON: ${err.message}`);
  }
}

export default async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).end();
      return;
    }

    const sponsors = loadSponsors();

    const { id, format } = req.body ?? {};
    if (!id) {
      return res.status(400).json({ error: "Missing sponsor id" });
    }

    const sponsor = sponsors.find((s) => s.id === id);
    if (!sponsor) return res.status(404).json({ error: "Not found" });

    const impressions = sponsor.impressions || 0;
    const clicks = sponsor.clicks || 0;
    const ctr = ((clicks / (impressions || 1)) * 100).toFixed(1);

    const csv = `Creative,Impressions,Clicks,CTR%\n"${sponsor.copy}",${impressions},${clicks},${ctr}`;
    const fileName = `report-${sponsor.id}.${format === "excel" ? "xls" : format === "pdf" ? "pdf" : "csv"}`;
    const outPath = `./public/generated/${fileName}`;

    let fileBuffer;
    try {
      fs.writeFileSync(outPath, csv);
      fileBuffer = fs.readFileSync(outPath);
    } catch (err) {
      throw new Error(`Failed to write report file: ${err.message}`);
    }

    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader(
      "Content-Type",
      format === "pdf"
        ? "application/pdf"
        : format === "excel"
          ? "application/vnd.ms-excel"
          : "text/csv",
    );
    res.send(fileBuffer);
  } catch (err) {
    console.error("sponsor-reports handler failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate sponsor report" });
    }
  }
};
