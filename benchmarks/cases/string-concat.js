// axis: string building by repeated concatenation — measures the string
// representation (rope/cons string vs eager copy) and allocator pressure.
//
// Ported from loopdive/js2 `benchmarks/suites/strings.ts` (`concat-short` /
// `concat-long`), rewritten as plain ES5. The receiver is the accumulator
// itself, so the expression already varies every iteration (see the note in
// string-builtins.js).
// (c) 2026 Loopdive GmbH — Apache-2.0 WITH LLVM-exception.

function benchMain() {
  var acc = "";
  for (var i = 0; i < 20000; i++) {
    acc = acc + "ab";
    if (acc.length > 4096) acc = acc.substring(2048);
  }

  var s = acc.length;
  for (var j = 0; j < acc.length; j += 64) s = s + acc.charCodeAt(j);
  return s;
}
