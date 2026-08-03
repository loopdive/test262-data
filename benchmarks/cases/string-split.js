// axis: String.prototype.split — measures string scanning plus array + string
// allocation for the parts.
//
// Ported from loopdive/js2 `benchmarks/suites/strings.ts` (`split`), rewritten
// as plain ES5. A table of distinct receivers indexed by the loop counter keeps
// the call from being hoisted out of the loop (see string-builtins.js).
// (c) 2026 Loopdive GmbH — Apache-2.0 WITH LLVM-exception.

var CSV_VARIANTS = [
  "alpha,bravo,charlie,delta,echo,foxtrot,golf,hotel",
  "bravo,charlie,delta,echo,foxtrot,golf,hotel,alpha",
  "charlie,delta,echo,foxtrot,golf,hotel,alpha,bravo",
  "delta,echo,foxtrot,golf,hotel,alpha,bravo,charlie",
  "echo,foxtrot,golf,hotel,alpha,bravo,charlie,delta",
  "foxtrot,golf,hotel,alpha,bravo,charlie,delta,echo",
  "golf,hotel,alpha,bravo,charlie,delta,echo,foxtrot",
  "hotel,alpha,bravo,charlie,delta,echo,foxtrot,golf"
];

function benchMain() {
  var s = 0;
  for (var i = 0; i < 20000; i++) {
    var parts = CSV_VARIANTS[i & 7].split(",");
    s = s + parts.length + parts[i & 7].length;
  }
  return s;
}
