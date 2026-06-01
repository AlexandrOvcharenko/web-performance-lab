(function () {
  const prefix = "[Resource Loading Lab]";
  window.__resourceLoadingLabHelperVersion = "v2";
  document.documentElement.dataset.labHelperVersion = "v2";

  function log(label, payload) {
    console.log(prefix, label, payload);
  }

  if ("PerformanceObserver" in window) {
    try {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          log(entry.name, `${entry.startTime.toFixed(1)}ms`);
        }
      });
      paintObserver.observe({ type: "paint", buffered: true });
    } catch (error) {
      log("paint observer unavailable", error.message);
    }

    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const latest = entries[entries.length - 1];
        const detail = {
          time: `${latest.startTime.toFixed(1)}ms`,
          element: latest.element ? latest.element.tagName.toLowerCase() : "unknown",
          url: latest.url || "text"
        };
        window.__resourceLoadingLabLatestLcp = detail;
        document.documentElement.dataset.labLatestLcp = JSON.stringify(detail);
        log("LCP", `${detail.time} ${detail.element} ${detail.url}`);
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch (error) {
      log("LCP observer unavailable", error.message);
    }
  }

  window.addEventListener("load", () => {
    const resources = performance.getEntriesByType("resource")
      .filter((entry) => /\/assets\/|metrics-helper/.test(entry.name))
      .map((entry) => ({
        name: entry.name.split("/").slice(-2).join("/"),
        initiatorType: entry.initiatorType,
        start: Number(entry.startTime.toFixed(1)),
        duration: Number(entry.duration.toFixed(1)),
        transferSize: entry.transferSize
      }));

    log("resource timing", resources);
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='mark-interaction']");
    if (!button) return;

    performance.mark("manual-interaction");
    log("manual interaction mark", `${performance.now().toFixed(1)}ms`);
  });
})();
