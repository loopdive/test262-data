import { $$ } from '../../util.js';

export default (file, module = false) => {
  const args = [ 'js2wasm/exec-runner.mjs', file ];
  if (module) args.push('--module');

  return $$('node', args);
};
