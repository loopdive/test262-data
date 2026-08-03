// axis: higher-order array builtins (map/filter/reduce) — measures closure
// call overhead and intermediate array allocation.
//
// Ported from loopdive/js2 `benchmarks/suites/arrays.ts` (`mapFilter`,
// `reduceSum`), rewritten as plain ES5 and merged into one checksummed case.
// (c) 2026 Loopdive GmbH — Apache-2.0 WITH LLVM-exception.

function benchMain() {
  var arr = [];
  for (var i = 0; i < 10000; i++) arr.push(i);

  var mapped = arr.map(function (x) {
    return x * 2;
  });
  var filtered = mapped.filter(function (x) {
    return x % 3 === 0;
  });
  return filtered.reduce(function (acc, x) {
    return acc + x;
  }, 0);
}
