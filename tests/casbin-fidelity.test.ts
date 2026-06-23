import { describe, expect, test } from 'bun:test';

import { parseModel } from '../src/model';
import { parseExpression } from '../src/parser';
import { createRoleContext, fromPolicySource } from '../src/policy';

describe('Model parser robustness', () => {
  test('CRLF line endings parse the same as LF', () => {
    const lf = '[request_definition]\nr = sub, obj, act\n[matchers]\nm = r.sub == p.sub\n';
    const parsed = parseModel(lf.replace(/\n/g, '\r\n'));

    expect(parsed.requestDefinition.r).toEqual(['sub', 'obj', 'act']);
    expect(Object.keys(parsed.matchers)).toEqual(['m']);
  });

  test('`#` comments are stripped from statements', () => {
    const parsed = parseModel('[request_definition]\nr = sub, obj, act # the request\n[matchers]\nm = true\n');

    expect(parsed.requestDefinition.r).toEqual(['sub', 'obj', 'act']);
  });

  test('a `[` inside a matcher no longer truncates the expression', () => {
    const parsed = parseModel('[matchers]\nm = r.act == ["read", "write"][0]\n', { parseExpression });

    expect(parsed.matchers.m({ r: { act: 'read' } } as any)).toBeTrue();
    expect(parsed.matchers.m({ r: { act: 'delete' } } as any)).toBeFalse();
  });

  test('malformed statements are reported, not silently mis-parsed', () => {
    const reported: string[] = [];
    parseModel('[matchers]\nthis line has no equals\n', { onError: (_e, ctx) => reported.push(ctx) });

    expect(reported).toContain('model.matchers');
  });
});

describe('Transitive RBAC', () => {
  test('roles are inherited through intermediate roles', () => {
    const ctx = createRoleContext({ g: ['_', '_'] }, [
      ['g', 'alice', 'admin'],
      ['g', 'admin', 'super'],
    ])!;

    expect(ctx.g('alice', 'admin')).toBeTrue(); // direct
    expect(ctx.g('alice', 'super')).toBeTrue(); // transitive
    expect(ctx.g('alice', 'nobody')).toBeFalse();
  });

  test('cycles do not hang', () => {
    const ctx = createRoleContext({ g: ['_', '_'] }, [
      ['g', 'a', 'b'],
      ['g', 'b', 'a'],
    ])!;

    expect(ctx.g('a', 'b')).toBeTrue();
    expect(ctx.g('a', 'c')).toBeFalse(); // would loop forever without the cycle guard
  });

  test('end-to-end: an inherited role grants the parent role permission', () => {
    const model = `
      [request_definition]
      r = sub, obj, act
      [policy_definition]
      p = sub, obj, act
      [role_definition]
      g = _, _
      [policy_effect]
      e = some(where (p.eft == allow))
      [matchers]
      m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
    `;
    const policy = {
      m: model,
      g: [['g', 'alice', 'admin'], ['g', 'admin', 'super']],
      p: [['p', 'super', 'data', 'read']],
    };

    const alice = fromPolicySource(policy, { request: ['r', 'alice'], parseExpression });
    expect(alice).toEqual({ read: ['data'] });
  });
});

describe('Policy effects', () => {
  test('deny rows override allow rows, are not added, and pairs are deduped', () => {
    const model = `
      [request_definition]
      r = sub, obj, act
      [policy_definition]
      p = sub, obj, act, eft
      [policy_effect]
      e = some(where (p.eft == allow)) && !some(where (p.eft == deny))
      [matchers]
      m = r.sub == p.sub && r.obj == p.obj && r.act == p.act
    `;

    const all = fromPolicySource({
      m: model,
      p: [
        ['p', 'alice', 'data', 'read', 'allow'],
        ['p', 'alice', 'data', 'read', 'allow'], // duplicate -> deduped
        ['p', 'alice', 'secret', 'read', 'allow'],
        ['p', 'alice', 'secret', 'read', 'deny'], // deny overrides the allow above
      ],
    });

    expect(all).toEqual({ read: ['data'] });
  });

  test('a request against a model with no matcher denies (no throw)', () => {
    const reported: string[] = [];
    const model = `
      [request_definition]
      r = sub, obj, act
      [policy_definition]
      p = sub, obj, act
    `; // deliberately no [matchers] section

    const perms = fromPolicySource(
      { m: model, p: [['p', 'alice', 'data', 'read']] },
      { request: ['r', 'alice'], parseExpression, onError: (_e, ctx) => reported.push(ctx) },
    );

    expect(perms).toEqual({});
    expect(reported).toContain('policy.fromCustomModel');
  });

  test('a permissionModel column mismatch is reported and skipped (no `{undefined: [...]}`)', () => {
    const reported: string[] = [];
    const model = `
      [request_definition]
      r = sub, obj, act
      [policy_definition]
      p = sub, resource, action
      [matchers]
      m = true
    `;

    const perms = fromPolicySource(
      { m: model, p: [['p', 'reader', 'data', 'read']] },
      { onError: (_e, ctx) => reported.push(ctx) },
    );

    expect(perms).toEqual({});
    expect(reported).toContain('policy.fromCustomModel');
  });
});
