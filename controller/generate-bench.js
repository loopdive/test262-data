// Turn results/bench-<engine>.json into the deployed report:
//
//   deploy/bench.json          latest run, one entry per engine per case
//   deploy/bench-history.json  one entry per date, for graphing over time
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cases from '../benchmarks/cases/index.js';
import systemInfo from './system-info.js';

const dataDir = 'deploy';

// what every other engine is scored against
const REFERENCE = process.env.FYI_BENCH_REFERENCE || 'v8';

const generateBench = async () => {
  if (!existsSync('results')) {
    console.warn('no results directory, skipping benchmark report');
    return;
  }

  const files = readdirSync('results').filter(x => x.startsWith('bench-') && x.endsWith('.json'));
  if (files.length === 0) {
    console.warn('no benchmark results, skipping benchmark report');
    return;
  }

  const runs = {};
  for (const file of files) {
    const data = JSON.parse(readFileSync(join('results', file), 'utf8'));
    runs[data.engine] = data;
    console.log(`loaded benchmark results of ${data.engine}`);
  }

  const engineNames = Object.keys(runs).sort((a, b) => a.localeCompare(b));
  const reference = runs[REFERENCE] ? REFERENCE : engineNames[0];

  // Checksum agreement is the validity gate: every engine computes the same
  // number from the same source, or the timing means nothing. A mismatch is
  // reported rather than hidden — it is usually a genuine correctness bug in
  // the engine, and worth surfacing next to the number.
  const checksums = {};
  for (const c of cases) {
    const expected = runs[reference]?.benchmarks?.[c.name]?.checksum ?? null;
    const mismatched = [];

    for (const engine of engineNames) {
      const got = runs[engine].benchmarks?.[c.name]?.checksum;
      if (got == null || expected == null) continue;
      if (got !== expected) mismatched.push(engine);
    }

    checksums[c.name] = { expected, mismatched };
  }

  const out = {
    generatedAt: Date.now(),
    system: systemInfo(),
    reference,
    cases: cases.map(c => ({ name: c.name, description: c.description })),
    checksums,
    engines: {}
  };

  for (const engine of engineNames) {
    const run = runs[engine];
    const benchmarks = {};

    for (const c of cases) {
      const r = run.benchmarks?.[c.name];
      if (!r) continue;

      const refMs = runs[reference]?.benchmarks?.[c.name]?.ms ?? null;

      benchmarks[c.name] = {
        ms: r.ms,
        reps: r.reps ?? null,
        timing: r.timing ?? null,
        // adapter-driven engines (AOT compilers) report compile+instantiate
        // for the case separately from the per-repetition number
        compileMs: r.compileMs ?? null,
        checksum: r.checksum ?? null,
        // > 1 means slower than the reference engine
        relative: r.ms != null && refMs ? r.ms / refMs : null,
        valid: r.ms != null && !checksums[c.name].mismatched.includes(engine),
        error: r.error ?? null
      };
    }

    out.engines[engine] = {
      version: run.version ?? null,
      startup: run.startup ?? null,
      time: run.time ?? null,
      benchmarks
    };
  }

  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'bench.json'), JSON.stringify(out));
  console.log(`generated bench.json (${engineNames.length} engines, ${cases.length} cases, reference ${reference})`);

  // --- history -------------------------------------------------------------
  let history;
  const historyUrl = process.env.FYI_BENCH_HISTORY_URL || 'https://data.test262.fyi/bench-history.json';
  try {
    const res = await fetch(historyUrl);
    if (res.status === 404) history = {}; // first ever run
      else if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      else history = await res.json();
  } catch (e) {
    // fatal so we don't erase history
    throw new Error(`failed to fetch existing bench-history.json: ${e.message}`);
  }

  const date = (new Date()).toISOString().split('T')[0];
  history[date] = {
    time: out.generatedAt,
    system: out.system,
    versions: Object.fromEntries(engineNames.map(e => [e, out.engines[e].version])),
    startup: Object.fromEntries(engineNames.map(e => [e, out.engines[e].startup])),
    cases: Object.fromEntries(cases.map(c => [
      c.name,
      Object.fromEntries(engineNames
        .filter(e => out.engines[e].benchmarks[c.name]?.valid)
        .map(e => [e, out.engines[e].benchmarks[c.name].ms]))
    ]))
  };

  writeFileSync(join(dataDir, 'bench-history.json'), JSON.stringify(history));
};

export default generateBench;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const workingDir = process.env.FYI_WORKDIR ?? join(import.meta.dirname, '..', '.test262-fyi');
  mkdirSync(workingDir, { recursive: true });
  process.chdir(workingDir);

  await generateBench();
}
