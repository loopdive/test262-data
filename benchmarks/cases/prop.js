// axis: monomorphic property read/write on a plain object. Measures how a
// named property resolves: fixed slot offset vs hash/ladder lookup.
//
// Ported verbatim from loopdive/js2 `benchmarks/cross-engine/axes-core.js`
// (c) 2026 Loopdive GmbH — Apache-2.0 WITH LLVM-exception.

function benchMain() {
  var o = { a: 1, b: 2, c: 3 };
  var s = 0;
  for (var i = 0; i < 300000; i++) {
    o.a = o.a + 1;
    s = s + o.a + o.b + o.c;
  }
  return s;
}
