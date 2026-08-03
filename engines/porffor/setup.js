import fs from 'node:fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { $ } from '../../util.js';

// Fallbacks for hosts that cannot reach the GitHub release API (no token, or a
// token scoped elsewhere). Both keep run.js's `./porf` contract via a shim.
//
// Source is preferred over npm because it is what "latest Porffor" actually
// means today: the npm package is a snapshot that has fallen behind the repo
// (0.61.13, published 2026-04-23), and upstream no longer even carries a
// package.json — HEAD self-reports `pre-alpha N (<sha> <date>)` under a reset
// version scheme. A clone is also the only path here that measures current
// upstream rather than a months-old build.
const shim = command => {
  fs.writeFileSync('porf', `#!/bin/sh\n${command}\n`);
  $('chmod +x porf');

  // tcc is what run.js asks for by default; without it Porffor's native path
  // fails outright, so fall back to whatever C compiler this host does have.
  if (!process.env.FYI_PORFFOR_COMPILER) {
    for (const candidate of ['tcc', 'clang', 'gcc', 'cc']) {
      try {
        $(`command -v ${candidate}`);
        process.env.FYI_PORFFOR_COMPILER = candidate;
        break;
      } catch {}
    }
    if (process.env.FYI_PORFFOR_COMPILER !== 'tcc') {
      console.log(`porffor: tcc not found, using ${process.env.FYI_PORFFOR_COMPILER ?? '(none)'}`);
    }
  }

  const version = $('./porf --version').trim();
  return version;
};

const installFromSource = async reason => {
  console.log(`porffor: building from source (${reason})`);

  fs.rmSync('porffor-src', { recursive: true, force: true });
  $('git clone --depth 1 https://github.com/CanadaHonk/porffor porffor-src');

  const commit = $('git -C porffor-src rev-parse --short HEAD').trim();
  const version = shim('exec node "$(dirname "$0")/porffor-src/runtime/index.js" "$@"');

  return { version: `${version} [${commit}]` };
};

const installFromNpm = async reason => {
  console.log(`porffor: falling back to npm (${reason})`);

  fs.rmSync('porffor', { recursive: true, force: true });
  fs.mkdirSync('porffor');
  $('cd porffor && npm install porffor@latest');

  return { version: `${shim('exec "$(dirname "$0")/porffor/node_modules/.bin/porf" "$@"')} [npm]` };
};

const fallback = async reason => {
  if (process.env.FYI_PORFFOR_NPM) return installFromNpm(reason);

  try {
    return await installFromSource(reason);
  } catch (err) {
    return installFromNpm(`${reason}; source build failed: ${err.message.split('\n')[0]}`);
  }
};

export default async () => {
  if (process.env.FYI_PORFFOR_NPM) return installFromNpm('FYI_PORFFOR_NPM set');
  if (process.env.FYI_PORFFOR_SOURCE) return installFromSource('FYI_PORFFOR_SOURCE set');

  const assetName = `porffor-${process.platform}-${process.arch}.tar.gz`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
  };

  const releaseResponse = await fetch('https://api.github.com/repos/CanadaHonk/porffor/releases/latest', { headers });
  if (!releaseResponse.ok) {
    return fallback(`release API: ${releaseResponse.status} ${releaseResponse.statusText}`);
  }

  const release = await releaseResponse.json();
  const asset = release.assets.find(x => x.name === assetName);
  if (!asset) return fallback(`release ${release.tag_name} has no ${assetName} asset`);

  const assetResponse = await fetch(asset.browser_download_url, { headers });
  if (!assetResponse.ok) return fallback(`download: ${assetResponse.status} ${assetResponse.statusText}`);

  fs.rmSync('porf', { force: true });
  try {
    await finished(Readable.fromWeb(assetResponse.body).pipe(fs.createWriteStream('porffor.tar.gz')));
    $('tar -xzf porffor.tar.gz');
  } finally {
    fs.rmSync('porffor.tar.gz', { force: true });
  }
  $('chmod +x porf');

  return { version: $('./porf --version').trim() };
};
