import child_process from 'node:child_process';

export const $ = (str, env = {}) => child_process.execSync(str, {
  encoding: 'utf8',
  env: {
    ...process.env,
    NO_COLOR: 1,
    ...env
  }
});

export const $$ = (cmd, args, env = {}) => {
  const out = child_process.spawnSync(cmd, args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: 1,
      ...env
    },
    // benchmarks/ raises this: a calibrated benchmark pass is allowed to take
    // far longer than a single test262 file.
    timeout: Number(process.env.FYI_TIMEOUT) || 10000
  });

  return {
    stdout: (out.stdout ?? '').toString('utf8'),
    stderr: (out.stderr ?? '').toString('utf8'),
    error: out.signal !== null || !!out.error || out.status !== 0
  };
};