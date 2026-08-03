import fs from 'node:fs';
import { $ } from '../../util.js';

// Static Hermes — the `static_h` branch of facebook/hermes. Where the `hermes`
// engine is the bytecode VM, shermes compiles JS ahead of time through C to a
// native binary, so it belongs in the same bucket as Porffor and js2 rather
// than next to the interpreters.
//
// There is no prebuilt release to download (the RN artifacts are hermes, not
// shermes), so this builds from source: ~250 objects for the compiler plus the
// runtime libraries `-exec` links against. Expect tens of minutes on a small
// box, which is why an existing tree is reused when one is present.
//
// Requires cmake, ninja, a C++ toolchain and ICU headers (libicu-dev on
// Debian/Ubuntu) — the same prerequisites the hermes engine's build has.
const srcDir = process.env.SHERMES_DIR ?? `${process.env.HOME}/shermes-src`;
const binary = `${srcDir}/build/bin/shermes`;

export default async () => {
  if (fs.existsSync(binary)) {
    console.log(`shermes: reusing the build at ${srcDir}`);
  } else {
    console.log('building static hermes... (this will take a while)');
    $(`rm -rf ${srcDir}`);
    $(`git clone https://github.com/facebook/hermes.git ${srcDir} --depth=1 --branch static_h`);
    $(`cmake -S ${srcDir} -B ${srcDir}/build -G Ninja -DCMAKE_BUILD_TYPE=Release`);
    // shermes alone is not enough: `-exec` compiles the program to C and links
    // it against these, and the link fails with -lshermes_console not found.
    $(`cmake --build ${srcDir}/build --target shermes shermes_console hermesvm jsi`);
  }

  // A shim rather than a copy: shermes resolves its own include and library
  // paths to absolute locations inside the build tree, baked in at configure
  // time, so the binary cannot be moved away from it.
  fs.writeFileSync('shermes', `#!/bin/sh\nexec "${binary}" "$@"\n`);
  $('chmod +x shermes');

  return { version: $(`git -C ${srcDir} rev-parse HEAD`).trim().slice(0, 7) };
};
