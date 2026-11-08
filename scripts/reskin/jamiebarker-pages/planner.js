// the UK Race Planner — renders city guides from jamiebarker/data/cities.json.
// Used by /jamiebarker/race-planner/ (all cities, tabbed) and /jamiebarker/hyrox-london/ (one city).
(function () {
  const root = document.getElementById("planner");
  const cards = document.getElementById("race-cards");
  const season = document.getElementById("season-list");
  const tabs = document.getElementById("city-tabs");
  if (!root && !cards && !season) return;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const when = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
  const list = items => `<ul class="plan-list">${(items || []).map(s => `<li>${esc(s)}</li>`).join("")}</ul>`;
  const source = c => `<a href="${esc(c.race.source)}" target="_blank" rel="noopener">Official event and venue information</a>`;
  const section = (title, html) => html ? `<section class="plan-section"><h3>${title}</h3>${html}</section>` : "";
  function city(c) {
    const hotels = (c.hotels || []).map(h => `<div class="plan-card"><h4>${esc(h.area)}</h4><p>${esc(h.picks)}</p><p class="plan-range">${esc(h.range)}</p></div>`).join("");
    return `<article class="plan-city" id="city-${esc(c.slug)}"><header class="plan-city-head"><h2>${esc(c.name)} <small>${esc(c.country)}</small></h2><p class="lead">${esc(c.tagline)}</p></header><div class="plan-race"><p class="eyebrow">${esc(c.race.name)}</p><p class="plan-when"><strong>${esc(when(c.race.start))} – ${esc(when(c.race.end || c.race.start))}</strong></p>${source(c)}</div>${section("Venue &amp; getting there", c.gettingThere?.length ? list(c.gettingThere) : "")}${section("Where to stay", hotels ? `<div class="plan-cards">${hotels}</div>` : "")}${section("Athlete-friendly eating", c.food?.length ? list(c.food) : "")}${section("After the finish", c.nightAfter?.length ? list(c.nightAfter) : "")}<p><a class="btn btn-primary" href="/jamiebarker/find-a-partner.html">Find a race-mate</a> <a class="btn btn-ghost" href="/jamiebarker/race-crew.html">Plan with the crew</a></p></article>`;
  }
  fetch("/jamiebarker/data/cities.json", {cache:"no-cache"}).then(r => r.ok ? r.json() : Promise.reject(new Error("load"))).then(data => {
    const today = new Date().toISOString().slice(0, 10);
    const cities = (data.cities || []).filter(c => c.race?.status === "confirmed" && c.race.start && c.race.start >= today && /^https:\/\//.test(c.race.source || ""));
    if (!cities.length) throw new Error("No confirmed upcoming races");
    if (cards) cards.innerHTML = cities.slice(0,3).map(c => `<div class="event"><div class="date"><strong><time datetime="${esc(c.race.start)}">${esc(when(c.race.start))}</time></strong><span>${esc(c.name)}</span></div><div><h4>${esc(c.race.name)}</h4><p>${esc(c.race.dates || when(c.race.start))} · ${esc(c.country)}</p>${source(c)}</div><a class="btn btn-ghost" href="/jamiebarker/events.html#${esc(c.slug)}">Plan the weekend</a></div>`).join("");
    if (season) season.innerHTML = cities.map(c => `<li class="event"><time datetime="${esc(c.race.start)}">${esc(c.race.dates || when(c.race.start))}</time><div><h4><a href="#${esc(c.slug)}">${esc(c.race.name)}</a></h4><p>${esc(c.country)} · ${source(c)}</p><p><a href="#${esc(c.slug)}">Plan this race weekend →</a></p></div></li>`).join("");
    const stamp = document.getElementById("race-checked");
    if (stamp) stamp.textContent = `Official listings checked ${when(data.checked)}. Check current entry availability with the organiser.`;
    if (!root) return;
    let active = cities[0].slug;
    function show(slug, scroll = false) {
      const c = cities.find(c => c.slug === slug) || cities[0];
      active = c.slug;
      root.innerHTML = city(c);
      if (tabs) tabs.innerHTML = cities.map(c => `<button class="city-tab${c.slug === active ? " is-active" : ""}" type="button" data-slug="${esc(c.slug)}" aria-pressed="${c.slug === active}">${esc(c.name)}</button>`).join("");
      if (scroll) root.scrollIntoView({behavior:"smooth",block:"start"});
    }
    show(root.dataset.city || location.hash.slice(1));
    tabs?.addEventListener("click", e => { const button = e.target.closest("button[data-slug]"); if (!button) return; history.replaceState(null, "", `#${button.dataset.slug}`); show(button.dataset.slug); });
    addEventListener("hashchange", () => { const slug = location.hash.slice(1); if (cities.some(c => c.slug === slug)) show(slug, true); });
    if (cities.some(c => c.slug === location.hash.slice(1))) root.scrollIntoView({block:"start"});
  }).catch(() => {
    const message = '<p class="callout">Race information needs refreshing. <a href="https://hyrox.com/find-my-race/" target="_blank" rel="noopener">Browse confirmed races with HYROX</a>.</p>';
    if (root) root.innerHTML = message;
    if (season) season.innerHTML = `<li>${message}</li>`;
  });
})();
