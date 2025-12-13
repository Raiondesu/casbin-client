import { $ } from 'bun';

await $`
  PER=$(bunx coverage-percentage ./tests/coverage/lcov.info --lcov)
  coverage-badge -o assets/coverage.svg -c $PER
`;

// await $``;
