import { describe, expect, test } from 'bun:test';

import { authorizer, type Permissions } from '../src/core';
import { byPattern, globMatch, keyMatch, keyMatch2, regexMatch } from '../src/functions';
import { parseExpression } from '../src/parser';
import { fromPolicySource } from '../src/policy';

describe('Built-in matcher functions', () => {
  test('keyMatch (`*` crosses `/`)', () => {
    expect(keyMatch('/foo/bar', '/foo/*')).toBeTrue();
    expect(keyMatch('/foo/bar/baz', '/foo/*')).toBeTrue();
    expect(keyMatch('/foo', '/foo/*')).toBeFalse();
    expect(keyMatch('/foo/bar', '/foo/bar')).toBeTrue();
    expect(keyMatch('/foo/bar', '/baz/*')).toBeFalse();
  });

  test('keyMatch2 (`:param` is one segment)', () => {
    expect(keyMatch2('/foo/123', '/foo/:id')).toBeTrue();
    expect(keyMatch2('/foo/123/bar', '/foo/:id')).toBeFalse();
    expect(keyMatch2('/foo/123/bar', '/foo/:id/bar')).toBeTrue();
  });

  test('regexMatch', () => {
    expect(regexMatch('foobar', '^foo')).toBeTrue();
    expect(regexMatch('foobar', '^bar')).toBeFalse();
  });

  test('globMatch (`*` stays in a segment, `**` spans them)', () => {
    expect(globMatch('/foo/bar', '/foo/*')).toBeTrue();
    expect(globMatch('/foo/bar/baz', '/foo/*')).toBeFalse();
    expect(globMatch('/foo/bar/baz', '/foo/**')).toBeTrue();
  });
});

describe('Pattern matching at check time (byPattern)', () => {
  test('a stored `/data/*` matches a concrete path', () => {
    // pattern-based permissions: objects are concrete paths (string) checked against stored patterns
    const can = authorizer<Permissions<'read' | 'write', string>>(() => ({ read: ['/data/*'], write: ['/admin'] }), {
      matchObject: byPattern(keyMatch),
    });

    expect(can('read', '/data/123')).toBeTrue();
    expect(can('read', '/other')).toBeFalse();
    expect(can('write', '/admin')).toBeTrue();
  });
});

describe('Pattern matching in policy matchers', () => {
  const model = `
    [request_definition]
    r = sub, obj, act
    [policy_definition]
    p = sub, obj, act
    [matchers]
    m = r.sub == p.sub && keyMatch(r.obj, p.obj) && r.act == p.act
  `;

  test('keyMatch is available by default inside matchers', () => {
    const policy = { m: model, p: [['p', 'alice', '/data/*', 'read']] };

    const granted = fromPolicySource(policy, { request: ['r', 'alice', '/data/x', 'read'], parseExpression });
    expect(granted).toEqual({ read: ['/data/*'] });

    const denied = fromPolicySource(policy, { request: ['r', 'alice', '/other', 'read'], parseExpression });
    expect(denied).toEqual({});
  });

  test('custom functions can be supplied / override built-ins', () => {
    const policy = { m: model.replace('keyMatch(', 'myMatch('), p: [['p', 'alice', 'X', 'read']] };

    const granted = fromPolicySource(policy, {
      request: ['r', 'alice', 'anything', 'read'],
      parseExpression,
      functions: { myMatch: () => true },
    });
    expect(granted).toEqual({ read: ['X'] });
  });
});
