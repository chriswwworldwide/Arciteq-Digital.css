(async () => {
  if (window.DeskConfig) await DeskConfig.ready;
  const store = window.ClientDeskStore;
  if (!store) return;
  const { clients, settings, save, esc, remaining, exactPrompt, exactFloorPrompt, attentionPlan, renewalGuidance, assetList, currentAsset, nextAsset, recommendedProgramme, progressionChecklist } = store;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const client = clients.find(item => item.id === params.get("client")) || clients[0];
  if (!client) return;
  let toastTimer;

  const bubble = (client, message, fallbackDirection = "in") => `
    <div class="bubble ${message.direction === "out" || fallbackDirection === "out" ? "outbound" : "inbound"}">
      <span>${message.direction === "out" || fallbackDirection === "out" ? "Marc · The Desk" : esc(client.name)}</span>
      <p>${esc(message.text)}</p>
    </div>`;

  const note = text => {
    client.messages = client.messages || [];
    client.messages.push({ direction: "out", text });
    client.lastContact = "Today";
    client.nextContact = client.floorDue || "Next check-in";
  };

  function showToast(message) {
    const toast = $("client-toast");
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.hidden = true, 3200);
  }

  function renderButtons() {
    client.sent = { early: false, final: false, followup: false, ...(client.sent || {}) };
    const buttons = { early: $("send-early"), final: $("send-final"), followup: $("send-followup") };
    [
      [buttons.early, "early", "Send early reminder"],
      [buttons.final, "final", "Send renew-today prompt"],
      [buttons.followup, "followup", "Send follow-up"]
    ].forEach(([button, stage, label]) => {
      const wasSent = Boolean(client.sent[stage]);
      button.textContent = wasSent ? "Sent" : label;
      button.disabled = wasSent || client.renewalStage === "none" || client.renewalStage === "renewed" || client.pauseAutomation || client.lifecycle !== "Active";
      button.classList.toggle("sent-action", wasSent);
    });
    const automationPaused = client.pauseAutomation || client.lifecycle !== "Active";
    if (client.renewalStage === "early") {
      buttons.final.disabled = automationPaused || !client.sent.early;
      buttons.followup.disabled = true;
    } else if (client.renewalStage === "final") {
      buttons.final.disabled = automationPaused || Boolean(client.sent.final);
      buttons.followup.disabled = automationPaused || !client.sent.final;
    } else if (client.renewalStage === "followup") {
      buttons.followup.disabled = automationPaused || Boolean(client.sent.followup);
    }
  }

  function renderProgrammeEvent() {
    const assets = assetList(client);
    const block = Math.max(1, Math.min(client.assetBlock || 1, assets.length));
    const recordOnly = client.lifecycle === "Archived";
    $("programme-summary").innerHTML = `
      <div><span>Programme</span><strong>${esc(client.plan)}</strong></div>
      <div><span>Content set</span><strong>Set ${block} · ${esc(currentAsset(client))}</strong></div>
      <div><span>Library source</span><strong>${esc(client.assetSource || "Coach library")}</strong></div>
      <div><span>Next renewal uses</span><strong>${esc(nextAsset(client))}</strong></div>
      <div><span>Recommended next</span><strong>${esc(recommendedProgramme(client))}</strong></div>
    `;
    $("asset-list").innerHTML = assets.map((asset, index) => `<li class="${index + 1 === block ? "is-current" : ""}">${esc(`Set ${index + 1} — ${asset}`)}</li>`).join("");
    $("progression-copy").textContent = `${client.progressionReview || "Not due"} · use this as a quick coach check, not a forced upsell.`;
    $("progression-list").innerHTML = progressionChecklist(client).map(item => `
      <div class="check-card ${item.pass ? "pass" : ""}"><span class="check-dot" aria-hidden="true"></span><strong>${esc(item.label)}</strong></div>
    `).join("");
    const event = client.eventGoal || {};
    $("event-goal").innerHTML = `
      <div><span>Next event</span><strong>${esc(event.event || "No event")}</strong></div>
      <div><span>Date</span><strong>${esc(event.date || "TBC")}</strong></div>
      <div><span>Target</span><strong>${esc(event.target || "Set target")}</strong></div>
      <div><span>Latest sim</span><strong>${esc(event.sim || "No sim yet")}</strong></div>
      <div><span>Status</span><strong>${esc(event.status || "Building base")}</strong></div>
      <div><span>Adaptation</span><strong>${esc(event.adaptation || "None set")}</strong></div>
    `;
    $("event-name").value = event.event || "";
    $("event-date").value = event.date || "";
    $("event-target").value = event.target || "";
    $("event-sim").value = event.sim || "";
    $("event-status").value = event.status || "Building base";
    $("event-adaptation").value = event.adaptation || "";
    $("race-tool").href = `/marcdean/predictor.html?audience=coach&client=${encodeURIComponent(client.name)}&event=${encodeURIComponent(event.event || "")}`;
    const WATCH_OPTIONS = ["SkiErg", "Sled Push", "Sled Pull", "Burpee Broad Jumps", "Rowing", "Farmers Carry", "Sandbag Lunges", "Wall Balls", "Compromised running", "Roxzone"];
    $("station-list").innerHTML = (client.stations || []).map((station, index) => `
      <div class="station-row" data-station-row="${index}">
        <strong>${esc(station.name)}</strong>
        <label><span>Status</span><select data-station-state><option value="good" ${station.state === "good" ? "selected" : ""}>Good</option><option value="watch" ${station.state === "watch" ? "selected" : ""}>Watch</option><option value="risk" ${station.state === "risk" ? "selected" : ""}>Risk</option></select></label>
        <label><span>Latest / note</span><input data-station-latest value="${esc(station.latest || "")}" placeholder="Latest marker" /><input data-station-note value="${esc(station.note || "")}" placeholder="Coach note" /></label>
        <button class="btn btn-ghost" type="button" data-station-remove="${index}" aria-label="Remove ${esc(station.name)} from watch list">×</button>
      </div>
    `).join("");
    const watched = new Set((client.stations || []).map(s => s.name.toLowerCase()));
    $("add-station").innerHTML = WATCH_OPTIONS.filter(name => !watched.has(name.toLowerCase())).map(name => `<option>${esc(name)}</option>`).join("");
    $("add-station-btn").disabled = recordOnly || $("add-station").options.length === 0;
    ["assign-next-assets", "progress-client", "save-event", "save-stations", "add-note"].forEach(id => { $(id).disabled = recordOnly; });
    document.querySelectorAll("[data-progression]").forEach(button => button.disabled = recordOnly);
  }

  function render() {
    document.title = `${client.name} | The Desk | MD HYROX`;
    $("client-title").textContent = `${client.name} · ${client.status}`;
    $("client-subtitle").textContent = `${client.plan} · ${client.note || ""}`;
    $("pause-client").textContent = client.lifecycle === "Archived" ? "Restore client" : client.pauseAutomation || client.lifecycle === "Paused" ? "Resume automation" : "Pause automation";
    $("archive-client").textContent = client.lifecycle === "Archived" ? "Restore client" : "Archive client";
    $("support-link").href = `mailto:chris@station9studio.co.uk?subject=${encodeURIComponent(`Client Desk support — ${client.name}`)}&body=${encodeURIComponent(`Client: ${client.name}\nProgramme: ${client.plan}\nStatus: ${client.status}\nPage: ${location.pathname}${location.search}\nWhat happened: `)}`;
    const intake = client.intake || (ContactStore.find({ email: client.email }) || {}).intake;
    $("intake-summary").textContent = intake ? `${intake.reviewed ? "Reviewed" : "Needs coach review"} · ${intake.at}. Health flags: ${(intake.flags || []).join(", ") || "None reported"}. ${intake.notes || ""}` : "Intake not submitted yet. Use the form link in the Intake card above.";
    $("review-intake").hidden = !intake || intake.reviewed;
    $("review-checkin").hidden = !client.checkinReviewPending;
    const usage = client.type === "monthly" ? `${client.daysRemaining} days left` : `${client.sessionsUsed}/${client.sessionsTotal} used`;
    $("client-detail").innerHTML = `
      <div><span>Package / subscription</span><strong>${esc(usage)}</strong></div>
      <div><span>Floor sessions</span><strong>${esc(`${client.floorUsed}/${client.floorTotal} this month`)}</strong></div>
      <div><span>Next floor session</span><strong>${esc(client.nextSession || client.floorDue)}</strong></div>
      <div><span>Online programme</span><strong>${esc(`${client.onlineDone}/${client.onlineTotal} done`)}</strong></div>
      <div><span>Check-in</span><strong>${esc(client.checkIn)}</strong></div>
      <div><span>Value / attendance</span><strong>${esc(`${client.value} · ${client.attendance}%`)}</strong></div>
      <div><span>Lifecycle</span><strong>${esc(client.lifecycle)}</strong></div>
      <div><span>Payment</span><strong>${esc(`${client.paymentStatus} · ${client.autoRenew ? "auto-renew" : "manual"}`)}</strong></div>
      <div><span>Next billing</span><strong>${esc(client.nextBilling)}</strong></div>
      <div><span>Preferred contact</span><strong>${esc(client.preferredContact)}</strong></div>
      <div><span>Contact</span><strong>${esc(client.email)}<br>${esc(client.phone)}</strong></div>
      <div><span>Source</span><strong>${esc(client.source)}</strong></div>
      <div><span>Booking state</span><strong>${esc(client.bookingState)}</strong></div>
      <div><span>Last contact</span><strong>${esc(client.lastContact)}</strong></div>
      <div><span>Next contact</span><strong>${esc(client.nextContact)}</strong></div>
      <div><span>Joined</span><strong>${esc(client.joined || "Recently")}</strong></div>
      <div><span>Intake</span><strong>${intake ? `On file · ${esc(intake.at)}${intake.flags && intake.flags.length ? " ⚠ " + esc(intake.flags.join(", ")) : ""}` : `Pending`}</strong>${intake ? "" : `<a href="/marcdean/intake.html" target="_blank" rel="noopener" style="font-size:.78rem;display:block;margin-top:.35rem">Open intake form ↗</a>`}</div>
      <div><span>Packages bought</span><strong>${esc(String(client.packagesBought || 1))}</strong></div>
      <div><span>Package path</span><strong>${esc(client.packagePath || client.plan)}</strong></div>
      <div><span>Package gap</span><strong>${esc(client.gap || "No recorded gap")}</strong></div>
    `;
    const attention = attentionPlan(client);
    $("attention-action-title").textContent = attention.title;
    $("attention-action-copy").textContent = attention.copy;
    $("attention-owner").textContent = attention.owner;
    const whatsapp = `https://wa.me/${client.phone || "4475550100"}?text=${encodeURIComponent(`Hi ${client.name.split(" ")[0]}, checking in on your ${client.plan} — how is everything feeling?`)}`;
    const actionHtml = {
      message: `<button class="btn btn-primary" data-attention="reply" type="button">Reply in Desk</button><a class="btn btn-ghost" href="${whatsapp}" target="_blank" rel="noopener">WhatsApp client</a><button class="btn btn-ghost" data-attention="handled" type="button">Mark handled</button>`,
      checkin: `<a class="btn btn-primary" href="${whatsapp}" target="_blank" rel="noopener">WhatsApp client</a><button class="btn btn-ghost" data-attention="checkin" type="button">Mark check-in received</button><button class="btn btn-ghost" data-attention="handled" type="button">Mark handled</button>`,
      floorStopped: `<a class="btn btn-primary" href="${whatsapp}" target="_blank" rel="noopener">WhatsApp client</a><button class="btn btn-ghost" data-attention="resume-floor" type="button">Resume auto reminder</button><button class="btn btn-ghost" data-attention="handled" type="button">Mark handled</button>`,
      renewal: `<button class="btn btn-primary" data-attention="renewal" type="button">Open renewal action</button><a class="btn btn-ghost" href="${whatsapp}" target="_blank" rel="noopener">WhatsApp client</a>`,
      floorPrompt: `<button class="btn btn-ghost" data-attention="floor" type="button">Open floor reminder</button>`,
      floorSent: `<button class="btn btn-ghost" data-attention="floor" type="button">Open floor reminder</button>`,
      payment: `<a class="btn btn-primary" href="${whatsapp}" target="_blank" rel="noopener">WhatsApp client</a><button class="btn btn-ghost" data-attention="payment" type="button">Mark payment resolved</button>`,
      progression: `<button class="btn btn-primary" data-attention="progression" type="button">Open progression check</button><a class="btn btn-ghost" href="${whatsapp}" target="_blank" rel="noopener">WhatsApp client</a>`,
      paused: `<button class="btn btn-primary" data-attention="resume-client" type="button">Resume client automation</button><a class="btn btn-ghost" href="${whatsapp}" target="_blank" rel="noopener">WhatsApp client</a>`,
      archived: `<button class="btn btn-primary" data-attention="resume-client" type="button">Restore client</button>`
    };
    $("attention-actions").innerHTML = actionHtml[attention.kind] || "";
    renderProgrammeEvent();
    $("client-timeline").innerHTML = (client.history || []).map(item => `
      <div class="timeline-item"><time>${esc(item.date)}</time><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div></div>
    `).join("");
    window.deskCap?.($("client-timeline"), { noun: "entries", limit: 5 });
    $("floor-title").textContent = `Floor-session reminder · ${client.floorPrompt}`;
    $("floor-copy").textContent = client.floorState === "stopped"
      ? "Automatic booking reminders are paused. Resume them when the client is ready to book again."
      : client.floorState === "sent"
        ? "The automatic booking reminder has gone out. Session totals update from completed bookings."
        : client.floorState === "booked"
          ? "The next gym-floor session is already booked. Completed bookings update usage automatically."
          : `Automatic reminder runs ${settings.floorDays} days before the next floor session unless stopped.`;
    $("floor-preview").innerHTML = `<strong>Client receives:</strong><br>${esc(exactFloorPrompt(client))}`;
    const lc = client.lastCheckin;
    $("checkin-summary").textContent = lc
      ? `Last: ${lc.at} — energy ${lc.energy.toLowerCase()}, sleep ${lc.sleep.toLowerCase()}, week ${lc.rpe.toLowerCase()}, niggles: ${lc.pain.toLowerCase()}${lc.note ? " — " + lc.note : ""}`
      : "No structured check-in logged yet — log what the client reported this week.";
    $("stop-floor").textContent = client.floorState === "stopped" ? "Resume auto reminder" : "Stop auto reminder";
    const recordOnly = client.lifecycle === "Archived";
    $("stop-floor").disabled = recordOnly || client.floorState === "booked";
    $("mark-floor-booked").disabled = recordOnly || client.floorState === "booked";
    $("booking-state").disabled = recordOnly;
    $("update-booking").disabled = recordOnly;
    $("booking-state").value = client.bookingState || "Booked";
    const requested = ["Cancel requested", "Reschedule requested"].includes(client.bookingState);
    $("cancel-decision").hidden = !requested || recordOnly;
    if (requested) $("cancel-decision-copy").textContent = `${client.name} asked to ${client.bookingState === "Cancel requested" ? "cancel" : "reschedule"} — inside your late-cancel window? Charge the session or waive it.`;
    $("renewal-title").textContent = client.renewalDue ? `Renew by ${client.renewalDue}` : "Renewal workflow";
    $("renewal-copy").textContent = renewalGuidance(client);
    $("prompt-preview").innerHTML = `<strong>Client receives:</strong><br>${esc(exactPrompt(client))}`;
    const messages = client.messages || [];
    const hasReplyWaiting = Boolean(client.unread && client.lastMessage);
    $("latest-message").innerHTML = hasReplyWaiting
      ? bubble(client, { direction: "in", text: client.lastMessage })
      : `<div class="empty-message"><strong>Nothing to reply to right now.</strong><p>New programme questions will appear here when this client needs a personal answer.</p></div>`;
    $("message-history").innerHTML = `
      ${[...messages].reverse().map(message => bubble(client, message)).join("")}
      ${client.lastMessage ? bubble(client, { direction: "in", text: client.lastMessage }) : ""}
    `;
    window.deskCap?.($("message-history"), { noun: "messages", limit: 8 });
    const replyBox = $("client-reply");
    replyBox.disabled = !hasReplyWaiting;
    replyBox.placeholder = hasReplyWaiting ? "Write the client reply" : "Nothing waiting — new client questions will appear here.";
    replyBox.value = hasReplyWaiting ? (client.draftReply || "Great question — keep the plan as written for now and tell me how the next session feels. If anything changes, I’ll adjust the next block rather than guessing on the day.") : "";
    $("send-reply").disabled = !hasReplyWaiting;
    renderButtons();
  }

  function sendPrompt(stage) {
    const prompt = exactPrompt(client);
    note(prompt);
    client.sent[stage] = true;
    if (stage === "early") { client.renewalStage = "final"; client.status = "Early reminder sent"; }
    if (stage === "final") { client.renewalStage = "followup"; client.status = "Renew-today sent"; }
    if (stage === "followup") { client.renewalStage = "followup"; client.status = "Follow-up sent"; }
    save();
    render();
    showToast("Prompt logged in this walkthrough.");
  }

  $("send-early").addEventListener("click", () => sendPrompt("early"));
  $("send-final").addEventListener("click", () => sendPrompt("final"));
  $("send-followup").addEventListener("click", () => sendPrompt("followup"));

  $("pause-client").addEventListener("click", () => {
    const isArchived = client.lifecycle === "Archived";
    const isPaused = client.pauseAutomation || client.lifecycle === "Paused";
    client.lifecycle = isArchived || isPaused ? "Active" : "Paused";
    client.pauseAutomation = !(isArchived || isPaused);
    client.history = client.history || [];
    client.history.push({ date: "Today", title: isArchived || isPaused ? "Automation resumed" : "Automation paused", detail: isArchived ? "Archived client restored to active coaching." : isPaused ? "Client returned to active coaching." : "Automated prompts are paused until the coach resumes them." });
    save();
    render();
    showToast(isArchived || isPaused ? "Automation resumed." : "Automation paused.");
  });

  $("archive-client").addEventListener("click", () => {
    const isArchived = client.lifecycle === "Archived";
    client.lifecycle = isArchived ? "Active" : "Archived";
    client.pauseAutomation = !isArchived;
    client.history = client.history || [];
    client.history.push({ date: "Today", title: isArchived ? "Client restored" : "Client archived", detail: isArchived ? "Client returned to the active register." : "Client removed from the daily register and kept for history." });
    save();
    render();
    showToast(isArchived ? "Client restored." : "Client archived.");
  });

  $("assign-next-assets").addEventListener("click", () => {
    const assets = assetList(client);
    const oldBlock = client.assetBlock || 1;
    if (oldBlock >= assets.length) {
      showToast("Already on the final content set — nothing new to assign.");
      return;
    }
    client.assetBlock = Math.min(oldBlock + 1, assets.length);
    client.history = client.history || [];
    const detail = `Assigned ${currentAsset(client)} from ${client.assetSource || "the coaching library"}.`;
    const last = client.history[client.history.length - 1];
    if (!last || last.title !== "Content set updated" || last.detail !== detail)
      client.history.push({ date: "Today", title: "Content set updated", detail });
    save();
    render();
    showToast("Next content set assigned.");
  });

  document.querySelectorAll("[data-progression]").forEach(button => button.addEventListener("click", () => {
    client.progressionReview = button.dataset.progression === "keep" ? "Kept current" : "Needs review";
    client.history = client.history || [];
    client.history.push({ date: "Today", title: "Progression reviewed", detail: button.dataset.progression === "keep" ? "Coach chose to keep the current programme for now." : "Coach wants a personal progression conversation before changing programme." });
    save();
    render();
    showToast("Progression review updated.");
  }));

  $("progress-client").addEventListener("click", () => {
    const next = recommendedProgramme(client);
    client.history = client.history || [];
    client.history.push({ date: "Today", title: "Programme progressed", detail: `${client.name} moved from ${client.plan} to ${next}.` });
    client.plan = next;
    client.assetBlock = 1;
    client.programmeMonths = 0;
    client.progressionReview = "Reviewed";
    client.packagePath = `${client.packagePath || "Programme"} → ${next}`;
    client.status = "Programme progressed";
    save();
    render();
    showToast("Client moved to the next programme.");
  });

  $("save-event").addEventListener("click", () => {
    client.eventGoal = {
      event: $("event-name").value.trim() || "No event booked",
      date: $("event-date").value.trim() || "TBC",
      target: $("event-target").value.trim() || "Set target",
      sim: $("event-sim").value.trim() || "No simulation yet",
      status: $("event-status").value,
      adaptation: $("event-adaptation").value.trim() || "No adaptation set"
    };
    client.history = client.history || [];
    client.history.push({ date: "Today", title: "Event goal updated", detail: `${client.eventGoal.event} · target ${client.eventGoal.target} · latest sim ${client.eventGoal.sim}.` });
    save();
    render();
    showToast("Event goal saved.");
  });

  $("station-list").addEventListener("click", event => {
    const btn = event.target.closest("[data-station-remove]");
    if (!btn) return;
    const removed = client.stations.splice(Number(btn.dataset.stationRemove), 1)[0];
    client.history = client.history || [];
    client.history.push({ date: "Today", title: "Watch list updated", detail: `${removed.name} removed from the watch list.` });
    save();
    render();
    showToast(`${removed.name} off the watch list.`);
  });

  $("add-station-btn").addEventListener("click", () => {
    const name = $("add-station").value;
    if (!name) return;
    client.stations = client.stations || [];
    client.stations.push({ name, state: "watch", latest: "", note: "" });
    client.history = client.history || [];
    client.history.push({ date: "Today", title: "Watch list updated", detail: `${name} added to the watch list.` });
    save();
    render();
    showToast(`${name} added — set its status and note.`);
  });

  $("save-stations").addEventListener("click", () => {
    document.querySelectorAll("[data-station-row]").forEach(row => {
      const station = client.stations[Number(row.dataset.stationRow)];
      station.state = row.querySelector("[data-station-state]").value;
      station.latest = row.querySelector("[data-station-latest]").value.trim();
      station.note = row.querySelector("[data-station-note]").value.trim();
    });
    client.history = client.history || [];
    client.history.push({ date: "Today", title: "Station snapshot updated", detail: "Coach refreshed current strengths, limiters and race notes." });
    save();
    render();
    showToast("Station snapshot saved.");
  });

  $("add-note").addEventListener("click", () => {
    const text = $("coach-note").value.trim();
    if (!text) return;
    client.coachNotes = client.coachNotes || [];
    client.coachNotes.push({ date: "Today", text });
    client.history = client.history || [];
    client.history.push({ date: "Today", title: "Coach note", detail: text });
    $("coach-note").value = "";
    client.lastContact = "Today";
    save();
    render();
    showToast("Coach note added.");
  });

  $("attention-actions").addEventListener("click", event => {
    const action = event.target.closest("[data-attention]")?.dataset.attention;
    if (!action) return;
    const kind = attentionPlan(client).kind;
    if (action === "reply") {
      $("client-reply").scrollIntoView({ behavior: "smooth", block: "center" });
      $("client-reply").focus();
      return;
    }
    if (action === "checkin") { $("log-checkin").click(); return; }
    if (action === "payment") {
      client.paymentStatus = client.type === "monthly" ? "Paid" : "Package paid";
      client.history = client.history || [];
      client.history.push({ date: "Today", title: "Payment resolved", detail: "Payment issue cleared by the coach." });
    }
    if (action === "resume-client") {
      client.lifecycle = "Active";
      client.pauseAutomation = false;
      client.history = client.history || [];
      client.history.push({ date: "Today", title: "Automation resumed", detail: "Client returned to active coaching and automated prompts." });
    }
    if (action === "resume-floor") {
      client.floorState = "scheduled";
      client.floorPrompt = `Scheduled · ${settings.floorDays} days before due`;
    }
    if (action === "renewal") { $("renewal-box").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (action === "progression") { $("programme-event").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (action === "floor") { $("floor-box").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (action === "handled") {
      if (kind === "message") client.unread = false;
      if (kind === "checkin") client.checkIn = "Coach contacted";
      if (kind === "floorStopped") { client.floorState = "booked"; client.floorPrompt = "Handled personally"; }
      client.status = "Coach contacted";
      client.history = client.history || [];
      client.history.push({ date: "Today", title: "Handled personally", detail: "The coach chose a direct route instead of another automated notice." });
      note("Coach handled this personally outside the automated prompt flow.");
    }
    client.lastContact = "Today";
    save();
    render();
    showToast("Client action updated.");
  });

  $("mark-renewed").addEventListener("click", () => {
    client.renewalStage = "none";
    client.status = "Renewed";
    client.sent = { early: false, final: false, followup: false };
    client.packagesBought = (client.packagesBought || 1) + 1;
    client.renewalCount = (client.renewalCount || 0) + 1;
    client.assetBlock = Math.min((client.assetBlock || 1) + 1, assetList(client).length);
    client.programmeMonths = (client.programmeMonths || 0) + 1;
    if (client.type === "monthly") client.daysRemaining = settings.monthLength;
    else { client.sessionsUsed = 0; client.sessionsTotal = settings.blockSize; }
    client.history = client.history || [];
    client.history.push({ date: "Today", title: "Renewed", detail: `${client.plan} renewed and the next package/month is active. Assigned content set: ${currentAsset(client)}.` });
    note("Renewal confirmed — the next block/month is active in this walkthrough.");
    save();
    render();
    showToast("Marked as renewed.");
  });

  $("send-reply").addEventListener("click", () => {
    const reply = $("client-reply").value.trim();
    if (!reply) return;
    note(reply);
    delete client.draftReply;
    client.unread = false;
    save();
    render();
    showToast("Client reply logged in this walkthrough.");
  });

  $("stop-floor").addEventListener("click", () => {
    client.floorState = client.floorState === "stopped" ? "scheduled" : "stopped";
    client.floorPrompt = client.floorState === "stopped" ? "Stopped by coach" : `Scheduled · ${settings.floorDays} days before due`;
    save();
    render();
    showToast(client.floorState === "stopped" ? "Automatic reminder stopped." : "Automatic reminder resumed.");
  });

  $("mark-floor-booked").addEventListener("click", () => {
    client.floorState = "booked";
    client.floorPrompt = "Booked · updates from session completion";
    client.bookingState = "Booked";
    save();
    render();
    showToast("Floor session marked as booked.");
  });

  $("update-booking").addEventListener("click", () => {
    client.bookingState = $("booking-state").value;
    client.history = client.history || [];
    if (client.bookingState === "Completed") {
      if (!client.bookingCounted) {
        client.floorUsed = Math.min(client.floorTotal, (client.floorUsed || 0) + 1);
        if (client.type === "sessions") client.sessionsUsed = Math.min(client.sessionsTotal, (client.sessionsUsed || 0) + 1);
        client.bookingCounted = true;
      }
      client.floorState = "booked";
      client.floorPrompt = "Completed · usage updated";
      client.nextSession = "Completed";
      client.history.push({ date: "Today", title: "Session completed", detail: "Booking completion updated the package/session count automatically." });
    } else if (client.bookingState === "Booked") {
      client.floorState = "booked";
      client.floorPrompt = "Booked · updates from session completion";
      client.history.push({ date: "Today", title: "Session booked", detail: "Next floor session is booked." });
    } else if (["Cancel requested", "Reschedule requested"].includes(client.bookingState)) {
      client.floorPrompt = `${client.bookingState} · needs your decision`;
      client.status = "Needs attention";
      client.history.push({ date: "Today", title: `Client ${client.bookingState.toLowerCase()}`, detail: "Request landed — decide whether the late-cancel policy applies before replying." });
    } else {
      client.floorState = "stopped";
      client.floorPrompt = `${client.bookingState} · coach review`;
      client.history.push({ date: "Today", title: `Session ${client.bookingState.toLowerCase()}`, detail: "Automation paused so the coach can decide the next step personally." });
    }
    client.lastContact = "Today";
    save();
    render();
    showToast("Booking state updated.");
  });

  const resolveRequest = charged => {
    if (!["Cancel requested", "Reschedule requested"].includes(client.bookingState)) return;
    const wasCancel = client.bookingState === "Cancel requested";
    client.bookingState = wasCancel ? "Cancelled" : "Rescheduled";
    if (charged) {
      client.floorUsed = Math.min(client.floorTotal, (client.floorUsed || 0) + 1);
      if (client.type === "sessions") client.sessionsUsed = Math.min(client.sessionsTotal, (client.sessionsUsed || 0) + 1);
    }
    client.floorState = "stopped";
    client.floorPrompt = charged ? "Late policy applied · session charged" : "Waived · reschedule free";
    client.lastContact = "Today";
    client.history = client.history || [];
    client.history.push({ date: "Today", title: charged ? "Late policy applied" : "Request waived", detail: charged ? `Session ${wasCancel ? "cancelled" : "rescheduled"} and charged against the package.` : `Session ${wasCancel ? "cancelled" : "rescheduled"} free of charge.` });
    save();
    render();
    showToast(charged ? "Session charged against the package." : "Waived — client can reschedule free.");
  };
  $("charge-session").addEventListener("click", () => resolveRequest(true));
  $("waive-session").addEventListener("click", () => resolveRequest(false));

  $("review-intake").addEventListener("click", () => {
    const contact = ContactStore.find({ email: client.email });
    const intake = client.intake || contact?.intake;
    if (!intake || intake.reviewed) return;
    intake.reviewed = new Date().toISOString();
    client.intake = intake;
    if (contact) contact.intake = intake;
    ContactStore.save();
    save();
    render();
    showToast("Intake reviewed — health information kept on file.");
  });
  $("review-checkin").addEventListener("click", () => {
    client.checkinReviewPending = false;
    if (client.status === "Needs check-in") client.status = "On track";
    save();
    render();
    showToast("Flagged check-in reviewed — notes kept on file.");
  });

  $("save-checkin").addEventListener("click", () => {
    const checkin = {
      at: "Today",
      energy: $("checkin-energy").value,
      sleep: $("checkin-sleep").value,
      rpe: $("checkin-rpe").value,
      pain: $("checkin-pain").value,
      note: $("checkin-note").value.trim()
    };
    client.lastCheckin = checkin;
    client.checkIn = "Received";
    const flagged = checkin.pain === "Needs attention" || checkin.rpe === "Too hard";
    client.checkinReviewPending = flagged;
    client.status = flagged ? "Needs check-in" : (!store.needsRenewal(client) && !client.unread ? "On track" : client.status);
    client.history = client.history || [];
    client.history.push({
      date: "Today", title: flagged ? "Check-in flagged" : "Check-in logged",
      detail: `Energy ${checkin.energy.toLowerCase()}, sleep ${checkin.sleep.toLowerCase()}, week felt ${checkin.rpe.toLowerCase()}, niggles: ${checkin.pain.toLowerCase()}.${checkin.note ? " — " + checkin.note : ""}`
    });
    save();
    render();
    showToast(flagged ? "Check-in logged — flagged for follow-up." : "Check-in logged.");
  });

  $("log-checkin").addEventListener("click", () => {
    client.checkIn = "Received";
    if (!store.needsRenewal(client) && !client.unread) client.status = "On track";
    save();
    render();
    showToast("Check-in marked received.");
  });

  render();
  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) {
      const det = target.closest("details");
      if (det) det.open = true;
      target.scrollIntoView({ block: "start" });
    }
  }
})();
