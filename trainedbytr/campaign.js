(() => {
  const panel = document.getElementById("next-campaign");
  if (!panel) return;
  const $ = id => document.getElementById(id);
  const form = $("campaign-form"), review = $("campaign-review"), approved = $("campaign-approved"), launch = $("campaign-launch");
  let offers = [], photoURL = "", ready = false;
  const status = text => { $("campaign-status").textContent = text; };
  const safeURL = value => { try { const u = new URL(value, location.origin); return u.protocol === "https:" || (u.origin === location.origin && u.protocol === location.protocol) ? u.href : ""; } catch { return ""; } };
  const trackedURL = (value, offer) => {
    const raw = safeURL(value);
    if (!raw) return "";
    const url = new URL(raw);
    const platform = $("campaign-platform").value;
    url.searchParams.set("utm_source", platform === "All platforms" ? "multi_social" : platform.toLowerCase().split(/[ &,]+/).filter(Boolean)[0] || "campaign");
    url.searchParams.set("utm_medium", platform === "All platforms" || platform.includes("YouTube") ? "paid_social_video" : "paid_social");
    url.searchParams.set("utm_campaign", $("campaign-event").value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    url.searchParams.set("utm_content", offer.id);
    return url.href;
  };
  const selected = () => offers.find(o => o.id === $("campaign-offer").value);
  const leadKey = "trainedbytr-campaign-leads";
  const historyKey = "trainedbytr-campaign-history";
  const campaignLeads = () => { try { return JSON.parse(localStorage.getItem(leadKey) || "[]"); } catch { return []; } };
  const saveCampaignLeads = leads => localStorage.setItem(leadKey, JSON.stringify(leads));
  const campaignHistory = () => { try { return JSON.parse(localStorage.getItem(historyKey) || "[]"); } catch { return []; } };
  const saveCampaignHistory = campaigns => localStorage.setItem(historyKey, JSON.stringify(campaigns));
  function renderHistory() {
    const panel = $("campaign-history"), list = $("campaign-history-list"), campaigns = campaignHistory(), leads = campaignLeads();
    if (!panel || !list) return;
    panel.hidden = !campaigns.length;
    list.replaceChildren(...campaigns.slice().reverse().map(campaign => {
      const related = leads.filter(lead => lead.campaignId === campaign.id);
      const replied = related.filter(lead => ["Replied","Booked","Converted"].includes(lead.status)).length;
      const booked = related.filter(lead => ["Booked","Converted"].includes(lead.status)).length;
      const sales = related.filter(lead => lead.status === "Converted").length;
      const card = document.createElement("article");
      card.className = "campaign-history-card";
      card.innerHTML = `<strong></strong><p></p><p></p><p></p><span></span>`;
      card.querySelector("strong").textContent = `${campaign.name} · ${campaign.context}`;
      card.querySelectorAll("p")[0].textContent = `${campaign.dates} · ${campaign.platforms} · ${campaign.budget}`;
      const clicks = campaign.clicks || 0, audience = campaign.audience || "Audience tracking";
      card.querySelectorAll("p")[1].textContent = `${clicks} link clicks · ${audience}`;
      const replyRate = related.length ? Math.round((replied / related.length) * 100) : 0;
      const bookedRate = related.length ? Math.round((booked / related.length) * 100) : 0;
      card.querySelectorAll("p")[2].textContent = `${related.length} ${related.length === 1 ? "enquiry" : "enquiries"} · ${replied} replied (${replyRate}%) · ${booked} booked (${bookedRate}%) · ${sales} ${sales === 1 ? "sale" : "sales"}`;
      card.querySelector("span").textContent = sales ? "Sale attributed" : booked ? "Booked conversation" : replied ? "Replied" : "Awaiting response";
      return card;
    }));
  }
  function renderResponses() {
    const panel = $("campaign-responses"), list = $("campaign-response-list"), leads = campaignLeads();
    if (!panel || !list) return;
    panel.hidden = !leads.length;
    list.replaceChildren(...leads.slice().reverse().map(lead => {
      const card = document.createElement("article");
      card.className = "campaign-response-card";
      const name = document.createElement("strong"); name.textContent = `${lead.name} · ${lead.origin}`;
      const message = document.createElement("p"); message.textContent = lead.message;
      const statusLabel = document.createElement("span"); statusLabel.textContent = lead.status;
      const open = document.createElement("a"); open.href = `/trainedbytr/leads.html?audience=coach&lead=${encodeURIComponent(lead.id)}`; open.textContent = "Open enquiry";
      card.append(name,message,statusLabel,open);
      return card;
    }));
    window.deskCap?.(list, { noun: "enquiries", limit: 5 });
  }
  function campaignCopy(offer) {
    const brief = $("campaign-brief").value.trim().replace(/\s+/g, " ");
    const context = $("campaign-event").value.trim();
    const location = $("campaign-location").value.trim();
    const audience = $("campaign-audience").value.trim();
    const lower = `${brief} ${audience}`.toLowerCase();
    const wantsStations = /station|sled|wall ball|roxzone/.test(lower);
    const wantsPacing = /pace|pacing|start|fast|slow|blow|fade|finish/.test(lower);
    const wantsFirstRace = /first|beginner|new|nerv/.test(lower);
    const headline = wantsPacing
      ? "Start controlled. Finish stronger."
      : wantsStations
        ? "Run strong. Finish stronger at the stations."
        : wantsFirstRace
          ? "Your first HYROX starts with the right plan."
          : `${context}: turn intent into a start line.`;
    const angle = wantsPacing
      ? `For ${location} athletes who go out hot and pay for it later, ${offer.name} builds pacing discipline, station control and confidence for ${context}.`
      : wantsStations
        ? `For ${location} athletes who can run but lose time under fatigue, ${offer.name} targets the part of race day that decides the result.`
        : wantsFirstRace
          ? `For ${location} athletes eyeing their first start line, ${offer.name} turns race-day nerves into a clear, coach-led plan.`
          : `For ${location} athletes ready for ${context}, ${offer.name} gives the next step structure, accountability and a clear route in.`;
    const support = wantsPacing
      ? "The win is not being fastest through the opening run. It is knowing how to hold back early, keep moving through the stations and still have something left when everyone else fades."
      : "This is not about doing more for the sake of it. It is about training with intent, knowing what to fix first and arriving with a plan you trust.";
    const caption = `${headline}\n\n${angle}\n\n${support}\n\nApply through Tom's verified route and take the next step before race week arrives.`;
    const story = `${headline}\n${angle}\n\nTap through to apply — Tom will help you choose the right starting point.`;
    return { headline, caption, story, support };
  }
  function renderCopy() {
    $("campaign-feed-title").textContent = $("campaign-headline").value;
    $("campaign-feed-copy").textContent = $("campaign-caption").value;
    $("campaign-story-preview").textContent = $("campaign-story-copy").value;
    const platforms = $("campaign-platform").value;
    const all = platforms === "All platforms";
    const social = all || platforms.includes("Instagram") || platforms.includes("Facebook");
    $("campaign-feed-preview").hidden = !social;
    $("campaign-story-preview-card").hidden = !social;
    const tiktok = $("campaign-tiktok-preview"), youtube = $("campaign-youtube-preview");
    if (tiktok) {
      tiktok.hidden = !(all || platforms.includes("TikTok"));
      $("campaign-tiktok-title").textContent = $("campaign-headline").value;
      $("campaign-tiktok-copy").textContent = `${$("campaign-story-copy").value}\n\nVertical video concept: coach-led opening hook, quick race-floor proof, then the application route.`;
    }
    if (youtube) {
      youtube.hidden = !(all || platforms.includes("YouTube"));
      $("campaign-youtube-title").textContent = $("campaign-headline").value;
      $("campaign-youtube-copy").textContent = `${$("campaign-caption").value}\n\nVideo concept: 20–30 second coach explainer with the application link in the end card.`;
    }
  }
  function invalidate(event) {
    if (event.target === approved) return;
    approved.checked = false;
    launch.disabled = true;
    launch.textContent = "Simulate launch";
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
    const destination = trackedURL(offer.destination, offer);
    if (!destination) { status("This offer needs a valid destination before it can be prepared."); return; }
    const summary = $("campaign-summary");
    summary.replaceChildren();
    for (const [label, value] of [["Offer",offer.name],["Context",$("campaign-event").value],["Dates",`${$("campaign-start").value} to ${$("campaign-end").value}`],["Budget",`${$("campaign-budget").value} GBP maximum`],["Location",$("campaign-location").value],["Audience",$("campaign-audience").value],["Platforms",$("campaign-platform").value],["Goal",offer.goal],["Tracked outcomes","Clicks · enquiries · replies · bookings · sales"],["Destination",destination]]) {
      const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = label; dd.textContent = value; summary.append(dt,dd);
    }
    const copy = campaignCopy(offer);
    $("campaign-headline").value = copy.headline;
    $("campaign-caption").value = copy.caption;
    $("campaign-story-copy").value = copy.story;
    const image = photoURL || safeURL(offer.image);
    if (!image) { status("Choose a valid offer photo before preparing the draft."); return; }
    $("campaign-feed-photo").src = image;
    $("campaign-story-photo").src = image;
    $("campaign-tiktok-photo").src = image;
    $("campaign-youtube-photo").src = image;
    $("campaign-destination").href = destination;
    $("campaign-destination").textContent = "Check tracked destination ↗";
    approved.checked = false; launch.disabled = true; ready = true; review.hidden = false; $("campaign-outcome").hidden = true;
    renderCopy(); status("Draft ready. Review the details, photo, copy and destination.");
    review.scrollIntoView({behavior:"smooth",block:"start"});
  });
  launch.addEventListener("click", () => {
    if (!ready || !approved.checked) return;
    const offer = selected();
    const leads = campaignLeads();
    const campaigns = campaignHistory();
    const campaignId = `campaign-${Date.now()}`;
    campaigns.push({
      id: campaignId,
      name: offer ? offer.name : "Campaign",
      context: $("campaign-event").value,
      dates: `${$("campaign-start").value} to ${$("campaign-end").value}`,
      budget: `${$("campaign-budget").value} GBP maximum`,
      platforms: $("campaign-platform").value,
      audience: `${$("campaign-location").value} · ${$("campaign-audience").value}`,
      clicks: 18,
      launched: new Date().toISOString()
    });
    saveCampaignHistory(campaigns);
    leads.push({
      id: `lead-${Date.now()}`,
      campaignId,
      campaignLead: true,
      name: "Amelia R.",
      source: offer ? offer.name : "Campaign enquiry",
      origin: `${$("campaign-event").value} · ${$("campaign-platform").value} · ${$("campaign-audience").value}`,
      originURL: offer ? trackedURL(offer.destination, offer) : "/trainedbytr/coaching.html",
      received: "Just now",
      status: "New",
      message: "Saw the campaign and wants to know whether this is the right starting point for their first race.",
      reply: "Thanks for reaching out off the back of the campaign. The best next step is a quick chat about where you are now, what you’re aiming at and what feels hardest at the moment — then I can point you to the right route rather than guessing.",
      sentReply: ""
    });
    saveCampaignLeads(leads);
    renderResponses();
    renderHistory();
    $("campaign-outcome").innerHTML = `Campaign launched in this walkthrough. <span class="campaign-launch-state">1 new enquiry landed in the Lead Desk</span>`;
    $("campaign-outcome").hidden = false;
    launch.textContent = "Launched";
    launch.disabled = true;
    approved.checked = false;
    ready = false;
    $("campaign-responses").scrollIntoView({behavior:"smooth",block:"nearest"});
  });
  addEventListener("storage", () => { renderResponses(); renderHistory(); });
  renderResponses();
  renderHistory();
  fetch("/trainedbytr/data/campaign-offers.json", {cache:"no-cache"}).then(r => r.ok ? r.json() : Promise.reject(new Error("load"))).then(data => {
    offers = (data.offers || []).filter(o => o.id && o.name && safeURL(o.destination) && safeURL(o.image));
    if (!offers.length) throw new Error("offers");
    $("campaign-offer").replaceChildren(...offers.map(o => { const option = document.createElement("option"); option.value = o.id; option.textContent = o.name; return option; }));
    status("Choose an offer to start your promotion.");
  }).catch(() => { status("Campaign offers need a valid photo and destination before this preview can run."); $("campaign-build").disabled = true; });
  addEventListener("pagehide", () => { if (photoURL) URL.revokeObjectURL(photoURL); });
})();
