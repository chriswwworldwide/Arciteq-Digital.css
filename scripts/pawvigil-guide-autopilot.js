import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateGuide, nearDuplicate } from "../src/guides.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE_URL = String(process.env.SITE_URL || "https://pawvigil.com").replace(
  /\/+$/,
  "",
);
const ADMIN_KEY = String(process.env.ADMIN_API_KEY || "");
const ANTHROPIC_KEY = String(process.env.ANTHROPIC_API_KEY || "");
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MIN_DAYS = Number(process.env.MIN_DAYS ?? 13);
const DRY = process.argv.includes("--dry");
const GIT_PUBLISH = process.env.GIT_PUBLISH === "true";

export const TOPICS = [
  "QR code dog ID tags: what to store, what to keep private and how often to test the link",
  "Reflective dog gear for winter walks: collar lights, harness panels and lead visibility",
  "A room-by-room home safety checklist for senior dogs with reduced mobility",
  "Pet camera placement: useful coverage without turning home monitoring into surveillance",
  "Dog car restraint checklist: harness fit, tether length and safer loading routines",
  "Preparing a calm emergency grab bag for a dog or cat",
  "Microchip details and visible ID tags: why responsible pet owners need both",
  "Helping an older cat reach beds, litter trays and favourite windows more comfortably",
  "Holiday pet-sitter handover checklist: routines, contacts, identification and home access",
  "How to check reflective and LED dog-walking gear before darker evenings",
  "Creating a quieter safe space for pets during fireworks without making medical claims",
  "Multi-pet home monitoring: camera blind spots, privacy and practical daily checks",
];

const BLOCKED = [
  /\b(diagnos(?:e|is|tic)|treat(?:ment)?|cure|heal)\b/i,
  /\b(dosage|dose|prescri(?:be|ption)|medication|medicine)\b/i,
  /\b(supplement|vitamin|probiotic|cbd|essential oil|ingestible)\b/i,
  /\b(guarantee[ds]?|risk[- ]free|completely safe|prevents? all)\b/i,
];

function daysSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

export function pickTopic(existing, topics = TOPICS) {
  const used = new Set(
    (existing || []).map((guide) => String(guide.source || "").toLowerCase()),
  );
  return topics.find((topic) => !used.has(topic.toLowerCase())) || null;
}

export function safetyError(guide) {
  const text = [
    guide?.title,
    guide?.description,
    guide?.lead,
    guide?.body_html,
    ...(guide?.faqs || []).flatMap((faq) => [faq?.q, faq?.a]),
  ].join(" ");
  const blocked = BLOCKED.find((rule) => rule.test(text));
  return blocked ? `blocked safety language: ${blocked}` : null;
}

export function buildPrompt(topic, existingTitles) {
  return `You are writing for PawVigil, a UK pet-safety and non-ingestible wellness guide. Write an original, practical guide on this exact topic:\n"${topic}"\n\nRules:\n- British English, calm and specific, 750–1100 words. No hype or filler.\n- Cover practical checks and owner routines only. Do not diagnose, treat or cure conditions. Do not recommend medicines, supplements, ingestibles, dosages, CBD or essential oils.\n- Never promise that a product prevents every accident or is completely safe. Tell readers to contact a vet when health, pain, breathing, poisoning, injury or sudden behaviour change is involved.\n- Use <h3> for 4–6 sections and <h4> sparingly. Allowed tags: h3, h4, p, ul, ol, li, strong, em, a. No images, inline styles or scripts.\n- Link naturally to one or two existing PawVigil guides or /shop.html using relative links only.\n- Do not repeat these existing guides: ${existingTitles.join("; ") || "(none yet)"}.\n- End with a useful action, not a sales claim.\n\nReturn ONLY a JSON object with keys: title, description, eyebrow, lead, body_html, faqs (3–5 objects with q and a).`;
}

async function api(pathname, init = {}) {
  const response = await fetch(`${SITE_URL}${pathname}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-admin-key": ADMIN_KEY,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const json = JSON.parse(text);
  if (!response.ok) throw new Error(`${pathname} ${response.status}: ${text.slice(0, 200)}`);
  return json;
}

async function draft(topic, existingTitles) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4500,
      messages: [{ role: "user", content: buildPrompt(topic, existingTitles) }],
    }),
  });
  if (!response.ok)
    throw new Error(`anthropic ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const data = await response.json();
  const text = (data.content || []).map((item) => item.text || "").join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("model returned no JSON");
  return JSON.parse(text.slice(start, end + 1));
}

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function staticState() {
  const file = path.join(root, "data", "pawvigil-guides.json");
  if (!fs.existsSync(file)) return { lastPublished: "", guides: [] };
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function renderStaticGuide(guide, date) {
  const canonical = `https://pawvigil.com/content/${guide.slug}.html`;
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: date,
    dateModified: date,
    author: { "@type": "Organization", name: "PawVigil" },
    publisher: { "@type": "Organization", name: "PawVigil" },
    mainEntityOfPage: canonical,
  }).replace(/</g, "\\u003c");
  const faqSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(guide.title)} | PawVigil</title><meta name="description" content="${esc(guide.description)}"><link rel="canonical" href="${canonical}">
<link rel="stylesheet" href="/styles/styles.css"><link rel="stylesheet" href="/styles/premium.css"><script src="/styles/premium.js" defer></script>
<script type="application/ld+json">${schema}</script><script type="application/ld+json">${faqSchema}</script>
<style>header,main{max-width:760px;margin:auto;padding:16px 24px}main{padding-bottom:48px}.hero{padding:24px 0}.hero h1{font-size:clamp(2rem,6vw,3.4rem);line-height:1.05}.lead{font-size:1.15rem;color:#374151}.article{line-height:1.7}.article h3{margin-top:2rem}.faq{margin-top:2.5rem}.faq details{border-top:1px solid #ddd;padding:1rem 0}.back{display:inline-block;margin-top:2rem}</style></head>
<body><header><a href="/" style="font-weight:700;color:inherit;text-decoration:none">PawVigil</a> · <a href="/content/pet-safety-guides.html">Guides</a> · <a href="/shop.html">Shop</a></header>
<main><section class="hero"><p>${esc(guide.eyebrow)}</p><h1>${esc(guide.title)}</h1><p>By the PawVigil editorial team · Updated <time datetime="${date}">${date}</time></p><p class="lead">${esc(guide.lead)}</p></section>
<article class="article">${guide.body_html}</article><section class="faq"><h2>Frequently asked questions</h2>${guide.faqs.map((faq) => `<details><summary>${esc(faq.q)}</summary><p>${esc(faq.a)}</p></details>`).join("")}</section>
<a class="back" href="/content/pet-safety-guides.html">More PawVigil guides</a></main></body></html>`;
}

function publishStatic(guide, topic, state) {
  const date = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(
    path.join(root, "content", `${guide.slug}.html`),
    renderStaticGuide(guide, date),
  );
  state.lastPublished = date;
  state.guides.unshift({ slug: guide.slug, title: guide.title, topic, date });
  fs.writeFileSync(
    path.join(root, "data", "pawvigil-guides.json"),
    `${JSON.stringify(state, null, 2)}\n`,
  );
  const tenantsFile = path.join(root, "data", "tenants.json");
  const tenants = JSON.parse(fs.readFileSync(tenantsFile, "utf8"));
  const tenant = tenants.tenants.find((item) => item.tenant_id === "default");
  const pages = tenant.seo.staticPages || (tenant.seo.staticPages = []);
  for (const pagePath of [
    "/content/pet-safety-guides.html",
    `/content/${guide.slug}.html`,
  ]) {
    if (!pages.some((page) => page.path === pagePath))
      pages.push({ path: pagePath, priority: "0.85" });
  }
  fs.writeFileSync(tenantsFile, `${JSON.stringify(tenants, null, 2)}\n`);
  const staticGuides = fs
    .readdirSync(path.join(root, "content"))
    .filter((file) => file.endsWith(".html") && file !== "pet-safety-guides.html")
    .map((file) => {
      const html = fs.readFileSync(path.join(root, "content", file), "utf8");
      const title = html.match(/<title>(.*?)\s*[|—]/i)?.[1] || file;
      return `<li><a href="/content/${file}">${esc(title)}</a></li>`;
    })
    .join("");
  fs.writeFileSync(
    path.join(root, "content", "pet-safety-guides.html"),
    `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pet safety guides | PawVigil</title><meta name="description" content="Practical PawVigil guides for pet identification, visibility, monitoring, travel and senior-pet comfort."><link rel="canonical" href="https://pawvigil.com/content/pet-safety-guides.html"><link rel="stylesheet" href="/styles/styles.css"><link rel="stylesheet" href="/styles/premium.css"></head><body><main style="max-width:760px;margin:auto;padding:40px 24px"><a href="/">PawVigil</a><h1>Pet safety guides</h1><p>Practical checks and routines for safer, calmer everyday pet care.</p><ul>${staticGuides}</ul></main></body></html>`,
  );
  console.log(`published static guide: /content/${guide.slug}.html`);
}

async function main() {
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY is required");
  const state = GIT_PUBLISH ? staticState() : null;
  if (!GIT_PUBLISH && !ADMIN_KEY) throw new Error("ADMIN_API_KEY is required");
  const existing = GIT_PUBLISH
    ? state.guides.map((guide) => ({
        ...guide,
        source: guide.topic,
        published_at: guide.date,
      }))
    : (await api("/admin/guides")).guides || [];
  if (daysSince(existing[0]?.published_at) < MIN_DAYS) {
    console.log("latest guide is under the fortnightly freshness threshold");
    return;
  }
  const topic = pickTopic(existing);
  if (!topic) {
    console.log("all safe topics are covered");
    return;
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const raw = await draft(
      topic,
      existing.map((guide) => guide.title),
    );
    const checked = validateGuide({ ...raw, source: topic });
    if (checked.error) {
      console.log(`attempt ${attempt}: rejected — ${checked.error}`);
      continue;
    }
    const unsafe = safetyError(checked.guide);
    if (unsafe) {
      console.log(`attempt ${attempt}: rejected — ${unsafe}`);
      continue;
    }
    const duplicate = nearDuplicate(checked.guide, existing);
    if (duplicate) {
      console.log(`attempt ${attempt}: too similar to ${duplicate.slug}`);
      continue;
    }
    if (DRY) {
      console.log(JSON.stringify(checked.guide, null, 2));
      return;
    }
    if (GIT_PUBLISH) {
      publishStatic(checked.guide, topic, state);
      return;
    }
    const output = await api("/admin/guides", {
      method: "POST",
      body: JSON.stringify(checked.guide),
    });
    console.log(`published: ${output.url}`);
    return;
  }
  throw new Error("no acceptable PawVigil draft after 2 attempts");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  main().catch((error) => {
    console.error(`PawVigil guide autopilot failed: ${error.message}`);
    process.exit(1);
  });
}
