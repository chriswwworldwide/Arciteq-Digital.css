// Example: Dynamic filtering
const products = document.querySelectorAll(".product");
const filterInput = document.getElementById("filter-input");

filterInput.addEventListener("input", () => {
  const keyword = filterInput.value.toLowerCase();
  products.forEach((product) => {
    const productName = product
      .querySelector(".product-name")
      .textContent.toLowerCase();
    if (productName.includes(keyword)) {
      product.style.display = "block";
    } else {
      product.style.display = "none";
    }
  });
});

// Example: Wishlist/Cart persistence using localStorage
const wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
const cart = JSON.parse(localStorage.getItem("cart")) || [];

function addToWishlist(productId) {
  if (!wishlist.includes(productId)) {
    wishlist.push(productId);
    localStorage.setItem("wishlist", JSON.stringify(wishlist));
  }
}

function addToCart(productId) {
  if (!cart.includes(productId)) {
    cart.push(productId);
    localStorage.setItem("cart", JSON.stringify(cart));
  }
}
