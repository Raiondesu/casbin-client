/// <reference path="./subscript.d.ts" />
// Built on subscript's sandboxed evaluator: matcher/effect expressions cannot reach the
// `Function` constructor, prototypes, or JS globals, so they cannot execute arbitrary code.
// We compose the base preset with just the features Casbin matchers need (literals, `in`,
// array/object literals, ternary) — skipping justin's arrows/spread/templates/optional —
// then add Casbin's `in` array-membership semantics. See https://github.com/dy/subscript
import subscript from 'subscript';
import 'subscript/feature/literal.js';        // true / false / null / undefined / NaN / Infinity
import 'subscript/feature/op/membership.js';  // `in` (parse)
import 'subscript/eval/op/membership.js';     // `in` (eval)
import 'subscript/feature/collection.js';     // [a, b] and { a: b } literals (parse)
import 'subscript/eval/collection.js';        // collection literals (eval)
import 'subscript/feature/op/ternary.js';     // a ? b : c (parse)
import 'subscript/eval/op/ternary.js';        // ternary (eval)
import { compile, operator, parse } from 'subscript/parse';

import type { ExpressionParser, Matcher, PolicyEffect } from './types.js';

// Casbin allows single-quoted strings.
parse.string["'"] = true;

// https://casbin.org/docs/syntax-for-models#special-grammar
// Casbin `in` is array membership (`x in [a, b]`), not JS's key-in-object lookup.
operator('in', (a, b) => b && (a = compile(a), b = compile(b), (ctx: unknown) => {
  const right = b(ctx), left = a(ctx);
  return Array.isArray(right) ? right.includes(left) : left in (right ?? {});
}));

export function parseExpression<R extends Matcher | PolicyEffect>(source: string): ReturnType<ExpressionParser<R>> {
  // `subscript()` returns an evaluator at runtime; its shipped type narrows to the AST,
  // so bridge through `unknown`.
  return subscript(source) as unknown as R;
}
