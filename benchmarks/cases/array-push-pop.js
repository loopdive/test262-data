// axis: dynamic array growth and shrink (push/pop). Measures the backing-store
// growth policy and element access.
//
// Ported from loopdive/js2 `benchmarks/suites/arrays.ts` (`pushPop`), rewritten
// as plain ES5 and made to return a checksum.
// (c) 2026 Loopdive GmbH — Apache-2.0 WITH LLVM-exception.

function benchMain() {
  var arr = [];
  for (var i = 0; i < 100000; i++) arr.push(i);

  var s = 0;
  while (arr.length > 0) s = s + arr.pop();
  return s;
}
