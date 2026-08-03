// axis: pure numeric work. No objects, no strings. Measures value
// representation (unboxed machine number vs heap-boxed) and loop codegen.
//
// Ported verbatim from loopdive/js2 `benchmarks/cross-engine/axes-core.js`
// (c) 2026 Loopdive GmbH — Apache-2.0 WITH LLVM-exception.

function benchMain() {
  var s = 0;
  for (var i = 0; i < 1000000; i++) {
    s = s + i * 2 - (i >> 1);
  }
  return s;
}
