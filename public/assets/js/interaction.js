document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-action='mark-interaction']")) return;
  document.body.dataset.interacted = "true";
});

console.log("[Resource Loading Lab] interaction script ready", performance.now().toFixed(1));
