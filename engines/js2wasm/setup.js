import fs from 'node:fs';
import { join } from 'node:path';
import { $ } from '../../util.js';

// js2wasm (https://github.com/loopdive/js2) is a JS/TS-to-WasmGC AOT
// compiler, not an interpreter — there's no upstream release binary to
// download like the other engines. We clone it, build it, and bundle its
// programmatic `compile()` API into a single self-contained CJS file
// (embedding TypeScript + Binaryen, so it needs no node_modules alongside
// it at runtime) that exec-runner.js uses to compile-and-run each test.
const srcDir = 'js2wasm-src';

export default async () => {
  console.log('building js2wasm... (this will take a while)');
  fs.rmSync(srcDir, { recursive: true, force: true });
  $(`git clone https://github.com/loopdive/js2.git ${srcDir} --depth=1`);
  const version = $(`git -C ${srcDir} rev-parse HEAD`).trim().slice(0, 7);

  $('corepack enable');
  $(`cd ${srcDir} && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile`);
  $(`cd ${srcDir} && node_modules/.bin/esbuild src/index.ts --bundle --platform=node --format=cjs --outfile=compiler-bundle.cjs`);

  fs.rmSync('js2wasm', { recursive: true, force: true });
  fs.mkdirSync('js2wasm');
  fs.copyFileSync(join(srcDir, 'compiler-bundle.cjs'), 'js2wasm/compiler-bundle.cjs');
  fs.copyFileSync(join(import.meta.dirname, 'exec-runner.mjs'), 'js2wasm/exec-runner.mjs');

  fs.rmSync(srcDir, { recursive: true, force: true });

  return { version };
};
