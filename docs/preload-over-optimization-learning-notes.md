# Web Performance Notes: Preload Over-Optimization

`preload` корисний тоді, коли сторінці точно потрібен конкретний критичний ресурс дуже рано. Але це не універсальна оптимізація. Некоректний або надмірний preload може не спрацювати, створити duplicate requests, засмітити waterfall або змусити браузер витрачати bandwidth на некритичні ресурси.

Головна ідея:

```text
preload - це не "завантаж усе раніше".
preload - це точний контракт із браузером:
цей ресурс, такого типу, з такими request параметрами, потрібен дуже скоро.
```

## Core Concepts

### Discovery Is Not The Same As Scheduling

`preload` впливає на discovery: він робить ресурс видимим браузеру раніше, ніж browser дійшов би до звичайного місця, де цей ресурс оголошений.

Наприклад:

```html
<link rel="preload" href="/hero.jpg" as="image">
```

означає:

```text
цей image потрібен для поточної навігації;
почни request рано, ще до того, як звичайний <img> буде розпарсений або layout покаже його важливість.
```

Але `preload` не гарантує миттєве завантаження. Після discovery request все одно проходить через browser scheduler, де конкурує з CSS, JS, fonts та іншими ресурсами.

### The `as` Attribute Is Part Of The Contract

`as` описує тип ресурсу:

```html
<link rel="preload" href="/hero.jpg" as="image">
<link rel="preload" href="/app.css" as="style">
<link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>
```

`as` потрібен браузеру для:

- правильного request destination;
- правильної priority;
- правильного `Accept` header;
- cache matching;
- CORS/security policy;
- коректного reuse, коли реальний споживач ресурсу з'явиться пізніше.

Без валідного `as` browser може відхилити preload як некоректний hint.

### `crossorigin` Must Match The Real Request

Fonts зазвичай завантажуються через CORS-mode request. Тому font preload має відповідати реальному `@font-face` request:

```html
<link
  rel="preload"
  href="https://static.example.com/font.woff2"
  as="font"
  type="font/woff2"
  crossorigin
>
```

Якщо preload і реальний font request мають різний CORS mode, browser може не reuse-нути preload response. У результаті можливий duplicate download або warning про unused preload.

## How It Works

### Correct Image Preload

```html
<head>
  <link rel="preload" href="/hero.jpg" as="image" fetchpriority="high">
</head>
<body>
  <img src="/hero.jpg" width="1200" height="800" alt="">
</body>
```

Очікувана механіка:

```text
1. Browser читає head.
2. Бачить valid preload з as="image".
3. Стартує early image request.
4. Пізніше parser доходить до <img>.
5. <img> reuse-ить уже запущений або вже завершений request.
```

### Missing `as`

```html
<head>
  <link rel="preload" href="/hero.jpg">
</head>
<body>
  <img src="/hero.jpg" width="1200" height="800" alt="">
</body>
```

Очікувана механіка:

```text
1. Browser бачить preload без valid as.
2. Hint вважається некоректним.
3. Ранній preload request може не стартувати.
4. Image все одно завантажиться, але звичайним шляхом, коли browser знайде <img>.
```

Важливо: якщо `<img>` знаходиться дуже рано в HTML, runtime-різниця може бути майже непомітною. У такому випадку warning є правильним сигналом про помилку markup, але не обов'язково демонструє сильний performance impact.

Щоб побачити реальну різницю в waterfall, ресурс має бути late-discovered:

```html
<head>
  <link rel="preload" href="/hero.jpg">
  <script src="/blocking-script.js"></script>
</head>
<body>
  <img src="/hero.jpg" width="1200" height="800" alt="">
</body>
```

У цьому прикладі preload без `as` не дає раннього image request. Правильний preload з `as="image"` може стартувати request ще до blocking script.

## Observable Signals

### Console Warnings

Browser може показати warning на кшталт:

```text
<link rel=preload> must have a valid `as` value
```

Це означає, що hint некоректний. Але сам warning не завжди показує розмір performance impact. Для досвідченого аналізу warning варто підтверджувати через Network або Resource Timing.

### Network Panel

У Network варто дивитися:

- чи є duplicate request до того самого URL;
- чи request стартує раніше за звичайний discovery point;
- `Priority`;
- `Timing`, особливо `Queued`, `Stalled`, `Started at`;
- waterfall position;
- чи з'являються некритичні resources дуже рано.

`Headers` корисні, але не завжди достатні. Наприклад, `Sec-Fetch-Dest: image` може бути однаковим і для звичайного `<img>` request, і для коректного image preload, який потім reuse-иться.

Тому `Sec-Fetch-Dest` не є надійним способом довести, що preload спрацював.

### Resource Timing `initiatorType`

Найшвидший програмний спосіб перевірити, хто ініціював resource request, - Resource Timing API:

```js
performance
  .getEntriesByType("resource")
  .filter((entry) => entry.name.includes("hero.jpg"))
  .map((entry) => ({
    name: entry.name,
    initiatorType: entry.initiatorType,
    startTime: Math.round(entry.startTime),
    duration: Math.round(entry.duration),
  }));
```

Типові значення:

```text
initiatorType: "link"  -> request був ініційований <link>, наприклад preload
initiatorType: "img"   -> request був ініційований <img>
initiatorType: "css"   -> request прийшов з CSS, наприклад background-image або font
initiatorType: "script" -> request ініціював script
```

Для image preload важлива різниця:

```text
correct preload:
initiatorType може бути "link"

missing or ineffective preload:
initiatorType часто буде "img"
```

Практичний висновок: у простій сторінці різниця може проявитися не як великий виграш у мілісекундах, а як зміна джерела discovery.

Наприклад:

```text
preload без valid as:
hero.jpg: img @ 10.9ms

preload з as="image":
hero.jpg: link @ 8.6ms
```

Це означає:

```text
img  -> browser знайшов ресурс як звичайний <img>
link -> browser знайшов ресурс через <link rel="preload">
```

Тобто доказ роботи preload - не тільки "стало швидше", а й "resource request стартував з іншого джерела discovery".

Це корисніше за `Sec-Fetch-Dest`, бо `initiatorType` відповідає на питання:

```text
Хто стартував request?
```

А `Sec-Fetch-Dest` відповідає на інше питання:

```text
Який destination у request?
```

Для аналізу preload нас цікавить саме перше.

## Patterns And Trade-offs

### Use Preload For Critical Current-Page Resources

Добрі кандидати:

- LCP image, який browser інакше знайде пізно;
- critical font, якщо він справді потрібен above the fold;
- critical CSS або script у дуже специфічних випадках, коли звичайний discovery запізнюється.

Слабкі кандидати:

- thumbnails;
- images нижче першого viewport;
- route assets для невідомої майбутньої навігації;
- scripts, які не потрібні для first paint або LCP.

### Prefer Correct Discovery Before Adding More Hints

Якщо ресурс можна зробити видимим у HTML, це часто краще, ніж компенсувати пізній discovery preload-ом.

Наприклад:

```html
<img src="/hero.jpg" width="1200" height="800" alt="">
```

зазвичай прозоріше для браузера, ніж CSS background image, який потрібно компенсувати preload-ом.

### Preload Does Not Replace `fetchpriority`

`preload` відповідає за ранній discovery. `fetchpriority` підказує scheduler-у важливість request.

```html
<link rel="preload" href="/hero.jpg" as="image" fetchpriority="high">
<img src="/hero.jpg" fetchpriority="high" alt="">
```

Ментальна модель:

```text
preload = знайди раніше
fetchpriority = плануй як важливіший/менш важливий
```

## Anti-Patterns

### Preload Without `as`

```html
<link rel="preload" href="/hero.jpg">
```

Проблема: browser не отримує достатньо інформації про request destination і може відхилити hint.

### Font Preload Without `crossorigin`

```html
<link rel="preload" href="/font.woff2" as="font">
```

Проблема: preload request може не збігтися з реальним `@font-face` request. Для fonts майже завжди потрібно:

```html
<link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>
```

### Excessive Preload

```html
<link rel="preload" href="/hero.jpg" as="image">
<link rel="preload" href="/thumb-1.jpg" as="image">
<link rel="preload" href="/thumb-2.jpg" as="image">
<link rel="preload" href="/non-critical.js" as="script">
```

Проблема: browser отримує сигнал, що багато ресурсів потрібні рано. Це може створити bandwidth contention і зменшити користь для справді критичного ресурсу.

Якщо все preload-иться, preload перестає бути корисним сигналом.

## Edge Cases

### Missing `as` May Look Harmless In Simple Pages

Якщо реальний `<img>` знаходиться одразу після `head`, image request може стартувати дуже рано навіть без preload. У такій сторінці різниця між invalid preload і correct preload може бути майже невидимою.

Це не означає, що `as` неважливий. Це означає, що page structure не підкреслює різницю в часі. У такому випадку дивись не тільки `startTime`, а й `initiatorType`: `img` означає звичайний discovery, `link` означає preload discovery.

Щоб перевірити реальний ефект, дивись на late-discovered ресурси:

- image після blocking script;
- CSS background image;
- font з cross-origin request;
- image, який з'являється тільки після client rendering.

### DevTools Initiator Can Be Ambiguous

Network `Initiator` може показувати document chain для обох випадків. Це не завжди достатньо, щоб розрізнити correct preload reuse і звичайний image discovery.

У таких випадках Resource Timing `initiatorType` часто дає чіткіший сигнал.

### Same URL Does Not Guarantee Reuse

Для reuse важливий не тільки URL. Мають збігатися request destination, CORS mode, credentials mode, type expectations та інші параметри.

Саме тому `as`, `type` і `crossorigin` є частиною preload contract.

### Font Entries Can Reveal Mismatches

Для fonts Resource Timing може показати два різні entries:

```text
font.woff2?version=preload: link
font.woff2: css
```

Це важливий сигнал. `link` означає preload request, `css` означає реальний `@font-face` request. Якщо URL, query string, CORS mode або інші request параметри не збігаються, browser може сприймати їх як різні ресурси і не reuse-нути preload.

Для font preload треба перевіряти не лише наявність `initiatorType: "link"`, а й те, що реальний font request не дублюється окремим `initiatorType: "css"` entry.

## Debugging Checklist

1. Відкрий DevTools Console і перевір warnings про preload.
2. У Network увімкни `Disable cache` і зроби hard reload.
3. Перевір, чи немає duplicate requests до одного ресурсу.
4. Відкрий resource і подивись `Timing`: коли request був queued і started.
5. Не покладайся лише на `Sec-Fetch-Dest`; він показує destination, а не джерело discovery.
6. У Console перевір Resource Timing:

```js
performance
  .getEntriesByType("resource")
  .filter((entry) => entry.name.includes("hero"))
  .map((entry) => ({
    name: entry.name,
    initiatorType: entry.initiatorType,
    startTime: entry.startTime,
    duration: entry.duration,
  }));
```

7. Для image preload очікуй `initiatorType: "link"` у випадку раннього preload request.
8. Для звичайного image discovery очікуй `initiatorType: "img"`.
9. Якщо `startTime` майже однаковий, порівняй порядок entries: `link` перед `img`/`script` показує, що preload змінив discovery order.
10. Для fonts перевір, що preload має `as="font"`, правильний `type` і `crossorigin`.
11. Для fonts перевір, чи немає окремого `css` request до того самого font, який мав би reuse-нути preload.
12. Якщо performance-різниця не видима, переконайся, що ресурс справді late-discovered; інакше experiment може показувати тільки warning або зміну `initiatorType`, а не великий runtime impact.

## Practical Rules

- Preload only what is needed for the current page very soon.
- Always set a valid `as`.
- For fonts, include `type` and `crossorigin`.
- Do not preload every visible asset.
- Use `fetchpriority` to influence scheduling, not discovery.
- Use Resource Timing `initiatorType` when DevTools `Initiator` or headers are ambiguous.
- Treat `img` -> `link` in `initiatorType` as evidence that preload changed discovery source, even when timing difference is small.
- Treat Console warnings as correctness signals, then verify runtime impact with Network and Resource Timing.
