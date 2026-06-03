# Web Performance Notes: Preload Scanner And Resource Discovery

Цей документ підсумовує четвертий урок про preload scanner. Його можна використовувати як основу для майбутньої статті про те, як браузер знаходить ресурси під час HTML parsing, що стає late-discovered resource, і чому спосіб оголошення image/CSS/JS напряму впливає на waterfall.

## Main Idea

Браузер не може завантажити ресурс, про який ще не знає.

Для loading performance важливо не тільки те, скільки важить ресурс, а й те, коли браузер зміг його знайти:

```text
discovery -> scheduling -> download -> parse/use -> render/paint
```

Preload scanner допомагає саме на етапі discovery. Він спекулятивно читає HTML-текст, який уже прийшов з network, і шукає очевидні resource URLs:

```html
<link rel="stylesheet" href="/styles.css">
<script src="/app.js" defer></script>
<img src="/hero.png" alt="">
<link rel="preload" href="/hero.png" as="image">
```

Але preload scanner не будує DOM, не виконує JavaScript і не може знати про ресурси, URL яких схований у ще не завантаженому CSS або створюється пізніше JavaScript.

Коротка модель:

```text
HTML-visible resource = early-discovered candidate
CSS/JS-created resource = often late-discovered candidate
```

## HTML Parser And Preload Scanner

HTML parser і preload scanner виконують різні ролі:

```text
HTML parser = будує DOM у правильному порядку
preload scanner = шукає майбутні resource URLs у HTML
```

Якщо parser тимчасово заблокований або повільно йде по документу, preload scanner все одно може побачити ресурси нижче в HTML і передати їх browser scheduler-у.

Це не означає, що DOM parsing продовжився. Scanner лише знайшов URL. Далі scheduler вирішує, коли реально почати request.

## CSS Background Images Are Late-Discovered

Якщо LCP image підключений через CSS background:

```css
.hero {
  background-image: url("/hero.png");
}
```

то HTML не містить прямого image URL. Браузер бачить тільки stylesheet:

```html
<link rel="stylesheet" href="/background-hero.css">
```

Щоб знайти image, браузеру треба:

```text
1. знайти stylesheet у HTML
2. завантажити stylesheet
3. розпарсити CSS
4. знайти background-image URL
5. поставити image request у scheduler
```

Тому CSS background image часто стартує пізніше, ніж `<img src="...">`.

У DevTools Network це видно так:

```text
document
-> background-hero.css
-> hero.png starts only after CSS is available/parsed
```

У цьому випадку initiator для image часто буде CSS файл, а не HTML document.

## HTML Images Are Easier To Discover Early

Якщо hero image є прямо в HTML:

```html
<img src="/hero.png" alt="">
```

preload scanner може побачити його URL під час читання HTML. Браузеру не треба чекати CSS parsing або JavaScript execution, щоб зрозуміти, що image потрібен.

Це не гарантує миттєвий download, бо після discovery працює scheduler. Але ресурс має шанс стартувати набагато раніше.

У DevTools Network очікувана різниця:

```text
CSS background: image request starts after CSS
HTML img: image request can start while CSS/JS are still loading
```

## Preload Can Expose A Hidden Critical Resource

Якщо CSS background неминучий, можна зробити image URL видимим раніше через preload:

```html
<link rel="preload" href="/hero.png" as="image" fetchpriority="high">
```

Preload не застосовує image до DOM і не замінює CSS. CSS все одно потрібен, щоб `background-image` реально зʼявився.

Preload робить інше:

```text
без preload:
HTML -> CSS -> CSS parse -> hero.png discovered

з preload:
HTML -> hero.png discovered early
HTML -> CSS -> CSS parse -> CSS reuses image request/cache entry
```

Тобто preload - це спосіб вручну відкрити browser-у ресурс, який природно був би знайдений занадто пізно.

Важливо вказувати `as="image"`, щоб browser правильно підібрав тип request, priority, cache matching і security behavior.

## JavaScript-Injected Images Are Invisible Until JS Runs

Якщо image створюється JavaScript:

```js
const image = document.createElement("img");
image.src = "/hero.png";
container.append(image);
```

то preload scanner не може побачити цей image у HTML, бо його там ще немає.

Типовий ланцюжок:

```text
HTML
-> script discovered
-> script downloaded
-> script executed
-> image element created
-> image request starts
```

Це часто гірше для LCP, ніж server-provided або HTML-provided critical markup, бо critical image request стартує тільки після JavaScript execution.

У DevTools Network для такого кейсу важливо дивитися, що image request зʼявляється після script request і після execution timing у Performance.

## Lazy Loading Is Wrong For Above-The-Fold LCP Images

`loading="lazy"` корисний для images нижче першого екрану:

```html
<img src="/gallery-20.png" loading="lazy" alt="">
```

Але для hero/LCP image above-the-fold це поганий сигнал:

```html
<img src="/hero.png" loading="lazy" alt="">
```

Такий image є важливим для першого paint, але атрибут `loading="lazy"` каже браузеру не поспішати з request.

Ментальна модель:

```text
above-the-fold critical image -> eager/default loading
below-the-fold non-critical image -> lazy loading can help
```

Для LCP image краще не ставити `loading="lazy"`. Якщо image critical, варто зробити його легко discoverable і, за потреби, дати preload/fetchpriority signal.

## Body Stylesheet: Render Blocking Does Not Mean Discovery Blocking

Stylesheet може бути render-blocking навіть якщо стоїть у `body`:

```html
<link rel="stylesheet" href="/slow.css">

<img src="/hero.png" alt="">
<section>
  <h2>Text below stylesheet</h2>
</section>
```

Такий stylesheet може затримати paint контенту нижче, бо браузеру потрібен CSSOM для коректного rendering.

Але це не те саме, що parser-blocking classic script. Браузер все ще може продовжувати читати HTML і знайти image нижче stylesheet.

Очікувана поведінка:

```text
slow.css is pending
hero.png below it is discovered and starts loading
text below stylesheet is not painted until CSS is ready
```

У DevTools Network це допомагає відділити два різні поняття:

```text
resource discovery can continue
rendering can still be blocked
```

## What To Look For In DevTools

Для цього уроку найкорисніші інструменти:

```text
DevTools -> Network
DevTools -> Performance
DevTools -> Console metrics logs
```

У Network варто увімкнути:

```text
Disable cache
Slow 4G або інший throttling
Waterfall
Initiator
Priority
Timing
```

Питання для кожного experiment:

```text
Коли browser дізнався про resource URL?
Хто initiator request: HTML, CSS, JS, preload?
Чи стартує image request до завершення CSS/JS?
Чи є resource pending через scheduler, чи він ще не discovered?
Чи змінився LCP candidate після завантаження image?
```

У Performance корисно дивитися:

```text
Screenshots
FCP marker
LCP marker
Network track
Main thread
```

Для body stylesheet кейсу особливо важливо порівняти:

```text
Network: image request starts while CSS is pending
Screenshots: text below stylesheet appears only after CSS is loaded
```

## Practical Rules

Для critical above-the-fold ресурсів:

```text
1. Робити critical image URL видимим у HTML, якщо це можливо.
2. Не ховати LCP image у CSS background без потреби.
3. Якщо CSS background неминучий, розглянути preload.
4. Не створювати LCP image тільки після JavaScript execution.
5. Не ставити loading="lazy" на above-the-fold LCP image.
6. Відрізняти render-blocking CSS від parser-blocking JS.
7. Аналізувати не тільки duration download, а й request start time.
```

Найважливіше питання для статті:

```text
Що саме зробило critical resource visible для browser-а?
```

Якщо відповідь "HTML", ресурс має шанс стартувати рано. Якщо відповідь "CSS parse" або "JS execution", це потенційний late-discovery bottleneck.

## Key Project Files

Навчальні приклади четвертого уроку в проекті:

```text
public/labs/04-preload-scanner/bad.html
public/labs/04-preload-scanner/better.html
public/labs/04-preload-scanner/body-stylesheet.html
public/labs/04-preload-scanner/best.html
public/labs/04-preload-scanner/js-injected.html
public/labs/04-preload-scanner/lazy-above-fold.html
```

Допоміжні ресурси:

```text
public/assets/css/background-hero.css
public/assets/css/body-render-blocking.css
public/assets/js/inject-hero.js
public/metrics-helper.js
```

Dashboard metadata для цього модуля описане в:

```text
server/labs.js
```
