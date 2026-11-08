import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const day = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
const regionKey = value => /^(uk|gb|britain|united kingdom|england|scotland|wales|northern ireland|somerset)$/i.test(value) ? "united kingdom" : String(value || "").toLowerCase();
const dateLabel = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function assertTemplateBuild(config, { existing = false, legacyMaintenance = false } = {}) {
  if (config.mode !== "chassis" && !(existing && legacyMaintenance)) throw new Error('New sites MUST build from the canonical template: set mode: "chassis". Another tenant is never a new-build source.');
  if (config.mode === "chassis" && (config.source || config.donorSlug || config.templateDonor)) throw new Error("A canonical template consumer cannot select a tenant donor or alternate source.");
}

export function selectConfirmedRaces(catalogue, { today = new Date().toISOString().slice(0, 10), region = "" } = {}) {
  const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${catalogue?.checked}T00:00:00Z`)) / 864e5;
  if (!day(catalogue?.checked) || age < 0 || age > 14) throw new Error("Refresh the verified race catalogue from official event pages before building: its checked date must be within 14 days.");
  const races = (catalogue.cities || []).filter(c => {
    const r = c.race || {};
    let official = false;
    try { const u = new URL(r.source); official = u.protocol === "https:" && /(^|\.)hyrox\.com$/.test(u.hostname) && u.pathname.startsWith("/event/"); } catch { official = false; }
    return c.slug && c.name && r.status === "confirmed" && day(r.start) && day(r.end || r.start) && r.start >= today && official;
  });
  if (!races.length) throw new Error("No confirmed upcoming races available. Refresh regional or relevant world events; do not publish TBA cards.");
  const key = regionKey(region);
  return races.sort((a, b) => {
    const local = c => key && [c.country, c.name].some(v => regionKey(v) === key);
    return Number(local(b)) - Number(local(a)) || a.race.start.localeCompare(b.race.start);
  }).map(c => ({ ...c, race: { ...c.race, dates: c.race.start === (c.race.end || c.race.start) ? dateLabel(c.race.start) : `${dateLabel(c.race.start)} – ${dateLabel(c.race.end)}` } }));
}

// Homepage board rotates at build time: a race only keeps its card while it
// starts at least `leadDays` out — once it slips inside the window it's too
// late to pitch, so it drops off the top and the next race rises behind it.
// The events page/countdown keep the full catalogue; only this board trims.
export function renderRaceCards(cities, slug, { leadDays = 14, count = 4, today = new Date().toISOString().slice(0, 10) } = {}) {
  const cutoff = Date.parse(`${today}T00:00:00Z`) + leadDays * 864e5;
  const board = (cities || [])
    .filter(c => Date.parse(`${c.race.start}T00:00:00Z`) >= cutoff)
    .sort((a, b) => a.race.start.localeCompare(b.race.start))
    .slice(0, count);
  if (cities?.length && !board.length)
    console.warn(`  RACE CARDS: ${cities.length} races in the catalogue but none start ${leadDays}+ days out — the events board will be empty. Refresh cfg.races.`);
  else if (cities?.length && board.length < count)
    console.warn(`  RACE CARDS: only ${board.length} of ${count} board slots filled after the ${leadDays}-day cutoff — top up the race catalogue.`);
  return board.map(c => `<div class="event"><div class="date"><strong><time datetime="${esc(c.race.start)}">${esc(dateLabel(c.race.start))}</time></strong><span>${esc(c.name)}</span></div><div><h4>${esc(c.race.name)}</h4><p>${esc(c.race.dates)} · ${esc(c.country)}</p><a href="${esc(c.race.source)}" target="_blank" rel="noopener">Official event details</a></div><a class="btn btn-ghost" href="/${slug}/events.html#${esc(c.slug)}">Plan the weekend</a></div>`).join("\n");
}

export function normaliseShowcaseNavigation(html, slug) {
  let result = html.replaceAll(`/${slug}/race-planner/`, `/${slug}/events.html#cities`).replaceAll(`/${slug}/race-planner.html`, `/${slug}/events.html#cities`);
  result = result.replace(/>UK HYROX news<|>UK scene<|>Hyrox the UK news</g, ">The Hybrid Brief<").replace(/>Race calendar<|>Race-trip planner</g, ">Race Calendar &amp; Travel<");
  const privateLink = `<a\\b[^>]*href="/${slug}/(?:desk|campaigns|platform-setup|manage-videos|manage-programmes)(?:\\.html|/)?(?:[?#][^"]*)?"[^>]*>[\\s\\S]*?<\\/a>`;
  result = result.replace(new RegExp(`<li\\b[^>]*>\\s*${privateLink}\\s*<\\/li>`, "g"), "").replace(new RegExp(privateLink, "g"), "");
  result = result.replaceAll(`href="/${slug}/planner.html"`, `href="/${slug}/planner.html?view=client"`).replaceAll(`href="/${slug}/planner/"`, `href="/${slug}/planner.html?view=client"`).replace(/>Book a slot</g, ">Book a session<");
  const open = /<ul\b[^>]*\bid="menu"[^>]*>/i.exec(result);
  if (!open) return result;
  const tags = /<\/?ul\b[^>]*>/gi;
  tags.lastIndex = open.index + open[0].length;
  let depth = 1, end = null, match;
  while ((match = tags.exec(result))) { depth += match[0].startsWith("</") ? -1 : 1; if (!depth) { end = tags.lastIndex; break; } }
  if (!end) return result;
  let menu = result.slice(open.index, end);
  for (const [url, title] of [["planner.html?view=client", "Book a session"], ["training.html", "Access your training"], ["events.html", "Race Calendar &amp; Travel"], ["news.html", "The Hybrid Brief"]]) {
    if (!menu.includes(`/${slug}/${url}`)) menu = menu.replace(/<\/ul>$/, `<li><a href="/${slug}/${url}">${title}</a></li></ul>`);
  }
  return result.slice(0, open.index) + menu + result.slice(end);
}

function menuFragment(html) {
  const opening = /<ul\b[^>]*\bid="menu"[^>]*>/i.exec(html);
  if (!opening) return "";
  const tags = /<\/?ul\b[^>]*>/gi;
  tags.lastIndex = opening.index + opening[0].length;
  let depth = 1, match;
  while ((match = tags.exec(html))) { depth += match[0].startsWith("</") ? -1 : 1; if (!depth) return html.slice(opening.index, tags.lastIndex); }
  return "";
}

export function resolveTrainingPlatform(config) {
  const supplied = config.trainingPlatform || {};
  const primaryOffer = config.coachingOffers?.[0];
  const url = value => {
    if (!value) return "";
    try { const parsed = new URL(value); return parsed.protocol === "https:" && !parsed.username && !parsed.password && ![...parsed.searchParams.keys()].some(key => /^(?:api[_-]?key|access[_-]?token|password|secret)$/i.test(key)) ? parsed.href : ""; } catch { return ""; }
  };
  const programmesURL = url(primaryOffer?.url || supplied.programmesURL || config.tokens?.PROGRAMMES_URL);
  const applicationURL = url(supplied.applicationURL || config.tokens?.APPLY_URL);
  if (!programmesURL || !applicationURL) throw new Error("Training programmes need valid HTTPS programme and application destinations, without credentials or secret query parameters.");
  const host = new URL(programmesURL).hostname;
  const known = /(^|\.)fitr\.training$/.test(host) ? { name: "FITR", login: "https://app.fitr.training/" } : /(^|\.)trainerize\.(?:com|me)$/.test(host) ? { name: "ABC Trainerize", login: "https://www.trainerize.com/login/" } : null;
  const coachURL = url(supplied.coachURL || known?.login);
  const clientURL = url(supplied.clientURL || known?.login);
  if ((supplied.coachURL && !url(supplied.coachURL)) || (supplied.clientURL && !url(supplied.clientURL))) throw new Error("Provide valid HTTPS coach and client training-platform links, without embedded credentials.");
  return { name: String(supplied.name || known?.name || "Your coaching platform").slice(0, 80), coachURL, clientURL, programmesURL, applicationURL, directCoachLink: Boolean(supplied.coachURL || known), offerTitle: String(primaryOffer?.title || supplied.offerTitle || "Training programmes").slice(0, 100), offerDescription: String(primaryOffer?.description || supplied.offerDescription || "Structured training towards your next goal, with clear sessions and progression.").slice(0, 500), note: String(supplied.note || "Open your existing coaching setup. Training delivery and client records stay on that platform; no workout or progress-data sync is connected here.").slice(0, 500) };
}

export function resolveCampaignOffers(offers, training) {
  return offers.map(offer => {
    const destination = offer.destination || (offer.id === "programme" ? training.programmesURL : offer.id === "coaching" ? training.applicationURL : undefined);
    if (destination) {
      let parsed;
      try { parsed = new URL(destination); } catch { throw new Error("Campaign offers need absolute HTTPS destinations."); }
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || [...parsed.searchParams.keys()].some(key => /^(?:api[_-]?key|access[_-]?token|password|secret)$/i.test(key))) throw new Error("Campaign offers need valid HTTPS destinations without credentials or secret query parameters.");
    }
    return { ...offer, destination };
  });
}

export function renderCoachView(slug, available = ["planner.html", "desk.html", "campaigns.html", "manage-programmes.html", "manage-videos.html"]) {
  const tools = [["planner.html", "planner.html?view=coach&audience=coach", "Bookings"], ["desk.html", "desk.html?audience=coach", "Finance"], ["campaigns.html", "campaigns.html?audience=coach", "Campaigns"], ["manage-programmes.html", "manage-programmes.html?audience=coach", "Programmes"], ["manage-videos.html", "manage-videos.html?audience=coach", "Content"]];
  return `<aside class="coach-view wrap" data-coach-view data-coach-expanded="false" aria-label="The Desk coaching tools"><div class="coach-view-heading"><strong><a class="coach-home-link" data-coach-link href="/${slug}/?audience=coach" aria-label="Coach homepage — The Desk">The Desk</a></strong><span>Your coaching tools</span></div><button class="coach-view-toggle" type="button" aria-expanded="false" aria-controls="coach-view-actions">Show tools</button><nav class="coach-view-actions" id="coach-view-actions" aria-label="Coach tools">${tools.filter(([file]) => available.includes(file)).map(([, url, title]) => `<a data-coach-link href="/${slug}/${esc(url)}">${title}</a>`).join("")}</nav><a class="coach-public-link" href="/${slug}/?audience=public" target="_blank" rel="noopener">Preview public site ↗</a></aside>`;
}

export function wireCoachView({ outputDir, config }) {
  const enabled = config.coachPreview !== false;
  const slug = config.slug;
  const privatePages = ["desk.html", "campaigns.html", "platform-setup.html", "manage-videos.html", "manage-programmes.html"];
  for (const file of privatePages.filter(file => file !== "desk.html")) {
    const manager = path.join(outputDir, file);
    if (!enabled && fs.existsSync(manager)) fs.unlinkSync(manager);
  }
  const available = ["planner.html", "desk.html", "campaigns.html", "manage-programmes.html", "manage-videos.html"].filter(file => fs.existsSync(path.join(outputDir, file)));
  for (const file of fs.readdirSync(outputDir).filter(file => file.endsWith(".html"))) {
    const target = path.join(outputDir, file);
    let html = fs.readFileSync(target, "utf8").replace(/<aside\b[^>]*data-coach-view[\s\S]*?<\/aside>/g, "");
    if (config.nutrition?.mode === "hidden") {
      const fuelLink = `<a\\b[^>]*href="/${slug}/fuel-zone(?:\\.html|/)?(?:[?#][^"]*)?"[^>]*>([\\s\\S]*?)<\\/a\\s*>`;
      html = html.replace(new RegExp(`[ \\t]*\\(\\s*${fuelLink}\\s*\\)`, "gi"), "").replace(new RegExp(`<li\\b[^>]*>\\s*${fuelLink}\\s*<\\/li>`, "gi"), "").replace(new RegExp(fuelLink, "gi"), "$1");
    }
    const privatePage = privatePages.includes(file);
    if (privatePage) {
      html = html.replace(/(<footer\b[^>]*>[\s\S]*?)<nav\b[^>]*>[\s\S]*?<\/nav>/g, `$1<a data-coach-link href="/${slug}/?audience=coach">Back to coach homepage</a>`);
      html = html.replace(new RegExp(`<a[^>]*href="/${slug}/\\?audience=public"[^>]*>View (?:the )?public site</a>`, "g"), `<a data-coach-link href="/${slug}/?audience=coach">Back to coach homepage</a>`);
      const opening = /<div\b[^>]*class="nav"[^>]*>/.exec(html);
      if (opening) {
        const tags = /<\/?div\b[^>]*>/g;
        tags.lastIndex = opening.index;
        let depth = 0, match;
        while ((match = tags.exec(html))) { depth += match[0].startsWith("</") ? -1 : 1; if (!depth) { html = html.slice(0, opening.index) + html.slice(tags.lastIndex); break; } }
      }
    } else html = normaliseShowcaseNavigation(html, slug);
    if (file === "manage-videos.html" && config.contentPublishing?.podcast === false) html = html.replace('data-podcast-enabled="true"', 'data-podcast-enabled="false"');
    if (file === "planner.html") {
      if (!html.includes("desk-booking-page")) html = html.replace(/<body\b([^>]*)>/, '<body$1 class="desk-booking-page">');
      if (!html.includes("desk-booking-heading")) html = html.replace('<p class="eyebrow"><span></span>THE SESSION PLANNER</p>', '<p class="eyebrow desk-booking-heading">The Desk / Bookings</p><p class="eyebrow booking-client-heading"><span></span>THE SESSION PLANNER</p>');
    }
    html = html.replace(/<html\b([^>]*)>/, (_, attrs) => `<html${attrs.replace(/\sdata-coach-(?:preview|page)="[^"]*"/g, "")} data-coach-preview="${enabled}" data-coach-page="${privatePage}">`);
    if (!html.includes(`/${slug}/showcase.css`)) html = html.replace("</head>", `<link rel="stylesheet" href="/${slug}/showcase.css" /></head>`);
    if (!html.includes(`/${slug}/coach-view.js`)) html = html.replace("</head>", `<script src="/${slug}/coach-view.js"></script></head>`);
    if (enabled && !/http-equiv="refresh"/i.test(html)) {
      if (privatePage && html.includes("</header>")) html = html.replace("</header>", `</header>${renderCoachView(slug, available)}`);
      else if (/<div class="nav">/.test(html)) html = html.replace('<div class="nav">', `${renderCoachView(slug, available)}\n<div class="nav">`);
      else html = html.replace(/(<body\b[^>]*>)/, `$1${renderCoachView(slug, available)}`);
    }
    fs.writeFileSync(target, html);
  }
}

export function validateCanonicalTemplate(root) {
  const dir = path.join(root, "chassis");
  for (const file of ["campaigns.html", "platform-setup.html", "client-success.js", "index.html", "events.html", "planner.js", "predictor.js", "news.html", "news.js", "desk.html", "campaign.js", "showcase.css", "coach-view.js", "manage-videos.html", "video-library.js", "data/videos.json", "manage-programmes.html", "training.html", "training-platform.js", "data/cities.json", "data/news.json"]) {
    if (!fs.existsSync(path.join(dir, file))) throw new Error(`Canonical template missing ${file}`);
  }
  const cities = JSON.parse(fs.readFileSync(path.join(dir, "data/cities.json"), "utf8"));
  selectConfirmedRaces(cities);
  const news = JSON.parse(fs.readFileSync(path.join(dir, "data/news.json"), "utf8"));
  if (news.items?.length < 5 || news.items.some(n => !n.source?.startsWith("https://") || !n.take)) throw new Error("Canonical news must contain sourced stories and coach-voice review takes.");
  if (/var £/.test(fs.readFileSync(path.join(dir, "desk.html"), "utf8"))) throw new Error("The Desk money formatter is invalid.");
  if (fs.readFileSync(path.join(dir, "planner.js"), "utf8").includes('timeZone: "the UK/')) throw new Error("Invalid race planner timezone.");
  return "Canonical chassis validated. No tenant donor was copied and no existing site was rebuilt.";
}

export function prepareShowcase({ root, outputDir, config }) {
  const master = path.join(root, "chassis");
  const catalogue = config.races || JSON.parse(fs.readFileSync(path.join(master, "data/cities.json"), "utf8"));
  const cities = selectConfirmedRaces(catalogue, { region: config.raceRegion || config.tokens?.COUNTRY || config.tokens?.REGION || "" });
  const slug = config.slug;
  const data = { ...catalogue, cities, home: cities[0].slug };
  fs.writeFileSync(path.join(outputDir, "data/cities.json"), JSON.stringify(data, null, 2) + "\n");
  fs.writeFileSync(path.join(outputDir, "data/events.json"), JSON.stringify({ checked: catalogue.checked, next: { name: cities[0].race.name, date: cities[0].race.start, url: cities[0].race.source } }, null, 2) + "\n");
  for (const [file, eventKey] of [["matchboard.json", "event"], ["travelboard.json", "race"]]) {
    const board = JSON.parse(fs.readFileSync(path.join(master, "data", file), "utf8"));
    board.items = board.items.map((item, index) => {
      const city = cities[index % cities.length];
      return { ...item, [eventKey]: city.race.name, until: city.race.end || city.race.start, ...(eventKey === "race" ? { dates: city.race.dates } : {}) };
    });
    fs.writeFileSync(path.join(outputDir, "data", file), JSON.stringify(board, null, 2) + "\n");
  }
  const training = resolveTrainingPlatform(config);
  fs.writeFileSync(path.join(outputDir, "data/training-platform.json"), JSON.stringify(training, null, 2) + "\n");
  const offerPath = path.join(outputDir, "data/campaign-offers.json");
  const campaignOffers = JSON.parse(fs.readFileSync(offerPath, "utf8"));
  campaignOffers.offers = resolveCampaignOffers(campaignOffers.offers || [], training);
  fs.writeFileSync(offerPath, JSON.stringify(campaignOffers, null, 2) + "\n");
  const defaultNews = JSON.parse(fs.readFileSync(path.join(master, "data/news.json"), "utf8"));
  const supplied = Array.isArray(config.news) && config.news.length ? config.news : config.showcaseNews?.items;
  const news = supplied ? { items: supplied.map(n => ({ ...n, type: n.source ? "news" : "editorial", takeStatus: "draft-for-review" })) } : defaultNews;
  let newsText = JSON.stringify(news, null, 2);
  for (const [key, value] of Object.entries(config.tokens || {})) newsText = newsText.split(`{{${key}}}`).join(JSON.stringify(String(value)).slice(1, -1));
  fs.writeFileSync(path.join(outputDir, "data/news.json"), newsText + "\n");
  let navigation = menuFragment(normaliseShowcaseNavigation(fs.readFileSync(path.join(outputDir, "index.html"), "utf8"), slug));
  const navLabels = { "shop.html": "Shop", "podcast.html": "Podcast", ...(config.navLabels || {}) };
  for (const [file, label] of [["shop.html", navLabels["shop.html"]], ["podcast.html", navLabels["podcast.html"]]]) {
    if (fs.existsSync(path.join(outputDir, file)) && !navigation.includes(`/${slug}/${file}`)) navigation = navigation.replace(/<\/ul>$/, `<li><a href="/${slug}/${file}">${label}</a></li></ul>`);
  }
  for (const file of fs.readdirSync(outputDir).filter(f => f.endsWith(".html"))) {
    const target = path.join(outputDir, file);
    const privatePage = ["desk.html", "campaigns.html", "platform-setup.html", "manage-videos.html", "manage-programmes.html"].includes(file);
    let text = fs.readFileSync(target, "utf8");
    if (!privatePage) text = normaliseShowcaseNavigation(text, slug);
    const oldMenu = privatePage ? "" : menuFragment(text);
    if (oldMenu && navigation) text = text.replace(oldMenu, navigation);
    if (!text.includes(`/${slug}/showcase.css`)) text = text.replace("</head>", `<link rel="stylesheet" href="/${slug}/showcase.css" /></head>`);
    if (file === "index.html") text = text.replace(/(<section\b[^>]*id="events"[\s\S]*?)<div class="events"[^>]*>[\s\S]*?<\/section>/, `$1<div class="events" id="race-cards" aria-live="polite">${renderRaceCards(cities, slug, { leadDays: config.races?.homepageLeadDays, count: config.races?.homepageCount })}</div></div></section>`);
    fs.writeFileSync(target, text);
  }
  const digest = crypto.createHash("sha256");
  const walk = dir => { for (const name of fs.readdirSync(dir).sort()) { const file = path.join(dir, name); if (fs.statSync(file).isDirectory()) walk(file); else digest.update(path.relative(master, file)).update(fs.readFileSync(file)); } };
  walk(master);
  fs.writeFileSync(path.join(outputDir, "build-provenance.json"), JSON.stringify({ source: "chassis", mode: "chassis", templateHash: digest.digest("hex"), builtAt: new Date().toISOString(), rules: ".devin/rules/platform-build-and-video.md", raceSourcesChecked: catalogue.checked }, null, 2) + "\n");
}
