import { describe, expect, test } from 'bun:test';

import { parseExpression } from '../src/parser';
import { fromPolicySource } from '../src/policy';
import type { ExpressionParser } from '../src/types';
import { sources } from './examples';

describe('Policy parser', () => {
  test('parses permissions from simple model', () => {
    const permissions = fromPolicySource(sources.simple);

    expect(permissions).toEqual({
      'read': ['data'],
      'write': ['data'],
      'delete': ['data'],
    });
  });

  test('parses from simple model and filters by subject using a naive matcher', () => {
    // Naive matcher which allows to not parse arbitrary expressions
    const naiveMatcher: ExpressionParser = () => (ctx) => ctx.p.sub === ctx.r.sub;

    const permissions = fromPolicySource(sources.simple, {
      request: ['reader'],
      parseExpression: naiveMatcher,
    });

    expect(permissions).toEqual({
      'read': ['data'],
    });

    const permissions2 = fromPolicySource(sources.simple, {
      request: ['writer'],
      parseExpression: naiveMatcher,
    });

    expect(permissions2).toEqual({
      'write': ['data'],
    });
  });

  test('parses from simple model and filters by subject using an expression parser', () => {
    const all = fromPolicySource(sources.simple, {
      parseExpression,
    });

    expect(all).toEqual({
      'read': ['data'],
      'write': ['data'],
      'delete': ['data'],
    });

    // FIXME: somthing is wrong with executing parsed matchers
    // const reader = fromPolicySource(sources.simple, {
    //   request: ['bob'],
    //   parseExpression,
    // });

    // expect(reader).toEqual({
    //   'read': ['data'],
    // });

    // const writer = fromPolicySource(sources.simple, {
    //   request: ['alice'],
    //   parseExpression,
    // });

    // expect(writer).toEqual({
    //   'read': ['data'],
    //   'write': ['data'],
    // });
  });
});
