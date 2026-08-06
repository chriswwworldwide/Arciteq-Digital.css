/* ===================================================================
   PawSense — Premium motion (shared template script)
   Progressive enhancement only: staggered scroll reveal + paw burst.
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

  function initPawBurst() {
    if (prefersReduced) return;
    // Trigger zone: the home hero, or anything marked data-paw.
    var zone = document.querySelector("[data-paw], .home-hero");
    if (!zone) return;
    zone.addEventListener("pointerdown", function (e) {
      if (e.target.closest("a,button,input,textarea,select,label")) return;
      for (var i = 0; i < 3; i++) {
        var paw = document.createElement("span");
        paw.className = "paw-burst";
        paw.textContent = "\uD83D\uDC3E";
        paw.style.left = e.clientX + (Math.random() - 0.5) * 48 + "px";
        paw.style.top = e.clientY + "px";
        paw.style.setProperty("--paw-rot", (Math.random() - 0.5) * 40 + "deg");
        paw.style.animationDelay = i * 90 + "ms";
        document.body.appendChild(paw);
        paw.addEventListener("animationend", function () {
          this.remove();
        });
      }
    });
  }

  function init() {
    // Signal CSS that JS is present so reveal elements may start hidden.
    // Skipped under reduced-motion so nothing is ever hidden.
    if (!prefersReduced) document.body.classList.add("js-reveal");
    observeReveals();
    initPawBurst();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
