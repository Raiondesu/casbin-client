import { readFileSync, readdirSync } from 'fs';

import { makeBadge, type Format } from 'badge-maker';
import { $, gzipSync } from 'bun';
import { writeFile } from 'fs/promises';

let core: Buffer<ArrayBuffer>;

const badges = await Promise.all([
  writeBadge('wip', {
    message: 'WIP',
    color: 'orange',
    label: '🚧',
  }),

  writeBadge('version', {
    color: 'green',
    label: 'version',
    message: (await import('../package.json')).version,
  }),

  writeBadge('coverage', p => ({
    color: p < .4 ? 'critical' : p < .7 ? 'important' : 'success',
    label: 'coverage',
    message: Intl.NumberFormat('ia', { style: 'percent', maximumFractionDigits: 1 }).format(p),
  }), Number(await $`bunx coverage-percentage ./tests/coverage/lcov.info --lcov`.text()) / 100),

  writeBadge('size-full', contents => ({
    color: 'blue',
    label: 'gzip size',
    message: formatBytes(gzipSync(contents).byteLength)
  }), (
    readdirSync('./dist/min', { withFileTypes: true })
      .filter(e => e.isFile())
      .map(e => {
        const content = readFileSync(e.parentPath + '/' + e.name);
        if (e.name === 'index.js') core = content;
        return content;
      })
      .join('')
  )),

  writeBadge('size-core', ({
    color: 'informational',
    label: 'gzip size (core)',
    message: formatBytes(gzipSync(core!).byteLength)
  })),
]);

console.log(`Generated ${badges.length} badges.`);

function writeBadge(file: string, options: Format): Promise<void>;
function writeBadge<T>(file: string, options: (v: T) => Format, value: T): Promise<void>;
function writeBadge<T>(file: string, options: ((v: T) => Format) | Format, value?: T) {
  return writeFile(`assets/${file}.svg`, makeBadge(typeof options === 'function' ? options(value!) : options));
}

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes) return '0B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KiB', 'MiB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`;
}
