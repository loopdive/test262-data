// Benchmark controller: runs the microbenchmarks on every engine, one engine
// at a time, then writes the report into the deploy directory.
//
//   node controller/bench.js            # all engines
//   node controller/bench.js v8,jsc     # a subset
//
// It is also invoked from controller/index.js after a test262 run when
// FYI_BENCH is set, which reuses the engines that run already downloaded.
import fs from 'node:fs';
import child_process from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from '../util.js';
import engines from '../engines/list.js';
import generateBench from './generate-bench.js';

const runOne = engine => new Promise(res => {
  console.log(`benchmarking ${engine}...`);
  console.time(`bench ${engine}`);

  child_process.exec(
    `node ${join(import.meta.dirname, '..', 'benchmarks', 'run.js')} ${engine}`,
    { maxBuffer: 16 * 1024 * 1024 },
    (err, stdout, stderr) => {
      console.timeEnd(`bench ${engine}`);
      if (stdout) process.stdout.write(stdout);
      // clean up any still running engine processes
      try { $(`pkill -9 -f "bench/${engine}/"`); } catch {}
      if (err) console.error(stderr || err);
      res();
    }
  );
});

const benchmark = async (queue = engines) => {
  // strictly serial — these are timing measurements, so nothing else should be
  // competing for the machine while one runs
  for (const engine of [...queue]) await runOne(engine);

  await generateBench();
};

export default benchmark;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const workingDir = process.env.FYI_WORKDIR ?? join(import.meta.dirname, '..', '.test262-fyi');
  fs.mkdirSync(workingDir, { recursive: true });
  process.chdir(workingDir);

  const queue = process.argv[2]?.split(',').map(x => x.trim()).filter(x => x);
  await benchmark(queue?.length ? queue : engines);
}
