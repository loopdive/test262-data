import { $ } from '../../util.js';

// js2wasm (https://github.com/loopdive/js2) ships js2-test262
// (bin: js2-test262, backed by dist/test262-worker.js), a CLI purpose-built
// by the js2wasm team for exactly this kind of integration: it runs the
// real, unmodified test262 harness through their own internal executor
// (fixture-graph resolution for _FIXTURE.js imports, real negative
// phase/type verification) instead of us hand-rolling compile+instantiate
// ourselves. Installed from the npm release (not built from source) so this
// tracks whatever they've shipped as `latest`.
export default async () => {
  console.log('installing js2wasm...');
  $('rm -rf js2wasm');
  $('mkdir js2wasm');
  $('cd js2wasm && npm install @loopdive/js2@latest');

  const version = $('cd js2wasm && node_modules/.bin/js2wasm --version').trim();
  return { version };
};
