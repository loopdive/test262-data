// Run every microbenchmark case on ONE engine and write
// `results/bench-<engine>.json`.
//
//   node benchmarks/run.js v8
//   node benchmarks/run.js jsc --only numeric,alloc
//
// Deliberately serial: benchmarks are timing measurements, so unlike the
// test262 runner nothing here is parallelised, and the controller runs one
// engine at a time.
import fs from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildDriver, buildStartupProbe, parseResult, loadExtras, SUBJECT } from './harness.js';
import cases from './cases/index.js';

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node benchmarks/run.js <engine> [--only a,b] [--out file.json]');
  process.exit(2);
}

let engine = arg;
let experimental = false;
if (engine.endsWith('_exp')) {
  experimental = true;
  engine = engine.slice(0, -4);
}

const flag = name => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};

const only = (flag('--only') ?? '').split(',').map(x => x.trim()).filter(x => x);
const outFile = flag('--out') ?? `results/bench-${arg}.json`;

// How long one measurement pass should take. The repetition count is calibrated
// per engine/case to hit this, which is what makes a 1000x spread between a JIT
// and an interpreter measurable with the same script.
const TARGET_MS = Number(process.env.FYI_BENCH_TARGET_MS) || 200;
const ROUNDS = Number(process.env.FYI_BENCH_ROUNDS) || 3;
const TIMEOUT = Number(process.env.FYI_BENCH_TIMEOUT) || 300000;

// engines/*/run.js goes through util.js `$$`, whose timeout is tuned for a
// single test262 file. A calibrated benchmark pass is allowed to take much
// longer, especially on the interpreters.
process.env.FYI_TIMEOUT = String(TIMEOUT);

// Same working directory the test262 controller uses, so an engine already
// downloaded for a conformance run is reused as-is.
const workingDir = process.env.FYI_WORKDIR ?? join(import.meta.dirname, '..', '.test262-fyi');
fs.mkdirSync(workingDir, { recursive: true });
process.chdir(workingDir);

const meta = process.env.FYI_BENCH_SKIP_SETUP
  ? {}
  : await (await import(`../engines/${engine}/setup.js`)).default();

const run = (await import(`../engines/${engine}/run.js`)).default;

// Optional per-engine benchmark adapter. An engine that cannot be driven as a
// shell — an AOT compiler with no script runner, say — ships
// `engines/<engine>/bench.js` and owns its own timing; see benchmarks/README.md.
const adapterPath = join(import.meta.dirname, '..', 'engines', engine, 'bench.js');
const adapterModule = existsSync(adapterPath) ? await import(`../engines/${engine}/bench.js`) : null;
const adapter = adapterModule?.default ?? null;

// `<root>/test/<name>.js`: engines that resolve a file relative to a test262
// checkout (js2wasm) need a root to hang the driver off, and it costs the
// others nothing.
const benchRoot = join('bench', arg);
const scratch = join(benchRoot, 'test');
fs.mkdirSync(scratch, { recursive: true });
process.env.FYI_TEST262_ROOT = benchRoot;

/** Write `source` to a scratch file, run it, return { ok, outer, parsed, err }. */
const exec = (name, source) => {
  const file = join(scratch, `${name}.js`);
  fs.writeFileSync(file, source);

  const t0 = performance.now();
  const res = run(file, false, experimental);
  const outer = performance.now() - t0;

  const combined = `${res.stdout}\n${res.stderr}`;
  const parsed = parseResult(combined);

  return {
    ok: !!parsed,
    outer,
    parsed,
    // No marker means the engine never got to the end of the driver — or got
    // there and mangled the line (Porffor truncates it to `#bench al` on the
    // allocation case). Say which, and keep the evidence.
    err: parsed ? null : (combined.trim()
      ? `no result marker in output: ${combined.trim().split('\n').slice(-4).join(' | ').slice(0, 300)}`
      : 'no output')
  };
};

// --- startup ---------------------------------------------------------------
// Every case's wall time includes process startup (and, for AOT engines like
// Porffor, compilation). Measuring it separately lets the report subtract it
// and lets the site show it as a metric in its own right.
let startup = null;
let startupError = null;
if (adapter) {
  const r = adapterModule.probeStartup?.() ?? { error: 'adapter has no probeStartup' };
  if (r.error) startupError = r.error;
    else startup = r.ms;
} else {
  const probe = buildStartupProbe();
  let best = Infinity;
  for (let i = 0; i <= ROUNDS; i++) {
    const r = exec('startup', probe);
    if (!r.ok) {
      startupError = r.err;
      best = Infinity;
      break;
    }
    if (i > 0 && r.outer < best) best = r.outer; // first run is warmup
  }
  if (best !== Infinity) startup = best;
}
console.log(`${arg} startup: ${startup === null ? `FAILED (${startupError})` : `${startup.toFixed(1)}ms`}`);

// --- cases -----------------------------------------------------------------
const benchmarks = {};
const started = performance.now();

for (const c of cases) {
  if (only.length && !only.includes(c.name)) continue;

  const casesDir = join(import.meta.dirname, 'cases');
  const casePath = join(casesDir, c.file);
  const source = fs.readFileSync(casePath, 'utf8');
  const maxRepsForCase = c.maxReps ?? 200;
  const extras = loadExtras(c, casesDir, (dir, file) => fs.readFileSync(join(dir, file), 'utf8'));

  if (adapter) {
    const r = await adapter({
      name: c.name,
      sourcePath: casePath,
      source,
      subject: SUBJECT,
      prepend: extras.prepend,
      injects: extras.injects,
      targetMs: TARGET_MS,
      rounds: ROUNDS,
      maxReps: maxRepsForCase
    });

    benchmarks[c.name] = r;
    console.log(r.ms == null
      ? `${arg} ${c.name}: FAILED (${String(r.error).split('\n')[0]})`
      : `${arg} ${c.name}: ${r.ms.toFixed(4)}ms/rep (reps=${r.reps}, chk=${r.checksum})`);
    continue;
  }

  // calibration pass: one repetition, to find out how slow this engine is here
  const cal = exec(c.name, buildDriver(c.name, source, 1, extras));
  if (!cal.ok) {
    benchmarks[c.name] = { ms: null, error: cal.err };
    console.log(`${arg} ${c.name}: FAILED (${cal.err.split('\n')[0]})`);
    continue;
  }

  const maxReps = maxRepsForCase;
  const repsFor = perRep => Math.max(1, Math.min(maxReps, Math.round(TARGET_MS / Math.max(perRep, 0.001))));

  const measure = reps => {
    const driver = buildDriver(c.name, source, reps, extras);
    let bestInner = Infinity, bestOuter = Infinity, checksum = null, error = null;

    for (let i = 0; i < ROUNDS; i++) {
      const r = exec(c.name, driver);
      if (!r.ok) {
        error = r.err;
        break;
      }

      if (checksum === null) checksum = r.parsed.checksum;
        else if (checksum !== r.parsed.checksum) error = `unstable checksum: ${checksum} vs ${r.parsed.checksum}`;

      if (r.parsed.inner >= 0 && r.parsed.inner < bestInner) bestInner = r.parsed.inner;
      if (r.outer < bestOuter) bestOuter = r.outer;
    }

    // per-repetition time. Inner timing is preferred: it excludes process
    // startup entirely. Outer is the fallback for engines with no usable clock,
    // and is startup-corrected — only approximate for AOT engines whose compile
    // time scales with the source, so `timing` records which one was used.
    const total = bestInner !== Infinity
      ? bestInner
      : (bestOuter === Infinity ? null : Math.max(bestOuter - (startup ?? 0), 0));

    return { reps, total, bestOuter, checksum, error, timing: bestInner !== Infinity ? 'inner' : 'outer-corrected' };
  };

  const calMs = cal.parsed.inner >= 0 ? cal.parsed.inner : Math.max(cal.outer - (startup ?? 0), 0);
  let m = measure(repsFor(calMs));

  // One repetition survived calibration but the full pass did not: on a
  // memory-limited engine an allocation-heavy case exhausts the heap partway
  // through (Porffor traps with "memory access out of bounds" on `alloc` at 500
  // reps, having been fine at 1). Back off rather than reporting the engine as
  // unable to run the case at all — a number from fewer reps is noisier, but it
  // is a number, and `reps` in the output says how few.
  while (m.total == null && m.reps > 1) {
    const fewer = Math.max(1, Math.floor(m.reps / 4));
    if (fewer === m.reps) break;
    m = measure(fewer);
  }

  // The calibration pass ran cold, so on a JIT it overestimates the per-rep cost
  // by an order of magnitude and the real measurement lands well under target.
  // Re-calibrate once from the warm number rather than reporting a pass that was
  // too short to be meaningful.
  if (!m.error && m.total != null && m.reps < maxReps && m.total < TARGET_MS / 2) {
    const warm = measure(repsFor(m.total / m.reps));
    if (!warm.error && warm.total != null) m = warm;
  }

  if (m.total == null) {
    benchmarks[c.name] = { ms: null, error: m.error };
    console.log(`${arg} ${c.name}: FAILED (${String(m.error).split('\n')[0]})`);
    continue;
  }

  benchmarks[c.name] = {
    ms: m.total / m.reps,
    reps: m.reps,
    checksum: m.checksum,
    timing: m.timing,
    outerMs: m.bestOuter,
    error: m.error
  };

  console.log(`${arg} ${c.name}: ${(m.total / m.reps).toFixed(4)}ms/rep (reps=${m.reps}, chk=${m.checksum})`);
}

fs.rmSync(benchRoot, { recursive: true, force: true });

const out = {
  engine: arg,
  experimental,
  startup,
  startupError,
  benchmarks,
  time: performance.now() - started,
  version: meta.version ?? null
};

fs.mkdirSync('results', { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out));
console.log(`wrote ${join(workingDir, outFile)}`);
