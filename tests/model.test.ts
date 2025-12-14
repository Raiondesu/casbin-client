import { describe, expect, test } from 'bun:test';

import { parseModel } from '../src/model';
import { parseExpression } from '../src/parser';
import { sources } from './examples';

describe('Model parser', () => {
  test('Parses a simple model with a naive parser', () => {
    const parsed = parseModel(sources.simple.m);

    expect(parsed.requestDefinition.r).toEqual(['sub', 'obj', 'act']);
    expect(parsed.policyDefinition.p).toEqual(['sub', 'obj', 'act']);
    expect(parsed.roleDefinition).toEqual({ g: ['_', '_'] });

    expect(parsed.policyEffect.e).toBeFunction();
    // @ts-expect-error intentional type violation
    expect(parsed.policyEffect.e()).toBeTrue();

    expect(parsed.matchers.m).toBeFunction();
    // @ts-expect-error intentional type violation
    expect(parsed.matchers.m!()).toBeTrue();
  });

  test('Parses a simple model with an expression parser', () => {
    const parsed = parseModel(sources.simple.m, {
      parseExpression
    });

    expect(parsed.requestDefinition.r).toEqual(['sub', 'obj', 'act']);
    expect(parsed.policyDefinition.p).toEqual(['sub', 'obj', 'act']);
    expect(parsed.roleDefinition).toEqual({ g: ['_', '_'] });

    expect(parsed.matchers.m).toBeFunction();
    expect(() => {
    // @ts-expect-error intentional type violation
      return parsed.matchers.m();
    }).toThrow();

    expect(parsed.policyEffect.e).toBeFunction();
    expect(() => {
      // @ts-expect-error intentional type violation
      return parsed.policyEffect.e();
    }).toThrow();
  });
});