import { type Format, makeBadge } from "badge-maker";
import * as Bun from "bun";
import { writeFile } from 'fs/promises';

export function writeBadge(file: string, options: Format): Promise<Format>;
export function writeBadge<T>(file: string, options: (v: T) => Format, value: T): Promise<Format>;
export async function writeBadge<T>(file: string, options: ((v: T) => Format) | Format, value?: T) {
  const opts = typeof options === 'function' ? options(value!) : options;

  await writeFile(
    `assets/${file}.svg`,
    makeBadge(opts)
  );

  return opts;
}

export function formatBytes(bytes: number, opts?: {
  decimals?: number;
  sep?: string;
}) {
  const {
    decimals = 2,
    sep = ' '
  } = opts ?? {};
  if (!bytes) return `0${sep}B`;

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB'];

  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sep}${sizes[i]}`;
}

export function c(color: string) {
  return (raw?: TemplateStringsArray | string, ...args: any[]) => `${color ? Bun.color(color, 'ansi') : ''}${raw ? String.raw({ raw }, ...args) + '\u001b[0m' : ''}`;
}

export function group(this: any, ...header: any[]) {
  if (this === 'right') {
    const len = count(header.join(' '));
    console.log(...header, '┐');
    console.group('  ┌' + '─'.repeat(len - 2) + '┘');
  } else {
    console.log('┌', ...header);
    console.group('└─┐');
  }

  return {
    line(...line: any[]) {
      console.log('├', ...line);
    },
    skip(...line: any[]) {
      console.log('│', ...line);
    },
    end(...footer: any[]) {
      console.log('└', ...footer);
      console.log();

      console.groupEnd();
    },
    footer(...footer: any[]) {
      this.skip('');
      const len = count(footer.join(' '));
      this.skip(...footer, '┐');
      console.log('└─' + '─'.repeat(len) + '─┘');
      console.log();

      console.groupEnd();
    }
  };
}

group.right = group.bind('right');
/*
┌─┬┐
│ ││
├─┼┤
└─┴┘
*/

function count(str: string) {
  // oxlint-disable-next-line no-control-regex
  return str.replace(/\u001b\[.*?m/g, '').length;
}