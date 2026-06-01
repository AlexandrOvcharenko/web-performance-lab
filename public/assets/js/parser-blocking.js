console.log("[Resource Loading Lab] parser-blocking script start");
const parserBlockingStart = performance.now();
while (performance.now() - parserBlockingStart < 250) {
  Math.sqrt(42);
}
console.log("[Resource Loading Lab] parser-blocking script finished");
