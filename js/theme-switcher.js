// Theme Switcher for L’Art‑de‑la‑Séduction

// Available theme list
const themes = [
  "default",
  "maison-de-seduction",
  "amour-noir",
  "rouge-seduction",
  "seductiv-by-lart",
  "nuit-etoilee",
];

// Detect <link data-theme> element
const linkEl = document.querySelector("link[data-theme]");

// Apply a requested theme
export function setTheme(name) {
  if (!themes.includes(name)) name = "default";
  if (linkEl) {
    linkEl.href = `themes/${name}.css`;
    localStorage.setItem("activeTheme", name);
    document.documentElement.setAttribute("data-theme", name);
  } else {
    console.warn("Theme link element not found!");
  }
}

// Initialize on page load
export function initThemeSwitcher() {
  const saved = localStorage.getItem("activeTheme") || "default";
  setTheme(saved);

  // Optional dropdown element
  const select = document.getElementById("themeSelector");
  if (select) {
    select.value = saved;
    select.addEventListener("change", (e) => setTheme(e.target.value));
  }
}

// Auto‑run if imported as <script type="module">
document.addEventListener("DOMContentLoaded", initThemeSwitcher);
