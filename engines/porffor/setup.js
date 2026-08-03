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
const BIN = process.env.FYI_PORFFOR_BIN ?? './porf';

// tcc is what run.js asks for by default; without it Porffor's native path
// fails outright, so settle on whatever C compiler this host does have. Every
// install path needs this, prebuilt binary included — the binary is the
// compiler front end, not a self-contained runtime.
export const pickCompiler = () => {
  if (process.env.FYI_PORFFOR_COMPILER) return process.env.FYI_PORFFOR_COMPILER;

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
  return process.env.FYI_PORFFOR_COMPILER;
};

export const shim = (command, bin = BIN) => {
  fs.writeFileSync(bin, `#!/bin/sh\n${command}\n`);
  $(`chmod +x ${bin}`);
  pickCompiler();

  return $(`${bin} --version`).trim();
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
  pickCompiler();

  if (process.env.FYI_PORFFOR_NPM) return installFromNpm('FYI_PORFFOR_NPM set');
  if (process.env.FYI_PORFFOR_SOURCE) return installFromSource('FYI_PORFFOR_SOURCE set');

  const assetName = `porffor-${process.platform}-${process.arch}.tar.gz`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
  };

  // The API is only consulted for the tag name, and only as a nicety: it needs
  // a credential and answers 401 on a host whose token is scoped elsewhere.
  // The asset itself is served unauthenticated from the /releases/latest/
  // /download/ redirect, so a release lane stays available either way — and
  // `porf --version` below is the authoritative version string regardless.
  let tag = null;
  try {
    const releaseResponse = await fetch('https://api.github.com/repos/CanadaHonk/porffor/releases/latest', { headers });
    if (releaseResponse.ok) tag = (await releaseResponse.json()).tag_name ?? null;
      else console.log(`porffor: release API unavailable (${releaseResponse.status}), downloading the asset directly`);
  } catch (err) {
    console.log(`porffor: release API unreachable (${err.message}), downloading the asset directly`);
  }

  const assetResponse = await fetch(`https://github.com/CanadaHonk/porffor/releases/latest/download/${assetName}`, {
    redirect: 'follow'
  });
  if (!assetResponse.ok) return fallback(`download: ${assetResponse.status} ${assetResponse.statusText}`);

  fs.rmSync(BIN, { force: true });
  try {
    await finished(Readable.fromWeb(assetResponse.body).pipe(fs.createWriteStream('porffor.tar.gz')));
    // the tarball holds a bare `porf`; -O keeps a second lane's BIN distinct
    $(`tar -xzOf porffor.tar.gz porf > ${BIN}`);
  } finally {
    fs.rmSync('porffor.tar.gz', { force: true });
  }
  $(`chmod +x ${BIN}`);

  const version = $(`${BIN} --version`).trim();
  return { version: tag ? `${version} [${tag}]` : version };
};
