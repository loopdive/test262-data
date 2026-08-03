import fs from 'node:fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { $ } from '../../util.js';

// Fallback for hosts that cannot reach the GitHub release API (no token, or a
// token scoped elsewhere): the same compiler is published to npm. It runs
// through Node rather than as a prebuilt native binary, so prefer the release
// when it is reachable — but a Porffor column measured through npm beats no
// Porffor column at all, and the shim keeps run.js's `./porf` contract.
const installFromNpm = async reason => {
  console.log(`porffor: falling back to npm (${reason})`);

  fs.rmSync('porffor', { recursive: true, force: true });
  fs.mkdirSync('porffor');
  $('cd porffor && npm install porffor@latest');

  fs.writeFileSync('porf', '#!/bin/sh\nexec "$(dirname "$0")/porffor/node_modules/.bin/porf" "$@"\n');
  $('chmod +x porf');

  return { version: $('./porf --version').trim() };
};

export default async () => {
  if (process.env.FYI_PORFFOR_NPM) return installFromNpm('FYI_PORFFOR_NPM set');

  const assetName = `porffor-${process.platform}-${process.arch}.tar.gz`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
  };

  const releaseResponse = await fetch('https://api.github.com/repos/CanadaHonk/porffor/releases/latest', { headers });
  if (!releaseResponse.ok) {
    return installFromNpm(`release API: ${releaseResponse.status} ${releaseResponse.statusText}`);
  }

  const release = await releaseResponse.json();
  const asset = release.assets.find(x => x.name === assetName);
  if (!asset) return installFromNpm(`release ${release.tag_name} has no ${assetName} asset`);

  const assetResponse = await fetch(asset.browser_download_url, { headers });
  if (!assetResponse.ok) return installFromNpm(`download: ${assetResponse.status} ${assetResponse.statusText}`);

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
