import fs from 'node:fs';
import { $ } from '../../util.js';

export default async () => {
  $('rm -rf porffor');
  $(`git clone https://github.com/CanadaHonk/porffor.git porffor --depth=1`);
  // porffor is currently dependency-free (no package.json on main) — `npm
  // install` errors out (ENOENT reading package.json) when there's nothing
  // to install. Only run it if a package.json shows up again later.
  if (fs.existsSync('porffor/package.json')) $(`cd porffor; npm install`);

  return {
    version: $('node ./porffor/runtime/index.js --version').trim()
    // No `preludes` override: porffor/test262/harness.js is no longer split
    // into `///`-delimited named sections (its own comment now says the real
    // harness comes verbatim from upstream test262/harness) — falls back to
    // the default reader, which does exactly that. Its $262/print prelude
    // content lives in ./runtime.js instead, matching every other engine.
  };
};
