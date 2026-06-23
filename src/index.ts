import { authorizer, type AuthorizerOptions, type Can, type Permissions } from "./core.js";

/**
 * Options for an async authorizer that allow using an async storage
 */
export interface AsyncAuthorizerOptions<P extends Permissions = Permissions> extends AuthorizerOptions<P> {
  /**
   * Store to cache permissions in
   */
  store?: WebStorage | AsyncStorage;

  /**
   * Key to store the permissions at
   */
  key?: string;
}

/**
 * Simple options for `createAuthorizer` with the ability to persist data locally
 */
export interface PersistAuthorizerOptions<P extends Permissions = Permissions> extends AsyncAuthorizerOptions<P> {
  store?: WebStorage;
}

/**
 * Options for a synchronous authorizer with optional local persistence.
 * Alias of {@link PersistAuthorizerOptions}.
 */
export type SyncAuthorizerOptions<P extends Permissions = Permissions> = PersistAuthorizerOptions<P>;

/**
 * Create an async authorizer from a `Permissions` object.
 *
 * This authorizer doesn't wait for the promise to resolve in order to facilitate uses in synchronous contexts.
 *
 * It enables null checks on the permissions object and streamlines the final inteface.
 *
 * @param permissions
 * A promise that resolves to a `Permissions` object
 *
 * @param options
 * Settings for the authorizer, with optional caching and fallbacks
 */
export function createAuthorizer<const P extends Permissions>(
  permissions: Promise<P>,
  options?: AsyncAuthorizerOptions<P>,
): AsyncAuthorizer<P>;

/**
 * Create an authorizer from a `Permissions` object, with optional caching and fallbacks.
 *
 * It enables null checks on the permissions object and streamlines the final inteface.
 *
 * @param getPermissions
 * A factory that should return a permissions object.
 * This function is called on each invocation of the `.can` method so be sure to memoize it yourself!
 *
 * @param options
 * Settings for the authorizer, with optional caching and fallbacks
 */
export function createAuthorizer<const P extends Permissions>(
  getPermissions: () => P | null | undefined,
  options?: PersistAuthorizerOptions<P>,
): Authorizer<P>;

export function createAuthorizer<const P extends Permissions>(
  getPermissions: (() => P | null | undefined) | Promise<P>,
  options: PersistAuthorizerOptions<P> | AsyncAuthorizerOptions<P> = {},
): AsyncAuthorizer<P> | Authorizer<P> {
  const {
    store = (globalThis as { sessionStorage?: WebStorage }).sessionStorage
      ?? { getItem: () => null, setItem: () => {} },
    key = 'auth',
    fallback = () => false,
    matchAction,
    matchObject,
    onError
  } = options;

  const captureAuthorizer = (permissions: () => P | null | undefined, remote?: Promise<P>) => {
    const p = { permissions: null as ReturnType<typeof permissions> };
    const get = () => {
      const local = getStore();
      updateStore(p.permissions = permissions() ?? p.permissions ?? (local instanceof Promise ? null : local));
      return p.permissions;
    };

    const can = authorizer(get, { fallback, matchAction, matchObject, onError });

    return {
      get permissions(): P | null | undefined { return get() },
      remote,
      can: new Proxy(can, {
        get(target, p, receiver) {
          // Symbols and `then` pass through (so the proxy is never accidentally
          // thenable); every other key is an action name to curry.
          if (typeof p === 'symbol' || p === 'then') return Reflect.get(target, p, receiver);

          return can.bind(null, p as keyof P & string);
        },
      }),
    } as AsyncAuthorizer<P>
  };

  if (!(getPermissions instanceof Promise)) {
    return captureAuthorizer(getPermissions as () => P);
  }

  const remote = getPermissions;
  const resolved = { permissions: null as P | null | undefined };

  // Seed from cache (sync or async) but never override a remote that already arrived.
  Promise.resolve(getStore())
    .then(cached => { resolved.permissions ??= cached; })
    .catch(() => {});

  // Remote always wins once it resolves; on failure we keep whatever the cache seeded.
  const updater = remote.then(async p => {
    await updateStore(resolved.permissions = p);
    return p;
  });
  updater.catch(() => {});

  return captureAuthorizer(() => resolved.permissions, updater);

  async function updateStore(permissions?: P | null) {
    try {
      // Coerce undefined -> null so we never persist the string "undefined",
      // which would throw on the next read.
      await store.setItem?.(key, JSON.stringify(permissions ?? null));
    } catch (error) {
      onError?.(error, 'createAuthorizer.updateStore');
    }
  }

  function getStore() {
    const item = store.getItem?.(key);
    if (!(item instanceof Promise)) return safeParse(item);

    return item.then(safeParse);
  }

  function safeParse(raw?: string | null): P | null {
    try {
      return JSON.parse(raw ?? 'null') as P;
    } catch (error) {
      // A corrupt cache entry must never throw at a permission check — degrade to "no cache".
      onError?.(error, 'createAuthorizer.getStore');
      return null;
    }
  }
}

/**
 * The minimal `Storage`-like surface this library uses. Declared structurally
 * (instead of the DOM `Storage` global) so the package stays environment-independent
 * and does not drag a DOM lib requirement into consumers. `sessionStorage`,
 * `localStorage`, and most KV shims satisfy it.
 */
export interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type AsyncStorage = {
  [K in keyof WebStorage]: WebStorage[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : WebStorage[K];
};

export interface AsyncAuthorizer<P extends Permissions> {
  readonly permissions?: P | null;
  readonly remote: Promise<P>;

  can: Can<P, boolean> & {
    [A in keyof P & string]: CanActOn<A, P>;
  };
}

export interface Authorizer<P extends Permissions> {
  readonly permissions: P | null;

  can: Can<P, boolean> & {
    [A in keyof P & string]: CanActOn<A, P>;
  };
}

export interface CanActOn<A extends keyof P & string, P extends Permissions, R = boolean> {
  <O extends P[A][number] & string>(objects: O | O[]): R;
}

export { type Permissions };