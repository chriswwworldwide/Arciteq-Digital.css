// src/segment-page.js
// Pure renderer for PawSense "segment" landing pages (breeders, show dogs/cats,
// dog walkers, pet sitters, multi-pet). Data-driven so the prestige/segment
// tracks all share one template and cascade the premium styles. No I/O here —
// the build script (scripts/build-segment-pages.js) reads the data + product
// catalog and calls these functions, so the logic stays unit-testable.

/** Escape a string for safe interpolation into HTML text/attributes. */
export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape a string for safe embedding inside a JSON-LD script block. */
export function escapeJsonLd(value) {
  // JSON.stringify handles quoting/escaping; strip the "</" sequence so a
  // value can never break out of the <script> element.
  return JSON.stringify(String(value == null ? "" : value)).replace(
    /<\//g,
    "<\\/",
  );
}

/**
 * Resolve a product's canonical URL + display title from the catalog.
 * @param {string} productId
 * @param {Array} products the parsed data/products.json array
 * @returns {{url:string,title:string}|null}
 */
export function resolveProduct(productId, products) {
  const list = Array.isArray(products) ? products : [];
  const p = list.find((x) => String(x?.productId || "") === String(productId));
  if (!p) return null;
  const cat = String(p?.nicheCategory?.slug || "").trim();
  const slug = String(p?.seo?.slug || "").trim();
  if (!cat || !slug) return null;
  // Strip functional "(Demo)/(Placeholder)/(Non-Ingestible)" tags from titles.
  const title = String(p?.title || "")
    .replace(/\s*\((?:demo|placeholder|non-ingestible)\)/gi, "")
    .trim();
  return { url: `/${cat}/${slug}`, title };
}

function renderPicks(picks, products) {
  const cards = (Array.isArray(picks) ? picks : [])
    .map((pick) => {
      const resolved = resolveProduct(pick?.productId, products);
      if (!resolved) return "";
      const why = escapeHtml(pick?.why || "");
      return `
        <div class="seg-card">
          <a href="${escapeHtml(resolved.url)}?ref=${escapeHtml(pick?.ref || "segment")}">
            <h3>${escapeHtml(resolved.title)}</h3>
            <p>${why}</p>
          </a>
        </div>`;
    })
    .filter(Boolean)
    .join("");
  return cards;
}

function renderProblemCards(cards) {
  return (Array.isArray(cards) ? cards : [])
    .map(
      (c) => `
        <div class="seg-card">
          <h3>${escapeHtml(c?.title)}</h3>
          <p>${escapeHtml(c?.text)}</p>
        </div>`,
    )
    .join("");
}

function renderReads(reads) {
  return (Array.isArray(reads) ? reads : [])
    .map((r) => {
      const title = escapeHtml(r?.title);
      const summary = escapeHtml(r?.summary || "");
      const href = String(r?.href || "").trim();
      if (href) {
        return `
        <div class="seg-card">
          <a href="${escapeHtml(href)}">
            <h3>${title}</h3>
            <p>${summary}</p>
          </a>
        </div>`;
      }
      const body = escapeHtml(r?.body || summary);
      return `
        <details class="seg-read">
          <summary><span class="seg-read-title">${title}</span></summary>
          <p>${body}</p>
        </details>`;
    })
    .join("");
}

/**
 * Split events into upcoming vs recent by date (relative to `today`), so a
 * scheduled rebuild automatically flips a show from "upcoming" to "recent with
 * results" once its date passes.
 * @param {Array} events [{ date:"YYYY-MM-DD", name, location, result? }]
 * @param {Date} today
 */
export function splitEvents(events, today = new Date()) {
  const list = Array.isArray(events) ? events : [];
  const cutoff = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  ).getTime();

  const parse = (d) => {
    const t = Date.parse(String(d || ""));
    return Number.isFinite(t) ? t : null;
  };

  const upcoming = [];
  const recent = [];
  for (const e of list) {
    const t = parse(e?.date);
    if (t == null) continue;
    if (t >= cutoff) upcoming.push(e);
    else recent.push(e);
  }
  upcoming.sort((a, b) => parse(a.date) - parse(b.date));
  recent.sort((a, b) => parse(b.date) - parse(a.date));
  return { upcoming, recent };
}

function fmtEventDate(d) {
  const t = Date.parse(String(d || ""));
  if (!Number.isFinite(t)) return escapeHtml(d);
  return new Date(t).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function renderEventsBlock(events, today) {
  const list = Array.isArray(events) ? events : [];
  if (list.length === 0) return "";
  const { upcoming, recent } = splitEvents(list, today);

  const row = (e, withResult) => `
        <li class="seg-event">
          <span class="seg-event-date">${fmtEventDate(e?.date)}</span>
          <span class="seg-event-name">${escapeHtml(e?.name)}</span>
          ${e?.location ? `<span class="seg-event-loc">${escapeHtml(e.location)}</span>` : ""}
          ${withResult && e?.result ? `<span class="seg-event-result">${escapeHtml(e.result)}</span>` : ""}
        </li>`;

  const upcomingHtml = upcoming.length
    ? `<h3 class="seg-events-sub">Upcoming events</h3><ul class="seg-events">${upcoming.map((e) => row(e, false)).join("")}</ul>`
    : "";
  const recentHtml = recent.length
    ? `<h3 class="seg-events-sub">Recent events &amp; results</h3><ul class="seg-events">${recent.map((e) => row(e, true)).join("")}</ul>`
    : "";

  return `
      <section class="seg-section seg-events-section" aria-label="Events">
        <h2>Events</h2>
        ${upcomingHtml}
        ${recentHtml}
      </section>`;
}

function renderRundownBlock(rundown) {
  const steps = Array.isArray(rundown?.steps) ? rundown.steps : [];
  if (steps.length === 0) return "";
  const heading = escapeHtml(rundown?.heading || "Show-day rundown");
  const intro = escapeHtml(rundown?.intro || "");
  const items = steps
    .map(
      (s) => `
        <li class="seg-rundown-step">
          <span class="seg-rundown-time">${escapeHtml(s?.time || "")}</span>
          <div>
            <span class="seg-rundown-title">${escapeHtml(s?.title)}</span>
            ${s?.text ? `<p>${escapeHtml(s.text)}</p>` : ""}
          </div>
        </li>`,
    )
    .join("");
  return `
      <section class="seg-section" aria-label="${heading}">
        <h2>${heading}</h2>
        ${intro ? `<p class="lead">${intro}</p>` : ""}
        <ol class="seg-rundown">
          ${items}
        </ol>
      </section>`;
}

function renderFaqHtml(faqs) {
  return (Array.isArray(faqs) ? faqs : [])
    .map(
      (f) => `
        <details>
          <summary>${escapeHtml(f?.q)}</summary>
          <p>${escapeHtml(f?.a)}</p>
        </details>`,
    )
    .join("");
}

function faqJsonLd(faqs) {
  const entities = (Array.isArray(faqs) ? faqs : [])
    .filter((f) => f?.q && f?.a)
    .map(
      (f) =>
        `{"@type":"Question","name":${escapeJsonLd(f.q)},"acceptedAnswer":{"@type":"Answer","text":${escapeJsonLd(f.a)}}}`,
    )
    .join(",");
  return `{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[${entities}]}`;
}

function eventsJsonLd(events, today) {
  const { upcoming } = splitEvents(events, today);
  if (upcoming.length === 0) return "";
  const nodes = upcoming
    .map(
      (e) =>
        `{"@context":"https://schema.org","@type":"Event","name":${escapeJsonLd(e?.name)},"startDate":${escapeJsonLd(e?.date)}${e?.location ? `,"location":{"@type":"Place","name":${escapeJsonLd(e.location)}}` : ""},"eventStatus":"https://schema.org/EventScheduled"}`,
    )
    .join(",");
  return `
    <script type="application/ld+json">
      [${nodes}]
    </script>`;
}

function itemListJsonLd(picks, products, canonical) {
  const items = (Array.isArray(picks) ? picks : [])
    .map((pick) => resolveProduct(pick?.productId, products))
    .filter(Boolean)
    .map(
      (r, i) =>
        `{"@type":"ListItem","position":${i + 1},"url":${escapeJsonLd(r.url)},"name":${escapeJsonLd(r.title)}}`,
    )
    .join(",");
  return `{"@context":"https://schema.org","@type":"ItemList","name":${escapeJsonLd(canonical)},"itemListElement":[${items}]}`;
}

function breadcrumbJsonLd(label, canonical) {
  const crumbs = [
    { name: "Home", item: "/" },
    { name: "Who it's for", item: "/segments/" },
    { name: String(label || ""), item: canonical },
  ];
  const items = crumbs
    .map(
      (c, i) =>
        `{"@type":"ListItem","position":${i + 1},"name":${escapeJsonLd(c.name)},"item":${escapeJsonLd(c.item)}}`,
    )
    .join(",");
  return `{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[${items}]}`;
}

/**
 * Render a full segment landing page HTML document.
 * @param {object} segment one entry from data/segments.json
 * @param {object} opts
 * @param {Array} opts.products parsed data/products.json array
 * @returns {string} complete HTML document
 */
export function renderSegmentPage(
  segment,
  { products = [], today = new Date() } = {},
) {
  const slug = escapeHtml(segment?.slug || "");
  const canonical = `/segments/${slug}.html`;
  const title = escapeHtml(
    segment?.metaTitle || segment?.heroTitle || "PawSense",
  );
  const description = escapeHtml(segment?.metaDescription || "");
  const kicker = escapeHtml(segment?.kicker || "");
  const heroTitle = escapeHtml(segment?.heroTitle || "");
  const heroIntro = escapeHtml(segment?.heroIntro || "");
  const whoFor = escapeHtml(segment?.whoFor || "");
  const why = escapeHtml(segment?.why || "");
  const readsHeading = escapeHtml(
    segment?.readsHeading || "Specialist short reads",
  );
  const problemsHeading = escapeHtml(
    segment?.problemsHeading || "What this segment needs",
  );
  const picksHeading = escapeHtml(segment?.picksHeading || "Curated picks");
  const picksIntro = escapeHtml(segment?.picksIntro || "");
  const kitName = escapeHtml(segment?.kit?.name || "");
  const kitText = escapeHtml(segment?.kit?.text || "");
  const crumbLabel = escapeHtml(
    segment?.indexTitle || segment?.heroTitle || slug,
  );

  const problemCards = renderProblemCards(segment?.problems);
  const pickCards = renderPicks(segment?.picks, products);
  const readsHtml = renderReads(segment?.reads);
  const hasInlineReads = (
    Array.isArray(segment?.reads) ? segment.reads : []
  ).some((r) => !String(r?.href || "").trim());
  const readsWrapOpen = hasInlineReads
    ? '<div class="seg-reads">'
    : '<div class="seg-grid">';
  const faqHtml = renderFaqHtml(segment?.faqs);

  const introBlock =
    whoFor || why
      ? `
      <section class="seg-intro">
        ${whoFor ? `<div class="seg-intro-col"><h2>Who it's for</h2><p>${whoFor}</p></div>` : ""}
        ${why ? `<div class="seg-intro-col"><h2>Why it matters</h2><p>${why}</p></div>` : ""}
      </section>`
      : "";

  const readsBlock = readsHtml
    ? `
      <section class="seg-section" aria-label="${readsHeading}">
        <h2>${readsHeading}</h2>
        ${readsWrapOpen}
          ${readsHtml}
        </div>
      </section>`
    : "";

  const rundownBlock = renderRundownBlock(segment?.rundown);
  const eventsBlock = renderEventsBlock(segment?.events, today);

  const kitBlock = kitName
    ? `
      <section class="seg-kit">
        <h2>${kitName}</h2>
        <p>${kitText}</p>
        <form class="seg-enquiry" data-segment="${slug}" aria-label="Register interest">
          <label for="seg-email-${slug}">Register interest — we'll email when it's ready.</label>
          <div class="seg-enquiry-row">
            <input id="seg-email-${slug}" type="email" name="email" placeholder="you@example.com" autocomplete="email" required />
            <button type="submit">Notify me</button>
          </div>
          <p class="seg-enquiry-note" role="status" aria-live="polite"></p>
        </form>
      </section>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="stylesheet" href="/styles/styles.css" />
    <link rel="stylesheet" href="/styles/premium.css" />
    <script src="/styles/premium.js" defer></script>
    <script src="/script.js" defer></script>
    <style>
      header.seg-header {
        max-width: 1100px;
        margin: 0 auto;
        padding: 16px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      main.seg-main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 0 24px 48px;
      }
      .seg-breadcrumb {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        padding: 14px 0 0;
        font-size: 0.85rem;
        color: #6b7280;
      }
      .seg-breadcrumb a {
        color: #6b7280;
        text-decoration: none;
      }
      .seg-breadcrumb a:hover {
        color: var(--accent, #8a2e2e);
      }
      .seg-breadcrumb [aria-current="page"] {
        color: #111827;
        font-weight: 600;
      }
      .seg-hero {
        padding: 20px 0 8px;
      }
      .seg-kicker {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--accent, #8a2e2e);
        margin: 0 0 8px;
      }
      .seg-hero h1 {
        margin: 0;
        font-size: 2.1rem;
        line-height: 1.15;
        color: #111827;
      }
      .seg-hero p {
        margin: 12px 0 0;
        max-width: 62ch;
        color: #374151;
        line-height: 1.55;
        font-size: 1.05rem;
      }
      .seg-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 14px;
      }
      @media (max-width: 900px) {
        .seg-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 600px) {
        .seg-grid { grid-template-columns: 1fr; }
      }
      .seg-card {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: #fff;
        overflow: hidden;
        box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04);
      }
      .seg-card > h3 { margin: 0; padding: 14px 14px 0; font-size: 1.02rem; color: #111827; }
      .seg-card > p { margin: 8px 0 0; padding: 0 14px 14px; color: #374151; line-height: 1.45; font-size: 0.95rem; }
      .seg-card a { display: block; color: inherit; text-decoration: none; }
      .seg-card a h3 { margin: 0; padding: 14px 14px 0; font-size: 1.02rem; color: #111827; }
      .seg-card a p { margin: 8px 0 0; padding: 0 14px 14px; color: #374151; line-height: 1.45; font-size: 0.95rem; }
      .seg-card a:hover h3 { text-decoration: underline; }
      .seg-intro {
        margin-top: 28px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        padding: 20px;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        background: #fafafa;
      }
      @media (max-width: 700px) { .seg-intro { grid-template-columns: 1fr; } }
      .seg-intro-col h2 { margin: 0 0 6px; font-size: 1.05rem; color: #111827; }
      .seg-intro-col p { margin: 0; color: #374151; line-height: 1.55; }
      .seg-reads { margin-top: 14px; display: grid; gap: 10px; }
      details.seg-read {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: #fff;
        padding: 12px 14px;
        box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04);
      }
      details.seg-read summary { cursor: pointer; list-style: none; outline: none; }
      details.seg-read summary::-webkit-details-marker { display: none; }
      .seg-read-title { font-weight: 600; color: #111827; }
      details.seg-read[open] .seg-read-title { color: var(--accent, #8a2e2e); }
      details.seg-read p { margin: 8px 0 0; color: #374151; line-height: 1.5; }
      .seg-events-sub { font-size: 1rem; margin: 16px 0 6px; color: #111827; }
      ul.seg-events { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
      li.seg-event {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 6px 12px;
        padding: 10px 12px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        background: #fff;
      }
      .seg-event-date { font-variant-numeric: tabular-nums; color: var(--accent, #8a2e2e); font-weight: 700; min-width: 96px; }
      .seg-event-name { font-weight: 600; color: #111827; }
      .seg-event-loc { color: #6b7280; font-size: 0.9rem; }
      .seg-event-result { color: #374151; font-size: 0.9rem; margin-left: auto; font-style: italic; }
      ol.seg-rundown { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 10px; }
      li.seg-rundown-step { display: flex; gap: 14px; align-items: flex-start; }
      .seg-rundown-time { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--accent, #8a2e2e); min-width: 68px; }
      .seg-rundown-title { font-weight: 600; color: #111827; }
      li.seg-rundown-step p { margin: 4px 0 0; color: #374151; line-height: 1.45; }
      section.seg-section { margin-top: 34px; }
      section.seg-section > h2 { font-size: 1.4rem; margin: 0 0 6px; color: #111827; }
      section.seg-section > p.lead { margin: 0 0 4px; color: #374151; line-height: 1.5; max-width: 62ch; }
      .seg-kit {
        margin-top: 34px;
        padding: 22px;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        background: #f9fafb;
      }
      .seg-kit h2 { margin: 0 0 6px; font-size: 1.3rem; color: #111827; }
      .seg-kit p { margin: 0; color: #374151; line-height: 1.5; max-width: 62ch; }
      .seg-enquiry { margin-top: 14px; }
      .seg-enquiry label { display: block; font-size: 0.9rem; color: #374151; margin-bottom: 8px; }
      .seg-enquiry-row { display: flex; gap: 8px; flex-wrap: wrap; }
      .seg-enquiry input {
        flex: 1 1 220px;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        font-size: 1rem;
      }
      .seg-enquiry button {
        padding: 10px 18px;
        border-radius: 10px;
        border: 1px solid var(--accent, #8a2e2e);
        background: var(--accent, #8a2e2e);
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      .seg-enquiry-note { margin: 8px 0 0; font-size: 0.85rem; color: #059669; min-height: 1em; }
      section.seg-faq { margin-top: 34px; }
      section.seg-faq h2 { font-size: 1.4rem; margin: 0 0 8px; }
      section.seg-faq details { border-top: 1px solid #e5e7eb; padding: 12px 0; }
      section.seg-faq details:last-child { border-bottom: 1px solid #e5e7eb; }
      section.seg-faq summary { font-weight: 600; cursor: pointer; list-style: none; outline: none; }
      section.seg-faq p { margin: 8px 0 0; color: #374151; line-height: 1.5; }
      .seg-footer-note {
        margin-top: 44px;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 0.9rem;
      }
      .seg-footer-note a { color: #111827; text-decoration: underline; }
    </style>
  </head>
  <body>
    <header class="seg-header">
      <a href="/" style="font-weight: 700; font-size: 1.25rem; color: #111827; text-decoration: none;">PawSense</a>
      <nav style="display: flex; gap: 14px; flex-wrap: wrap;">
        <a href="/shop.html" style="color: #374151; text-decoration: none;">Shop</a>
        <a href="/segments/" style="color: #374151; text-decoration: none;">Who it's for</a>
      </nav>
    </header>

    <main class="seg-main">
      <section id="trust-strip" aria-label="Trust"></section>

      <nav class="seg-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span aria-hidden="true">›</span>
        <a href="/segments/">Who it's for</a>
        <span aria-hidden="true">›</span>
        <span aria-current="page">${crumbLabel}</span>
      </nav>

      <section class="seg-hero">
        ${kicker ? `<p class="seg-kicker">${kicker}</p>` : ""}
        <h1>${heroTitle}</h1>
        <p>${heroIntro}</p>
      </section>

      ${introBlock}

      ${readsBlock}

      <section class="seg-section" aria-label="${problemsHeading}">
        <h2>${problemsHeading}</h2>
        <div class="seg-grid">
          ${problemCards}
        </div>
      </section>

      <section class="seg-section" aria-label="${picksHeading}">
        <h2>${picksHeading}</h2>
        ${picksIntro ? `<p class="lead">${picksIntro}</p>` : ""}
        <div class="seg-grid">
          ${pickCards}
        </div>
      </section>

      ${eventsBlock}

      ${rundownBlock}

      ${kitBlock}

      <section class="seg-faq" aria-label="Frequently asked questions">
        <h2>Frequently asked questions</h2>
        ${faqHtml}
      </section>

      <section class="seg-footer-note">
        <p>
          PawSense focuses on non-ingestible pet tech &amp; wellness. This page is
          general guidance, not veterinary advice.
          <a href="/">Back to home</a> or <a href="/shop.html">browse the shop</a>.
        </p>
      </section>
    </main>

    <script>
      (function () {
        var form = document.querySelector(".seg-enquiry");
        if (!form) return;
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var input = form.querySelector("input[type=email]");
          var note = form.querySelector(".seg-enquiry-note");
          var email = input && input.value ? input.value.trim() : "";
          if (!email) return;
          if (note) note.textContent = "Thanks — we'll be in touch.";
          var payload = {
            email: email,
            source: "segment:" + (form.getAttribute("data-segment") || ""),
          };
          try {
            fetch("/api/capture-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }).catch(function () {});
          } catch (err) {
            /* non-fatal: the reassurance message already showed */
          }
          form.reset();
        });
      })();
    </script>
    <script type="application/ld+json">
      ${faqJsonLd(segment?.faqs)}
    </script>
    <script type="application/ld+json">
      ${itemListJsonLd(segment?.picks, products, canonical)}
    </script>
    <script type="application/ld+json">
      ${breadcrumbJsonLd(segment?.indexTitle || segment?.heroTitle || segment?.slug, canonical)}
    </script>${eventsJsonLd(segment?.events, today)}
  </body>
</html>
`;
}

/**
 * Render the segments hub/index page linking every segment.
 * @param {Array} segments
 * @returns {string} complete HTML document
 */
function hubBreadcrumbJsonLd() {
  const crumbs = [
    { name: "Home", item: "/" },
    { name: "Who it's for", item: "/segments/" },
  ];
  const items = crumbs
    .map(
      (c, i) =>
        `{"@type":"ListItem","position":${i + 1},"name":${escapeJsonLd(c.name)},"item":${escapeJsonLd(c.item)}}`,
    )
    .join(",");
  return `{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[${items}]}`;
}

function hubItemListJsonLd(segments) {
  const items = (Array.isArray(segments) ? segments : [])
    .map((s) => ({
      url: `/segments/${String(s?.slug || "")}.html`,
      name: String(s?.indexTitle || s?.heroTitle || s?.slug || ""),
    }))
    .filter((s) => s.name && s.url !== "/segments/.html")
    .map(
      (s, i) =>
        `{"@type":"ListItem","position":${i + 1},"url":${escapeJsonLd(s.url)},"name":${escapeJsonLd(s.name)}}`,
    )
    .join(",");
  return `{"@context":"https://schema.org","@type":"ItemList","name":"Who PawSense is for","itemListElement":[${items}]}`;
}

export function renderSegmentsIndex(segments) {
  const list = Array.isArray(segments) ? segments : [];
  const cards = list
    .map(
      (s) => `
        <div class="seg-card">
          <a href="/segments/${escapeHtml(s?.slug)}.html">
            <h3>${escapeHtml(s?.indexTitle || s?.heroTitle)}</h3>
            <p>${escapeHtml(s?.indexBlurb || s?.metaDescription)}</p>
          </a>
        </div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Who PawSense is for | Breeders, show, walkers, sitters &amp; multi-pet homes</title>
    <meta name="description" content="Specialist PawSense picks for breeders, show dogs and cats, dog walkers, pet sitters and multi-pet homes — non-ingestible tech and wellness for every kind of pet parent." />
    <link rel="canonical" href="/segments/" />
    <link rel="stylesheet" href="/styles/styles.css" />
    <link rel="stylesheet" href="/styles/premium.css" />
    <script src="/styles/premium.js" defer></script>
    <script src="/script.js" defer></script>
    <style>
      header.seg-header { max-width: 1100px; margin: 0 auto; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      main.seg-main { max-width: 1100px; margin: 0 auto; padding: 0 24px 48px; }
      .seg-hero { padding: 20px 0 8px; }
      .seg-hero h1 { margin: 0; font-size: 2.1rem; line-height: 1.15; color: #111827; }
      .seg-hero p { margin: 12px 0 0; max-width: 62ch; color: #374151; line-height: 1.55; font-size: 1.05rem; }
      .seg-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 20px; }
      @media (max-width: 900px) { .seg-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 600px) { .seg-grid { grid-template-columns: 1fr; } }
      .seg-card { border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; overflow: hidden; box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04); }
      .seg-card a { display: block; color: inherit; text-decoration: none; }
      .seg-card h3 { margin: 0; padding: 14px 14px 0; font-size: 1.05rem; color: #111827; }
      .seg-card p { margin: 8px 0 0; padding: 0 14px 14px; color: #374151; line-height: 1.45; font-size: 0.95rem; }
      .seg-card a:hover h3 { text-decoration: underline; }
      .seg-breadcrumb { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 14px 0 0; font-size: 0.85rem; color: #6b7280; }
      .seg-breadcrumb a { color: #6b7280; text-decoration: none; }
      .seg-breadcrumb a:hover { color: var(--accent, #8a2e2e); }
      .seg-breadcrumb [aria-current="page"] { color: #111827; font-weight: 600; }
    </style>
  </head>
  <body>
    <header class="seg-header">
      <a href="/" style="font-weight: 700; font-size: 1.25rem; color: #111827; text-decoration: none;">PawSense</a>
      <nav style="display: flex; gap: 14px; flex-wrap: wrap;">
        <a href="/shop.html" style="color: #374151; text-decoration: none;">Shop</a>
      </nav>
    </header>
    <main class="seg-main">
      <section id="trust-strip" aria-label="Trust"></section>
      <nav class="seg-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Who it's for</span>
      </nav>
      <section class="seg-hero">
        <h1>Who PawSense is for</h1>
        <p>Whatever your relationship with your pets — raising a litter, showing, walking, sitting, or keeping cats and dogs in harmony — here are the specialist non-ingestible picks built around your day.</p>
      </section>
      <section class="seg-grid">
        ${cards}
      </section>
    </main>
    <script type="application/ld+json">
      ${hubBreadcrumbJsonLd()}
    </script>
    <script type="application/ld+json">
      ${hubItemListJsonLd(list)}
    </script>
  </body>
</html>
`;
}
