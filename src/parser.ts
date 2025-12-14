// oxlint-disable no-sparse-arrays
import bake, { binary, compile, operator, token } from 'subscript';
import { err } from 'subscript/parse';

import type { ExpressionParser, Matcher, PolicyEffect } from './types';

// We're reimplementing a bit of subscript/justin here because it lacks types
// See https://github.com/dy/subscript/issues/26
binary('in', 90);
operator('in', (a, b) => b && (a = compile(a), b = compile(b), (ctx: unknown) => a(ctx) in b(ctx)));

// add JS literals
token('undefined', 20, a => a ? err() : [, undefined])
token('NaN', 20, a => a ? err() : [, NaN])
token('null', 20, a => a ? err() : [, null])

export function parseExpression<R extends Matcher | PolicyEffect>(source: string): ReturnType<ExpressionParser<R>> {
  return bake(source) as unknown as R;
}
