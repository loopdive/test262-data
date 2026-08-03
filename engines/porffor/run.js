import { $$ } from '../../util.js';

export default (file, module = false) => {
  // tcc unless the host hasn't got it — setup.js picks the substitute (see the
  // shim there); Porffor's native path needs *a* C compiler either way.
  const args = [ `--compiler=${process.env.FYI_PORFFOR_COMPILER ?? 'tcc'}`, file ];
  if (module) args.push('--module');

  return $$('./porf', args);
};
