// js2wasm is an AOT compiler, not an interpreter: there is no single binary
// to exec a JS file with. This script does what a JS engine's CLI normally
// does in one step — compile the given file to WasmGC, instantiate it, and
// run it — then reports success/failure the same way a real engine would:
// exit 0 with clean stdout, or exit non-zero with an error on stderr.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { compile } = require(join(dirname(fileURLToPath(import.meta.url)), 'compiler-bundle.cjs'));

const [, , file, ...flags] = process.argv;
const isModule = flags.includes('--module');
const source = readFileSync(file, 'utf8');

// Extract a readable "Name: message" from whatever test() (or module init)
// threw. Assertion/type errors compiled by js2wasm's JS-host target surface
// as a WebAssembly.Exception carrying the real JS Error as its payload
// (readable via the module's own __exn_tag); host-level errors (e.g. calling
// an undefined function) surface as plain JS errors instead.
function describeThrown(err, exportsObj) {
  if (typeof WebAssembly !== 'undefined' && err instanceof WebAssembly.Exception) {
    try {
      const tag = exportsObj?.__exn_tag ?? exportsObj?.__tag;
      const payload = tag ? err.getArg(tag, 0) : null;
      if (payload instanceof Error) return `${payload.name}: ${payload.message}`;
      if (payload != null) return String(payload);
    } catch {
      // fall through to generic label below
    }
    return 'uncaught wasm exception (no instance to decode payload)';
  }
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

try {
  // Non-module tests get wrapped in an exported function and invoked
  // explicitly — a bare top-level throw does not reliably propagate out of
  // WebAssembly.instantiate's start section in the current compiler, but a
  // throw out of an explicitly-called exported function does.
  // inferModuleStrictArguments: false keeps the synthetic wrapper from being
  // treated as strict module code (matches js2wasm's own test262 harness).
  const src = isModule ? source : `export function test() {\n${source}\n}`;
  // fileName + skipSemanticDiagnostics matches js2wasm's own test262 harness:
  // without skipSemanticDiagnostics, full TS type-checking runs over code that
  // was never meant to type-check (raw test262 sources) and drowns real
  // compile failures in unrelated noise ("Cannot find name 'console'", missing
  // lib types, etc). emitWat defaults to true upstream (unused here, pure
  // per-test overhead), so it's turned off.
  const baseOpts = { target: 'gc', fileName: 'test.ts', skipSemanticDiagnostics: true, emitWat: false };
  const compileOpts = isModule
    ? { ...baseOpts, deferTopLevelInit: true }
    : { ...baseOpts, inferModuleStrictArguments: false };

  const result = await compile(src, compileOpts);

  if (!result.success) {
    console.error('js2wasm compile error:');
    for (const e of result.errors ?? []) console.error(e.message ?? String(e));
    process.exitCode = 1;
  } else {
    let exportsObj;
    try {
      const inst = await WebAssembly.instantiate(result.binary, result.importObject);
      exportsObj = inst.instance ? inst.instance.exports : inst.exports;
    } catch (err) {
      console.error(describeThrown(err, null));
      process.exitCode = 1;
    }

    if (exportsObj) {
      const entry = isModule ? exportsObj.__module_init : exportsObj.test;
      if (typeof entry === 'function') {
        try {
          entry();
        } catch (err) {
          console.error(describeThrown(err, exportsObj));
          process.exitCode = 1;
        }
      }
    }
  }
} catch (err) {
  console.error('js2wasm internal error:', (err && err.stack) || err);
  process.exitCode = 1;
}

process.on('unhandledRejection', err => {
  console.error('unhandled rejection:', (err && err.stack) || err);
  process.exitCode = 1;
});
