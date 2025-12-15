import { describe, expect, test } from 'bun:test';
import { createAuthorizer, type AsyncAuthorizer, type Permissions } from '../src';
import { authorizer } from '../src/core';

type SimplePermissions = Permissions<
  'read' | 'write' | 'delete',
  'data' | 'users'
>;

export const permissions = {
  simple: {
    user: <SimplePermissions>({
      read: ['data'],
      write: ['data'],
      delete: []
    }),
    admin: <SimplePermissions>({
      read: ['data', 'users'],
      write: ['data', 'users'],
      delete: ['data']
    }),
    system: <SimplePermissions>({
      read: ['data', 'users'],
      write: ['data', 'users'],
      delete: ['data', 'users']
    }),
  }
};

describe('Simple authorizer', () => {
  test('example from README', () => {
    const permissions = {
      read: ['data']
    };

    const can = authorizer(() => permissions);

    expect(can('read', 'data')).toBeTrue();
    expect(!can('read', 'users')).toBeTrue();

    permissions.read = ['data', 'users'];

    expect(can('read', 'users')).toBeTrue();
    expect(can('read', ['data', 'users'])).toBeTrue();
    expect(can('read', ['data', 'huh?'])).toBeFalse();
  });
});

describe('Authorizer', () => {
  test('works with simple permissions in a synchronized way', () => {
    const auth = Object.fromEntries(
      Object.entries(permissions.simple)
        .map(([user, perm]) => [
          user,
          createAuthorizer(() => perm)
        ], [])
    ) as { [key in keyof typeof permissions['simple']]: AsyncAuthorizer<typeof permissions['simple'][key]> };

    // user
    checkPermissions(auth);
  });

  test('works with simple permissions and waits for promises', async () => {
    const auth = Object.fromEntries(
      Object.entries(permissions.simple)
        .map(([user, perm]) => [
          user,
          createAuthorizer(Promise.resolve(perm))
        ], [])
    ) as { [key in keyof typeof permissions['simple']]: AsyncAuthorizer<typeof permissions['simple'][key]> };

    expect(auth.admin.can.read('data')).toBeFalse();
    expect(auth.admin.can.write('data')).toBeFalse();
    expect(auth.admin.can.delete('data')).toBeFalse();

    await Promise.all(Object.values(auth).map(a => a.remote));

    // user
    checkPermissions(auth);
  });
});

function checkPermissions(auth: {
  user: AsyncAuthorizer<SimplePermissions>;
  admin: AsyncAuthorizer<SimplePermissions>;
  system: AsyncAuthorizer<SimplePermissions>;
}) {
  expect(auth.user.can.read('data')).toBeTrue();
  expect(auth.user.can.write('data')).toBeTrue();
  expect(auth.user.can.delete('data')).toBeFalse();
  expect(auth.user.can.read('users')).toBeFalse();
  expect(auth.user.can.write('users')).toBeFalse();
  expect(auth.user.can.delete('users')).toBeFalse();
  expect(auth.user.can.read(['data', 'users'])).toBeFalse();
  expect(auth.user.can.write(['data', 'users'])).toBeFalse();
  expect(auth.user.can.delete(['data', 'users'])).toBeFalse();
  expect(auth.user.can(['read', 'write'], 'data')).toBeTrue();
  expect(auth.user.can(['read', 'write'], ['data', 'users'])).toBeFalse();
  expect(auth.user.can(['write', 'delete'], 'users')).toBeFalse();
  expect(auth.user.can(['write', 'delete'], ['data', 'users'])).toBeFalse();

  // admin
  expect(auth.admin.can('read', 'data')).toBeTrue();
  expect(auth.admin.can('write', 'data')).toBeTrue();
  expect(auth.admin.can('delete', 'data')).toBeTrue();
  expect(auth.admin.can('read', 'users')).toBeTrue();
  expect(auth.admin.can('write', 'users')).toBeTrue();
  expect(auth.admin.can('delete', 'users')).toBeFalse();
  expect(auth.admin.can('read', ['data', 'users'])).toBeTrue();
  expect(auth.admin.can('write', ['data', 'users'])).toBeTrue();
  expect(auth.admin.can('delete', ['data', 'users'])).toBeFalse();
  expect(auth.admin.can(['read', 'write'], 'data')).toBeTrue();
  expect(auth.admin.can(['read', 'write'], ['data', 'users'])).toBeTrue();
  expect(auth.admin.can(['write', 'delete'], 'data')).toBeTrue();
  expect(auth.admin.can(['write', 'delete'], 'users')).toBeFalse();
  expect(auth.admin.can(['write', 'delete'], ['data', 'users'])).toBeFalse();

  // system
  expect(auth.system.can('read', 'data')).toBeTrue();
  expect(auth.system.can('write', 'data')).toBeTrue();
  expect(auth.system.can('delete', 'data')).toBeTrue();
  expect(auth.system.can('read', 'users')).toBeTrue();
  expect(auth.system.can('write', 'users')).toBeTrue();
  expect(auth.system.can('delete', 'users')).toBeTrue();
  expect(auth.system.can('read', ['data', 'users'])).toBeTrue();
  expect(auth.system.can('write', ['data', 'users'])).toBeTrue();
  expect(auth.system.can('delete', ['data', 'users'])).toBeTrue();
  expect(auth.system.can(['read', 'write'], 'data')).toBeTrue();
  expect(auth.system.can(['read', 'write'], ['data', 'users'])).toBeTrue();
  expect(auth.system.can(['write', 'delete'], 'data')).toBeTrue();
  expect(auth.system.can(['write', 'delete'], 'users')).toBeTrue();
  expect(auth.system.can(['write', 'delete'], ['data', 'users'])).toBeTrue();
}
