import { describe, expect, test } from 'bun:test';

import { createAuthorizer, type Permissions, type WebStorage } from '../src';

/** An in-memory `WebStorage` that mirrors the DOM spec's string coercion on `setItem`. */
function memoryStore(initial?: Record<string, string>) {
  const data = new Map(Object.entries(initial ?? {}));

  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
  } satisfies WebStorage & { data: Map<string, string> };
}

describe('Storage edges', () => {
  test('a corrupt cache degrades to deny instead of throwing', () => {
    const reported: string[] = [];
    const store = memoryStore({ auth: '{ not json' });
    const auth = createAuthorizer<Permissions>(() => null, {
      store,
      onError: (_e, ctx) => reported.push(ctx),
    });

    expect(() => auth.can('read', 'data')).not.toThrow();
    expect(auth.can('read', 'data')).toBeFalse();
    expect(reported).toContain('createAuthorizer.getStore');
  });

  test('repeated checks do not re-hit storage on the hot path', () => {
    let reads = 0, writes = 0;
    const store = {
      getItem: (_k: string) => { reads++; return null; },
      setItem: (_k: string, _v: string) => { writes++; },
    } satisfies WebStorage;

    const perms = { read: ['data'], write: ['data'] };
    const auth = createAuthorizer<Permissions>(() => perms, { store });

    auth.can('read', 'data');
    auth.can('write', 'data');
    auth.can(['read', 'write'], ['data']); // fans out to several internal checks
    auth.can('read', 'data');

    // the store is seeded once and written at most once - not once per check.
    expect(reads).toBeLessThanOrEqual(1);
    expect(writes).toBeLessThanOrEqual(1);
  });

  test('a valid cache is read back', () => {
    const store = memoryStore({ auth: JSON.stringify({ read: ['data'] }) });
    const auth = createAuthorizer<Permissions>(() => null, { store });

    expect(auth.can('read', 'data')).toBeTrue();
    expect(auth.can('read', 'users')).toBeFalse();
  });

  test('a remote resolving to undefined does not poison the cache with "undefined"', async () => {
    const store = memoryStore();
    const auth = createAuthorizer(Promise.resolve(undefined as unknown as Permissions), { store });

    await auth.remote.catch(() => {});

    expect(store.data.get('auth')).not.toBe('undefined');

    // a fresh authorizer reading the same key must not throw
    const next = createAuthorizer<Permissions>(() => null, { store });
    expect(() => next.can('read', 'data')).not.toThrow();
  });

  test('remote permissions override cached ones', async () => {
    const store = memoryStore({ auth: JSON.stringify({ read: ['data'] }) });
    const auth = createAuthorizer(Promise.resolve({ read: ['data', 'users'] }), { store });

    // cached value is visible synchronously
    expect(auth.can('read', 'users')).toBeFalse();

    await auth.remote;

    // remote has been applied over the cache
    expect(auth.can('read', 'users')).toBeTrue();
  });
});

describe('Proxy curried accessor', () => {
  test('action names that collide with Function properties still resolve to real checks', () => {
    const auth = createAuthorizer(() => ({
      name: ['x'], length: ['y'], bind: ['z'], read: ['data'],
    }));

    expect((auth.can as any).read('data')).toBeTrue();
    expect((auth.can as any).name('x')).toBeTrue();
    expect((auth.can as any).length('y')).toBeTrue();
    expect((auth.can as any).bind('z')).toBeTrue();
    expect((auth.can as any).name('nope')).toBeFalse();
  });

  test('the `can` proxy is not accidentally thenable', async () => {
    const auth = createAuthorizer(() => ({ read: ['data'] }));

    expect(typeof (auth.can as any).then).toBe('undefined');

    const settled = await Promise.race([
      (async () => { await (auth.can as any); return 'resolved'; })(),
      new Promise((r) => setTimeout(() => r('HUNG'), 200)),
    ]);
    expect(settled).toBe('resolved');
  });
});
