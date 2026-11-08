(() => {
  const panel = document.getElementById("next-campaign");
  if (!panel) return;
  const $ = id => document.getElementById(id);
  const form = $("campaign-form"), review = $("campaign-review"), approved = $("campaign-approved"), launch = $("campaign-launch");
  let offers = [], photoURL = "", ready = false;
  const status = text => { $("campaign-status").textContent = text; };
  const safeURL = value => { try { const u = new URL(value, location.origin); return u.protocol === "https:" || (u.origin === location.origin && u.protocol === location.protocol) ? u.href : ""; } catch { return ""; } };
  const selected = () => offers.find(o => o.id === $("campaign-offer").value);
  function renderCopy() {
    $("campaign-feed-title").textContent = $("campaign-headline").value;
    $("campaign-feed-copy").textContent = $("campaign-caption").value;
    $("campaign-story-preview").textContent = $("campaign-story-copy").value;
  }
  function invalidate(event) {
    if (event.target === approved) return;
    approved.checked = false;
    launch.disabled = true;
    $("campaign-outcome").hidden = true;
    if (form.contains(event.target)) { ready = false; review.hidden = true; }
    else if (review.contains(event.target)) renderCopy();
  }
  panel.addEventListener("input", invalidate);
  panel.addEventListener("change", invalidate);
  approved.addEventListener("change", () => { launch.disabled = !ready || !approved.checked; });
  $("campaign-photo").addEventListener("change", () => {
    if (photoURL) URL.revokeObjectURL(photoURL);
    photoURL = "";
    const file = $("campaign-photo").files[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      $("campaign-photo").value = "";
      status("Choose a JPG, PNG or WebP image up to 10 MB.");
      return;
    }
    photoURL = URL.createObjectURL(file);
    status("Your new photo is ready for the draft.");
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const offer = selected();
    if (!offer || !form.reportValidity()) return;
    if ($("campaign-end").value < $("campaign-start").value) { status("Choose an end date on or after the start date."); return; }
    const destination = safeURL(offer.destination);
    if (!destination) { status("This offer needs a valid destination before it can be prepared."); return; }
    const summary = $("campaign-summary");
    summary.replaceChildren();
    for (const [label, value] of [["Offer",offer.name],["Context",$("campaign-event").value],["Dates",`${$("campaign-start").value} to ${$("campaign-end").value}`],["Budget",`${$("campaign-budget").value} GBP maximum`],["Audience",$("campaign-location").value],["Platforms",$("campaign-platform").value],["Goal",offer.goal],["Destination",destination]]) {
      const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = label; dd.textContent = value; summary.append(dt,dd);
    }
    $("campaign-headline").value = offer.headline;
    $("campaign-caption").value = $("campaign-brief").value.trim();
    $("campaign-story-copy").value = `${offer.headline}\n${$("campaign-brief").value.trim()}`;
    const image = photoURL || safeURL(offer.image);
    if (!image) { status("Choose a valid offer photo before preparing the draft."); return; }
    $("campaign-feed-photo").src = image;
    $("campaign-story-photo").src = image;
    $("campaign-destination").href = destination;
    $("campaign-destination").textContent = `Check destination: ${destination}`;
    approved.checked = false; launch.disabled = true; ready = true; review.hidden = false; $("campaign-outcome").hidden = true;
    renderCopy(); status("Draft ready. Review the details, photo, copy and destination.");
    review.scrollIntoView({behavior:"smooth",block:"start"});
  });
  launch.addEventListener("click", () => {
    if (!ready || !approved.checked) return;
    $("campaign-outcome").hidden = false;
    launch.disabled = true;
    approved.checked = false;
    ready = false;
  });
  fetch("/jamiebarker/data/campaign-offers.json", {cache:"no-cache"}).then(r => r.ok ? r.json() : Promise.reject(new Error("load"))).then(data => {
    offers = (data.offers || []).filter(o => o.id && o.name && safeURL(o.destination) && safeURL(o.image));
    if (!offers.length) throw new Error("offers");
    $("campaign-offer").replaceChildren(...offers.map(o => { const option = document.createElement("option"); option.value = o.id; option.textContent = o.name; return option; }));
    status("Choose an offer to start your promotion.");
  }).catch(() => { status("Campaign offers need a valid photo and destination before this preview can run."); $("campaign-build").disabled = true; });
  addEventListener("pagehide", () => { if (photoURL) URL.revokeObjectURL(photoURL); });
})();
