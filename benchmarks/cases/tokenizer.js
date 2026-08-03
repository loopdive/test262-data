// axis: the acorn tokenizer shape — a constructor instance whose methods
// read/write `this.<field>` and call `this.<method>()` in a loop. This is what
// a real parser's inner loop looks like, and it is the shape that static
// monomorphisation has to survive. Reads SUBJECT (injected by the harness).
//
// Ported verbatim from loopdive/js2 `benchmarks/cross-engine/axes-core.js`
// (c) 2026 Loopdive GmbH — Apache-2.0 WITH LLVM-exception.

function Tok(input) {
  this.input = input;
  this.pos = 0;
  this.acc = 0;
}
Tok.prototype.nextCode = function () {
  var c = this.input.charCodeAt(this.pos);
  this.pos = this.pos + 1;
  return c;
};
Tok.prototype.run = function () {
  while (this.pos < this.input.length) {
    this.acc = this.acc + this.nextCode();
  }
  return this.acc;
};

function benchMain() {
  var t = new Tok(SUBJECT);
  return t.run();
}
