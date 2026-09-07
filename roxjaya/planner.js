// Asia Race Planner — renders city guides from roxjaya/data/cities.json.
// Used by /roxjaya/race-planner/ (all cities, tabbed) and /roxjaya/hyrox-jakarta/ (one city).
(function () {
  const root = document.getElementById("planner");
  if (!root) return;
  const only = root.dataset.city || "";
  const tabsEl = document.getElementById("city-tabs");
  const seasonEl = document.getElementById("season-list");
  const nextEl = document.getElementById("next-race");

  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const list = (items) =>
    `<ul class="plan-list">${(items || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
  const fmtDate = (iso) =>
    new Date(`${iso}T00:00:00+07:00`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
  const daysUntil = (iso) =>
    Math.ceil(
      (new Date(`${iso}T00:00:00+07:00`).getTime() - Date.now()) / 864e5,
    );

  function raceBlock(c, checked) {
    const r = c.race || {};
    let when;
    if (r.status === "confirmed" && r.start) {
      const d = daysUntil(r.start);
      when = `<p class="plan-when"><strong>${esc(r.dates)}</strong>${
        d > 0 ? ` <span class="plan-days">${d} days to go</span>` : ""
      }</p>`;
    } else {
      when = `<p class="plan-when plan-tbc"><strong>Date TBC</strong> ${esc(r.expected || "")}${
        r.last
          ? ` <span class="plan-last">Last edition: ${esc(r.last.dates)}${
              r.last.athletes ? `, ${esc(r.last.athletes)} athletes` : ""
            }.</span>`
          : ""
      }</p>`;
    }
    return `<div class="plan-race">
      <p class="eyebrow">${esc(r.name || "Race")}</p>
      ${when}
      <p class="plan-venue"><strong>${esc(r.venue || "")}</strong><br />${esc(r.address || "")}</p>
      <p class="plan-source">Source: <a href="${esc(r.source || "https://hyrox.com")}" rel="noopener" target="_blank">${esc(
        r.sourceLabel || "hyrox.com",
      )}</a> · checked ${esc(checked)}. Confirm on the official page before booking.</p>
    </div>`;
  }

  function hotelsBlock(hotels) {
    return `<div class="plan-cards">${(hotels || [])
      .map(
        (h) => `<div class="plan-card">
          <h4>${esc(h.area)}</h4>
          <p>${esc(h.picks)}</p>
          <p class="plan-range">${esc(h.range)}</p>
        </div>`,
      )
      .join("")}</div>`;
  }

  function flightsBlock(flights) {
    return `<div class="plan-table-wrap"><table class="plan-table">
      <thead><tr><th>From</th><th>Flight</th><th>Airlines</th><th>Approx. return</th></tr></thead>
      <tbody>${(flights || [])
        .map(
          (f) =>
            `<tr><td>${esc(f.from)}</td><td>${esc(f.time)}</td><td>${esc(f.airlines)}</td><td>${esc(f.fare)}</td></tr>`,
        )
        .join("")}</tbody></table></div>`;
  }

  function meetupBlock(m) {
    if (!m || !m.when) return "";
    return `<section class="plan-section plan-meetup" id="meetup">
      <h3>Warriors meet-up</h3>
      <p><strong>${esc(m.when)}</strong>${m.where ? ` · ${esc(m.where)}` : ""}</p>
      ${m.note ? `<p>${esc(m.note)}</p>` : ""}
      <a class="btn btn-primary" href="/roxjaya/#ask">Tell Dina you're coming</a>
    </section>`;
  }

  function renderCity(c, checked) {
    const stamp = `<p class="plan-stamp">Hotel, fare and food notes are pointers, not quotes — checked ${esc(
      checked,
    )}. Check live prices before you book.</p>`;
    return `<article class="plan-city" id="city-${esc(c.slug)}">
      <header class="plan-city-head">
        <h2><span aria-hidden="true">${esc(c.flag || "")}</span> ${esc(c.name)} <small>${esc(c.country)}</small></h2>
        <p class="lead">${esc(c.tagline)}</p>
      </header>
      ${raceBlock(c, checked)}
      <section class="plan-section" id="getting-there"><h3>Venue &amp; getting there</h3>${list(c.gettingThere)}</section>
      <section class="plan-section" id="hotels"><h3>Where to stay</h3>${hotelsBlock(c.hotels)}</section>
      <section class="plan-section" id="flights"><h3>Flights</h3>${flightsBlock(c.flights)}</section>
      <section class="plan-section" id="food"><h3>Athlete-friendly eating</h3>${list(c.food)}</section>
      <section class="plan-section" id="city"><h3>Around the city</h3>${list(c.city)}</section>
      <section class="plan-section" id="night-after"><h3>The night after</h3>${list(c.nightAfter)}</section>
      ${meetupBlock(c.meetup)}
      ${
        c.coachNote
          ? `<div class="callout plan-coach"><p><strong>Dina's note.</strong> ${esc(c.coachNote)}</p>
          <p><a class="btn btn-primary" href="/roxjaya/#plans">Train for ${esc(c.name)} with Dina</a> <a class="btn" href="/roxjaya/taper-zone/">Taper Zone guide</a></p></div>`
          : ""
      }
      ${stamp}
    </article>`;
  }

  function renderSeason(cities, home) {
    if (!seasonEl) return;
    const rows = cities
      .map((c) => ({ c, r: c.race || {} }))
      .filter(({ r }) => r.status === "confirmed" && r.start)
      .sort((a, b) => a.r.start.localeCompare(b.r.start));
    const tbc = cities.filter((c) => (c.race || {}).status !== "confirmed");
    const href = (c) =>
      c.slug === home
        ? "/roxjaya/hyrox-jakarta/"
        : `/roxjaya/race-planner/#${c.slug}`;
    seasonEl.innerHTML =
      rows
        .map(
          ({ c, r }) => `<li class="event">
          <time datetime="${esc(r.start)}">${esc(r.dates)}</time>
          <div><h4><a href="${href(c)}">${esc(r.name)}</a></h4><p>${esc(r.venue)} · ${
            daysUntil(r.start) > 0
              ? `${daysUntil(r.start)} days to go`
              : "this week"
          }</p></div></li>`,
        )
        .join("") +
      tbc
        .map(
          (c) => `<li class="event">
          <time>Date TBC</time>
          <div><h4><a href="${href(c)}">${esc(c.race.name)}</a></h4><p>${esc(c.race.expected || "Awaiting the official date.")}</p></div></li>`,
        )
        .join("");
    if (nextEl && rows.length) {
      const { c, r } = rows[0];
      nextEl.hidden = false;
      nextEl.innerHTML = `<p class="eyebrow">Next confirmed race in the region</p>
        <h3><a href="${href(c)}">${esc(r.name)}</a></h3>
        <p><strong>${daysUntil(r.start)}</strong> days · ${esc(fmtDate(r.start))} · ${esc(r.venue)}</p>`;
    }
  }

  function renderTabs(cities, home, active) {
    if (!tabsEl) return;
    tabsEl.innerHTML = cities
      .map((c) =>
        c.slug === home
          ? `<a class="city-tab" href="/roxjaya/hyrox-jakarta/">${esc(c.flag || "")} ${esc(c.name)} <small>home race →</small></a>`
          : `<button type="button" class="city-tab${c.slug === active ? " is-active" : ""}" data-slug="${esc(c.slug)}" aria-pressed="${
              c.slug === active
            }">${esc(c.flag || "")} ${esc(c.name)}</button>`,
      )
      .join("");
  }

  fetch("/roxjaya/data/cities.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const cities = Array.isArray(json?.cities) ? json.cities : [];
      const checked = String(json?.checked || "");
      const home = String(json?.home || "jakarta");
      if (!cities.length) throw new Error("no cities");

      if (only) {
        const c = cities.find((x) => x.slug === only);
        root.innerHTML = c
          ? renderCity(c, checked)
          : `<p class="callout">City guide coming soon.</p>`;
        return;
      }

      renderSeason(cities, home);
      const away = cities.filter((c) => c.slug !== home);
      const fromHash = location.hash.replace(/^#/, "");
      let active = away.some((c) => c.slug === fromHash)
        ? fromHash
        : away[0].slug;
      const show = (slug) => {
        active = slug;
        const c = away.find((x) => x.slug === slug) || away[0];
        root.innerHTML = renderCity(c, checked);
        renderTabs(cities, home, active);
      };
      show(active);
      tabsEl?.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-slug]");
        if (!b) return;
        history.replaceState(null, "", `#${b.dataset.slug}`);
        show(b.dataset.slug);
        const nav = document.querySelector(".nav");
        const offset = (nav ? nav.getBoundingClientRect().height : 0) + 16;
        const top = root.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
      });
      window.addEventListener("hashchange", () => {
        const s = location.hash.replace(/^#/, "");
        if (away.some((c) => c.slug === s)) show(s);
      });
    })
    .catch(() => {
      const msg = `<p class="callout">Couldn't load the city guides just now — try again in a moment, or check <a href="https://hyrox.com/events/" rel="noopener">hyrox.com</a> for dates.</p>`;
      root.innerHTML = msg;
      if (seasonEl) seasonEl.innerHTML = msg;
      if (nextEl) nextEl.hidden = true;
    });
})();
