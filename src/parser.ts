import { addBinaryOp, compile } from 'jse-eval';

import type { ExpressionParser, Matcher, PolicyEffect } from './types';

export function parseExpression<R extends Matcher | PolicyEffect>(source: string, token: string): ReturnType<ExpressionParser<R>> {
  addBinaryOp('in', 1, customIn);

  return {
    compiled: compile(source) as unknown as R,
    token,
  };
}

// see https://github.com/casbin/casbin-core/blob/b7ce2a9e54c34605b827b2f5c673650b52fca376/src/util/util.ts#L214
// and https://casbin.org/docs/syntax-for-models#special-grammar
function customIn(a: string | number, b: unknown | Array<unknown>) {
  if (canInclude(b)) {
    return b.includes(a);
  }

  return a in ((b ?? {}) as object);
}

interface Includes {
  includes(a: unknown): boolean;
}

function canInclude(b: unknown): b is Includes {
  return b instanceof Array
    || typeof b === 'string'
    || ('includes' in (b as {}) && typeof (b as Includes).includes === 'function');
}