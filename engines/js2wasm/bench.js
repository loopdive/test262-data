// Benchmark adapter for js2wasm (see ../../benchmarks/README.md, "Engine
// adapters"). benchmarks/run.js uses this instead of the generic script driver
// because js2 is an AOT compiler with no script-running shell — bench-runner.mjs
// explains the rest. Timing is host-side around an exported function, so results
// are marked `timing: "host"` rather than "inner".
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

// CWD-relative, like every other path in this engine: setup.js copies the
// runner next to the node_modules it needs to resolve @loopdive/js2 from.
const RUNNER = 'js2wasm/bench-runner.mjs';

const target = process.env.FYI_JS2_TARGET ?? 'standalone';

// Params go through a file, not argv: the acorn case injects ~245 KB of source
// twice (prepended as code, injected as the string being parsed), which is
// half a megabyte of argument — well into the territory where the exec fails
// with nothing on stderr to explain it.
const PARAMS = 'js2wasm/bench-params.json';

const call = (arg, name, params) => {
  writeFileSync(PARAMS, JSON.stringify({ ...params, target }));

  const out = spawnSync('node', [RUNNER, arg, name, PARAMS], {
    encoding: 'utf8',
    timeout: Number(process.env.FYI_TIMEOUT) || 300000,
    env: { ...process.env, NO_COLOR: 1 }
  });

  const line = (out.stdout ?? '').trim().split('\n').filter(Boolean).pop();
  if (!line) {
    const stderr = (out.stderr ?? '').trim().split('\n').slice(-3).join('\n');
    return { error: stderr || `no output from ${RUNNER}` };
  }

  try {
    return JSON.parse(line);
  } catch {
    return { error: `unparseable response: ${line.slice(0, 200)}` };
  }
};

/** Compile+instantiate cost of a trivial module — an AOT engine's real startup. */
export const probeStartup = () => {
  const r = call('--probe', 'startup', {});
  return r.error ? { error: r.error } : { ms: r.startup };
};

export default ({ name, sourcePath, subject, prepend, injects, targetMs, rounds, maxReps }) => {
  const r = call(sourcePath, name, { subject, prepend, injects, targetMs, rounds, maxReps });
  if (r.error) return { ms: null, error: r.error };

  return {
    ms: r.ms,
    reps: r.reps,
    checksum: r.checksum,
    timing: 'host',
    // compile+instantiate for THIS case, kept separate from the per-rep number
    compileMs: r.compileMs,
    error: null
  };
};
