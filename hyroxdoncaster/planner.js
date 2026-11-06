// the UK Race Planner — renders city guides from hyroxdoncaster/data/cities.json.
// Used by /hyroxdoncaster/race-planner/ (all cities, tabbed) and /hyroxdoncaster/hyrox-london/ (one city).
(function () {
  const root = document.getElementById("planner");
  const cards = document.getElementById("race-cards");
  const season = document.getElementById("season-list");
  const tabs = document.getElementById("city-tabs");
  const prep = document.getElementById("race-prep");
  if (!root && !cards && !season && !prep) return;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const when = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
  const list = items => `<ul class="plan-list">${(items || []).map(s => `<li>${esc(s)}</li>`).join("")}</ul>`;
  const source = c => `<a href="${esc(c.race.source)}" target="_blank" rel="noopener">Official event and venue information</a>`;
  const section = (title, html) => html ? `<section class="plan-section"><h3>${title}</h3>${html}</section>` : "";
  function city(c) {
    const hotels = (c.hotels || []).map(h => `<div class="plan-card reveal"><h4>${esc(h.area)}</h4><p>${esc(h.picks)}</p><p class="plan-range">${esc(h.range)}</p></div>`).join("");
    return `<article class="plan-city" id="city-${esc(c.slug)}"><header class="plan-city-head"><h2>${esc(c.name)} <small>${esc(c.country)}</small></h2><p class="lead">${esc(c.tagline)}</p></header><div class="plan-race reveal"><p class="eyebrow">${esc(c.race.name)}</p><p class="plan-when"><strong>${esc(when(c.race.start))} – ${esc(when(c.race.end || c.race.start))}</strong></p>${source(c)}</div>${section("Venue &amp; getting there", c.gettingThere?.length ? list(c.gettingThere) : "")}${section("Where to stay", hotels ? `<div class="plan-cards">${hotels}</div>` : "")}${section("Athlete-friendly eating", c.food?.length ? list(c.food) : "")}${section("After the finish", c.nightAfter?.length ? list(c.nightAfter) : "")}<p><a class="btn btn-primary" href="/hyroxdoncaster/find-a-partner.html">Find a race-mate</a> <a class="btn btn-ghost" href="/hyroxdoncaster/race-crew.html">Plan with the crew</a></p></article>`;
  }
  fetch("/hyroxdoncaster/data/cities.json", {cache:"no-cache"}).then(r => r.ok ? r.json() : Promise.reject(new Error("load"))).then(data => {
    const today = new Date().toISOString().slice(0, 10);
    const cities = (data.cities || []).filter(c => c.race?.status === "confirmed" && c.race.start && c.race.start >= today && /^https:\/\//.test(c.race.source || ""));
    if (!cities.length) throw new Error("No confirmed upcoming races");
    if (prep) {
      const selected = cities.find(c => c.slug === new URLSearchParams(location.search).get("race"));
      if (selected) {
        const days = Math.max(0, Math.ceil((new Date(`${selected.race.start}T12:00:00Z`) - new Date()) / 86400000));
        prep.hidden = false;
        prep.innerHTML = `<p class="eyebrow">Your start line</p><h3>Prepare for ${esc(selected.race.name)}</h3><p>${esc(when(selected.race.start))} · ${days} days to go</p><p>${days >= 84 ? "There is time to explore a structured build. First race? Look at Six-week HYROX intro below, or ask Nigel about individual coaching." : days >= 21 ? "Your preparation needs to fit the weeks left and the training you already do. Ask Nigel about a focused approach rather than squeezing in a full programme." : "The race is close. Prioritise pacing, practical preparation and tapering rather than starting a new training block."}</p><div class="actions"><a class="btn btn-primary" href="/hyroxdoncaster/?race=${encodeURIComponent(selected.race.name)}&audience=public#ask">Ask Nigel about this race</a><a class="btn btn-ghost" href="/hyroxdoncaster/${days < 21 ? "taper-zone.html" : "prep-club.html"}">${days < 21 ? "Race-week guidance" : "Explore free preparation"}</a></div>`;
        prep.scrollIntoView({ block: "start" });
      }
    }
    if (cards) cards.innerHTML = [...cities].sort((a,b) => a.race.start.localeCompare(b.race.start)).slice(0,3).map(c => {
      const days = Math.max(0, Math.ceil((new Date(`${c.race.start}T12:00:00Z`) - new Date()) / 86400000));
      const prep = days >= 84 ? "Time for a structured build — explore a first-race programme or personal coaching." : days >= 21 ? "Make the remaining weeks count — ask Nigel which preparation fits your current training." : "Close to race day — focus on pacing, race-week preparation and a sensible taper.";
      return `<div class="event reveal"><div class="date"><strong><time datetime="${esc(c.race.start)}">${esc(when(c.race.start))}</time></strong><span>${esc(c.name)}</span><small>${days} days to go</small></div><div><h4>${esc(c.race.name)}</h4><p>${esc(c.race.dates || when(c.race.start))} · ${esc(c.country)}</p>${source(c)}<p class="event-prep">${prep}</p></div><div class="event-actions"><a class="btn btn-primary" href="/hyroxdoncaster/coaching.html?race=${encodeURIComponent(c.slug)}#race-prep">Prepare for this race</a><a class="btn btn-ghost" href="/hyroxdoncaster/find-a-partner.html?race=${encodeURIComponent(c.slug)}#partner-form">Find a partner for this race</a><a href="/hyroxdoncaster/events.html#${esc(c.slug)}">Plan the weekend →</a></div></div>`;
    }).join("");
    if (season) season.innerHTML = cities.map(c => `<li class="event reveal"><time datetime="${esc(c.race.start)}">${esc(c.race.dates || when(c.race.start))}</time><div><h4><a href="#${esc(c.slug)}">${esc(c.race.name)}</a></h4><p>${esc(c.country)} · ${source(c)}</p><p><a href="#${esc(c.slug)}">Plan this race weekend →</a></p></div></li>`).join("");
    const stamp = document.getElementById("race-checked");
    if (stamp) stamp.textContent = `Official listings checked ${when(data.checked)}. Check current entry availability with the organiser.`;
    window.revealScan?.();
    if (!root) return;
    let active = cities[0].slug;
    function show(slug, scroll = false) {
      const c = cities.find(c => c.slug === slug) || cities[0];
      active = c.slug;
      root.innerHTML = city(c);
      if (tabs) tabs.innerHTML = cities.map(c => `<button class="city-tab${c.slug === active ? " is-active" : ""}" type="button" data-slug="${esc(c.slug)}" aria-pressed="${c.slug === active}">${esc(c.name)}</button>`).join("");
      window.revealScan?.();
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
