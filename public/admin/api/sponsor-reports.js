import fs from "fs";

export default async (req, res) => {
  const sponsors = JSON.parse(
    fs.readFileSync("./public/generated/sponsors.json", "utf8"),
  );
  if (req.method === "POST") {
    const { id, format } = req.body;
    const sponsor = sponsors.find((s) => s.id === id);
    if (!sponsor) return res.status(404).json({ error: "Not found" });

    const csv = `Creative,Impressions,Clicks,CTR%\n"${sponsor.copy}",${sponsor.impressions || 0},${sponsor.clicks || 0},${((sponsor.clicks / (sponsor.impressions || 1)) * 100).toFixed(1)}`;
    const fileName = `report-${sponsor.id}.${format === "excel" ? "xls" : format === "pdf" ? "pdf" : "csv"}`;
    const outPath = `./public/generated/${fileName}`;
    fs.writeFileSync(outPath, csv);

    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader(
      "Content-Type",
      format === "pdf"
        ? "application/pdf"
        : format === "excel"
          ? "application/vnd.ms-excel"
          : "text/csv",
    );
    res.send(fs.readFileSync(outPath));
    return;
  }
  res.status(405).end();
};
