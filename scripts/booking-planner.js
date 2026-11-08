import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

export const BOOKING_FILES = [
  "planner.html",
  "booking-ui.js",
  "booking-model.js",
  "booking.css",
];
const defaults = {
  slug: "chassis",
  brand: "Your coaching platform",
  coachFull: "Your coach",
  coachFirst: "Your coach",
  city: "Your training venue",
  timeZone: "Europe/London",
  accent: "#8b5cf6",
  tagline: "Your training. Your time.",
  portrait: "",
  watermark: "",
};
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const jsonHtml = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
const sourceDir = (root) =>
  path.join(root, "scripts", "reskin", "booking-template");

export function prepareBookingTemplate(root) {
  const pilot = path.join(root, "scripts", "reskin", "trainedbytr-assets");
  const target = sourceDir(root);
  fs.mkdirSync(target, { recursive: true });
  let html = fs.readFileSync(path.join(pilot, "planner.html"), "utf8");
  html = html
    .replaceAll("/trainedbytr/", "/chassis/")
    .replaceAll("/planner.css", "/booking.css")
    .replaceAll("/session-planner.js", "/booking-ui.js");
  html = html.replace(
    /<a class="wordmark"[\s\S]*?<\/a\s*>/,
    '<a class="wordmark" href="/chassis/"><span>Your coaching platform</span><small>Your training. Your time.</small></a>',
  );
  html = html
    .replace(/TRAINED BY\s*<b>TR<\/b>/g, "Your coaching platform")
    .replaceAll("Trained by TR", "Your coaching platform")
    .replaceAll("Tom Redmond", "Your coach")
    .replaceAll("Tom’s", "your coach’s")
    .replaceAll("Widnes", "Your training venue");
  html = html.replace(
    /<img\s+src="\/chassis\/images\/bio\.jpg"\s+alt="Your coach"\s*\/?\s*>/,
    '<img data-coach-portrait alt="" hidden />',
  );
  html = html.replace(
    /<span class="coach-avatar"[^>]*>[\s\S]*?<\/span>/,
    '<span class="coach-avatar" aria-label="Your coach">CP</span>',
  );
  html = html.replace(
    /<p class="coach-quote">[\s\S]*?<\/p>/,
    '<p class="coach-quote">Your training.<br />Your time.</p>',
  );
  html = html.replace(/\?v=pilot2/g, "?v=booking1");
  html = html.replace(
    /\s*<script\s+type="module"/,
    `\n<script id="booking-profile" type="application/json">${jsonHtml(defaults)}</script>\n<script type="module"`,
  );
  fs.writeFileSync(path.join(target, "planner.html"), html);

  let css = fs.readFileSync(path.join(pilot, "planner.css"), "utf8");
  css = css.replace(
    /background:\s*url\("\/trainedbytr\/images\/bio\.jpg"\)\s*right 20%\s*\/\s*auto 115vh\s*no-repeat;/,
    "background-image: var(--planner-watermark, none); background-position: right 20%; background-size: auto 115vh; background-repeat: no-repeat;",
  );
  if (css.includes("trainedbytr"))
    throw new Error("Pilot-specific image remains in booking CSS");
  css +=
    '\n.wordmark { white-space: normal; max-width: 370px; font-size: clamp(16px,1.7vw,24px); }\n.primary, .view-switch button[aria-pressed="true"] { background: var(--accent); }\n@media(max-width:800px) { .topbar { flex-wrap: wrap; } .wordmark { max-width: 240px; } }\n';
  fs.writeFileSync(path.join(target, "booking.css"), css);

  let model = fs.readFileSync(path.join(pilot, "planner-model.js"), "utf8");
  model = model.replace(
    'export const ZONE = "Europe/London";',
    `export const PROFILE = typeof document === "undefined" ? ${JSON.stringify(defaults)} : JSON.parse(document.getElementById("booking-profile")?.textContent || ${JSON.stringify(JSON.stringify(defaults))});\nexport const ZONE = PROFILE.timeZone;`,
  );
  model = model
    .replace("TR Planner Preview", "Coach Planner Preview")
    .replace(
      '"X-WR-CALNAME:Trained by TR - DEMO sessions"',
      "`X-WR-CALNAME:${text(PROFILE.brand)} - DEMO sessions`",
    );
  model = model.replace(/\\r\?\\n\/g/, "\\r\\n|\\r|\\n/g");
  fs.writeFileSync(path.join(target, "booking-model.js"), model);

  let js = fs.readFileSync(path.join(pilot, "planner.js"), "utf8");
  js = js
    .replace('"./planner-model.js"', '"./booking-model.js"')
    .replace("  ZONE,", "  ZONE,\n  PROFILE,");
  js = js
    .replace(
      '"In person · Widnes"',
      'profile.city.toLowerCase() === "online" ? "Online · coaching" : `In person · ${profile.city}`',
    )
    .replaceAll(
      '"In person · Widnes"',
      'profile.city.toLowerCase() === "online" ? "Online · coaching" : `In person · ${profile.city}`',
    )
    .replaceAll(
      '"Widnes · walkthrough session"',
      "`${profile.city} · walkthrough session`",
    )
    .replaceAll(
      '"TransFit Widnes · walkthrough class"',
      "`${profile.brand} · sample class`",
    )
    .replaceAll('"Widnes · walkthrough class"', "`${profile.city} · sample class`");
  js = js
    .replaceAll("UK<br>TIME", "LOCAL<br>TIME")
    .replaceAll("(UK time)", "(${esc(profile.timeZone)})");
  js = js
    .replace(
      '"New-client preview: Tom reviews the request before it is confirmed."',
      "`New-client preview: ${esc(profile.coachFirst)} reviews the request before it is confirmed.`",
    )
    .replace(
      "`trainedbytr-DEMO-${dates[0]}.ics`",
      "`${profile.slug}-DEMO-${dates[0]}.ics`",
    );
  js = js.replace(
    /let backdrop =\s*new URLSearchParams\(location.search\)\.get\("backdrop"\) === "watermark"\s*\? "watermark"\s*: "subtle";/,
    'let backdrop = profile.watermark && new URLSearchParams(location.search).get("backdrop") !== "subtle" ? "watermark" : "subtle";',
  );
  js = js.replace(
    "const hours =",
    `const profile = PROFILE;\napplyProfile();\nconst hours =`,
  );
  js += `\nfunction applyProfile() {
  document.title = "Your week, made simple · " + profile.brand;
  const home = profile.slug === "chassis" ? "/" : "/" + profile.slug + "/";
  const logo = document.querySelector(".wordmark");
  logo.textContent = profile.brand.toUpperCase(); logo.href = home;
  const tagline = document.createElement("small"); tagline.textContent = profile.tagline; logo.append(tagline);
  const links = document.querySelectorAll(".topbar nav a");
  links[0].href = home; links[1].href = profile.coachingPath || home + "#plans"; links[2].href = "/" + profile.slug + "/planner.html";
  const footer = document.querySelector(".pilot-footer a"); footer.textContent = profile.brand.toUpperCase(); footer.href = home;
  const avatar = document.querySelector(".coach-avatar"); avatar.textContent = profile.coachFull.split(/\\s+/).slice(0,2).map(w=>w[0]).join(""); avatar.setAttribute("aria-label",profile.coachFull);
  document.querySelector(".coach-heading h2").textContent = profile.coachFull;
  document.querySelector(".coach-heading p").textContent = profile.brand + " · " + profile.city;
  const portrait = document.querySelector("[data-coach-portrait]");
  if (profile.portrait) { portrait.src = profile.portrait; portrait.alt = profile.brand + " — existing site imagery"; portrait.hidden = false; }
  document.querySelector(".coach-card .small-note").textContent = "Demo schedule — not " + profile.coachFirst + "’s actual diary.";
  document.querySelector(".timezone").textContent = "06:00–20:00 · " + profile.timeZone;
  const accent = profile.accent;
  if (/^#[0-9a-f]{6}$/i.test(accent)) { document.body.style.setProperty("--purple",accent); document.body.style.setProperty("--accent","color-mix(in srgb," + accent + " 50%,white)"); }
  if (profile.watermark) document.body.style.setProperty("--planner-watermark", 'url("' + profile.watermark + '")');
  else { const button = document.querySelector('[data-background="watermark"]'); button.disabled = true; button.title = "Optional planner-watermark photo slot not filled"; }
}\n`;
  if (/trainedbytr|Widnes|TransFit|Tom reviews/.test(js))
    throw new Error("Pilot-specific copy remains in shared planner");
  fs.writeFileSync(path.join(target, "booking-ui.js"), js);
}

function profileFor(root, slug, config, tenant, dir = path.join(root, slug)) {
  const tokens = config.tokens || {};
  const author = tenant.guides?.author?.name || "Your coach";
  const brand =
    tokens.BRAND ||
    config.brand ||
    tenant.guides?.brand ||
    tenant.seo?.brandName ||
    slug;
  const coachFull = tokens.COACH_NAME || config.coachFull || author;
  const coachFirst =
    tokens.COACH_FIRST || config.coachFirst || coachFull.split(" ")[0];
  const city =
    tokens.CITY ||
    config.city ||
    (slug === "roxjaya" ? "Jakarta" : "Your training venue");
  const timeZone =
    config.booking?.timeZone ||
    (slug === "roxjaya" || String(tenant.currency).toLowerCase() === "idr"
      ? "Asia/Jakarta"
      : "Europe/London");
  new Intl.DateTimeFormat("en-GB", { timeZone });
  const candidates = [
    config.booking?.watermark,
    "images/planner-watermark.jpg",
    "images/bio.jpg",
    "images/dina-avatar.jpg",
  ].filter(Boolean);
  const existing = candidates.filter(
    (file) =>
      /^images\/[a-z0-9/_-]+\.(?:jpe?g|png|webp)$/i.test(file) &&
      !file.includes("..") &&
      fs.existsSync(path.join(dir, file)),
  );
  const portrait =
    existing.find((file) => /bio|avatar/i.test(file)) || existing[0];
  return {
    slug,
    brand,
    coachFull,
    coachFirst,
    city,
    timeZone,
    coachingPath: fs.existsSync(path.join(dir, "coaching.html"))
      ? `/${slug}/coaching.html`
      : `/${slug}/#plans`,
    tagline: tokens.TAGLINE || config.tagline || "Your training. Your time.",
    accent: tokens.ACCENT || config.colors?.pink || "#8b5cf6",
    portrait: portrait ? `/${slug}/${portrait}` : "",
    watermark: existing[0] ? `/${slug}/${existing[0]}` : "",
  };
}

export function injectBookingNavigation(html, slug, home = false) {
  const href = `/${slug}/planner.html`;
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const previous = new RegExp(
    `<li>\\s*<a\\b[^>]*href="/${escaped}/planner(?:\\.html|/)[^"]*"[^>]*>[\\s\\S]*?</a>\\s*</li>`,
    "g",
  );
  html = html
    .replace(previous, "")
    .replace(/\sdata-booking-navigation(?:="[^"]*")?/g, "");
  html = html.replace(
    /<ul\b([^>]*\bid="menu"[^>]*)>/,
    `<ul$1 data-booking-navigation><li><a href="${href}" style="color:var(--pink,#b69aff);font-weight:800">Book a slot</a></li>`,
  );
  if (
    html.includes("data-booking-navigation") &&
    !html.includes('id="booking-navigation-style"')
  )
    html = html.replace(
      "</head>",
      '<style id="booking-navigation-style">@media(min-width:901px){[data-booking-navigation]{display:flex!important;flex-wrap:wrap;justify-content:center;gap:0 3px}[data-booking-navigation]>li>a,[data-booking-navigation]>li>button{padding:8px 9px;font-size:13px}}</style></head>',
    );
  if (!home) return html;
  html = html.replace(/\s*<div class="booking-entry"[\s\S]*?<\/div>/g, "");
  const hero =
    /<section\b[^>]*class="[^"]*\bhero\b[^"]*"[^>]*>[\s\S]*?<\/section>/;
  return html.replace(hero, (section) => {
    section = section.replace(
      new RegExp(
        `<a\\b[^>]*href="/${escaped}/planner(?:\\.html|/)[^"]*"[^>]*>[\\s\\S]*?</a>`,
        "g",
      ),
      "",
    );
    if (section.includes("hero-footer"))
      return section.replace(
        '<div class="actions">',
        `<div class="actions"><a class="btn btn-primary" href="${href}">Book a slot</a>`,
      );
    return section;
  });
}

export function installBookingPlanner({
  root,
  slug,
  config = {},
  tenant = {},
  template = false,
  outputDir,
}) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("Invalid planner site");
  const dir = outputDir || path.join(root, slug);
  if (!fs.existsSync(path.join(dir, "index.html"))) return null;
  const profile = template ? defaults : profileFor(root, slug, config, tenant, dir);
  const source = sourceDir(root);
  const hash = createHash("sha256");
  for (const asset of BOOKING_FILES)
    hash.update(fs.readFileSync(path.join(source, asset)));
  const version = hash.digest("hex").slice(0, 12);
  for (const file of BOOKING_FILES) {
    let text = fs.readFileSync(path.join(source, file), "utf8");
    if (file === "planner.html") {
      text = text
        .replaceAll("/chassis/", `/${slug}/`)
        .replace(
          /<script\b(?=[^>]*id="booking-profile")[^>]*>[\s\S]*?<\/script>/,
          `<script id="booking-profile" type="application/json">${jsonHtml(profile)}</script>`,
        );
      text = text.replace(
        /<title>[\s\S]*?<\/title>/,
        `<title>Your week, made simple · ${escapeHtml(profile.brand)}</title>`,
      );
      text = text.replaceAll("?v=booking1", `?v=${version}`);
    }
    if (file === "booking-ui.js")
      text = text.replace(
        '"./booking-model.js"',
        `"./booking-model.js?v=${version}"`,
      );
    fs.writeFileSync(path.join(dir, file), text);
  }
  for (const file of fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".html") && name !== "planner.html")) {
    const target = path.join(dir, file);
    const before = fs.readFileSync(target, "utf8");
    const after = injectBookingNavigation(
      before,
      template ? "{{SLUG}}" : slug,
      file === "index.html",
    );
    if (after !== before) fs.writeFileSync(target, after);
  }
  return profile;
}

export function bookingProfiles(root) {
  const configs = new Map();
  for (const file of fs
    .readdirSync(path.join(root, "scripts", "reskin"))
    .filter((name) => name.endsWith(".demo.json"))) {
    const config = JSON.parse(
      fs.readFileSync(path.join(root, "scripts", "reskin", file), "utf8"),
    );
    if (config.slug) configs.set(config.slug, config);
  }
  const tenants = JSON.parse(
    fs.readFileSync(path.join(root, "data", "tenants.json"), "utf8"),
  ).tenants;
  return tenants
    .filter(
      (tenant) =>
        tenant.vertical === "coaching" &&
        fs.existsSync(path.join(root, tenant.tenant_id, "index.html")),
    )
    .map((tenant) => ({
      slug: tenant.tenant_id,
      config: configs.get(tenant.tenant_id) || {},
      tenant,
    }));
}
