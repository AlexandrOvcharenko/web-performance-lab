# Web Performance Notes: Fetch Priority (Lab 06)

Цей документ підсумовує урок `06-fetch-priority`: як **порядок discovery у HTML**, **`preload`** і **`fetchpriority`** впливають на scheduler браузера, LCP image і thumbnails. Мета — зрозуміти різницю між **discovery** (коли з’являється запит) і **scheduling** (коли запит реально стартує), і **де** це видно в DevTools.

## Entry Point

Lab відкривається з dashboard або напряму:

- `/labs/06-fetch-priority/bad.html` — без оптимізацій
- `/labs/06-fetch-priority/better.html` — `preload` hero у `<head>`
- `/labs/06-fetch-priority/best.html` — `preload` + `fetchpriority="high"` на hero, `fetchpriority="low"` на thumbs

Усі варіанти використовують:

- Hero: `/assets/images/hero.png?delay=7000` (LCP candidate, 960×640)
- Thumbnails: `/assets/images/thumb-1.svg?delay=7000` … `thumb-3.svg?delay=7000`

Параметр `?delay=7000` штучно затягує **TTFB** (~7 s). Content Download зазвичай < 1 ms — lab показує **чергу scheduler**, а не конкуренцію за bandwidth під час завантаження великих файлів.

## High-Level Flow

### Розмітка vs візуальний порядок

Thumbnails у HTML **перед** hero; CSS flex `order` показує hero зверху. LCP лишається hero image.

```text
DOM order (discovery):     thumb-1 → thumb-2 → thumb-3 → hero.png
Visual order (CSS order):  hero section → thumb grid
LCP element:               hero image (найбільший painted content)
```

Структура в `public/assets/css/lab.css`:

```css
.gallery-layout { display: flex; flex-direction: column; }
.gallery-layout .gallery-hero { order: 1; }
.gallery-layout .gallery-thumbs { order: 2; }
```

### Лестниця оптимізацій

```text
bad    →  hero останній у discovery; Medium → High після layout (занадто пізно)
better →  preload hero у head → discovery до thumbs; hero ще може коротко чекати в scheduler
best   →  preload + fetchpriority high/low → hero без queuing; thumbs явно відкладаються
```

### preload vs fetchpriority

```text
preload       →  раніше знайти ресурс (discovery)
fetchpriority →  вищий/нижчий пріоритет у scheduler (scheduling)
```

`fetchpriority="high"` **не** чекає повного завантаження hero перед стартом thumbs. Він відкладає **старт** Low-запитів на десятки ms і віддає перевагу High під час конкуренції за слоти/bandwidth.

## Key Files

| Файл | Роль |
|------|------|
| `public/labs/06-fetch-priority/bad.html` | Baseline: thumbs перед hero у DOM, без hints |
| `public/labs/06-fetch-priority/better.html` | `<link rel="preload" href="hero.png" as="image">` у `<head>` |
| `public/labs/06-fetch-priority/best.html` | Preload + `fetchpriority="high"`; thumbs з `fetchpriority="low"`; `<img fetchpriority="high">` на hero |
| `public/assets/css/lab.css` | `.gallery-layout` — flex order для візуального hero зверху |
| `server/labs.js` | Описи варіантів на dashboard |
| `docs/expected-observations.md` | Короткі очікувані спостереження |
| `docs/worksheet.md` | Питання для самоперевірки |

## Important State And Events

### Browser scheduler pipeline (спрощено)

```text
HTML parser / preload scanner
        ↓
resource discovered  →  Network list order
        ↓
priority assigned    →  Priority column (Medium / High / Low)
        ↓
queuing / stalled    →  світла «палочка» у waterfall
        ↓
request started      →  Timing: Started at
        ↓
TTFB + download      →  зелена смуга (у lab ~7 s TTFB)
```

### Priority у `bad`

- Спочатку всі images: **Medium**
- Після layout Chrome підвищує hero до **High** (LCP-aware heuristics)
- Підвищення **після** старту запиту — thumbnails уже в мережі

### Network discovery order у `bad`

```text
thumb-1 → thumb-2 → thumb-3 → hero.png
```

Типові Timing (localhost, без throttling):

| Ресурс | Queued at | Started at | Queuing |
|--------|-----------|------------|---------|
| thumbs | ~31 ms | ~40–50 ms | ~10–20 ms |
| hero | ~31 ms | ~100 ms+ | ~75 ms |

Hero **Queued** приблизно разом із thumbs, але **Started** значно пізніше — чекає, поки попередні image requests займуть слоти scheduler.

### `better`: preload hero

```html
<link rel="preload" href="/assets/images/hero.png?delay=7000" as="image">
```

- Hero у Network **перед** thumbs, Initiator **`preload`**
- Hero `Started at` значно раніше за `bad` (~100 ms → одразу після head)
- Thumbnails без `fetchpriority`: **Medium**, стартують рано і конкурують

Типові Timing thumbs (localhost):

| | `better` thumb-1 | `best` thumb-1 |
|---|------------------|----------------|
| Started at | ~45 ms | ~84 ms |

### `best`: preload + fetchpriority

```html
<link rel="preload" href="..." as="image" fetchpriority="high">
<img class="hero-image" ... fetchpriority="high">
<img ... fetchpriority="low">  <!-- кожен thumb -->
```

- Hero: Priority **High** одразу, Initiator **`preload`**
- Thumbs: Priority **Low**
- Hero queuing ~0 ms; thumbs queuing ~50–56 ms

### Waterfall: «світла палочка»

Тонка світла смужка **на початку** бару в Network waterfall = **Queuing and connecting** (Resource Scheduling).

```text
[|]           ← Queuing / Stalled (scheduler)
[████████]    ← Waiting (TTFB) — ?delay=7000
[█]           ← Content Download
```

| Варіант | Hero | Thumbs |
|---------|------|--------|
| `better` | ~10 ms queuing → палочка видна | стартують рано (~45 ms), менше queuing |
| `best` | ~0 ms queuing → **немає** палочки | ~56 ms queuing → **палочка видна** |

На throttled network (наприклад Fast 3G) hero у `better`:

- `Queued at` ~2.06 s, `Started at` ~2.07 s → ~10 ms queuing
- У Performance tooltip для preload без `fetchpriority` може бути **Low → High**

Hero у `best`:

- `Queued at` і `Started at` ~2.06 s → queuing ~0 ms

## Edge Cases

### LCP не змінюється між `better` і `best` без throttling

Bottleneck lab — **7 s TTFB** (`?delay=7000`), не download. Hero завершується ~7 s у всіх варіантах. Різниця `better` vs `best` — у **queuing**, **Priority** і **Started at** thumbs, не у фінальному часі LCP marker.

### Мало конкуруючих ресурсів на localhost

Файли малі; Content Download < 1 ms. Без Network throttling **bandwidth competition** майже не видна. Для сильнішого ефекту: DevTools → **Fast 3G** / **Slow 3G**, Disable cache, Hard reload.

### `fetchpriority` не блокує thumbs до кінця hero

Thumbs у `best` стартують через ~80–100 ms, не через 7 s. Паралельні запити під час TTFB можливі; Low лише **відкладає старт** і знижує частку bandwidth.

### Priority Medium → High у `bad` — не помилка

Chrome сам підвищує hero після layout. Це не замінює явний `fetchpriority="high"` на старті.

### Preload без `fetchpriority` у `better`

Hero preload може мати неявний High, але коротке queuing (~10 ms) і конкуренція з Medium thumbs лишаються.

## Debugging Checklist

Підготовка:

- [ ] Disable cache
- [ ] Hard reload
- [ ] Для `bad` vs `better`: порівняти side-by-side
- [ ] Для `better` vs `best`: увімкнути **Network throttling** (Fast 3G) — queuing видніший

Network panel:

- [ ] Увімкнути колонки **Priority**, **Initiator**
- [ ] `bad`: порядок `thumb-1` → `thumb-2` → `thumb-3` → `hero.png`
- [ ] `better`/`best`: hero з Initiator **`preload`** перед thumbs
- [ ] `best`: hero **High**, thumbs **Low**

Timing tab:

- [ ] `bad`: hero `Started at` ~100 ms+ vs thumbs ~40–50 ms
- [ ] `better`: hero queuing ~10 ms (світла палочка); thumb-1 `Started at` ~45 ms
- [ ] `best`: hero queuing ~0 ms (без палочки); thumb-1 queuing ~56 ms (палочка + tooltip)

Performance panel:

- [ ] Tooltip hero: `better` може показати **Low → High**; `best` — **High** одразу
- [ ] LCP marker ~7 s у всіх — очікувано через `?delay=7000`

Висновок уроку:

```text
bad    → пізній discovery (hero останній у HTML)
better → preload → hero рано, але scheduler може трохи затримати (~10 ms)
best   → fetchpriority → hero без queuing; thumbs Low з видимою палочкою (~50+ ms)
```

## Зв’язок з Lab 05

У `public/labs/05-resource-hints/best.html` є prefetch наступного уроку:

```html
<link rel="prefetch" href="/lab/06-fetch-priority/best" as="document">
```

Initiator **`prefetch`**, Priority **Lowest** — speculative load для майбутньої навігації, не пов’язаний із LCP hero в lab 06.
