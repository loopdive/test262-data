// axis: string scanning — the tokenizer inner loop shape. Reads SUBJECT, the
// ~35 KB of JS source the harness injects.
//
// Ported verbatim from loopdive/js2 `benchmarks/cross-engine/axes-core.js`
// (c) 2026 Loopdive GmbH — Apache-2.0 WITH LLVM-exception.

function benchScan(src) {
  var s = 0;
  for (var i = 0; i < src.length; i++) {
    s = s + src.charCodeAt(i);
  }
  return s;
}

function benchMain() {
  return benchScan(SUBJECT);
}
