(() => {
  const home = document.querySelector("body.home-lab");
  if (!home || !window.IntersectionObserver) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  if (reduced.matches) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -6% 0px", threshold: .08 });
  const selector = "#zones h3, .pitch-tool, .tool-preview, #story figure, #story .story > div, #plans h3, #plans .plan, #events h3, #race-cards .event, #wall-photos h3, #polaroids .polaroid, #stories h3, #stories .showcase-card, #tips h3, #ask h3";
  const register = () => {
    home.querySelectorAll(selector).forEach(element => {
      if (element.classList.contains("editorial-reveal")) return;
      const siblings = [...element.parentElement.children];
      const index = siblings.filter(sibling => sibling.matches(selector)).indexOf(element);
      element.style.setProperty("--entry-delay", `${Math.min(Math.max(index, 0), 3) * 90}ms`);
      element.classList.add("editorial-reveal");
      observer.observe(element);
    });
  };
  register();
  home.classList.add("motion-ready");
  const mutations = new MutationObserver(register);
  mutations.observe(home, { childList: true, subtree: true });
  home.addEventListener("focusin", event => {
    let element = event.target;
    while (element && element !== home) {
      if (element.classList.contains("editorial-reveal")) element.classList.add("is-visible");
      element = element.parentElement;
    }
  });
  reduced.addEventListener("change", event => {
    if (!event.matches) return;
    observer.disconnect();
    mutations.disconnect();
    home.classList.remove("motion-ready");
    home.querySelectorAll(".editorial-reveal").forEach(element => element.classList.add("is-visible"));
  });
})();
