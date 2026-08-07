/* ===================================================================
   PawSense — shared template script (progressive enhancement only)
   Staggered scroll reveal + display-title helper.
   Loaded on every page; safe no-op where the hooks are absent.
   =================================================================== */
(function () {
  "use strict";

  var prefersReduced =
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var revealObserver = null;

  function ensureObserver() {
    if (revealObserver || prefersReduced) return revealObserver;
    if (!("IntersectionObserver" in globalThis)) return null;
    revealObserver = new IntersectionObserver(
      function (entries, obs) {
        var stagger = 0;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          el.style.transitionDelay = Math.min(stagger, 240) + "ms";
          stagger += 60;
          el.classList.add("is-visible");
          obs.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    return revealObserver;
  }

  // (Re)scan the DOM for reveal targets. Safe to call repeatedly, e.g.
  // after a page injects product cards dynamically.
  function observeReveals() {
    var nodes = document.querySelectorAll(".reveal:not(.is-visible)");
    var obs = ensureObserver();
    if (!obs) {
      // Reduced-motion or old browser: just show everything.
      nodes.forEach(function (n) {
        n.classList.add("is-visible");
      });
      return;
    }
    nodes.forEach(function (n) {
      obs.observe(n);
    });
  }
  globalThis.pawObserveReveals = observeReveals;

  // Aspirational display titles: strip functional trailing tags like
  // "(Demo)" / "(Placeholder)" so storefront copy reads like a brand,
  // not a spec sheet. Meaningful parentheticals are left intact.
  function displayTitle(t) {
    var s = String(t == null ? "" : t);
    var prev;
    do {
      prev = s;
      s = s.replace(/\s*\((?:demo|placeholder|sample|test|wip)\)\s*$/i, "");
    } while (s !== prev);
    return s.trim();
  }
  globalThis.pawDisplayTitle = displayTitle;

  // ---- Video apparatus (shared, credential-free) --------------------
  // A reusable lazy video slot for hero + product pages. Returns "" when
  // no clip is configured, so the slot stays empty until a video is set.
  // GPU/bandwidth-cheap: preload=none, no autoplay, poster until play.
  function escAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function guessVideoType(src) {
    var s = String(src || "").toLowerCase();
    if (s.indexOf(".webm") >= 0) return "video/webm";
    if (s.indexOf(".ogv") >= 0 || s.indexOf(".ogg") >= 0) return "video/ogg";
    if (s.indexOf(".m3u8") >= 0) return "application/x-mpegURL";
    return "video/mp4";
  }

  function videoSlotHTML(cfg) {
    if (!cfg || typeof cfg !== "object") return "";
    var src = String(cfg.src || "").trim();
    if (!src) return "";
    var poster = cfg.poster ? ' poster="' + escAttr(cfg.poster) + '"' : "";
    var label = cfg.name ? ' aria-label="' + escAttr(cfg.name) + '"' : "";
    var type = escAttr(cfg.type || guessVideoType(src));
    return (
      '<video class="video-slot" preload="none" controls playsinline ' +
      'width="640" height="360"' +
      poster +
      label +
      ">" +
      '<source src="' +
      escAttr(src) +
      '" type="' +
      type +
      '">' +
      "</video>"
    );
  }

  function toAbsUrl(u) {
    var s = String(u || "");
    var origin = (globalThis.location && globalThis.location.origin) || "";
    return /^https?:/i.test(s) ? s : origin + s;
  }

  // Build a schema.org VideoObject (or null when no clip). ctx supplies
  // fallback name/description/uploadDate from the surrounding page.
  function videoObjectSchema(cfg, ctx) {
    if (!cfg || typeof cfg !== "object") return null;
    var src = String(cfg.src || "").trim();
    if (!src) return null;
    ctx = ctx || {};
    var name = String(cfg.name || ctx.name || "").trim() || "Product video";
    var desc = String(cfg.description || ctx.description || name).trim();
    var obj = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: name,
      description: desc || name,
      contentUrl: toAbsUrl(src),
    };
    var uploadDate = String(cfg.uploadDate || ctx.uploadDate || "").trim();
    if (uploadDate) obj.uploadDate = uploadDate;
    if (cfg.poster) obj.thumbnailUrl = [toAbsUrl(cfg.poster)];
    if (cfg.duration) obj.duration = String(cfg.duration);
    return obj;
  }

  function injectVideoSchema(cfg, ctx) {
    var obj = videoObjectSchema(cfg, ctx);
    if (!obj) return;
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.setAttribute("data-paw-video-schema", "1");
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  }

  // Render a clip into a mount element (and add its VideoObject schema).
  // No-op when cfg has no src, leaving the mount untouched/empty.
  function renderVideoSlot(mount, cfg, ctx) {
    var el = typeof mount === "string" ? document.getElementById(mount) : mount;
    if (!el) return false;
    var html = videoSlotHTML(cfg);
    if (!html) return false;
    el.innerHTML = html;
    injectVideoSchema(cfg, ctx);
    return true;
  }

  globalThis.pawVideoSlotHTML = videoSlotHTML;
  globalThis.pawVideoObjectSchema = videoObjectSchema;
  globalThis.pawInjectVideoSchema = injectVideoSchema;
  globalThis.pawRenderVideoSlot = renderVideoSlot;

  // ---- A/B assignment (browser copy of src/ab-test.js; keep in sync) ----
  // FNV-1a 32-bit hash -> unit float in [0, 1). Stable across runs/devices.
  function hashToUnit(input) {
    var str = String(input);
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return (h >>> 0) / 0x100000000;
  }

  function normalizeVariants(variants) {
    var list = Array.isArray(variants) ? variants : [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (v == null) continue;
      var id = typeof v === "string" ? v : v.id;
      if (id == null || id === "") continue;
      var weight =
        typeof v === "string" ? 1 : Number(v.weight == null ? 1 : v.weight);
      if (!isFinite(weight) || weight <= 0) continue;
      out.push({ id: String(id), weight: weight });
    }
    return out;
  }

  // Deterministic: same (experimentKey, visitorId) -> same variant id.
  function assignVariant(args) {
    args = args || {};
    var normalized = normalizeVariants(args.variants);
    if (normalized.length === 0) return null;
    if (normalized.length === 1) return normalized[0].id;
    var total = 0;
    for (var i = 0; i < normalized.length; i++) total += normalized[i].weight;
    var point = hashToUnit(args.experimentKey + ":" + args.visitorId) * total;
    var cursor = 0;
    for (var j = 0; j < normalized.length; j++) {
      cursor += normalized[j].weight;
      if (point < cursor) return normalized[j].id;
    }
    return normalized[normalized.length - 1].id;
  }

  // Stable, privacy-light first-party visitor id (no PII). Used as the A/B
  // bucketing key so a visitor sees a consistent variant across page loads.
  function getVisitorId() {
    var KEY = "paw_visitor_id";
    try {
      var existing = localStorage.getItem(KEY);
      if (existing) return existing;
      var id =
        globalThis.crypto && globalThis.crypto.randomUUID
          ? globalThis.crypto.randomUUID()
          : "v-" +
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).slice(2, 10);
      localStorage.setItem(KEY, id);
      return id;
    } catch {
      // Storage blocked (private mode): fall back to a per-load id.
      return "v-ephemeral-" + Math.random().toString(36).slice(2, 10);
    }
  }

  // Record an experiment exposure locally so a later block can stitch it to a
  // conversion. Best-effort; never throws.
  function recordExposure(experimentKey, variant) {
    try {
      var KEY = "paw_ab_exposures";
      var map = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (!map || typeof map !== "object") map = {};
      map[String(experimentKey)] = {
        variant: String(variant),
        at: new Date().toISOString(),
      };
      localStorage.setItem(KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  globalThis.pawHashToUnit = hashToUnit;
  globalThis.pawAssignVariant = assignVariant;
  globalThis.pawGetVisitorId = getVisitorId;
  globalThis.pawRecordExposure = recordExposure;

  function init() {
    // Signal CSS that JS is present so reveal elements may start hidden.
    // Skipped under reduced-motion so nothing is ever hidden.
    if (!prefersReduced) document.body.classList.add("js-reveal");
    observeReveals();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
