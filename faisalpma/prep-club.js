/* Prep Club — public nurture layer.
   Feed items live in data/desk/prep-club-feed.json; joins and signals
   land on the shared ContactStore record via Integrations. */
(async () => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[char]));

  await DeskConfig.ready;
  const feed = DeskConfig.get("prepClubFeed") || [];
  const templates = (DeskConfig.get("templates") || {}).prepClub || {};
  const rules = (DeskConfig.get("settings") || {}).readiness || { hotGoalKeywords: ["programme","coaching","structure"], warmSignals: 2, newSignals: 3 };

  // The club member is a contact record now. Local object mirrors the
  // member slice for fast page state; ContactStore is the source of truth.
  const member = { joined: false, email: "", name: "", experience: "", goal: "", actions: [] };
  const storedMember = ContactStore.contacts.find(c => c.member && c.member.joined);
  if (storedMember) Object.assign(member, storedMember.member);

  const track = (signal, hot = false) => {
    if (!member.actions.some(item => item.signal === signal)) member.actions.push({ signal, at: new Date().toISOString(), hot });
    else if (hot) member.actions.find(item => item.signal === signal).hot = true;
    if (member.email) {
      ContactStore.upsertMember(member);
      ContactStore.logEvent({ email: member.email }, "signal", signal);
    }
  };

  const usefulActions = () => member.actions.length;
  const readiness = () => {
    const hotGoal = member.goal && rules.hotGoalKeywords.some(k => member.goal.toLowerCase().includes(k));
    if (!member.joined) return usefulActions() >= rules.newSignals ? "Warm" : "New";
    if (member.actions.some(item => item.hot) || hotGoal) return "Hot";
    return usefulActions() >= rules.warmSignals ? "Warm" : "New";
  };
  const summary = () => member.actions.slice(0, 4).map(item => item.signal).join(", ") || "joined before using tools";
  const fill = (tpl = "") => tpl.replaceAll("{name}", member.name || "them").replaceAll("{goal}", (member.goal || "").toLowerCase());

  async function queueLead() {
    const hot = readiness() === "Hot";
    await Integrations.captureLead({
      name: member.name,
      email: member.email,
      source: "Prep Club",
      origin: "HYROX Prep Club · join form",
      originURL: "/faisalpma/prep-club.html",
      message: `Joined Prep Club · ${member.experience} · wants to ${member.goal.toLowerCase()}. Signals: ${summary()}.`,
      reply: hot ? templates.hotReply : templates.warmReply
    });
    // Readiness + nudge land on the same contact record the lead lives on.
    const contact = ContactStore.find({ email: member.email });
    if (contact) {
      contact.lead.readiness = readiness();
      contact.lead.readinessReason = `${usefulActions()} engagement signal${usefulActions() === 1 ? "" : "s"}: ${summary()}`;
      contact.lead.nudge = fill(hot ? templates.hotNudge : templates.warmNudge);
      ContactStore.save();
      ContactStore.logEvent({ email: member.email }, "readiness", contact.lead.readiness);
    }
  }

  function renderFeed() {
    const week = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
    const items = [...feed.slice(week % feed.length), ...feed.slice(0, week % feed.length)].slice(0, 6);
    $("prep-feed").innerHTML = items.map(item => `
      <article class="feed-card reveal">
        <img src="${item.img}" alt="" loading="lazy" />
        <div><span>${esc(item.type)}</span><h4>${esc(item.title)}</h4><p>${esc(item.copy)}</p><a href="${item.href}" data-prep-action="${esc(item.signal)}" data-hot="${item.hot ? "true" : "false"}">${esc(item.cta)} →</a></div>
      </article>
    `).join("");
    window.revealScan?.();
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("[data-prep-action]");
    if (link) track(link.dataset.prepAction, link.dataset.hot === "true");
  });

  $("join-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    member.email = $("join-email").value.trim();
    member.name = $("join-name").value.trim() || member.email.split("@")[0];
    member.experience = $("join-experience").value;
    member.goal = $("join-goal").value;
    member.joined = true;
    track("Joined Prep Club");
    ContactStore.upsertMember(member);
    ContactStore.logEvent({ email: member.email }, "join", "Joined Prep Club");
    await queueLead();
    $("join-done").hidden = false;
    event.target.querySelector("button").disabled = true;
    event.target.querySelector("button").textContent = readiness() === "Hot" ? "Joined — Faisal can nudge the right route" : "Joined Prep Club";
  });

  renderFeed();
  if (member.joined) {
    $("join-email").value = member.email;
    $("join-name").value = member.name;
    $("join-experience").value = member.experience;
    $("join-goal").value = member.goal;
    $("join-done").hidden = false;
  }
})();
