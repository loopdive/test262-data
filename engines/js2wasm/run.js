import { $$ } from '../../util.js';

// js2-test262 re-derives flags/negative/async straight from the assembled
// file's own metadata comment block (same one read.js leaves intact) and
// its exit code + stdout/stderr are already shaped for the generic scorer
// in runner/index.js — e.g. a correctly-matched negative test exits 1 with
// text containing the expected error type name (satisfies
// `hasError && combined.includes(negative.type)`), and an *incorrectly*
// non-throwing negative test exits 0 with empty output (satisfies
// `!hasError` -> fail). No extra translation needed here, same as every
// other engine's run.js.
export default (file, module = false) => {
  const args = [
    '--target', 'gc',
    '--test262-root', 'test262',
    '--engine-suffix', 'js2wasm',
  ];
  if (module) args.push('--module');
  args.push(file);

  return $$('js2wasm/node_modules/.bin/js2-test262', args);
};
