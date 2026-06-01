# Resource Loading Lab

Навчальний стенд для дослідження loading performance web-ресурсів: CSS, JavaScript, images, fonts, preload scanner, resource hints і Fetch Priority API.

Проект навмисно побудований без frontend-фреймворку або bundler. Кожен експеримент повертає повний HTML document з Express, щоб у Chrome DevTools було видно реальну поведінку HTML parser, preload scanner, render-blocking CSS і parser-blocking JavaScript.

## Запуск

```bash
npm install
npm run dev
```

Після запуску:

- main lab: http://localhost:3000
- cross-origin asset server: http://localhost:3001

Обидва сервери стартують однією командою. Якщо `3000` або `3001` зайняті, сервер автоматично вибере наступний вільний порт і надрукує фактичні URL у terminal output. Другий origin потрібен для `preconnect`, `dns-prefetch`, CORS font preload і cross-origin image прикладів.

## Як проходити lab

1. Відкрий http://localhost:3000.
2. У Chrome DevTools увімкни:
   - Network -> Disable cache;
   - Network throttling -> Slow 4G або власний latency profile;
   - columns: Priority, Initiator, Timing, Waterfall.
3. Для кожного модуля відкрий `bad`, потім `better`, потім `best`.
4. Робіть hard reload для кожного варіанта.
5. Заповнюй `docs/worksheet.md`, а потім звіряйся з `docs/expected-observations.md`.

## Модулі

- `01-baseline`: контрольний waterfall і LCP image.
- `02-render-parser-blocking`: parser-blocking script, `defer`, `async`, `type="module"`.
- `03-css-loading`: `@import`, parallel CSS links, critical CSS, unused CSS.
- `04-preload-scanner`: HTML image, CSS background image, JS-injected image, lazy above-the-fold image.
- `05-resource-hints`: `dns-prefetch`, `preconnect`, `preload`, `prefetch`.
- `06-fetch-priority`: LCP image priority і thumbnails priority.
- `07-client-rendering`: client-rendered critical markup проти server-provided markup.
- `08-over-optimization`: missing `as`, missing `crossorigin`, excessive preload, corrected hints.

## Навчальний формат коду

Кожен варіант уроку є окремим HTML-документом у `public/labs`.

Наприклад:

```text
public/labs/01-baseline/control.html
public/labs/01-baseline/preload-lcp-image.html
```

Це зроблено навмисно: для навчання важливіше бачити повний HTML source і порядок тегів у `<head>`, ніж уникати дублювання. Dashboard описаний у `server/labs.js` як manifest і просто посилається на ці HTML-файли.

## Корисні джерела

- https://web.dev/learn/performance/optimize-resource-loading
- https://web.dev/learn/performance/resource-hints
- https://web.dev/articles/preload-scanner

## Примітки

Assets підтримують query-параметр `delay`, наприклад:

```text
/assets/images/hero.png?delay=1200
/assets/css/render-blocking.css?delay=2000
/assets/js/parser-blocking.js?delay=1500
```

Express обмежує штучну затримку максимумом 10 секунд, щоб випадково не зависити сторінку надовго.
