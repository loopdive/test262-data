// axis: short-lived object allocation (GC / allocator throughput).
//
// Ported verbatim from loopdive/js2 `benchmarks/cross-engine/axes-core.js`
// (c) 2026 Loopdive GmbH — Apache-2.0 WITH LLVM-exception.

function benchMain() {
  var s = 0;
  for (var i = 0; i < 100000; i++) {
    var o = { x: i, y: i + 1 };
    s = s + o.x + o.y;
  }
  return s;
}
