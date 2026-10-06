// Guide autopilot support: validation, duplicate detection and HTML rendering
// for database-stored guides. Pure functions, no I/O.

const ALLOWED_TAGS = new Set([
  "h3",
  "h4",
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "a",
  "br",
]);

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Keep only a small whitelist of tags; strip attributes except safe hrefs.
export function sanitizeBody(html) {
  return String(html || "").replace(
    /<\/?([a-zA-Z0-9]+)([^>]*)>/g,
    (m, tag, attrs) => {
      const t = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(t)) return "";
      if (m.startsWith("</")) return `</${t}>`;
      if (t === "a") {
        const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs || "")?.[1];
        if (
          href &&
          /^(\/|https?:\/\/)/i.test(href) &&
          !/^javascript:/i.test(href)
        ) {
          return `<a href="${escapeHtml(href)}">`;
        }
        return "<a>";
      }
      return `<${t}>`;
    },
  );
}

export function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(html) {
  const t = stripTags(html);
  return t ? t.split(" ").length : 0;
}

function shingles(text, n = 3) {
  const words = stripTags(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set();
  for (let i = 0; i + n <= words.length; i++) {
    out.add(words.slice(i, i + n).join(" "));
  }
  return out;
}

// Jaccard similarity on 3-word shingles. 0 = nothing shared, 1 = identical.
export function similarity(a, b) {
  const sa = shingles(a);
  const sb = shingles(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const s of sa) if (sb.has(s)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export function nearDuplicate(candidate, existing, threshold = 0.2) {
  for (const g of existing || []) {
    const score = similarity(
      `${candidate.title} ${candidate.body_html}`,
      `${g.title} ${g.body_html}`,
    );
    if (score >= threshold) return { slug: g.slug, score };
  }
  return null;
}

export function validateGuide(raw, { minWords = 500, maxWords = 2500 } = {}) {
  const g = raw && typeof raw === "object" ? raw : {};
  const title = String(g.title || "").trim();
  const description = String(g.description || "").trim();
  const body_html = sanitizeBody(g.body_html);
  const slug = slugify(g.slug || title);
  if (!slug) return { error: "slug/title required" };
  if (title.length < 10 || title.length > 110)
    return { error: "title must be 10–110 characters" };
  if (description.length < 50 || description.length > 170)
    return { error: "description must be 50–170 characters" };
  const words = wordCount(body_html);
  if (words < minWords) return { error: `body too short (${words} words)` };
  if (words > maxWords) return { error: `body too long (${words} words)` };
  if (!/<h3>/.test(body_html)) return { error: "body needs <h3> sections" };
  const faqs = Array.isArray(g.faqs)
    ? g.faqs
        .map((f) => ({
          q: String(f?.q || "").trim(),
          a: stripTags(f?.a || ""),
        }))
        .filter((f) => f.q && f.a)
        .slice(0, 8)
    : [];
  if (faqs.length < 2) return { error: "at least 2 FAQs required" };
  return {
    guide: {
      slug,
      title,
      description,
      eyebrow: String(g.eyebrow || "Guide")
        .trim()
        .slice(0, 40),
      lead: stripTags(g.lead || "").slice(0, 300),
      body_html,
      faqs,
      source: String(g.source || "").slice(0, 60),
    },
  };
}

function tocFromBody(body_html) {
  const items = [];
  const html = String(body_html).replace(
    /<h3>([\s\S]*?)<\/h3>/g,
    (m, inner) => {
      const text = stripTags(inner);
      let id = slugify(text) || `s${items.length + 1}`;
      if (items.some((i) => i.id === id)) id = `${id}-${items.length + 1}`;
      items.push({ id, text });
      return `<h3 id="${id}">${inner}</h3>`;
    },
  );
  return { html, items };
}

export function renderGuidePage(guide, cfg, others = []) {
  const base = String(cfg.basePath || "/guides/").replace(/\/?$/, "/");
  const url = `${base}${guide.slug}/`;
  const brand = cfg.brand || "Guides";
  const author = cfg.author || {};
  const updated = String(guide.updated_at || guide.published_at || "").slice(
    0,
    10,
  );
  const published = String(guide.published_at || "").slice(0, 10);
  const { html: body, items: toc } = tocFromBody(guide.body_html);
  const faqs = Array.isArray(guide.faqs) ? guide.faqs : [];
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        inLanguage: cfg.language || "en",
        datePublished: published,
        dateModified: updated,
        author: author.name
          ? {
              "@type": "Person",
              name: author.name,
              jobTitle: author.jobTitle || undefined,
            }
          : { "@type": "Organization", name: brand },
        publisher: { "@type": "Organization", name: brand },
        mainEntityOfPage: url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: brand,
            item: cfg.homePath || "/",
          },
          { "@type": "ListItem", position: 2, name: "Guides", item: base },
          { "@type": "ListItem", position: 3, name: guide.title, item: url },
        ],
      },
      faqs.length
        ? {
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }
        : null,
    ].filter(Boolean),
  };
  const more = others
    .filter((o) => o.slug !== guide.slug)
    .slice(0, 6)
    .map(
      (o) =>
        `<li><a href="${base}${escapeHtml(o.slug)}/">${escapeHtml(o.title)}</a></li>`,
    )
    .join("");
  const faqHtml = faqs
    .map(
      (f) =>
        `<details><summary>${escapeHtml(f.q)}</summary><p>${escapeHtml(f.a)}</p></details>`,
    )
    .join("");
  const tocHtml = toc
    .map((t) => `<li><a href="#${t.id}">${escapeHtml(t.text)}</a></li>`)
    .join("");
  const nav = (cfg.nav || [])
    .map(
      (n) =>
        `<li><a href="${escapeHtml(n.href)}">${escapeHtml(n.label)}</a></li>`,
    )
    .join("");
  const footerNav = (cfg.nav || [])
    .map((n) => `<a href="${escapeHtml(n.href)}">${escapeHtml(n.label)}</a>`)
    .join("");
  const styles = (cfg.stylesheets || [])
    .map((s) => `<link rel="stylesheet" href="${escapeHtml(s)}" />`)
    .join("");
  const scripts = (cfg.scripts || [])
    .map((s) => `<script src="${escapeHtml(s)}" defer></script>`)
    .join("");
  const headerHtml =
    cfg.headerHtml ||
    `<h1><a href="${escapeHtml(cfg.homePath || "/")}">${escapeHtml(brand)}</a></h1>`;
  return `<!doctype html>
<html lang="${escapeHtml(cfg.language || "en")}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(guide.title)} — ${escapeHtml(brand)}</title>
<meta name="description" content="${escapeHtml(guide.description)}" />
<link rel="canonical" href="${escapeHtml(url)}" />
${styles}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<header class="masthead wrap">${headerHtml}</header>
<div class="nav"><div class="wrap">
<button class="nav-toggle" aria-expanded="false" aria-controls="menu">Menu</button>
<ul class="menu" id="menu">${nav}</ul>
</div></div>
<section class="guide-hero"><div class="wrap"><div class="guide-hero-text">
<ol class="crumbs"><li><a href="${escapeHtml(cfg.homePath || "/")}">${escapeHtml(brand)}</a></li><li><a href="${base}">Guides</a></li><li>${escapeHtml(guide.title)}</li></ol>
<p class="eyebrow">${escapeHtml(guide.eyebrow || "Guide")}</p>
<h2>${escapeHtml(guide.title)}</h2>
${guide.lead ? `<p class="lead">${escapeHtml(guide.lead)}</p>` : ""}
<p class="byline">${escapeHtml(cfg.byline || "")}${updated ? ` · Updated <time datetime="${updated}">${updated}</time>` : ""}</p>
</div></div></section>
<div class="wrap guide">
<aside class="toc" aria-label="Sections"><p>Jump to</p><ol>${tocHtml}</ol></aside>
<div class="article">
<article class="station">${body}</article>
${faqs.length ? `<section class="faq" id="faq"><h3>FAQ</h3>${faqHtml}</section>` : ""}
${cfg.ctaHtml || ""}
${more ? `<section class="more-guides" aria-label="More guides"><h3>More guides</h3><ul>${more}</ul></section>` : ""}
</div></div>
<footer><div class="wrap"><div>© <span id="year"></span> ${escapeHtml(brand)}</div><nav>${footerNav}</nav></div></footer>
${scripts}
</body></html>`;
}

export function renderGuideIndex(guides, cfg) {
  const base = String(cfg.basePath || "/guides/").replace(/\/?$/, "/");
  const brand = cfg.brand || "Guides";
  const nav = (cfg.nav || [])
    .map(
      (n) =>
        `<li><a href="${escapeHtml(n.href)}">${escapeHtml(n.label)}</a></li>`,
    )
    .join("");
  const styles = (cfg.stylesheets || [])
    .map((s) => `<link rel="stylesheet" href="${escapeHtml(s)}" />`)
    .join("");
  const items = guides
    .map(
      (g) =>
        `<li><a href="${base}${escapeHtml(g.slug)}/"><strong>${escapeHtml(g.title)}</strong></a><br />${escapeHtml(g.description)} <small>· ${escapeHtml(String(g.updated_at || g.published_at || "").slice(0, 10))}</small></li>`,
    )
    .join("");
  const title = cfg.indexTitle || `Guides — ${brand}`;
  const desc = cfg.indexDescription || `All guides from ${brand}.`;
  return `<!doctype html>
<html lang="${escapeHtml(cfg.language || "en")}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}" />
<link rel="canonical" href="${escapeHtml(base)}" />
${styles}
</head>
<body>
<header class="masthead wrap">${cfg.headerHtml || `<h1>${escapeHtml(brand)}</h1>`}</header>
<div class="nav"><div class="wrap"><button class="nav-toggle" aria-expanded="false" aria-controls="menu">Menu</button><ul class="menu" id="menu">${nav}</ul></div></div>
<section class="guide-hero"><div class="wrap"><div class="guide-hero-text">
<ol class="crumbs"><li><a href="${escapeHtml(cfg.homePath || "/")}">${escapeHtml(brand)}</a></li><li>Guides</li></ol>
<p class="eyebrow">Guides</p><h2>${escapeHtml(cfg.indexHeading || "Training guides")}</h2>
<p class="lead">${escapeHtml(desc)}</p></div></div></section>
<div class="wrap guide"><div class="article"><ul class="checklist">${items || "<li>New guides land here every fortnight.</li>"}</ul></div></div>
<footer><div class="wrap"><div>© <span id="year"></span> ${escapeHtml(brand)}</div></div></footer>
${(cfg.scripts || []).map((s) => `<script src="${escapeHtml(s)}" defer></script>`).join("")}
</body></html>`;
}
