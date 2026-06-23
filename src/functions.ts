// Casbin built-in matcher functions for path / pattern matching. They are available by
// default inside policy matchers (e.g. `keyMatch(r.obj, p.obj)`), and `byPattern` adapts
// any of them into a `matchObject` so a stored pattern like `/data/*` matches a concrete
// `/data/123` at check time. See https://casbin.org/docs/function

import type { MatchObject } from './core.js';

/** `key2` may end in `*`, which matches the trailing part of `key1` (crosses `/`). */
export function keyMatch(key1: string, key2: string): boolean {
  const i = key2.indexOf('*');
  if (i < 0) return key1 === key2;
  return key1.length > i ? key1.slice(0, i) === key2.slice(0, i) : key1 === key2.slice(0, i);
}

/** Like `keyMatch`, but `key2` also supports `:param`, matching a single path segment. */
export function keyMatch2(key1: string, key2: string): boolean {
  return regexMatch(key1, `^${key2.replace(/\/\*/g, '/.*').replace(/:[^/]+/g, '[^/]+')}$`);
}

/** Does the regular expression `pattern` match `key1`? */
export function regexMatch(key1: string, pattern: string): boolean {
  return new RegExp(pattern).test(key1);
}

/** Glob match where `*` stays within a path segment and `**` spans segments. */
export function globMatch(key1: string, pattern: string): boolean {
  const re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex specials (leaving * ? for globbing)
    .replace(/\*\*/g, '\0')               // ** -> placeholder
    .replace(/\*/g, '[^/]*')              // *  -> within a segment
    .replace(/\0/g, '.*')                 // ** -> across segments
    .replace(/\?/g, '[^/]');              // ?  -> one non-slash char
  return new RegExp(`^${re}$`).test(key1);
}

/** The default set of built-in matcher functions, available in every policy matcher. */
export const builtinFunctions = { keyMatch, keyMatch2, regexMatch, globMatch };

/**
 * Adapt a pattern function into a `matchObject`: an object is allowed if it matches ANY
 * of the stored patterns. Lets the authorizer treat permissions like `{ read: ['/data/*'] }`
 * as patterns at check time, e.g. `authorizer(() => perms, { matchObject: byPattern(keyMatch) })`.
 */
export const byPattern = (match: (object: string, pattern: string) => boolean): MatchObject =>
  (object, source) => source?.some(pattern => match(object, pattern)) ?? false;
