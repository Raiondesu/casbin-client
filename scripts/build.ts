import { existsSync } from 'fs';
import { join } from 'path';

import { gzipSync } from 'bun';
import { readdir, rm } from 'fs/promises';

import { c, formatBytes, group, writeBadge } from './utils';

if (existsSync('dist')) await rm('dist', { recursive: true });

const src = await readdir('src', { withFileTypes: true })
  .then(files => files.map(f => join(f.parentPath, f.name)));

let complete = false;

try {
  const full = await Bun.build({
    entrypoints: src,
    outdir: 'dist',
    root: 'src',

    minify: false,
    splitting: false,
    packages: 'external',
  });

  await postProcess(full, 'isolated');

  const minified = await Bun.build({
    entrypoints: src,
    outdir: 'dist/min',
    root: 'src',

    emitDCEAnnotations: true,
    minify: true,
    splitting: false,
    // react is a peer dependency — never inline it (the full build externalises all packages).
    external: ['react', 'react-dom'],
    naming: { entry: '[dir]/[name].[ext]' },
  });

  complete = true;

  await postProcess(minified, 'minified');

  // Bun strips the `'use client'` directive; re-prepend it so RSC / Next.js App Router works.
  for (const file of ['dist/react.js', 'dist/min/react.js']) {
    if (existsSync(file)) await Bun.write(file, `"use client";\n${await Bun.file(file).text()}`);
  }

  if (minified.success) {
    const contents = (await Promise.all(
      minified.outputs.map(o => o.text()
        .catch(() => '')
      )
    )).join('');

    const size = formatBytes(gzipSync(contents).byteLength);
    const sizeCore = formatBytes(gzipSync(
      await minified.outputs.find(o => o.path.endsWith('core.js'))!
        .text()
        .catch(() => '')
    ).byteLength);

    await writeBadge('size-full', {
      color: 'blue',
      label: 'gzip size',
      message: size
    });

    await writeBadge('size-core', {
      color: 'informational',
      label: 'gzip size (core)',
      message: sizeCore
    });

    const grouped = group.right(c('orange')`Updated size badges:`);
    grouped.line(c('gray')`min-zipped full: ${c('chocolate')()}${size}`);
    grouped.end(c('gray')`min-zipped core: ${c('chocolate')()}${sizeCore}`);
  }
} catch (e) {
  const error = e as AggregateError;
  if (!complete) console.error("Build Failed!");
  console.error(error);
}

async function postProcess(result: Bun.BuildOutput, type: string) {
  if (result.success) {
    const grouped = group.right(c('lightgreen')`Bundled ${result.outputs.length} ${type} modules successfuly`);

    for (const module of result.outputs) if (module.size) {
      grouped.line(
        c('mediumorchid')`${module.path.split(/[/\\]/).at(-1)}\t`,
        formatBytes(module.size)
      );
    } else {
      try {
        await rm(module.path);
      } catch {}
    }

    grouped.footer(
      c('gray')`total size:\t`,
      c('royalblue')(formatBytes(result.outputs.reduce((s, o) => s + o.size, 0)))
    )
  } else {
    console.error(`Couldn't bundle modules!`);
  }

  for (const msg of result.logs) {
    console.warn(msg);
  }
}
