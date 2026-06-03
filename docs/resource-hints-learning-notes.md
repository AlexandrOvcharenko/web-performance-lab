# Web Performance Notes: Resource Hints (Lab 05)

Цей документ підсумовує урок `05-resource-hints`: `dns-prefetch`, `preconnect`, `preload` і `prefetch`. Мета — зрозуміти, **коли** кожен hint спрацьовує, **що саме** він готує, і **де** це видно в DevTools Network.

## Entry Point

Lab відкривається з dashboard (`http://localhost:3000`) або напряму:

- `/labs/05-resource-hints/bad.html` — baseline без hints
- `/labs/05-resource-hints/better.html` — `dns-prefetch`
- `/labs/05-resource-hints/best.html` — `preconnect` + `preload` + `prefetch`

Усі три варіанти використовують **Google Fonts (Inter)** з зовнішніх origin:

- `https://fonts.googleapis.com` — CSS
- `https://fonts.gstatic.com` — `.woff2`

Hero-image лишається на cross-origin asset server (`http://localhost:3001/...`) лише для візуального layout; основний навчальний фокус — Google Fonts.

## High-Level Flow

Лестниця hints за «силою» підготовки:

```text
dns-prefetch  →  лише DNS lookup
preconnect    →  DNS + TCP (+ TLS на HTTPS)
preload       →  реальне завантаження конкретного ресурсу
prefetch      →  speculative load для майбутньої навігації (low priority)
```

Загальна модель для поточного lab:

```text
<head>
  hints (залежно від варіанту)
  lab.css
</head>
<body>
  hero section
  parser-blocking.js?delay=8000   ← блокує parser ~8 s
  JS inject Google Fonts CSS       ← preload scanner не бачить
</body>
```

Після blocking script inline-скрипт створює `<link rel="stylesheet">` для Google Fonts:

```javascript
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href =
  'https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap';
document.head.appendChild(link);
```

Цей патерн навмисний: **preload scanner не знаходить JS-injected ресурси**, тому без `preload` hint CSS не стартує до завершення blocking script.

## Key Files

| Файл | Роль |
|---|---|
| `public/labs/05-resource-hints/bad.html` | Baseline: без hints, JS inject після blocking script |
| `public/labs/05-resource-hints/better.html` | `dns-prefetch` для `fonts.googleapis.com` і `fonts.gstatic.com` |
| `public/labs/05-resource-hints/best.html` | `preconnect`, `preload as="style"`, `prefetch as="document"` |
| `public/assets/js/parser-blocking.js` | Parser-blocking script; `?delay=8000` затримує download через server middleware |
| `server/index.js` | `delayMiddleware` додає `Server-Timing: lab-delay` і cap delay до 10 s |
| `docs/expected-observations.md` | Короткі очікувані спостереження для worksheet |
| `docs/worksheet.md` | Питання для самоперевірки |

## Hint By Hint

### 1. `dns-prefetch` (`better.html`)

**Коли виконується:** під час парсингу `<head>`, одразу після знаходження тега:

```html
<link rel="dns-prefetch" href="https://fonts.gstatic.com">
```

**Що робить:** асинхронно резолвить hostname. Не блокує parser. Не відкриває TCP/TLS. Не завантажує файли.

**Де видно в DevTools:** окремого network row для hint зазвичай **немає**. Ефект — на **першому реальному запиті** до того ж host:

- у `bad.html` на `.woff2` → Timing → **DNS Lookup ~15–25 ms**
- у `better.html` на той самий `.woff2` → **DNS Lookup відсутній** або ~0 ms

**Важливо:** CSS у `bad` і `better` стартує однаково пізно (після JS inject). Порівнюй **DNS на `.woff2`**, не Start CSS.

### 2. `preconnect` (`best.html`)

**Коли виконується:** під час парсингу `<head>`.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

**Що робить:** DNS + TCP (+ TLS). Дорожче за `dns-prefetch`, але готує повне з'єднання.

**`crossorigin` на `fonts.gstatic.com`:** font requests йдуть як cross-origin; без matching `crossorigin` preconnect може не reuse-итись для `.woff2`.

**Де видно:** Timing на `.woff2` — **Initial connection** коротший або відсутній порівняно з `bad`.

### 3. `preload` (`best.html`)

```html
<link rel="preload"
  href="https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap"
  as="style">
```

**Коли виконується:** під час парсингу `<head>`, до blocking script і JS inject.

**Що робить:** починає **завантаження конкретного CSS** з high priority.

**Де видно:**

| Момент | `bad` | `best` |
|---|---|---|
| Поки `parser-blocking.js` pending | немає Google Fonts CSS | CSS є, Initiator **`preload`** |
| Після JS inject | CSS download → `.woff2` | CSS уже в кеші → одразу `.woff2` |

**Обмеження:** `preload as="style"` качає лише CSS. URL `.woff2` всередині CSS — браузер дізнається про них лише коли stylesheet **активується** (після JS inject). Тому `.woff2` у обох варіантах стартує **після** blocking script; виграш preload — **CSS уже готовий**.

### 4. `prefetch` (`best.html`)

```html
<link rel="prefetch" href="/lab/06-fetch-priority/best" as="document">
```

**Коли виконується:** після критичних ресурсів, speculative.

**Що робить:** низькопріоритетно підвантажує HTML для **майбутньої** навігації.

**Де видно:** запит до `/lab/06-fetch-priority/best`, Initiator **`prefetch`**, Priority **Lowest**.

## Important Pitfalls (Edge Cases)

### Preload scanner ховає різницю між `bad` і `best`

Якщо Google Fonts підключити статичним `<link rel="stylesheet">` після blocking script у HTML, **preload scanner знайде його заздалегідь** — CSS стартує навіть без `rel="preload"`.

Симптом: у `bad.html` CSS з Initiator `bad.html:58` з'являється поки script pending.

**Fix у lab:** JS inject після blocking script — scanner не бачить URL.

### `Disable cache` не скидає DNS

Network → Disable cache впливає лише на **HTTP cache**. DNS кешується окремо.

Для порівняння `bad` vs `better`:

1. `chrome://net-internals/#dns` → **Clear host cache**
2. Hard reload однієї сторінки
3. Повторити для другої сторінки

### `localhost:3001` погано демонструє DNS

На `localhost` Chrome часто **не малює** рядок DNS Lookup (~0 ms). Тому lab переведено на **Google Fonts** — там DNS видно в Timing.

### Connection reuse між запитами

Якщо дивитись Timing на **другому** запиті до того ж origin (наприклад hero-image після font), **DNS Lookup і Initial connection можуть бути відсутні** — з'єднання вже відкрито першим запитом. Аналізуй **перший** запит до `fonts.gstatic.com`.

### Same-origin шрифт з `lab.css`

`lab.css` містить `@font-face` на `/assets/fonts/lab-font.woff2` (same-origin, ~2 ms). Не плутати з cross-origin `.woff2` від Google Fonts (`?delay` немає, Initiator `lab.css` або Google Fonts CSS).

## Debugging Checklist

### Baseline (`bad.html`)

- [ ] Disable cache → Hard reload
- [ ] Поки `parser-blocking.js?delay=8000` pending — **немає** `fonts.googleapis.com` / `gstatic`
- [ ] Після script — CSS → `.woff2`
- [ ] Timing на `.woff2` — є **DNS Lookup**

### `dns-prefetch` (`better.html` vs `bad`)

- [ ] Clear host cache перед кожним прогоном
- [ ] Фільтр `gstatic` → Timing на `.woff2`
- [ ] `bad`: DNS Lookup ~15–25 ms
- [ ] `better`: DNS Lookup **відсутній**
- [ ] CSS під час pending script однаковий (немає) — це очікувано

### `preconnect` + `preload` (`best.html` vs `bad`)

- [ ] Side-by-side reload обох сторінок
- [ ] Поки script pending: `best` має CSS з Initiator **`preload`**, `bad` — ні
- [ ] Після script: `best` одразу `.woff2`, `bad` спочатку CSS
- [ ] Timing на `.woff2` у `best`: без DNS, коротший Initial connection
- [ ] Prefetch document: `/lab/06-fetch-priority/best`, Priority Lowest

### Колонки DevTools, які варто читати

| Колонка | Навіщо |
|---|---|
| **Waterfall / Start** | коли hint «виграє» час |
| **Initiator** | `preload`, `prefetch`, або рядок HTML/JS |
| **Timing → DNS Lookup** | ефект `dns-prefetch` |
| **Timing → Initial connection** | ефект `preconnect` |
| **Priority** | `prefetch` = Lowest |

## Recommended Study Order

```text
1. bad.html     → зрозуміти baseline і JS inject
2. better.html  → dns-prefetch на .woff2 (Clear host cache!)
3. best.html    → preload (CSS під час script) + preconnect (.woff2) + prefetch (lab 06)
```

## Related Docs

- `docs/worksheet.md` — питання для самоперевірки (розділ 05)
- `docs/expected-observations.md` — короткий checklist очікувань
- `docs/preload-scanner-learning-notes.md` — чому JS inject потрібен для чесного порівняння
- https://web.dev/learn/performance/resource-hints — офіційний матеріал
