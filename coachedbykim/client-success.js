(() => {
  const form = document.getElementById("success-form");
  if (!form) return;
  const $ = id => document.getElementById(`success-${id}`);
  let offers = {};
  fetch("/coachedbykim/data/campaign-offers.json", {cache:"no-cache"}).then(r => r.ok ? r.json() : Promise.reject(new Error("load"))).then(data => {
    const entries = (data.offers || []).filter(o => ["coaching", "programme"].includes(o.id) && o.name && /^https:\/\//.test(o.destination || ""));
    offers = Object.fromEntries(entries.map(o => [o.id, { name:o.name, url:o.destination }]));
    $("offer").replaceChildren(...entries.map(o => { const option = document.createElement("option"); option.value=o.id; option.textContent=o.name; return option; }));
    if (!entries.length) { $("status").textContent="Add a coaching offer and its enquiry link before preparing a client story."; form.querySelector('button[type="submit"]').disabled=true; }
  }).catch(() => { $("status").textContent="Coaching offers could not load. Refresh to try again."; form.querySelector('button[type="submit"]').disabled=true; });
  const photos = new Map();
  const approvals = [$("consent"), $("verified"), $("approved")];
  let prepared = false;
  const updateActions = () => {
    const ready = prepared && approvals.every(input => input.checked);
    $("schedule").disabled = $("copy").disabled = !ready;
    return ready;
  };
  const resetApproval = () => {
    approvals.forEach(input => { input.checked = false; });
    $("outcome").hidden = true;
    updateActions();
  };
  const renderCopy = () => {
    $("feed-title").textContent = $("headline").value;
    $("feed-copy").textContent = $("caption").value;
    $("story-copy").textContent = $("story").value;
  };
  form.addEventListener("input", () => { prepared = false; resetApproval(); $("review").hidden = true; $("status").textContent = ""; });
  form.addEventListener("change", () => { prepared = false; resetApproval(); $("review").hidden = true; });
  for (const phase of ["before", "after"]) {
    const input = $("photo-" + phase);
    input.addEventListener("change", () => {
      input.setCustomValidity("");
      if (photos.has(phase)) URL.revokeObjectURL(photos.get(phase));
      photos.delete(phase);
      const file = input.files[0];
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
        input.setCustomValidity("Choose a JPG, PNG or WebP up to 5 MB."); input.reportValidity(); return;
      }
      photos.set(phase, URL.createObjectURL(file));
    });
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const offer = offers[$("offer").value];
    if (!offer) return;
    const name = $("name").value.trim(), period = $("period").value.trim(), result = $("result").value.trim(), quote = $("quote").value.trim();
    if (!name || !period || !result) { $("status").textContent = "Add a client-approved display name, timeframe and actual result."; return; }
    $("headline").value = `${name} · ${$("focus").value}`.slice(0, 100);
    $("caption").value = `${name} · ${offer.name}\n${period}\n\n${result}${quote ? `\n\n“${quote}”` : ""}\n\nExplore ${offer.name}:\n${offer.url}\n\nAn individual client story, shared with permission. Results vary.`;
    $("story").value = `${name}\n${period}\n${result}\n\nExplore ${offer.name} through the link sticker.\nIndividual results vary.`;
    $("summary").textContent = `${offer.name} · ${$("channel").value} · planned for ${$("date").value}`;
    $("destination").href = offer.url;
    $("destination").textContent = `Check ${offer.name} enquiry form ↗`;
    $("images").replaceChildren();
    for (const [phase, url] of photos) {
      const figure = document.createElement("figure"), image = document.createElement("img"), caption = document.createElement("figcaption");
      image.src = url; image.alt = phase === "before" ? "Client-approved starting photo" : "Client-approved latest photo";
      caption.textContent = phase === "before" ? "Starting photo" : "Latest photo";
      figure.append(image, caption); $("images").append(figure);
    }
    prepared = true; resetApproval(); renderCopy(); $("review").hidden = false;
    $("status").textContent = "Draft ready. Review the story and confirm the client’s permission before copying or planning to share it.";
    $("review").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  for (const name of ["headline", "caption", "story"]) $(name).addEventListener("input", () => { resetApproval(); renderCopy(); });
  approvals.forEach(input => input.addEventListener("change", () => { $("outcome").hidden = true; updateActions(); }));
  $("schedule").addEventListener("click", () => {
    if (!updateActions()) return;
    $("outcome").textContent = `Sharing plan ready: ${$("summary").textContent}. Your approved draft is ready to take to your social tools. Nothing has been posted or scheduled externally.`;
    $("outcome").hidden = false;
  });
  $("copy").addEventListener("click", async () => {
    if (!updateActions()) return;
    try { await navigator.clipboard.writeText($("caption").value); $("status").textContent = "Approved caption copied. Add the approved imagery and destination in your social tools."; }
    catch { $("caption").focus(); $("caption").select(); $("status").textContent = "Select and copy the approved caption above."; }
  });
  addEventListener("pagehide", () => { photos.forEach(url => URL.revokeObjectURL(url)); });
})();
