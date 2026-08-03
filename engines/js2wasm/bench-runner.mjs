// Benchmark leg for js2wasm. Copied next to node_modules/@loopdive/js2 by
// setup.js (same reason as server.mjs: the bare specifier below has to resolve
// through normal Node lookup, which walks up from THIS file's location).
//
// Why this engine needs its own adapter instead of the generic script driver:
//
//   1. js2 is an AOT compiler, not a shell. There is no `js2 file.js` that runs
//      a script — the CLI emits a .wasm, and something has to instantiate it.
//   2. The conformance adapter (run.js -> client/server -> executeTestFile)
//      cannot carry a result back: processOutcome() deliberately discards the
//      program's stdout and reports only pass/fail, which is all test262 needs.
//   3. `performance` is null in the compiled program, so the in-program clock
//      the generic driver relies on is not available either.
//
// So the timing happens on the host side, around an exported function — the
// same shape js2's own cross-engine harness uses (loopdive/js2
// benchmarks/cross-engine/run-js2.mjs). The loops inside each case are long
// enough that one call-boundary crossing per repetition is noise.
//
// argv: <case-source-path | --probe> <name> <params-json-file>
// stdout: one line of JSON.
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const [, , sourcePath, name, paramsPath] = process.argv;
const params = paramsPath ? JSON.parse(readFileSync(paramsPath, 'utf8')) : {};
const targetMs = params.targetMs ?? 200;
const rounds = params.rounds ?? 3;
const maxReps = params.maxReps ?? 200;
const target = params.target ?? 'standalone';
const injects = { SUBJECT: params.subject ?? '', ...(params.injects ?? {}) };
const prepend = params.prepend ?? '';

const emit = value => process.stdout.write(JSON.stringify(value) + '\n');

// One 35 KB string literal overflows the compiler's expression recursion (and
// the acorn case injects 245 KB), so every injected source is assembled from
// 4 KB chunks — the same workaround js2's own harness uses.
const chunked = (name, text) => {
  const chunks = [];
  for (let i = 0; i < text.length; i += 4096) chunks.push(text.slice(i, i + 4096));

  return `const __${name}_parts = [${chunks.map(c => JSON.stringify(c)).join(',\n')}];
const ${name} = __${name}_parts.join("");`;
};

const buildSource = caseSource => `${Object.entries(injects).map(([k, v]) => chunked(k, v)).join('\n')}
${prepend}
${caseSource}
export function bench() { return benchMain(); }
`;

const instantiate = async (js2, source) => {
  const result = await js2.compile(source, {
    fileName: 'bench.mjs',
    skipSemanticDiagnostics: true,
    target
  });

  if (!result.binary?.length) {
    const detail = (result.errors ?? []).slice(0, 4)
      .map(e => e.messageText ?? e.message ?? String(e)).join('; ');
    throw new Error(`js2 compile failed: ${detail || 'no binary emitted'}`);
  }

  if (target === 'standalone') {
    const module = await WebAssembly.compile(result.binary);
    const imports = WebAssembly.Module.imports(module).length;
    if (imports !== 0) throw new Error(`standalone module has ${imports} imports, expected 0`);
    // instantiate(Module) resolves to the Instance itself, not {module, instance}
    const instance = await WebAssembly.instantiate(module, {});
    return instance.exports;
  }

  const { instance } = await js2.instantiateWasm(result.binary, {});
  return instance.exports;
};

try {
  const js2 = await import('@loopdive/js2');

  // --probe: what an AOT engine's "startup" actually is — compile plus
  // instantiate of a trivial module, with no benchmark body in it.
  if (sourcePath === '--probe') {
    const t0 = performance.now();
    await instantiate(js2, 'function benchMain() { return 0; }\n');
    emit({ startup: performance.now() - t0 });
    process.exit(0);
  }

  const t0 = performance.now();
  const exports = await instantiate(js2, buildSource(readFileSync(sourcePath, 'utf8')));
  const compileMs = performance.now() - t0;

  const fn = exports.bench;
  if (typeof fn !== 'function') throw new Error(`module has no bench export (got ${typeof fn})`);

  const checksum = String(fn()); // warmup, and the value every engine must agree on

  const time = reps => {
    const start = performance.now();
    for (let i = 0; i < reps; i++) fn();
    return performance.now() - start;
  };

  const repsFor = perRep => Math.max(1, Math.min(maxReps, Math.round(targetMs / Math.max(perRep, 0.001))));

  let reps = repsFor(time(1));
  let best = Infinity;
  for (let i = 0; i < rounds; i++) best = Math.min(best, time(reps));

  // same warm re-calibration the generic runner does
  if (reps < maxReps && best < targetMs / 2) {
    const warmReps = repsFor(best / reps);
    if (warmReps > reps) {
      reps = warmReps;
      best = Infinity;
      for (let i = 0; i < rounds; i++) best = Math.min(best, time(reps));
    }
  }

  const after = String(fn());
  if (after !== checksum) throw new Error(`unstable checksum: ${checksum} vs ${after}`);

  emit({ name, ms: best / reps, reps, checksum, compileMs, target });
} catch (err) {
  emit({ name, error: String(err?.stack ?? err) });
  process.exit(1);
}
