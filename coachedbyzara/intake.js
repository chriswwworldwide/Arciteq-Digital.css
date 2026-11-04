/* New-client intake — PAR-Q-lite + consent.
   Existing client email → intake attaches to their client record (via the
   Client Desk store, mirrored into ContactStore).
   Unknown email → lands in the Lead Desk as a new-client enquiry so the
   coach can welcome them and book the first session. */
(() => {
  const CLIENTS_KEY = "coachedbyzara-client-desk-v2";
  const form = document.getElementById("intake-form");
  const note = document.getElementById("intake-note");
  const done = document.getElementById("intake-done");
  const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? f; } catch { return f; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());
    const flags = [d.q_heart === "Yes" && "heart/BP", d.q_injury === "Yes" && "injury", d.q_meds === "Yes" && "medication"].filter(Boolean);
    const intake = {
      at: new Date().toISOString().slice(0, 10),
      emergency: d.emergency,
      flags,
      notes: d.notes || ""
    };
    const summary = `Intake submitted — ${flags.length ? "flags: " + flags.join(", ") : "no health flags"}.${d.notes ? " Note: " + d.notes : ""}`;

    const clients = read(CLIENTS_KEY, []);
    const client = clients.find(c => c.email && c.email.toLowerCase() === d.email.toLowerCase());
    // Intake always lands on the contact record — the Client Desk store is
    // only seeded once the desk is opened, so it may not exist yet.
    let c = ContactStore.find({ email: d.email }) || ContactStore.create({ name: d.name, email: d.email, phone: d.phone, stage: "prospect" });
    c.intake = intake;
    c.phone = c.phone || d.phone || "";
    ContactStore.event(c, "intake", summary);
    ContactStore.save();
    if (client) {
      client.intake = intake;
      client.history = client.history || [];
      client.history.push({ date: "Today", title: "Intake received", detail: summary });
      write(CLIENTS_KEY, clients);
      ContactStore.load();
      ContactStore.importClients(clients);
    } else {
      await Integrations.captureLead({
        name: d.name,
        email: d.email,
        source: "Client intake",
        origin: "New client intake form",
        originURL: location.pathname,
        message: summary,
        reply: `Welcome — intake received, thanks. First session: I'll plan around what you've told me${flags.length ? " (" + flags.join(", ") + ")" : ""}. What days and times usually work for you?`
      });
      const c = ContactStore.find({ email: d.email });
      if (c) { c.intake = intake; ContactStore.save(); }
    }
    form.hidden = true;
    done.hidden = false;
    done.scrollIntoView({ behavior: "smooth", block: "center" });
  });
})();
