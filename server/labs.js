export const labModules = [
  {
    id: "01-baseline",
    title: "Baseline",
    goal: "Контрольна сторінка для порівняння waterfall, FCP і LCP.",
    focus: "Порядок discovery для CSS, JS, font і hero image.",
    variants: [
      variant("01-baseline", "control", "control", "Late-discovered CSS background LCP image."),
      variant("01-baseline", "preload-lcp-image", "preload LCP image", "Той самий layout із preload для LCP image.")
    ]
  },
  {
    id: "02-render-parser-blocking",
    title: "Render і Parser Blocking",
    goal: "Порівняти parser-blocking script, defer, async і module.",
    focus: "HTML parser blocking, render-blocking CSS, порядок execution.",
    variants: [
      variant("02-render-parser-blocking", "bad", "bad: blocking script", "CSS і звичайний script у head блокують parsing/rendering."),
      variant("02-render-parser-blocking", "better", "better: defer", "External script завантажується без блокування parser."),
      variant("02-render-parser-blocking", "best", "best: module", "Module script deferred by default, CSS залишено мінімальним."),
      variant("02-render-parser-blocking", "async", "async comparison", "Async scripts виконуються одразу після download і можуть міняти порядок.")
    ]
  },
  {
    id: "03-css-loading",
    title: "CSS Loading",
    goal: "Показати request chain від @import, parallel links і critical CSS trade-off.",
    focus: "Render-blocking CSS discovery і CSSOM.",
    variants: [
      variant("03-css-loading", "bad", "bad: @import chain", "CSS imports створюють послідовний request chain."),
      variant("03-css-loading", "better", "better: parallel links", "Окремі link stylesheet можуть стартувати паралельно."),
      variant("03-css-loading", "best", "best: critical CSS", "Above-the-fold CSS inline, non-critical CSS завантажується пізніше."),
      variant("03-css-loading", "unused", "unused CSS", "Великий CSS payload блокує render, хоча більшість правил не використовується.")
    ]
  },
  {
    id: "04-preload-scanner",
    title: "Preload Scanner",
    goal: "Побачити, які ресурси browser може знайти під час blocked parser scan.",
    focus: "HTML-discovered ресурси проти CSS/JS-discovered ресурсів.",
    variants: [
      variant("04-preload-scanner", "bad", "bad: CSS background LCP", "Hero image схований у CSS, preload scanner не читає CSS content."),
      variant("04-preload-scanner", "better", "better: HTML img", "Hero image присутній в initial HTML і може бути знайдений раніше."),
      variant("04-preload-scanner", "body-stylesheet", "body stylesheet", "Stylesheet у body блокує render, але parser все ще знаходить image нижче."),
      variant("04-preload-scanner", "best", "best: preload CSS background", "Якщо CSS background неминучий, preload робить ресурс видимим раніше."),
      variant("04-preload-scanner", "js-injected", "bad: JS injected", "Startup script injects hero image, тому request стартує після виконання JS."),
      variant("04-preload-scanner", "lazy-above-fold", "bad: lazy LCP", "Above-the-fold LCP image не має бути lazy-loaded.")
    ]
  },
  {
    id: "05-resource-hints",
    title: "Resource Hints",
    goal: "Порівняти dns-prefetch, preconnect, preload і prefetch.",
    focus: "Connection setup, speculative work і late-discovered critical resources.",
    variants: [
      variant("05-resource-hints", "bad", "bad: no hints", "Той самий layout що best, без preconnect/preload — font CSS стартує лише після parser дійде до link."),
      variant("05-resource-hints", "better", "better: dns-prefetch", "dns-prefetch у head — DNS Lookup на .woff2 коротший або відсутній порівняно з bad."),
      variant("05-resource-hints", "best", "best: preconnect + preload", "Preconnect готує Google Fonts origin, preload стартує font CSS до пізнього link у body.")
    ]
  },
  {
    id: "06-fetch-priority",
    title: "Fetch Priority",
    goal: "Показати, як розмітка, preload і fetchpriority впливають на чергу LCP image.",
    focus: "Network порядок discovery, Priority, Timing → Queuing/Started at.",
    variants: [
      variant("06-fetch-priority", "bad", "bad: hero останній у discovery", "Thumbs у HTML перед hero; hero стартує пізно (~100 ms+), Priority Medium→High занадто пізно."),
      variant("06-fetch-priority", "better", "better: preload hero", "Preload у head — hero у Network перед thumbs, без очікування в черзі."),
      variant("06-fetch-priority", "best", "best: preload + fetchpriority", "Hero High з head, thumbs Low — LCP не карається за пізню позицію в розмітці.")
    ]
  },
  {
    id: "08-over-optimization",
    title: "Over Optimization",
    goal: "Показати типові помилки з preload, crossorigin і надмірною пріоритезацією.",
    focus: "Duplicate downloads, console warnings, bandwidth contention.",
    variants: [
      variant("08-over-optimization", "missing-as", "bad: missing as", "Preload без as може спричинити неправильну поведінку і warnings."),
      variant("08-over-optimization", "missing-crossorigin", "bad: missing crossorigin", "Font preload без crossorigin не збігається з CORS font request."),
      variant("08-over-optimization", "excessive", "bad: excessive preload", "Некритичні thumbnails і scripts preloaded разом з LCP ресурсом."),
      variant("08-over-optimization", "corrected", "best: corrected hints", "Preload лише для critical LCP, font preload має crossorigin.")
    ]
  }
];

export function findLabHref(moduleId, variantId) {
  const labModule = labModules.find((item) => item.id === moduleId);
  const labVariant = labModule?.variants.find((item) => item.id === variantId);
  return labVariant?.href ?? null;
}

export function renderDashboard() {
  const cards = labModules.map((labModule) => `
    <section class="module-card">
      <div>
        <p class="eyebrow">${labModule.id}</p>
        <h2>${labModule.title}</h2>
        <p>${labModule.goal}</p>
        <p class="focus">${labModule.focus}</p>
      </div>
      <div class="variant-list">
        ${labModule.variants.map((labVariant) => `
          <a href="${labVariant.href}">
            <span>${labVariant.label}</span>
            <small>${labVariant.summary}</small>
          </a>
        `).join("")}
      </div>
    </section>
  `).join("");

  return `<!doctype html>
  <html lang="uk">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Resource Loading Lab</title>
      <link rel="stylesheet" href="/assets/css/lab.css">
    </head>
    <body>
      <main class="dashboard">
        <header class="dashboard-hero">
          <p class="eyebrow">Vanilla HTML/CSS/JS + Express</p>
          <h1>Resource Loading Lab</h1>
          <p>Навчальний стенд для дослідження того, як браузер знаходить, пріоритезує і завантажує web ресурси.</p>
        </header>
        <div class="toolbar">
          <a href="/docs/worksheet.md">worksheet.md</a>
          <a href="/docs/expected-observations.md">expected-observations.md</a>
          <a href="https://web.dev/learn/performance/optimize-resource-loading">web.dev: optimize loading</a>
          <a href="https://web.dev/learn/performance/resource-hints">web.dev: resource hints</a>
          <a href="https://web.dev/articles/preload-scanner">web.dev: preload scanner</a>
        </div>
        <div class="module-grid">
          ${cards}
        </div>
      </main>
    </body>
  </html>`;
}

function variant(moduleId, id, label, summary) {
  return {
    id,
    label,
    summary,
    href: `/labs/${moduleId}/${id}.html`
  };
}
