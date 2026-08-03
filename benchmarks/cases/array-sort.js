// axis: Array.prototype.sort with a user comparator — measures the sort
// implementation plus the cost of calling back into JS per comparison.
//
// Ported from loopdive/js2 `benchmarks/suites/arrays.ts` (`sortI32`), rewritten
// as plain ES5. The checksum is order-sensitive so a no-op sort cannot pass.
// (c) 2026 Loopdive GmbH — Apache-2.0 WITH LLVM-exception.

function benchMain() {
  var arr = [];
  for (var i = 0; i < 10000; i++) arr.push((i * 37 + 13) % 10000);

  arr.sort(function (a, b) {
    return a - b;
  });

  var s = 0;
  for (var j = 0; j < arr.length; j++) s = s + arr[j] * ((j & 7) + 1);
  return s;
}
