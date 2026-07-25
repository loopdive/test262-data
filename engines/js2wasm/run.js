import cluster from 'node:cluster';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $$ } from '../../util.js';

// Persistent-server design: js2-test262's one-shot invocation pays the full
// cost of loading js2's TypeScript-based compiler from scratch (plus a
// second, nested Node fork internally) on EVERY test file — ~2.3-2.8s of
// fixed overhead, dwarfing actual compile+execute time. @loopdive/js2
// exposes FyiSourceExecutor/executeTestFile specifically so a caller like
// this one can hold ONE warm executor for the lifetime of a cluster worker
// and answer many requests through it, instead of cold-starting per test —
// server.mjs does that; client.mjs is the (deliberately tiny, no heavy
// imports) per-test process that talks to it. run.js's exported function
// must stay synchronous (runner/index.js calls it without await), so the
// actual socket I/O lives in the spawned client, not here.
//
// Socket path lives in os.tmpdir(), not a path under the working directory:
// AF_UNIX paths have a ~104-108 byte limit, and a deeply nested working
// directory (e.g. a git worktree several levels down) can exceed that.
// process.ppid (runner/index.js's own PID) disambiguates concurrent runs;
// cluster.worker.id disambiguates workers within one run.
// CWD-relative, matching the rest of this file and every other engine's
// run.js (the caller — runner/index.js's cluster worker — always runs with
// CWD set to the working directory setup.js installed into). server.mjs
// specifically cannot be referenced via import.meta.dirname here: it needs
// to live next to node_modules/@loopdive/js2 for its own bare-specifier
// import to resolve (setup.js copies it there), not next to this file.
const workerId = cluster.worker?.id ?? process.pid;
const socketPath = join(tmpdir(), `js2wasm-${process.ppid}-${workerId}.sock`);
const serverScript = 'js2wasm/server.mjs';
const clientScript = 'js2wasm/client.mjs';

const SERVER_READY_TIMEOUT_MS = 15000;
let serverStarted = false;
let serverPid;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function ensureServerRunning() {
  if (serverStarted && existsSync(socketPath)) return;

  if (!existsSync(socketPath)) {
    const child = spawn('node', [serverScript, socketPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    serverPid = child.pid;

    const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
    while (!existsSync(socketPath) && Date.now() < deadline) sleepSync(50);
    if (!existsSync(socketPath)) {
      throw new Error(`js2wasm: server did not start within ${SERVER_READY_TIMEOUT_MS}ms (socket: ${socketPath})`);
    }
  }
  serverStarted = true;
}

// runner/index.js's primary process kills each cluster worker once its test
// queue is exhausted — nothing in the shared runner knows this engine spawned
// a background server, and its command line doesn't match controller/
// index.js's generic `pkill -f "\.${engine}$"` cleanup pass (that pattern
// targets per-test temp files, not a long-lived process). Without this, the
// server would leak past the end of every run. server.mjs also self-exits
// after an idle timeout as a backup in case this handler doesn't fire (e.g.
// SIGKILL).
function killServer() {
  if (!serverPid) return;
  try {
    process.kill(serverPid, 'SIGTERM');
  } catch {
    // already gone
  }
}
process.once('exit', killServer);
process.once('SIGTERM', () => {
  killServer();
  process.exit(0);
});
process.once('SIGINT', () => {
  killServer();
  process.exit(0);
});

export default (file, module = false) => {
  ensureServerRunning();
  const args = [clientScript, socketPath, 'gc', 'test262', 'js2wasm', file, module ? '1' : '0'];
  return $$('node', args);
};
