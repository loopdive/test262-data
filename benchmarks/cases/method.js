// axis: prototype method dispatch on a constructor instance.
//
// Ported verbatim from loopdive/js2 `benchmarks/cross-engine/axes-core.js`
// (c) 2026 Loopdive GmbH — Apache-2.0 WITH LLVM-exception.

function P(v) {
  this.v = v;
}
P.prototype.inc = function () {
  this.v = this.v + 1;
  return this.v;
};

function benchMain() {
  var p = new P(0);
  var s = 0;
  for (var i = 0; i < 300000; i++) {
    s = s + p.inc();
  }
  return s;
}
