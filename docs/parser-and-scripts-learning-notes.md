# Web Performance Notes: HTML Parser, Scripts, And DOMContentLoaded

Цей документ підсумовує ідеї для майбутньої статті про те, як браузер парсить HTML, знаходить ресурси і поводиться зі scripts. Він не прив'язаний до конкретного проекту або фреймворку. Його можна використовувати як основу для пояснювальної статті про parser-blocking scripts, `defer`, `async`, `type="module"` і `DOMContentLoaded`.

## HTML Parser And Preload Scanner Are Different

У браузері важливо розділяти дві різні ролі:

```text
HTML parser = будує DOM
preload scanner = шукає майбутні resource URLs
```

HTML parser читає HTML послідовно і створює DOM-дерево. Коли parser доходить до звичайного classic script без `defer`, `async` або `type="module"`, він має зупинитися, завантажити script, виконати його і тільки після цього продовжити parsing.

Preload scanner працює інакше. Він не будує DOM і не виконує JavaScript. Його задача - спекулятивно дивитися вперед у HTML-текст, який уже прийшов з network, і знаходити очевидні ресурси:

```html
<link rel="stylesheet" href="/styles.css">
<script src="/app.js"></script>
<img src="/hero.png" alt="">
```

Тому parser може бути заблокований на script, але браузер все одно може вже знати про ресурси нижче в HTML і навіть почати їх завантажувати.

Ключова ментальна модель:

```text
preload scanner helps with discovery
preload scanner does not continue DOM parsing
```

## Discovery Is Not Download

Коли браузер знайшов ресурс, це ще не означає, що download уже стартував.

Корисно розділяти pipeline на окремі етапи:

```text
discovery -> scheduling -> download -> execution/use
```

Наприклад, preload scanner може знайти image або deferred script нижче в HTML. Але після discovery ресурс потрапляє до browser scheduler. Scheduler вирішує, коли реально дати request network slot.

Тому у DevTools Network ресурс може виглядати як pending або довго стояти у `Queueing` / `Stalled`. Це не обов'язково означає, що браузер його не бачив. Часто це означає, що браузер уже знає про ресурс, але ще не почав або не завершив його завантаження через scheduling.

У вкладці Timing корисно дивитися:

```text
Queueing
Stalled
Request sent
Waiting for server response
Content Download
```

Ці фази допомагають відрізнити "ресурс ще не знайдений" від "ресурс знайдений, але чекає у scheduler".

## Stylesheets Block Rendering, Not HTML Parsing

Stylesheet у `<head>` зазвичай не зупиняє HTML parser:

```html
<link rel="stylesheet" href="/styles.css">
```

Браузер може продовжувати читати HTML і будувати DOM, поки CSS файл завантажується.

Але stylesheet є render-blocking resource. Для першого нормального paint браузеру потрібні:

```text
DOM + CSSOM -> render tree -> layout -> paint
```

Поки CSS не завантажений і не розпарсений у CSSOM, браузер зазвичай відкладає rendering. Інакше він міг би намалювати сторінку без стилів, а потім одразу перемалювати її зі стилями.

Важливий нюанс: CSS може непрямо затримати classic script. Якщо після stylesheet стоїть parser-blocking script:

```html
<link rel="stylesheet" href="/styles.css">
<script src="/app.js"></script>
```

браузер може чекати stylesheet перед виконанням script, бо script потенційно може читати computed styles:

```js
getComputedStyle(document.body);
```

Тому stylesheet не блокує HTML parsing напряму, але може впливати на critical path через rendering і script execution.

## Classic Scripts Can Block The Parser

Звичайний external classic script без атрибутів є parser-blocking:

```html
<script src="/app.js"></script>
```

Коли HTML parser доходить до такого script, відбувається приблизно це:

```text
1. parser зупиняється
2. browser завантажує script, якщо він ще не завантажений
3. browser виконує script
4. parser продовжує читати HTML
```

Причина в тому, що classic script може змінити документ прямо під час parsing:

```js
document.write("<h1>Inserted by script</h1>");
```

або звернутися до DOM, який уже побудований:

```js
document.querySelector("main");
```

Браузер не може безпечно продовжити DOM construction повз такий script, поки не виконає його.

Це не означає, що браузер стає повністю "сліпим". Preload scanner може побачити ресурси нижче в HTML. Але сам DOM parsing стоїть.

## `defer` Lets The Parser Continue

`defer` змінює поведінку external classic script:

```html
<script src="/app.js" defer></script>
```

Такий script завантажується паралельно з HTML parsing, але не виконується одразу. Parser може продовжити читати HTML і будувати DOM.

Поведінка:

```text
1. parser бачить defer script
2. download стартує паралельно
3. parser продовжує HTML
4. parsing завершується
5. defer scripts виконуються
6. DOMContentLoaded fired
```

Якщо на сторінці кілька deferred scripts, вони виконуються у порядку HTML, а не в порядку завершення download:

```html
<script src="/one.js" defer></script>
<script src="/two.js" defer></script>
```

Навіть якщо `two.js` завантажиться швидше, execution order буде:

```text
one.js
two.js
```

Це робить `defer` добрим default для classic scripts, які потрібні сторінці, але не мають блокувати parser.

Важливий нюанс: `defer` має сенс для external scripts. Для inline script він не дає потрібної deferred-поведінки:

```html
<script defer>
  console.log("inline");
</script>
```

Inline script виконується тоді, коли parser до нього дійшов.

## `async` Is Independent And Orderless

`async` теж дозволяє завантажувати script паралельно з HTML parsing:

```html
<script src="/analytics.js" async></script>
```

Але на відміну від `defer`, async script виконується одразу після завершення download. Якщо parser у цей момент ще працює, execution може тимчасово перервати parsing.

Поведінка:

```text
1. parser бачить async script
2. download стартує паралельно
3. parser продовжує HTML
4. script завантажився
5. browser виконує script одразу
6. parser продовжує після execution
```

Async scripts не гарантують порядок виконання:

```html
<script src="/slow.js" async></script>
<script src="/fast.js" async></script>
```

Якщо `fast.js` завантажиться раніше, він може виконатися раніше, навіть якщо стоїть нижче в HTML:

```text
fast.js
slow.js
```

Тому `async` добре підходить для незалежних scripts: analytics, tracking, isolated widgets. Його не варто використовувати для scripts, які залежать один від одного або мають виконуватися у визначеному порядку.

## Module Scripts Are Deferred By Default

Сучасний module script підключається так:

```html
<script type="module" src="/app.js"></script>
```

Module script не блокує HTML parser під час download. У цьому сенсі він схожий на `defer`.

Спрощена поведінка:

```text
1. parser бачить module script
2. download стартує паралельно
3. parser продовжує HTML
4. parsing завершується
5. module script виконується
6. DOMContentLoaded fired
```

Але module script - це не просто classic script з іншим timing. Це JavaScript module:

```js
import { init } from "./init.js";

init();
```

Modules підтримують `import` / `export`, мають module scope і завжди виконуються у strict mode.

Практичні відмінності:

```text
defer = classic script, відкладене виконання
type="module" = JavaScript module, deferred by default
```

У module script top-level `this` не є `window`, а змінні верхнього рівня не стають global properties. Module scripts також мають іншу CORS-поведінку, особливо коли завантажуються з іншого origin.

Inline module script працює:

```html
<script type="module">
  import { init } from "/init.js";
  init();
</script>
```

Це ще одна відмінність від `defer`, який не дає корисної deferred-поведінки для inline classic script.

## DOMContentLoaded Is Not Just "Parser Reached The End"

`DOMContentLoaded` часто описують як момент, коли HTML document повністю розпарсений. Це близько до правди, але неповно.

Точніша модель:

```text
DOMContentLoaded fires after:
1. HTML parsing finished
2. deferred classic scripts executed
3. module scripts executed
```

Тому `DOMContentLoaded` чекає `defer` scripts:

```html
<script src="/app.js" defer></script>
```

і чекає module scripts:

```html
<script type="module" src="/app.js"></script>
```

Але `DOMContentLoaded` не чекає `async` scripts:

```html
<script src="/analytics.js" async></script>
```

Якщо async script завантажився дуже швидко, він може виконатися до `DOMContentLoaded`. Якщо завантажився пізно, `DOMContentLoaded` може пройти без нього.

Для `defer` порядок стабільний:

```text
HTML parsing finished
defer scripts execute in HTML order
DOMContentLoaded
```

Для `async` порядок нестабільний:

```text
async script may execute before DOMContentLoaded
or
DOMContentLoaded may fire before async script executes
```

Для module scripts:

```text
HTML parsing finished
module graph loaded and executed
DOMContentLoaded
```

Якщо module має imports, browser має завантажити і виконати dependency graph перед `DOMContentLoaded`.

## What To Look For In DevTools

Для аналізу parser/script behavior корисні дві панелі: Network і Performance.

У Network варто дивитися:

```text
request start
waterfall
Timing -> Queueing / Stalled / Request sent / Waiting / Content Download
```

У Performance варто дивитися:

```text
Parse HTML
Evaluate Script
DOMContentLoaded marker
FCP / LCP markers
```

Корисні питання під час аналізу:

```text
Де HTML parser зупинився?
Який script виконувався у цей момент?
Чи був script parser-blocking?
Чи продовжив parser роботу під час download?
Коли fired DOMContentLoaded?
Чи чекав DOMContentLoaded цей script?
Чи зберігся порядок execution?
```

Ці питання допомагають перейти від простого "ресурс довго вантажився" до точнішого розуміння: чи проблема була у discovery, scheduling, blocking behavior або execution.

