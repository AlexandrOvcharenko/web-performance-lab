const slot = document.querySelector("#hero-slot");
if (slot) {
  const image = document.createElement("img");
  image.className = "hero-image";
  image.src = "/assets/images/hero.png?delay=1200";
  image.alt = "Injected hero image";
  image.width = 960;
  image.height = 640;
  slot.replaceWith(image);
}

console.log("[Resource Loading Lab] injected hero image", performance.now().toFixed(1));
