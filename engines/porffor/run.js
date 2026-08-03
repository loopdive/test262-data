import { $$ } from '../../util.js';

export default (file, module = false) => {
  // tcc unless the host hasn't got it — setup.js picks the substitute (see the
  // shim there); Porffor's native path needs *a* C compiler either way.
  const args = [ `--compiler=${process.env.FYI_PORFFOR_COMPILER ?? 'tcc'}`, file ];
  if (module) args.push('--module');

  // FYI_PORFFOR_BIN lets a second Porffor lane (engines/porffor_prealpha)
  // install its own binary side by side instead of overwriting ./porf.
  return $$(process.env.FYI_PORFFOR_BIN ?? './porf', args);
};
