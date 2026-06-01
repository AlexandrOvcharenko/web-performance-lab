# Web Performance Notes: LCP, Resource Discovery, Preload, And Browser Scheduling

Цей документ підсумовує базові ідеї, які варто розуміти перед глибшим зануренням у loading performance. Він не прив'язаний до конкретного проекту або фреймворку. Його можна використовувати як основу для майбутньої серії статей про web performance.

## LCP Is Not Always An Image Element

Largest Contentful Paint, або LCP, вимірює момент, коли браузер намалював найбільший важливий контент у viewport.

Важливо: LCP element - це DOM-елемент, який був намальований. Це не завжди тег `<img>`.

Наприклад, якщо hero-зображення підключене так:

```html
<img src="/hero.png" alt="">
```

то LCP element може бути:

```text
img
```

Але якщо те саме зображення підключене через CSS:

```css
.hero {
  background-image: url("/hero.png");
}
```

то LCP element може бути:

```text
section.hero
```

Це нормально. У такому випадку DOM-елементом є `section`, а image URL є ресурсом, який допоміг цей елемент намалювати.

Корисна ментальна модель:

```text
LCP element = DOM element, який браузер намалював
LCP resource = image/font/resource, який був потрібен для цього paint
```

## LCP Can Change During One Page Load

LCP - це не обов'язково одна незмінна подія.

Під час завантаження сторінки браузер може кілька разів оновлювати LCP candidate.

Наприклад:

```text
1. Намалювався заголовок h1.
   Він поки найбільший contentful element.
   Поточний LCP candidate = h1.

2. Пізніше завантажився великий hero background.
   Тепер section.hero більший за h1.
   Поточний LCP candidate = section.hero.

3. Браузер завершує observation window.
   Final LCP = останній найбільший candidate.
```

Тому в DevTools можна спочатку побачити LCP element як `h1`, а потім як `section.hero`. Це не суперечність. Це означає, що сторінка продовжувала малювати більший контент.

Для аналізу важливий фінальний LCP candidate, але проміжні кандидати теж корисні: вони показують, як сторінка поступово стає видимою.

## Resource Discovery Matters

Одне з найважливіших питань loading performance:

```text
Коли браузер дізнався, що цей ресурс потрібен?
```

Браузер не може завантажити ресурс, про який він ще не знає.

Якщо image є прямо в HTML:

```html
<img src="/hero.png" alt="">
```

браузер може знайти його рано під час HTML parsing або preload scanning.

Якщо image схований у CSS:

```css
.hero {
  background-image: url("/hero.png");
}
```

то браузер побачить image URL тільки після того, як:

```text
1. HTML послався на CSS.
2. CSS файл завантажився.
3. CSS файл був розпарсений.
4. Browser дійшов до background-image.
```

Тому CSS background image часто є late-discovered resource.

Типовий ланцюжок:

```text
HTML
-> CSS request
-> CSS download
-> CSS parse
-> image discovered
-> image request
-> image loaded
-> element painted
-> LCP
```

Проблема не лише в тому, що image довго завантажується. Проблема може бути в тому, що browser занадто пізно про нього дізнався.

## Preload Makes A Resource Discoverable Earlier

`rel="preload"` - це спосіб сказати браузеру:

```text
Цей ресурс точно скоро знадобиться. Почни завантажувати його раніше.
```

Приклад:

```html
<link rel="preload" href="/hero.png" as="image" fetchpriority="high">
```

Що робить кожна частина:

```html
rel="preload"
```

Підказує браузеру завантажити ресурс рано, ще до того, як він буде знайдений природним шляхом.

```html
href="/hero.png"
```

URL ресурсу.

```html
as="image"
```

Пояснює тип ресурсу. Це важливо для priority, cache matching, security rules і правильного повторного використання request.

```html
fetchpriority="high"
```

Додатковий сигнал browser scheduler-у, що цей ресурс важливий.

Preload не застосовує ресурс. Він лише завантажує його або починає active request.

Наприклад, якщо image використовується в CSS:

```css
.hero {
  background-image: url("/hero.png");
}
```

CSS усе одно потрібен, щоб image реально з'явився на сторінці. Але preload дає можливість почати завантаження image раніше.

Без preload:

```text
HTML
-> CSS
-> CSS parse
-> hero.png discovered
-> hero.png request starts
```

З preload:

```text
HTML
-> hero.png discovered by preload
-> hero.png request starts early
-> CSS
-> CSS parse
-> CSS reuses already requested image
```

Коротко:

```text
preload = знайти ресурс раніше
```

## Fetch Priority Is A Scheduling Hint

`fetchpriority="high"` не робить ресурс магічно першим завжди.

Він каже browser scheduler-у:

```text
Коли будеш планувати network requests, вважай цей ресурс важливим.
```

Це особливо корисно для LCP image, якщо браузер може не одразу зрозуміти, що саме цей image є найважливішим.

Але `fetchpriority` і `preload` вирішують різні проблеми:

```text
preload = допомагає раніше знайти ресурс
fetchpriority = допомагає дати йому вищу пріоритетність
```

Якщо ресурс знайдений пізно, сам `fetchpriority` може не допомогти достатньо. Якщо ресурс знайдений рано, але конкурує з багатьма іншими ресурсами, `fetchpriority` може бути корисним сигналом.

## The Browser Has A Scheduler, Not A Simple Queue

Коли браузер знаходить ресурс, він не завжди одразу фізично починає download.

Спрощений pipeline:

```text
HTML parser / preload scanner
        ↓
resource discovered
        ↓
browser assigns type and priority
        ↓
request enters scheduling
        ↓
scheduler decides when to start it
        ↓
network request starts
```

Це не проста FIFO-черга.

Браузер враховує:

- тип ресурсу: document, CSS, JS, font, image, fetch, prefetch;
- чи ресурс render-blocking;
- чи ресурс parser-blocking;
- priority;
- `fetchpriority`;
- origin;
- HTTP protocol;
- connection limits;
- bandwidth;
- cache state;
- browser heuristics;
- чи сторінка активна або backgrounded.

Тому не варто думати:

```text
browser бере перші 6 ресурсів, потім наступні 6
```

Правильніше:

```text
browser постійно переоцінює, які requests важливіші,
і запускає їх відповідно до priority, ресурсних обмежень і network state.
```

Для HTTP/1.1 часто згадують обмеження приблизно 6 concurrent connections per origin, але це не універсальна модель для всіх випадків. HTTP/2 і HTTP/3 використовують multiplexed streams, де багато requests можуть іти через одне connection, але bandwidth усе одно обмежений.

## You Cannot See The Scheduler Queue Directly In DevTools

DevTools не показує внутрішню таблицю browser scheduler-а.

Немає окремої панелі типу:

```text
Network Scheduler Queue
1. app.css
2. hero.png
3. font.woff2
```

Але можна побачити наслідки scheduler-а.

У Network panel корисні колонки:

```text
Priority
Initiator
Waterfall
```

У деталях request корисна вкладка:

```text
Timing
```

Там можна дивитись:

```text
Queueing
Stalled
Request sent
Waiting for server response
Content Download
```

Для практичного аналізу особливо корисні:

```text
Waterfall start time
Initiator
Priority
```

Якщо ресурс ще не був discovered, він просто не з'явиться в Network.

Якщо ресурс уже discovered, але не стартував через scheduling або connection limits, це може проявитися як `Queueing` або `Stalled`.

## LCP Marker Is A Paint Moment, Not A Discovery Moment

LCP marker у Performance panel показує момент, коли найбільший contentful element був намальований.

Він не показує момент, коли браузер знайшов LCP resource.

Для image-based LCP треба розрізняти:

```text
resource discovery
resource request start
resource download complete
element paint
LCP marker
```

Приклад:

```text
CSS finished
-> browser discovered hero.png
-> hero.png request started
-> hero.png loaded
-> section.hero painted
-> LCP marker
```

Як побачити discovery practically:

```text
Network request start + Initiator
```

Якщо `Initiator` вказує на CSS, ресурс був знайдений через CSS.

Якщо `Initiator` вказує на HTML/preload, ресурс був знайдений раніше через HTML.

## DevTools Insights Help Find LCP Problems

У Chrome DevTools Performance panel є Insights sidebar. Він допомагає не шукати вручну всі події в timeline.

Для LCP особливо корисні:

```text
LCP by phase
LCP request discovery
```

`LCP by phase` розкладає час до LCP на частини. Це допомагає зрозуміти, де саме втрачається час:

```text
document / TTFB
resource load delay
resource load duration
element render delay
```

`LCP request discovery` допомагає зрозуміти, чи був LCP resource знайдений надто пізно.

Якщо LCP image схований у CSS або JS, цей insight може показати, що ресурс міг бути discovered earlier.

## How To Read A Late-Discovered LCP Trace

Для CSS background LCP типовий trace виглядає так:

```text
baseline styles request
        ↓
CSS with background-image finishes
        ↓
hero image request starts
        ↓
hero image finishes
        ↓
LCP marker
```

Ключова ознака проблеми:

```text
image request starts only after CSS is downloaded
```

Після preload trace має виглядати інакше:

```text
hero image request starts early
CSS with background-image still loads
CSS applies background
LCP marker
```

Тобто preload не прибирає потребу в CSS, але прибирає пізнє відкриття image request.

## Minimal Experiments Are Easier To Understand

Для навчання performance важливо прибирати зайві ресурси.

Якщо на сторінці є зайві scripts, fonts, shared CSS, analytics або framework runtime, Network waterfall стає важче читати.

Для простого експерименту краще мати мінімальний набір:

```text
document
layout CSS
delayed CSS with image URL
image resource
```

Так легше побачити causal chain:

```text
resource discovery
request start
download
paint
LCP
```

Коли експеримент зрозумілий у мінімальному вигляді, його можна переносити на складніші production scenarios.

## Key Mental Models

```text
LCP can change during load.
```

```text
Final LCP is the last largest candidate before observation ends.
```

```text
LCP element and LCP resource are not always the same thing.
```

```text
A resource cannot be downloaded before it is discovered.
```

```text
CSS background images can be discovered late.
```

```text
preload makes a resource discoverable earlier.
```

```text
fetchpriority influences scheduling, not discovery.
```

```text
The browser scheduler is priority-based, not FIFO.
```

```text
DevTools does not show the internal scheduler queue directly.
```

```text
Network request start plus Initiator is the practical way to infer discovery.
```

```text
LCP marker is the paint moment, not the discovery moment.
```

```text
For learning, remove every resource that does not teach the current behavior.
```
