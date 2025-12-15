import { authorizer, type AuthorizerOptions, type Can, type Permissions } from "./core";

/**
 * Options for an async authorizer that allow using an async storage
 */
export interface AsyncAuthorizerOptions<P extends Permissions = Permissions> extends AuthorizerOptions<P> {
  /**
   * Store to cache permissions in
   */
  store?: Storage | AsyncStorage;

  /**
   * Key to store the permissions at
   */
  key?: string;
}

/**
 * Simple options for `createAuthorizer` with the ability to persist data locally
 */
export interface PersistAuthorizerOptions<P extends Permissions = Permissions> extends AsyncAuthorizerOptions<P> {
  store?: Storage;
}

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
    store = globalThis.sessionStorage ?? {},
    key = 'auth',
    fallback = () => false,
  } = options;

  const captureAuthorizer = (permissions: () => P | null | undefined, remote?: Promise<P>) => {
    const p = { permissions: null as ReturnType<typeof permissions> };
    const get = () => {
      const local = getStore();
      updateStore(p.permissions = permissions() ?? p.permissions ?? (local instanceof Promise ? null : local));
      return p.permissions;
    };

    const can = authorizer(get, { fallback });

    return {
      get permissions(): P | null | undefined { return get() },
      remote,
      can: new Proxy(can, {
        get(target, p) {
          if (p in target) return target[p as keyof typeof target];

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

  const updater = remote.then(async p => {
    await updateStore(resolved.permissions = p);
    return resolved.permissions;
  });

  const cached = Promise.resolve(getStore());

  // Ensure that after resolution of all promises,
  // the remote permissions are always applied over cached
  Promise.race([
    updater.catch(() => cached)
      .then(p => resolved.permissions = p),
    cached.catch(() => updater)
  ]).then(p => resolved.permissions = p);

  return captureAuthorizer(() => resolved.permissions, updater);

  async function updateStore(permissions?: P | null) {
    try {
      await store.setItem?.(key, JSON.stringify(permissions));
    } catch { /* log/forward the error? */ }
  }

  function getStore() {
    const item = store.getItem?.(key);
    if (!(item instanceof Promise)) return JSON.parse(item ?? 'null') as P;

    return item.then(r => JSON.parse(r ?? 'null') as P)
  }
}

export type AsyncStorage = {
  [key in keyof Storage]: Storage[key] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : Storage[key];
} & {
  [key: string]: never;
};

export interface AsyncAuthorizer<P extends Permissions> {
  readonly permissions?: P | null;
  readonly remote: Promise<P>;

  can: Can<P, boolean> & {
    [A in keyof P & string]: CanActOn<A, P>;
  };
}

export interface Authorizer<P extends Permissions> {
  readonly permissions: P;

  can: Can<P, boolean> & {
    [A in keyof P & string]: CanActOn<A, P>;
  };
}

export interface CanActOn<A extends keyof P & string, P extends Permissions, R = boolean> {
  <O extends P[A][number] & string>(objects: O | O[]): R;
}

export { type Permissions };