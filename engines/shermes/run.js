import { $$ } from '../../util.js';

// -exec: compile the file through C to a native binary and run it in one shot.
// The compile is per invocation, so it lands in the startup measurement the
// same way Porffor's and js2's do.
export default (file) => $$('./shermes', [ '-exec', file ]);
