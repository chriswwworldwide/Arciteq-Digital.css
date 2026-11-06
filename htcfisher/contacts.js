/* ContactStore — one person record across the funnel.
   stage: prospect → member/lead → client → archived.
   events[]: everything that happened to them, in order.
   lead/member/client slices hold the desk-specific fields so each view
   (Lead Desk, Prep Club, Client Desk) is a lens on the same human.

   Backwards compatibility: existing localStorage keys are still read and
   written so older pages (campaign.js, app.js) keep working — this file
   is the bridge, not a flag-day migration. */
(() => {
  const KEY = "htcfisher-contacts-v1";
  const LEGACY = { leads: "htcfisher-campaign-leads", clients: "htcfisher-client-desk-v2", member: "htcfisher-prep-club" };
  const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? f; } catch { return f; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const now = () => new Date().toISOString();
  const uid = p => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const store = {
    contacts: [],
    loaded: false,

    load() {
      this.contacts = read(KEY, []);
      this.migrate();
      this.loaded = true;
      return this.contacts;
    },

    save() { write(KEY, this.contacts); },

    migrate() {
      // Fold legacy keys into contact records once. Keys are left in
      // place so older pages keep working; ContactStore mirrors them.
      read(LEGACY.leads, []).forEach(l => {
        let c = this.find({ email: l.email }) || this.find({ name: l.name });
        if (!c) {
          c = this.create({ id: l.id, name: l.name, email: l.email, stage: "lead" });
        }
        c.lead = { ...(c.lead || {}), ...l };
        if (["Converted"].includes(l.status)) this.promote(c, "client", "lead converted");
        this.event(c, "lead", `Lead via ${l.source || "site"}`);
      });
      const member = read(LEGACY.member, null);
      if (member && member.email) {
        let c = this.find({ email: member.email });
        if (!c) c = this.create({ name: member.name, email: member.email, stage: "member" });
        c.member = member;
        (member.actions || []).forEach(a => this.event(c, "signal", a.signal));
        if (member.joined) this.event(c, "join", "Joined Prep Club");
      }
      read(LEGACY.clients, []).forEach(cl => {
        let c = this.find({ email: cl.email }) || this.find({ name: cl.name }) || this.find({ id: cl.id });
        if (!c) c = this.create({ id: cl.id, name: cl.name, email: cl.email, stage: "client" });
        c.client = cl;
        if (!["archived"].includes(c.stage)) c.stage = cl.lifecycle === "Archived" ? "archived" : "client";
      });
      this.save();
    },

    create({ id, name, email, phone, stage = "prospect" }) {
      const c = { id: id || uid("c"), name: name || "", email: email || "", phone: phone || "", stage, source: "", events: [] };
      this.contacts.push(c);
      return c;
    },

    find({ id, email, name }) {
      if (id) { const c = this.contacts.find(x => x.id === id); if (c) return c; }
      if (email) { const c = this.contacts.find(x => x.email && x.email.toLowerCase() === email.toLowerCase()); if (c) return c; }
      if (name) { const c = this.contacts.find(x => x.name && x.name.toLowerCase() === name.toLowerCase()); if (c) return c; }
      return null;
    },

    event(contact, type, detail) {
      contact.events.push({ at: now(), type, detail });
    },

    promote(contact, stage, why = "") {
      const order = ["prospect", "lead", "member", "client", "archived"];
      // "member" and "lead" are parallel rungs — never demote a client.
      if (contact.stage === "client" || contact.stage === "archived") return;
      contact.stage = stage;
      this.event(contact, "stage", `Moved to ${stage}${why ? ` — ${why}` : ""}`);
    },

    // Views used by the desks.
    leads() { return this.contacts.filter(c => c.lead); },
    members() { return this.contacts.filter(c => c.member); },
    clients() { return this.contacts.filter(c => c.client); },

    // Write-through helpers used by the new pages.
    upsertLead(lead) {
      let c = this.find({ email: lead.email }) || this.find({ name: lead.name });
      if (!c) c = this.create({ id: lead.id, name: lead.name, email: lead.email, stage: "lead" });
      c.lead = { ...(c.lead || {}), ...lead };
      if (c.stage === "prospect" || c.stage === "member") c.stage = "lead";
      this.event(c, "lead", lead.origin || lead.source || "Lead captured");
      this.save();
      // Mirror back to the legacy key so campaign/app readers still see it.
      const leads = read(LEGACY.leads, []);
      const i = leads.findIndex(l => l.id === c.lead.id || (l.email && l.email === c.lead.email));
      if (i >= 0) leads[i] = c.lead; else leads.push(c.lead);
      write(LEGACY.leads, leads);
      return c;
    },

    upsertMember(member) {
      let c = this.find({ email: member.email });
      if (!c) c = this.create({ name: member.name, email: member.email, stage: "member" });
      c.member = { ...(c.member || {}), ...member };
      this.promote(c, "member");
      this.save();
      write(LEGACY.member, c.member);
      return c;
    },

    // Client Desk keeps its own domain store; this mirrors it into the
    // contact records so one person still has one record.
    importClients(clients) {
      clients.forEach(client => {
        let c = this.find({ email: client.email }) || this.find({ id: client.id }) || this.find({ name: client.name });
        if (!c) c = this.create({ id: client.id, name: client.name, email: client.email, stage: "client" });
        c.client = client;
        c.email = c.email || client.email || "";
        c.stage = client.lifecycle === "Archived" ? "archived" : "client";
      });
      this.save();
    },

    setStage(id, stage) {
      const c = this.find({ id });
      if (c && c.stage !== stage) { c.stage = stage; this.event(c, "stage", `Moved to ${stage}`); this.save(); }
    },

    logEvent(ref, type, detail) {
      const c = this.find(ref);
      if (c) { this.event(c, type, detail); this.save(); }
    }
  };

  store.load();
  window.ContactStore = store;
})();
