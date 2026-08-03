import fs from 'node:fs';
import { join } from 'node:path';
import { $ } from '../../util.js';

// js2wasm (https://github.com/loopdive/js2) ships js2-test262
// (bin: js2-test262, backed by dist/test262-worker.js), a CLI purpose-built
// by the js2wasm team for exactly this kind of integration: it runs the
// real, unmodified test262 harness through their own internal executor
// (fixture-graph resolution for _FIXTURE.js imports, real negative
// phase/type verification) instead of us hand-rolling compile+instantiate
// ourselves. Installed from the npm release (not built from source) so this
// tracks whatever they've shipped as `latest`.
//
// server.mjs/client.mjs (persistent-compile-server + per-test client, see
// run.js) get copied alongside node_modules rather than imported from their
// original engines/js2wasm/ location in the git repo: server.mjs needs
// `import('@loopdive/js2/test262-fyi')` to resolve via normal Node module
// lookup, which walks up from the IMPORTING FILE's own location on disk —
// engines/js2wasm/ has no node_modules ancestor with @loopdive/js2 installed,
// only this working directory's js2wasm/node_modules/ does.
// FYI_JS2_SOURCE points at a js2 checkout with `dist/` already built
// (`pnpm run build`). The npm release can lag main by a lot — measured
// 2026-08-03, `array/sort` was 95x FASTER from source than from
// @loopdive/js2@0.67.0, because the O(n log n) comparator sort had not been
// published yet — so a benchmark run against npm can misreport the compiler
// by two orders of magnitude on a single case. Conformance keeps using the
// release (that is what users get); benchmarks want the option of both.
export default async () => {
  const source = process.env.FYI_JS2_SOURCE;

  console.log(source ? `installing js2wasm from ${source}...` : 'installing js2wasm...');
  $('rm -rf js2wasm');
  $('mkdir js2wasm');
  $(`cd js2wasm && npm install ${source ? source : '@loopdive/js2@latest'}`);

  const srcDir = import.meta.dirname;
  fs.copyFileSync(join(srcDir, 'server.mjs'), 'js2wasm/server.mjs');
  fs.copyFileSync(join(srcDir, 'client.mjs'), 'js2wasm/client.mjs');
  fs.copyFileSync(join(srcDir, 'bench-runner.mjs'), 'js2wasm/bench-runner.mjs');

  const version = $('cd js2wasm && node_modules/.bin/js2wasm --version').trim();
  if (!source) return { version };

  let sha = '';
  try {
    sha = ` (${$(`git -C ${source} rev-parse --short HEAD`).trim()})`;
  } catch {
    // not a git checkout — the version alone will have to identify it
  }
  return { version: `${version}${sha} [source]` };
};
