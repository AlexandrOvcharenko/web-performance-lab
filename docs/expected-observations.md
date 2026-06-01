# Resource Loading Lab: expected observations

Цей документ не є точним benchmark. Мета - перевірити відносну поведінку ресурсів у Chrome DevTools. Результати можуть трохи відрізнятися залежно від Chrome version, CPU, throttling profile і OS.

## 01 Baseline

- `control`: `hero.png` схований у CSS background, тому request має стартувати після завантаження і парсингу `baseline-late-hero.css`.
- `preload-lcp-image`: той самий CSS background використовується для layout, але `hero.png` має стартувати раніше, бо він оголошений через `rel="preload"` перед stylesheet.

## 02 Render і Parser Blocking

- `bad`: `parser-blocking.js` блокує HTML parser. CSS також render-blocking, тому first render чекає stylesheet.
- `better`: `defer-one.js` і `defer-two.js` не блокують parsing і виконуються у markup order після parsing.
- `best`: `type="module"` поводиться як deferred script by default.
- `async`: швидший `async-two.js` може виконатися раніше за `async-one.js`, бо async execution залежить від завершення download.

## 03 CSS Loading

- `bad`: `import-entry.css` має показати chain: entry CSS -> imported CSS files.
- `better`: CSS files, які є в HTML як `<link>`, можуть стартувати раніше і паралельніше.
- `best`: above-the-fold styles приходять разом із HTML; `non-critical.css` не має блокувати перший meaningful render.
- `unused`: Coverage має показати значну частину невикористаного CSS у `unused-heavy.css`.

## 04 Preload Scanner

- `bad`: background image не видно в HTML, тому browser дізнається про нього після CSS download/parse.
- `better`: HTML `<img>` дає browser змогу знайти image раніше.
- `best`: preload компенсує late discovery CSS background image.
- `js-injected`: image request стартує тільки після download і execution `inject-hero.js`.
- `lazy-above-fold`: LCP image може стартувати пізніше, ніж у нормального eager `<img>`.

## 05 Resource Hints

- `bad`: ресурси з `localhost:3001` стартують тільки коли browser дійде до font/image discovery.
- `better`: `dns-prefetch` може зменшити DNS частину connection setup, хоча для localhost ефект може бути мінімальним.
- `best`: `preconnect` має підготувати connection до `localhost:3001`, а `preload` має зробити LCP image early-discovered.
- `prefetch`: future navigation document може з'явитися як low priority speculative request.

## 06 Fetch Priority

- `bad`: hero image і thumbnails конкурують без явного priority signal.
- `better`: preload робить hero image early-discovered, але сам по собі не завжди достатньо описує relative priority.
- `best`: hero image має отримати higher priority signal, thumbnails - lower priority signal.

## 07 Client Rendering

- `bad`: browser не може request hero image до виконання `client-render.js`, бо image URL не існує в initial HTML.
- `better`: server-provided `<img>` видно раніше, JS лише додає поведінку.
- `best`: server-provided markup плюс preload дають найраніший discovery для LCP image.

## 08 Over Optimization

- `missing-as`: Chrome може показати warning або preload може не бути використаний очікуваним способом.
- `missing-crossorigin`: font preload без `crossorigin` не збігається з CORS font request, можливий duplicate або unused preload warning.
- `excessive`: багато ранніх preload requests створюють конкуренцію і засмічують waterfall.
- `corrected`: preload залишений тільки для critical image і font, font preload має `type` і `crossorigin`.
