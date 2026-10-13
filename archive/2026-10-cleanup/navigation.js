// Responsive Navigation
const toggleButton = document.getElementById("menu-toggle");
const navMenu = document.querySelector("nav ul");

toggleButton.addEventListener("click", () => {
  navMenu.classList.toggle("visible");
});
