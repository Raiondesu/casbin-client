import { expect, expectTypeOf, test } from 'bun:test';

import { createAuthorizer, type Permissions, type SyncAuthorizer } from '../src';
import { parseExpression } from '../src/parser';
import { fromPolicySource } from '../src/policy';
import { sources } from './examples';

test('All work in unison', async () => {
  type P = Permissions<'read' | 'write' | 'delete', 'data'>;
  const auth = createAuthorizer(() => fromPolicySource<P>(sources.simple, { parseExpression }));

  expectTypeOf(auth).toEqualTypeOf<SyncAuthorizer<P>>();

  expect(auth.can('read', 'data')).toBeTrue();
  expect(auth.can(
    // @ts-expect-error incorrect permission
    'huh?',
    'data'
  )).toBeFalse();
  expect(auth.can('read',
    // @ts-expect-error incorrect permission
    'crap'
  )).toBeFalse();

  expect(auth.can('write', 'data')).toBeTrue();
  expect(auth.can(
    // @ts-expect-error incorrect permission
    'huh?',
    'data'
  )).toBeFalse();
  expect(auth.can('write',
    // @ts-expect-error incorrect permission
    'crap'
  )).toBeFalse();

  expect(auth.can('delete', 'data')).toBeTrue();
  expect(auth.can(
    // @ts-expect-error incorrect permission
    'huh?',
    'data'
  )).toBeFalse();
  expect(auth.can('delete',
    // @ts-expect-error incorrect permission
    'crap'
  )).toBeFalse();
});