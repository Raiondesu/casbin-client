// We're reimplementing a bit of subscript/justin here because it lacks types
import 'subscript/feature/number.js';
import 'subscript/feature/string.js';
import 'subscript/feature/call.js';
import 'subscript/feature/access.js';
import 'subscript/feature/group.js';
import 'subscript/feature/ternary.js';
import 'subscript/feature/bool.js';
import 'subscript/feature/array.js';
import 'subscript/feature/object.js';
import 'subscript/feature/arrow.js';
import 'subscript/feature/optional.js';
import 'subscript/feature/spread.js';
import 'subscript/feature/logic.js';
import 'subscript/feature/compare.js';

// oxlint-disable no-sparse-arrays
import { compile, operator } from 'subscript/compile';
import { binary, err, parse, token } from 'subscript/parse';

import type { ExpressionParser, Matcher, PolicyEffect } from './types';

// We're reimplementing a bit of subscript/justin here because it lacks types
// See https://github.com/dy/subscript/issues/26
binary('in', 90);

// https://casbin.org/docs/syntax-for-models#special-grammar
operator('in', (a, b) => b && (a = compile(a), b = compile(b), (ctx: unknown) => {
  const _b = b(ctx), _a = a(ctx);
  return Array.isArray(_b) ? _b.includes(_a) : _a in (_b ?? {});
}));

// add JS literals
token('undefined', 20, a => a ? err() : [, undefined])
token('NaN', 20, a => a ? err() : [, NaN])
token('null', 20, a => a ? err() : [, null])

export function parseExpression<R extends Matcher | PolicyEffect>(source: string): ReturnType<ExpressionParser<R>> {
  return compile(parse(source)) as R;
}
