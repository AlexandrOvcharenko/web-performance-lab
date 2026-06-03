const root = document.querySelector("#client-hero");
if (root) {
  root.innerHTML = `
    <div class="hero-copy">
      <p class="eyebrow">07 CSR</p>
      <h1>Critical content створений на клієнті</h1>
      <p>Image request не може стартувати до виконання цього script.</p>
    </div>
    <img class="hero-image" src="/assets/images/hero.png?delay=1200" alt="Client rendered hero image" width="960" height="640">
  `;
}

console.log("[Resource Loading Lab] client-rendered critical markup", performance.now().toFixed(1));
