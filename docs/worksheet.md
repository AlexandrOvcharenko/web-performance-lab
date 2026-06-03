# Resource Loading Lab: worksheet

Використовуй Chrome або інший Chromium-based browser. Перед кожним вимірюванням відкрий DevTools, увімкни `Disable cache`, задай throttling `Slow 4G` і зроби hard reload.

Для кожного варіанта записуй:

- який ресурс стартував першим після HTML;
- який ресурс став LCP;
- чи є parser/render blocking;
- що показують `Priority`, `Initiator`, `Timing`, `Waterfall`;
- чи є warnings у Console.

## 01 Baseline

Відкрий:

- `/labs/01-baseline/control.html`
- `/labs/01-baseline/preload-lcp-image.html`

Питання:

- Коли стартує request для `hero.png` у control після завантаження CSS?
- Чи змінюється request start у `preload-lcp-image`?
- Що показує Console для LCP entry?

## 02 Render і Parser Blocking

Відкрий:

- `/labs/02-render-parser-blocking/bad.html`
- `/labs/02-render-parser-blocking/better.html`
- `/labs/02-render-parser-blocking/best.html`
- `/labs/02-render-parser-blocking/async.html`

Питання:

- Чи блокує звичайний `<script>` подальший HTML parsing?
- Чи зберігають `defer` scripts порядок виконання?
- Чи може `async-two.js` виконатися раніше за `async-one.js`?
- Чим відрізняється `type="module"` у waterfall?

## 03 CSS Loading

Відкрий:

- `/labs/03-css-loading/bad.html`
- `/labs/03-css-loading/better.html`
- `/labs/03-css-loading/best.html`
- `/labs/03-css-loading/unused.html`

Питання:

- Чи видно послідовний request chain від `@import`?
- Чи стартують `import-layer-a.css` і `import-layer-b.css` раніше у `better`?
- Як inline critical CSS впливає на перший render?
- Що показує Coverage для `unused-heavy.css`?

## 04 Preload Scanner

Відкрий:

- `/labs/04-preload-scanner/bad.html`
- `/labs/04-preload-scanner/better.html`
- `/labs/04-preload-scanner/best.html`
- `/labs/04-preload-scanner/js-injected.html`
- `/labs/04-preload-scanner/lazy-above-fold.html`

Питання:

- Чому CSS background image стартує пізніше?
- Чому HTML `<img>` легше знайти preload scanner?
- Чи допомагає `rel="preload"` для CSS background image?
- Коли стартує image request у JS-injected варіанті?
- Чи має сенс `loading="lazy"` для above-the-fold LCP image?

## 05 Resource Hints

Відкрий:

- `/labs/05-resource-hints/bad.html`
- `/labs/05-resource-hints/better.html`
- `/labs/05-resource-hints/best.html`

Питання:

- Чи видно окремий cross-origin asset server `localhost:3001`?
- Як змінюється connection timing із `dns-prefetch`?
- Що дає `preconnect`?
- Чи стартує LCP image раніше з `preload`?
- Чи з'являється prefetch для майбутньої навігації?

## 06 Fetch Priority

Відкрий:

- `/labs/06-fetch-priority/bad.html`
- `/labs/06-fetch-priority/better.html`
- `/labs/06-fetch-priority/best.html`

Питання:

- У якому порядку preload scanner знаходить image requests у `bad`?
- Чому hero має `Started at` ~100 ms+, а thumbs ~40–50 ms?
- Чи змінює `preload` порядок hero vs thumbs у Network?
- Чи `fetchpriority="high"` / `"low"` зменшує конкуренцію під час TTFB?

## 07 Client Rendering

Відкрий:

- `/labs/07-client-rendering/bad.html`
- `/labs/07-client-rendering/better.html`
- `/labs/07-client-rendering/best.html`

Питання:

- Чи може browser знайти hero image до виконання `client-render.js`?
- Що змінюється, коли markup вже є в HTML response?
- Як `preload` впливає на server-provided critical markup?

## 08 Over Optimization

Відкрий:

- `/labs/08-over-optimization/missing-as.html`
- `/labs/08-over-optimization/missing-crossorigin.html`
- `/labs/08-over-optimization/excessive.html`
- `/labs/08-over-optimization/corrected.html`

Питання:

- Чи є warning для preload без `as`?
- Чи бачиш duplicate або невикористаний font preload без `crossorigin`?
- Як excessive preload впливає на waterfall?
- Які hints залишені у corrected варіанті?
