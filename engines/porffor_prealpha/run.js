// Same invocation as the release lane, pointed at this lane's own binary so
// the two can be installed side by side.
import run from '../porffor/run.js';

export default (file, module = false, experimental = false) => {
  process.env.FYI_PORFFOR_BIN ??= './porf-prealpha';
  return run(file, module, experimental);
};
