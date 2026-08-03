import os from 'node:os';
import { readFileSync } from 'node:fs';
import { $ } from '../util.js';

const cleanCpu = cpu => cpu
  ?.replace(/^Apple /, '')
  .replace(/\s+\d+-Core Processor$/i, '')
  .replace(/\s+/g, ' ')
  .trim();

const linuxName = () => {
  try {
    const fields = Object.fromEntries(readFileSync('/etc/os-release', 'utf8')
      .split('\n')
      .filter(line => line.includes('='))
      .map(line => {
        const [key, ...value] = line.split('=');
        return [key, value.join('=').replace(/^"|"$/g, '')];
      }));

    return fields.PRETTY_NAME ?? fields.NAME;
  } catch {
    return 'Linux';
  }
};

const systemInfo = () => {
  const cpu = cleanCpu(os.cpus()[0]?.model);

  if (process.platform === 'darwin') {
    const version = $('sw_vers -productVersion').trim() || os.release();
    return `macOS ${version}${cpu ? ` with ${cpu}` : ''}`;
  }

  if (process.platform === 'linux') {
    const name = linuxName();
    return `${name} ${process.arch}${cpu ? ` with ${cpu}` : ''}`;
  }
};

export default systemInfo;
