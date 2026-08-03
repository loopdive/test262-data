// Tiny per-test client for server.mjs. Deliberately has zero heavy imports
// (no compiler, no TypeScript) so its own startup cost stays close to bare
// Node startup — the actual compile work happens in the already-warm server
// process this connects to. Exits with the server's reported exit code and
// mirrors its stdout/stderr onto this process's own, so run.js's existing
// $$()-based {stdout, stderr, error} contract needs no changes at all.
import net from 'node:net';

// Order matches run.js's args array exactly: [socket, target, test262Root,
// engineSuffix, inputPath, moduleFlag].
const [, , socketPath, target, test262Root, engineSuffix, inputPath, moduleFlag] = process.argv;

const request = {
  target,
  test262Root,
  inputPath,
  engineSuffix,
  module: moduleFlag === '1',
};

function fail(message) {
  process.stderr.write(message + '\n');
  process.exit(1);
}

const socket = net.connect(socketPath);
let buffer = '';

socket.on('connect', () => {
  // write(), not end(): AF_UNIX sockets on macOS don't cleanly support a
  // one-sided half-close the way TCP does — calling end() here to send the
  // request tore down the whole connection before the server's (several
  // seconds later) response could arrive, so every request read back as an
  // empty, "malformed" response. Writing leaves the connection fully open;
  // the server is the one that end()s once it actually has a response.
  socket.write(JSON.stringify(request) + '\n');
});
socket.setEncoding('utf8');
socket.on('data', chunk => {
  buffer += chunk;
});
socket.on('error', err => {
  fail(`js2wasm client.mjs: cannot reach server at ${socketPath}: ${err.message}`);
});
socket.on('close', () => {
  const newline = buffer.indexOf('\n');
  if (newline === -1) return fail(`js2wasm client.mjs: malformed response from server: ${JSON.stringify(buffer).slice(0, 200)}`);
  let response;
  try {
    response = JSON.parse(buffer.slice(0, newline));
  } catch (err) {
    return fail(`js2wasm client.mjs: could not parse server response: ${err.message}`);
  }
  if (response.stdout) process.stdout.write(response.stdout);
  if (response.stderr) process.stderr.write(response.stderr);
  process.exit(response.exitCode);
});
