// axis: String.prototype search/slice builtins.
//
// Ported from loopdive/js2 `benchmarks/suites/strings.ts`, rewritten as plain
// ES5. (c) 2026 Loopdive GmbH — Apache-2.0 WITH LLVM-exception.
//
// NOTE (js2 #3898): every call's *input* must vary with the loop counter. With
// a constant receiver and constant arguments an optimising JIT hoists the call
// out of the loop entirely (loop-invariant code motion) and runs it once, which
// makes the JIT engines look thousands of times faster than they are. Returning
// and consuming the accumulator is NOT enough — that only defeats dead-code
// elimination. So the search start position is derived from `i`.

function benchMain() {
  var hay = "";
  for (var k = 0; k < 200; k++) hay += "abcdefghij";

  var s = 0;
  for (var i = 0; i < 20000; i++) {
    var from = i % 1000;
    s = s + hay.indexOf("fghij", from);
    s = s + hay.lastIndexOf("abcde", 1000 + from);
    s = s + hay.substring(from, from + 8).length;
    s = s + hay.charCodeAt(from);
  }
  return s;
}
