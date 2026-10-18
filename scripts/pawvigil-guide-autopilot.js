import { validateGuide, nearDuplicate } from "../src/guides.js";

const SITE_URL = String(process.env.SITE_URL || "https://pawvigil.com").replace(
  /\/+$/,
  "",
);
const ADMIN_KEY = String(process.env.ADMIN_API_KEY || "");
const ANTHROPIC_KEY = String(process.env.ANTHROPIC_API_KEY || "");
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MIN_DAYS = Number(process.env.MIN_DAYS ?? 13);
const DRY = process.argv.includes("--dry");

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

async function main() {
  if (!ADMIN_KEY) throw new Error("ADMIN_API_KEY is required");
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY is required");
  const { guides: existing = [] } = await api("/admin/guides");
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
