// js2wasm has no native shell `print()` (unlike d8/jsshell/etc.), but its
// JS-host target does support console.* as a recognized global (routed to
// real Node console). Polyfill print() so doneprintHandle.js's async
// completion signal ("Test262:AsyncTestComplete") is observable.
function print(x) {
  console.log(x);
}
