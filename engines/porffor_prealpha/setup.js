import fs from 'node:fs';
import { $ } from '../../util.js';
import { pickCompiler, shim } from '../porffor/setup.js';

// Porffor's dev lane, alongside the release lane in ../porffor.
//
// Upstream tags every dev build `pre-alpha-<n>` (pre-alpha-15 = 2026-08-03),
// and cuts the GitHub release from those same tags — so the two lanes usually
// sit on the same commit and differ in HOW they run: the release lane is the
// prebuilt binary, this one is a source checkout under the host's Node. When
// the release lags a tag or two, the difference becomes the version as well.
//
// The tag is resolved from the remote rather than hardcoded, and sorted
// numerically: `git ls-remote --tags` returns lexical order, in which
// pre-alpha-9 sorts after pre-alpha-15.
const BIN = './porf-prealpha';

const latestTag = () => {
  const tags = $('git ls-remote --tags https://github.com/CanadaHonk/porffor')
    .split('\n')
    .map(line => line.split('refs/tags/')[1]?.trim())
    .filter(tag => tag && /^pre-alpha-\d+$/.test(tag));

  if (tags.length === 0) throw new Error('no pre-alpha-* tags found upstream');

  return tags.sort((a, b) => Number(a.split('-')[2]) - Number(b.split('-')[2])).pop();
};

export default async () => {
  pickCompiler();

  const tag = latestTag();
  console.log(`porffor_prealpha: checking out ${tag}`);

  fs.rmSync('porffor-prealpha', { recursive: true, force: true });
  $(`git clone --depth 1 --branch ${tag} https://github.com/CanadaHonk/porffor porffor-prealpha`);

  const commit = $('git -C porffor-prealpha rev-parse --short HEAD').trim();
  // The version string baked into runtime/index.js is stale in a source
  // checkout (the release build injects the real one), so the tag and commit
  // are what actually identify this lane.
  shim('exec node "$(dirname "$0")/porffor-prealpha/runtime/index.js" "$@"', BIN);

  return { version: `${tag} (${commit})` };
};
