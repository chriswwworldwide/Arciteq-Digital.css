(() => {
  const root = "/marcdean/";
  const html = document.documentElement;
  const enabled = html.dataset.coachPreview === "true";
  const params = new URLSearchParams(location.search);
  const audience = !enabled || params.get("audience") === "public" ? "public" : "coach";
  html.dataset.previewAudience = audience;
  // Coach landing = the public homepage with The Desk toolbar above it —
  // the pitch needs the shopfront first, tools one click away. Today is
  // reachable from the toolbar, not forced as the landing view.
  if (audience === "public" && html.dataset.coachPage === "true") {
    location.replace(`${root}?audience=public`);
    return;
  }
  if (audience === "public" && /\/planner(?:\.html|\/)$/.test(location.pathname) && params.get("view") === "coach") {
    const url = new URL(location.href);
    url.searchParams.set("view", "client");
    location.replace(url.href);
    return;
  }
  const publicLink = anchor => {
    if (audience !== "public" || !anchor || anchor.hasAttribute("data-coach-link")) return;
    const raw = anchor.getAttribute("href");
    if (!raw || raw.startsWith("#")) return;
    try {
      const url = new URL(raw, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith(root)) return;
      url.searchParams.set("audience", "public");
      if (/\/planner(?:\.html|\/)$/.test(url.pathname)) url.searchParams.set("view", "client");
      anchor.href = url.href;
    } catch { return; }
  };
  const ready = () => {
    // Coach-homepage links stay on /?audience=coach — that IS the coach
    // landing now (homepage + toolbar). Nothing rewrites to today.html.
    if (enabled && audience === "public" && !document.querySelector("[data-public-preview]")) {
      const banner = document.createElement("aside"), text = document.createElement("span"), back = document.createElement("a");
      banner.className = "public-preview-banner"; banner.dataset.publicPreview = "true"; banner.setAttribute("aria-label", "Public-site preview controls");
      text.textContent = "Public-site preview · This is the athlete-facing experience.";
      back.textContent = "Back to coach view"; back.href = `${root}?audience=coach`; back.setAttribute("data-coach-link", "");
      banner.append(text, back); document.body.prepend(banner);
    }
    document.querySelectorAll("[data-coach-view]").forEach(bar => {
      const button = bar.querySelector(".coach-view-toggle");
      if (!button) return;
      const actions = bar.querySelector(".coach-view-actions");
      const leadsLink = actions?.querySelector('a[href*="leads.html"]');
      if (actions && leadsLink && !actions.querySelector('a[href*="clients.html"]')) {
        const clientsLink = document.createElement("a");
        clientsLink.href = `${root}clients.html?audience=coach`;
        clientsLink.dataset.coachLink = "";
        clientsLink.textContent = "Clients";
        leadsLink.after(clientsLink);
      }
      if (actions && !actions.querySelector('a[href*="tour.html"]')) {
        const tourLink = document.createElement("a");
        tourLink.href = `${root}tour.html?audience=coach`;
        tourLink.dataset.coachLink = "";
        tourLink.textContent = "Tour";
        actions.append(tourLink);
      }
      if (actions && !actions.querySelector('a[href*="today.html"]')) {
        const todayLink = document.createElement("a");
        todayLink.href = `${root}today.html?audience=coach`;
        todayLink.dataset.coachLink = "";
        todayLink.textContent = "Today";
        todayLink.style.background = "var(--desk-accent, var(--pink))";
        todayLink.style.color = "var(--paper, #0d0d12)";
        todayLink.style.fontWeight = "900";
        if (location.pathname.endsWith("/today.html")) todayLink.setAttribute("aria-current", "page");
        actions.prepend(todayLink);
      }
      if (actions && !actions.querySelector('a[data-support-link]')) {
        const supportLink = document.createElement("a");
        supportLink.href = `mailto:chris@station9studio.co.uk?subject=${encodeURIComponent("The Desk — something not working")}&body=${encodeURIComponent(`Page: ${location.pathname}${location.search}\nWhat happened: `)}`;
        supportLink.dataset.coachLink = "";
        supportLink.dataset.supportLink = "";
        supportLink.textContent = "Support";
        actions.append(supportLink);
      }
      if (actions) {
        const order = ["today.html", "planner.html", "clients.html", "leads.html", "manage-programmes.html", "manage-videos.html", "desk.html", "campaigns.html", "tour.html"];
        const labels = ["Today", "Bookings", "Clients", "Leads", "Programmes", "Content", "Finance", "Campaigns", "Tour"];
        order.forEach((page, index) => {
          let link = actions.querySelector(`a[href*="/${page}"]`);
          if (!link) {
            link = document.createElement("a");
            link.href = `${root}${page}?audience=coach${page === "planner.html" ? "&view=coach" : ""}`;
            link.dataset.coachLink = "";
            link.textContent = labels[index];
          }
          actions.append(link);
        });
        const support = actions.querySelector("[data-support-link]");
        if (support) actions.append(support);
      }
      const setExpanded = expanded => { bar.dataset.coachExpanded = String(expanded); button.setAttribute("aria-expanded", String(expanded)); button.textContent = expanded ? "Hide tools" : "Show tools"; };
      const mobile = matchMedia("(max-width: 800px)");
      setExpanded(!mobile.matches);
      button.addEventListener("click", () => setExpanded(bar.dataset.coachExpanded !== "true"));
      mobile.addEventListener("change", () => setExpanded(!mobile.matches));
    });
    document.querySelectorAll("a[href]").forEach(publicLink);
    document.addEventListener("click", event => publicLink(event.target.closest("a[href]")));
    document.addEventListener("auxclick", event => publicLink(event.target.closest("a[href]")));
    if (!document.querySelector('script[src$="nav.js"]')) {
      const navScript = document.createElement("script");
      navScript.src = `${root}nav.js`;
      document.body.append(navScript);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();
})();
