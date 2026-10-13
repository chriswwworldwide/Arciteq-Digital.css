// src/tax-rules.js
// Country tax helpers for coach/gym sites. These are ESTIMATES shown to
// owners as a guide — never tax advice. Every rule cites where it came from
// and when it was checked; re-check before relying on a number.
//
// Amounts are integer minor units (pence / sen). IDR uses 2-decimal minor
// units like the rest of the engine, so Rp 1 = 100 minor.

export const TAX_RULES_CHECKED = "2026-10-13";

// Indonesia — PPh Final UMKM (PP 55/2022 as amended by PP 20/2026, in force
// 22 Apr 2026). 0.5% of monthly gross turnover; individuals (orang pribadi)
// pay nothing on the first Rp500 juta of gross turnover in a calendar tax
// year; scheme only available while annual gross turnover ≤ Rp4.8 miliar;
// no time limit for individuals since PP 20/2026. Payment due by the 15th of
// the following month (PMK 81/2024 art. 94). Source: pajak.go.id.
export const ID_RULES = {
  rate: 0.005,
  individualAllowanceMinor: 500_000_000 * 100,
  ceilingMinor: 4_800_000_000 * 100,
  dueDay: 15,
  sources: [
    "https://www.pajak.go.id/id/artikel/pp-202026-tarif-pph-05-bagi-umkm-orang-pribadi-berlaku-selamanya",
    "https://pajak.go.id/index.php/id/artikel/omzet-rp500-juta-pertama-pajak-yang-tidak-dipungut",
  ],
};

// UK — VAT registration threshold £90,000 of taxable turnover over any
// rolling 12 months (from 1 Apr 2024; still current 2026/27). Making Tax
// Digital for Income Tax: sole traders/landlords with qualifying income over
// £50k from 6 Apr 2026, £30k from 6 Apr 2027, £20k from 6 Apr 2028;
// quarterly updates due 7 Aug / 7 Nov / 7 Feb / 7 May. Source: gov.uk.
export const GB_RULES = {
  vatThresholdMinor: 90_000 * 100,
  mtdThresholds: [
    { from: "2026-04-06", overMinor: 50_000 * 100 },
    { from: "2027-04-06", overMinor: 30_000 * 100 },
    { from: "2028-04-06", overMinor: 20_000 * 100 },
  ],
  sources: [
    "https://www.gov.uk/register-for-vat",
    "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
  ],
};

const COUNTRY_BY_CURRENCY = { idr: "ID", gbp: "GB" };

// Accounting profile for a tenant: explicit `accounting` block in
// tenants.json wins, otherwise inferred from the tenant's currency.
export function accountingProfile(tenant) {
  const cfg =
    tenant?.accounting && typeof tenant.accounting === "object"
      ? tenant.accounting
      : {};
  const currency = String(cfg.currency || tenant?.currency || "gbp").toLowerCase();
  const country = String(
    cfg.country || COUNTRY_BY_CURRENCY[currency] || "",
  ).toUpperCase();
  return {
    country,
    currency,
    // ID: "individual" (orang pribadi) gets the Rp500jt allowance;
    // "pt_perorangan" uses the 0.5% scheme without it.
    taxpayer: String(cfg.taxpayer || "individual"),
    vatRegistered: Boolean(cfg.vatRegistered),
  };
}

const pad = (n) => String(n).padStart(2, "0");

// Indonesia monthly PPh Final estimate for one calendar year.
// monthlyGrossMinor: 12 numbers (Jan..Dec) of gross business income.
export function idPphFinal({ year, monthlyGrossMinor, taxpayer = "individual" }) {
  const allowance =
    taxpayer === "individual" ? ID_RULES.individualAllowanceMinor : 0;
  let cumulative = 0;
  const months = [];
  for (let m = 0; m < 12; m += 1) {
    const gross = Math.max(0, Math.round(Number(monthlyGrossMinor?.[m]) || 0));
    const before = Math.max(0, cumulative - allowance);
    cumulative += gross;
    const after = Math.max(0, cumulative - allowance);
    // Tax is on the part of this month's turnover above the allowance,
    // rounded to whole rupiah.
    const taxMinor = Math.round(((after - before) * ID_RULES.rate) / 100) * 100;
    const dueYear = m === 11 ? year + 1 : year;
    const dueMonth = m === 11 ? 1 : m + 2;
    months.push({
      month: `${year}-${pad(m + 1)}`,
      grossMinor: gross,
      cumulativeMinor: cumulative,
      taxMinor,
      dueDate: `${dueYear}-${pad(dueMonth)}-${pad(ID_RULES.dueDay)}`,
    });
  }
  const ytdTaxMinor = months.reduce((s, x) => s + x.taxMinor, 0);
  const ceilingPct = cumulative / ID_RULES.ceilingMinor;
  let status = "under_allowance";
  if (cumulative > ID_RULES.ceilingMinor) status = "over_ceiling";
  else if (ceilingPct >= 0.8) status = "near_ceiling";
  else if (cumulative > allowance) status = "paying";
  return {
    months,
    ytdGrossMinor: cumulative,
    ytdTaxMinor,
    allowanceMinor: allowance,
    allowanceRemainingMinor: Math.max(0, allowance - cumulative),
    ceilingMinor: ID_RULES.ceilingMinor,
    ceilingPct,
    status,
  };
}

// UK tax year (6 April – 5 April) containing `isoDate`.
export function ukTaxYear(isoDate) {
  const d = String(isoDate).slice(0, 10);
  const y = Number(d.slice(0, 4));
  const startYear = d >= `${y}-04-06` ? y : y - 1;
  return {
    start: `${startYear}-04-06`,
    end: `${startYear + 1}-04-05`,
    label: `${startYear}/${String(startYear + 1).slice(2)}`,
  };
}

// Next MTD quarterly update deadline on or after `isoDate`.
export function nextMtdDeadline(isoDate) {
  const d = String(isoDate).slice(0, 10);
  const y = Number(d.slice(0, 4));
  const candidates = [
    `${y}-02-07`,
    `${y}-05-07`,
    `${y}-08-07`,
    `${y}-11-07`,
    `${y + 1}-02-07`,
  ];
  return candidates.find((c) => c >= d);
}

export function gbVatStatus(rolling12Minor) {
  const pct = (Number(rolling12Minor) || 0) / GB_RULES.vatThresholdMinor;
  let status = "ok";
  if (pct > 1) status = "over";
  else if (pct >= 0.9) status = "near";
  else if (pct >= 0.75) status = "watch";
  return {
    thresholdMinor: GB_RULES.vatThresholdMinor,
    rolling12Minor: Number(rolling12Minor) || 0,
    pct,
    status,
  };
}

// MTD threshold in force for a tax year starting on `taxYearStart`.
export function mtdThresholdFor(taxYearStart) {
  const applicable = GB_RULES.mtdThresholds.filter((t) => t.from <= taxYearStart);
  return applicable.at(-1)?.overMinor ?? null;
}
