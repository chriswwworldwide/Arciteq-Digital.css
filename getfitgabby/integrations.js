/* Integrations — the seam where real services plug in.
   The walkthrough adapter writes to ContactStore + posts to the capture
   endpoint. A production tenant swaps these functions; pages don't change. */
(() => {
  const tenant = "getfitgabby";

  async function postCapture(payload) {
    try {
      const utm = Object.fromEntries(new URLSearchParams(location.search).entries());
      await fetch("/api/capture-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant,
          utm_source: utm.utm_source || "prep-club",
          utm_medium: utm.utm_medium || "",
          utm_campaign: utm.utm_campaign || "",
          ...payload
        })
      });
    } catch { /* offline walkthrough — the local record is the source */ }
  }

  window.Integrations = {
    // Someone joins, enquires or applies. Returns the contact record.
    async captureLead({ name, email, source, message, origin, originURL, reply }) {
      const templates = (window.DeskConfig && DeskConfig.get("templates")) || {};
      const contact = ContactStore.upsertLead({
        id: `site-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        siteLead: true,
        name: name || (email ? email.split("@")[0] : "Website enquiry"),
        email,
        source,
        origin,
        originURL,
        received: "Just now",
        status: "New",
        message,
        reply: reply || templates.defaultLeadReply,
        sentReply: ""
      });
      if (email) await postCapture({ email, name, source, message });
      return contact;
    },

    // A lead becomes a paying client — links the same person record.
    convertToClient(contact, clientFields) {
      ContactStore.promote(contact, "client", "converted from lead");
      contact.client = { id: contact.id, name: contact.name, email: contact.email, ...clientFields };
      ContactStore.save();
      return contact;
    },

    // Every meaningful thing that happens to a person lands here.
    track(contactRef, type, detail) {
      ContactStore.logEvent(contactRef, type, detail);
    }
  };
})();
