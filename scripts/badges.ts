import { $ } from 'bun';

import { c, group, writeBadge } from './utils';

const badges = await Promise.all([
  writeBadge('version', ({ version }) => ({
    color: 'green',
    label: 'version',
    message: version,
  }), await import('../package.json')),

  writeBadge('coverage', ({ coverage: p }) => ({
    color: p < .4 ? 'critical' : p < .7 ? 'important' : 'success',
    label: 'coverage',
    message: Intl.NumberFormat('ia', { style: 'percent', maximumFractionDigits: 1 }).format(p),
  }), {
    coverage: Number(await $`bunx coverage-percentage ./tests/coverage/lcov.info --lcov`.text()) / 100
  }),
]);

const log = group.call('right', c('orange')`Generated ${badges.length} badges`);

badges.forEach((b, i, a) => {
  log[i === a.length - 1 ? 'end' : 'line'](b.label, c({
    'critical': 'tomato',
    'important': 'goldenrod',
    'success': 'limegreen'
  }[b.color!]!)(b.message));
});
