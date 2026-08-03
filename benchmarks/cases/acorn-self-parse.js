// axis: a real parser doing real work — acorn parsing its own source.
//
// This is the shape js2 uses as its scale stressor (loopdive/js2
// tests/dogfood/acorn-corpus.mjs, "the acorn entry module itself — a ~230 KB
// real-world stressor"). Unlike the single-axis cases, it exercises everything
// at once: string scanning, object allocation, method dispatch, closures and a
// deep recursive AST — which is exactly why it is worth having alongside them.
// A JIT can win an axis and still lose here, and an AOT compiler that is level
// on `numeric` can fall over on the allocation volume.
//
// acorn itself is prepended by the harness (cases/vendor/acorn.js), and its
// source is injected as ACORN_SRC — the same bytes, so this is a genuine
// self-parse.

// Iterative, not recursive: the AST is deep enough that a recursive walk risks
// a stack overflow on engines with a small default stack, which would measure
// the stack limit rather than the parser.
function astChecksum(root) {
  var stack = [root];
  var nodes = 0;
  var sum = 0;

  while (stack.length > 0) {
    var node = stack.pop();
    if (node === null || typeof node !== 'object') continue;

    if (typeof node.type === 'string') {
      nodes = nodes + 1;
      sum = (sum + node.type.length + (node.end - node.start)) % 1000000007;
    }

    // `for...in` visits string keys in insertion order per spec, so the walk is
    // deterministic across engines; array indices come through the same way.
    for (var key in node) {
      var value = node[key];
      if (value !== null && typeof value === 'object') stack.push(value);
    }
  }

  return nodes * 1000003 + sum;
}

function benchMain() {
  var parser = typeof acorn !== 'undefined'
    ? acorn
    : (typeof globalThis !== 'undefined' ? globalThis.acorn : null);
  if (!parser) throw new Error('acorn did not load');

  return astChecksum(parser.parse(ACORN_SRC, { ecmaVersion: 2020, sourceType: 'script' }));
}
