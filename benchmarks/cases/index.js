// Manifest of microbenchmark cases. Each case file is plain ES5 that defines
// `benchMain()` returning a numeric checksum, and may read the global
// `SUBJECT` string the harness injects.
//
// `maxReps` caps the adaptive repetition count (see ../harness.js) so a very
// fast engine cannot spin for longer than intended on a cheap case.

export default [
  {
    name: 'numeric',
    file: 'numeric.js',
    description: 'pure numeric loop — value representation and loop codegen',
    maxReps: 500
  },
  {
    name: 'prop',
    file: 'prop.js',
    description: 'monomorphic property read/write on a plain object',
    maxReps: 500
  },
  {
    name: 'method',
    file: 'method.js',
    description: 'prototype method dispatch on a constructor instance',
    maxReps: 500
  },
  {
    name: 'string-scan',
    file: 'string-scan.js',
    description: 'charCodeAt scan over ~35 KB of source — tokenizer inner loop',
    maxReps: 500
  },
  {
    name: 'alloc',
    file: 'alloc.js',
    description: 'short-lived object allocation — GC / allocator throughput',
    maxReps: 500
  },
  {
    name: 'tokenizer',
    file: 'tokenizer.js',
    description: 'acorn-shaped tokenizer: this.<field> + this.<method>() in a loop',
    maxReps: 500
  },
  {
    name: 'array-push-pop',
    file: 'array-push-pop.js',
    description: 'dynamic array growth and shrink (push/pop)',
    maxReps: 200
  },
  {
    name: 'array-sort',
    file: 'array-sort.js',
    description: 'Array.prototype.sort with a user comparator',
    maxReps: 200
  },
  {
    name: 'array-hof',
    file: 'array-hof.js',
    description: 'map / filter / reduce — closure calls and intermediate arrays',
    maxReps: 200
  },
  {
    name: 'string-builtins',
    file: 'string-builtins.js',
    description: 'indexOf / lastIndexOf / substring with counter-derived inputs',
    maxReps: 200
  },
  {
    name: 'string-concat',
    file: 'string-concat.js',
    description: 'repeated concatenation — string representation and allocation',
    maxReps: 200
  },
  {
    name: 'acorn-self-parse',
    file: 'acorn-self-parse.js',
    description: 'acorn 8.18.0 parsing its own 233 KB source — a whole-parser workload',
    prepend: ['vendor/acorn.js', 'vendor/acorn-ns.js'],
    inject: { ACORN_SRC: 'vendor/acorn.js' },
    maxReps: 20
  },
  {
    name: 'string-split',
    file: 'string-split.js',
    description: 'String.prototype.split — scanning plus parts allocation',
    maxReps: 200
  }
];
