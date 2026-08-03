// Persistent compile server for a single test262-fyi cluster worker.
//
// js2wasm's per-test invocation (js2-test262) pays the full cost of loading
// its TypeScript-based compiler from scratch on every call — plus a second,
// nested Node process fork internally — because js2-test262 is designed as
// a one-shot CLI. That's ~2.3-2.8s of pure fixed overhead per test file,
// dwarfing actual compile+execute time.
//
// @loopdive/js2 exposes the same executor js2-test262 uses internally
// (FyiSourceExecutor) and lets executeTestFile() accept a pre-existing one
// instead of always creating+tearing-down a fresh one — the same reuse
// pattern its own full-suite CI mode already relies on. This server holds
// ONE warm executor for the lifetime of the run.js cluster worker that
// spawned it, and answers many requests over a Unix socket instead of
// cold-starting per test.
import fs from 'node:fs';
import net from 'node:net';

const [, , socketPath] = process.argv;
if (!socketPath) {
  console.error('server.mjs: socket path argument required');
  process.exit(1);
}

const { FyiSourceExecutor, executeTestFile, processOutcome } = await import('@loopdive/js2/test262-fyi');

const executor = new FyiSourceExecutor();

fs.rmSync(socketPath, { force: true });

// run.js's cleanup handler kills this process when its cluster worker exits
// (see run.js for why: nothing in the shared runner otherwise knows this
// engine spawned a background process). This is a backup for the case that
// doesn't fire — e.g. the worker gets SIGKILL'd rather than SIGTERM — so a
// bug elsewhere can't leave compile servers running indefinitely.
const IDLE_SHUTDOWN_MS = 5 * 60 * 1000;
let lastActivity = Date.now();
const idleCheck = setInterval(() => {
  if (Date.now() - lastActivity > IDLE_SHUTDOWN_MS) shutdown();
}, 60 * 1000);
idleCheck.unref();

const server = net.createServer(socket => {
  let buffer = '';
  socket.setEncoding('utf8');
  socket.on('data', chunk => {
    buffer += chunk;
    const newline = buffer.indexOf('\n');
    if (newline === -1) return;
    const line = buffer.slice(0, newline);
    buffer = '';
    lastActivity = Date.now();

    (async () => {
      let response;
      try {
        const request = JSON.parse(line);
        const result = await executeTestFile({ ...request, executor });
        response = processOutcome(result);
      } catch (err) {
        response = { exitCode: 1, stdout: '', stderr: `js2wasm server error: ${err && err.stack || err}\n` };
      }
      socket.end(JSON.stringify(response) + '\n');
    })();
  });
  socket.on('error', () => {});
});

server.on('error', err => {
  console.error('js2wasm server.mjs listen error:', err);
  process.exit(1);
});

server.listen(socketPath);

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(idleCheck);
  server.close();
  executor.shutdown();
  fs.rmSync(socketPath, { force: true });
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
