import { readFileSync, readdirSync, writeFileSync } from 'fs';

import { makeBadge } from 'badge-maker';
import { $, gzipSync } from 'bun';

await $`
  PER=$(bunx coverage-percentage ./tests/coverage/lcov.info --lcov)
  coverage-badge -o assets/coverage.svg -c $PER
`;

let core: Buffer<ArrayBuffer>;

const combined = readdirSync('./dist/min', { withFileTypes: true })
  .filter(e => e.isFile())
  .map(e => {
    const content = readFileSync(e.parentPath + '/' + e.name);
    if (e.name === 'index.js') core = content;
    return content;
  })
  .join('');

const size = formatBytes(gzipSync(combined).byteLength);
writeFileSync('assets/size-full.svg', makeBadge({
  message: size,
  color: 'blue',
  label: 'gzip size'
}));

const coreSize = formatBytes(gzipSync(core!).byteLength);
writeFileSync('assets/size-core.svg', makeBadge({
  message: coreSize,
  color: 'blue',
  label: 'gzip size (core)',
}));

writeFileSync('assets/wip.svg', makeBadge({
  message: 'WIP',
  color: 'orange',
  label: '🚧',
}));

function formatBytes(bytes: number, decimals = 2) {
    if (!bytes) return '0B'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['B', 'KiB', 'MiB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`
}