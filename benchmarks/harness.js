// Driver generation for the cross-engine microbenchmarks.
//
// A driver is a single self-contained ES5 script: no modules, no imports, no
// host API beyond `print`/`console.log` and (optionally) a clock. Every engine
// in ../engines runs the byte-identical file, which is the whole point — the
// numbers are only comparable if the source is.

const MARKER = '#bench';

// ~35 KB of realistic JS source, used as the subject of the string and
// tokenizer axes. Generated (not stored) so the file stays small; the output is
// deterministic, so every engine sees the same bytes.
export const SUBJECT = (() => {
  let s = '';
  for (let i = 0; i < 800; i++) s += `var x${i} = function(a,b){ return a+b*${i} };\n`;
  return s;
})();

// Portable prologue. Notes on what is and is not safe to assume:
//   - Neither printer is universal, and the order matters. `console.log` is
//     tried FIRST: QuickJS/qjs_ng/XS have no `console` at all and fall through
//     to `print`, while Porffor has both — but its `print` is a low-level
//     numeric builtin that swallows strings (`print("yo")` emits `24`), so
//     preferring `print` there loses the result line entirely. Measured on the
//     engines in this repo: v8, sm, njs, kiesel, porffor -> console.log;
//     qjs, qjs_ng, xs -> print.
//   - `performance.now()` is NOT universal. `Date.now()` is (ES5), but only has
//     ms resolution — which is why the runner calibrates the repetition count
//     up to a target of ~200 ms per measurement rather than timing one pass.
//   - When no clock is usable at all, inner time is reported as -1 and the
//     runner falls back to the externally measured wall time.
const PROLOGUE = `var __print = (function () {
  if (typeof console !== 'undefined' && console && typeof console.log === 'function') {
    return function (s) { console.log(s); };
  }
  if (typeof print === 'function') return print;
  return function () {};
})();
var __clock = (function () {
  if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
    return function () { return performance.now(); };
  }
  if (typeof Date !== 'undefined' && typeof Date.now === 'function') {
    return function () { return Date.now(); };
  }
  return null;
})();
var __now = __clock === null ? function () { return -1; } : __clock;
`;

const epilogue = (name, reps) => `
benchMain();

var __t0 = __now();
var __chk = 0;
for (var __i = 0; __i < ${reps}; __i++) __chk = benchMain();
var __t1 = __now();

__print('${MARKER} ${name} inner=' + (__clock === null ? -1 : (__t1 - __t0)) + ' reps=${reps} chk=' + __chk);
`;

/** Full driver source for one case at one repetition count. */
export const buildDriver = (name, source, reps) =>
  `${PROLOGUE}var SUBJECT = ${JSON.stringify(SUBJECT)};\n\n${source}\n${epilogue(name, reps)}`;

/** Script that does nothing but print — measures process startup cost. */
export const buildStartupProbe = () =>
  `${PROLOGUE}__print('${MARKER} startup inner=0 reps=0 chk=0');\n`;

/**
 * Parse the marker line out of an engine's stdout+stderr. Engines are chatty
 * (Porffor prints C-compiler warnings, some shells print banners), so the line
 * is located rather than assumed to be the whole output.
 */
export const parseResult = output => {
  for (const line of String(output).split('\n')) {
    const i = line.indexOf(MARKER + ' ');
    if (i === -1) continue;

    const m = line.slice(i).match(/^#bench (\S+) inner=(\S+) reps=(\d+) chk=(.*)$/);
    if (!m) continue;

    return {
      name: m[1],
      inner: Number(m[2]),
      reps: Number(m[3]),
      checksum: m[4].trim()
    };
  }

  return null;
};
