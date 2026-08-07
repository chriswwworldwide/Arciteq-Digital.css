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
