# Microbenchmarks

Cross-engine microbenchmarks, run on the same engines as the test262
conformance suite. Every engine executes the **byte-identical** script and every
case returns a **checksum** — if two engines disagree on the checksum, the
timing is reported as invalid rather than compared.

The cases are ported from [loopdive/js2](https://github.com/loopdive/js2)
(`benchmarks/cross-engine/axes-core.js` and `benchmarks/suites/`), rewritten as
plain ES5 so every engine here accepts them verbatim. They are
Apache-2.0 WITH LLVM-exception, © 2026 Loopdive GmbH; each file carries its own
attribution header.

## Running

```bash
# one engine
node benchmarks/run.js v8
node benchmarks/run.js jsc --only numeric,alloc

# every engine, then generate the report
node controller/bench.js
node controller/bench.js v8,sm,jsc

# as part of a full test262 run (opt-in — it adds serial wall time)
FYI_BENCH=1 node controller/index.js
```

`run.js` writes `results/bench-<engine>.json` inside the working directory
(`.test262-fyi/`, shared with the test262 runner so an already-downloaded engine
is reused). `controller/bench.js` then writes the deployed report:

- `deploy/bench.json` — latest run: per engine, per case, `ms` per repetition,
  `relative` (× the reference engine, `v8` by default), `valid`, `checksum`
- `deploy/bench-history.json` — one entry per date, for graphing over time

## Method

Everything runs **serially**. Nothing else should be competing for the machine.

1. **Startup** is measured first: a script that only prints, min of N runs. It is
   reported as its own metric and used to correct the fallback timing path.
2. **Calibration**: the case runs once to find out how slow this engine is here.
3. **Measurement**: the repetition count is chosen so one pass takes about
   `FYI_BENCH_TARGET_MS` (default 200 ms), capped by the case's `maxReps`, and
   the pass runs `FYI_BENCH_ROUNDS` times (default 3). The reported number is
   **min-of-rounds ÷ reps**. Calibration runs cold, so if the warm measurement
   lands far under target the reps are recomputed once and the pass repeated.
   This is what lets the same script measure a JIT and a tree-walking
   interpreter three orders of magnitude apart.
4. **Timing source**: in-engine (`performance.now()`, else `Date.now()`) when the
   engine has a clock — this excludes process startup entirely. Engines with no
   usable clock fall back to externally measured wall time minus startup, which
   each result records as `timing: "outer-corrected"`.

### Caveats

- **Absolute ms are only comparable within one run on one machine.** Only the
  ratios between engines on the same case mean anything. `bench.json` records
  the system string for this reason.
- **`outer-corrected` is approximate.** Subtracting a fixed startup cost assumes
  startup does not depend on the program. That does not hold for an AOT engine
  like Porffor, whose compile time scales with the source.
- **A checksum mismatch invalidates the timing** and usually indicates a
  correctness bug in the engine. `bench.json` lists the mismatching engines per
  case under `checksums`.
- Cases below ~0.1 ms per repetition on the fastest engine are loop-bound rather
  than measuring the named operation. If a case drifts down there, raise its
  inner iteration count rather than reading the number.

## Adding a case

1. Write `cases/<name>.js`: plain ES5, define `benchMain()` returning a numeric
   checksum. The global `SUBJECT` (~35 KB of JS source) is available.
2. Add it to `cases/index.js` with a description and a `maxReps` cap.

Make the inner loop's **input** depend on the loop counter. With a constant
receiver and constant arguments, an optimising JIT hoists the call out of the
loop entirely and runs it once — which is how a benchmark comes to report a
1.56 ns `indexOf`. Returning and consuming the accumulator only defeats
dead-code elimination, not loop-invariant code motion.

## Environment variables

| Variable                 | Default                                    | Meaning                              |
| ------------------------ | ------------------------------------------ | ------------------------------------ |
| `FYI_BENCH`              | unset                                      | run benchmarks from `controller/index.js` |
| `FYI_BENCH_TARGET_MS`    | `200`                                      | target duration of one measured pass |
| `FYI_BENCH_ROUNDS`       | `3`                                        | measured passes per case (min wins)  |
| `FYI_BENCH_TIMEOUT`      | `300000`                                   | per-process timeout, ms              |
| `FYI_BENCH_REFERENCE`    | `v8`                                       | engine the `relative` column is against |
| `FYI_BENCH_SKIP_SETUP`   | unset                                      | reuse an already-downloaded engine   |
| `FYI_BENCH_HISTORY_URL`  | `https://data.test262.fyi/bench-history.json` | existing history to append to     |
| `FYI_WORKDIR`            | `.test262-fyi`                             | working directory                    |
