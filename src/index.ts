import type { Permissions } from "./types";

/**
 *
 */
export interface AuthorizerAsyncOptions<P extends Permissions = Permissions> {
  /**
   * Fallback function that runs if a matching policy wasn't found
   * @param action an action that wasn't found
   * @param object a corresponding object
   */
  fallback?: <A extends keyof P>(action: A, object: P[A][number]) => boolean;

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
 * Simple options for `createAuthorizer`
 */
export interface AuthorizerOptions<P extends Permissions = Permissions> extends AuthorizerAsyncOptions<P> {
  store?: Storage;
}

/**
 * Create an async authorizer from a `Permissions` object.
 *
 * This authorizer doesn't wait for the promise to resolve in order to facilitate uses in synchronous contexts.
 *
 * @param permissions
 * A promise that resolves to a `Permissions` object
 *
 * @param options
 * Settings for the authorizer, with optional caching and fallbacks
 */
export function createAuthorizer<const P extends Permissions>(
  permissions: Promise<P>,
  options?: AuthorizerAsyncOptions<P>,
): AsyncAuthorizer<P>;

/**
 * Create an authorizer from a `Permissions` object, with optional caching and fallbacks
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
  options?: AuthorizerOptions<P>,
): Authorizer<P>;

export function createAuthorizer<const P extends Permissions>(
  getPermissions: (() => P | null | undefined) | Promise<P>,
  options: AuthorizerOptions<P> | AuthorizerAsyncOptions<P> = {},
): AsyncAuthorizer<P> | Authorizer<P> {
  const {
    store = globalThis.sessionStorage ?? {},
    key = 'auth',
    fallback = () => false,
  } = options;

  const local = store.getItem?.(key);

  const captureAuthorizer = (permissions: () => P | null | undefined, remote?: Promise<P>) => {
    const p = { permissions: null as ReturnType<typeof permissions> };
    const get = () => {
      updateStore(p.permissions = permissions() ?? p.permissions);
      return p.permissions;
    }

    return {
      get permissions(): P | null | undefined { return get() },
      remote,
      can: new Proxy(can.bind(null, get), {
        get(target, p) {
          if (p in target) return target[p as keyof typeof target];

          return can.bind(null, get, p as keyof P & string);
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

  const cached = Promise.resolve(local)
    .then(r => JSON.parse(r ?? 'null') as P);

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

  function can<A extends keyof P & string, O extends P[A][number] & string>(
    permissions: () => P | null | undefined,
    action: A | A[],
    object: O | O[]
  ): boolean {
    return Array.isArray(action)
      ? action.every(a => can(permissions, a, object))
      : Array.isArray(object)
        ? object.every(o => can(permissions, action, o))
        : (
          permissions()?.[action]?.includes(object)
          ?? fallback(action, object)
        );
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

export interface Can<P extends Permissions, R = boolean> {
  <A extends keyof P & string, O extends P[A][number] & string>(actions: A[], object: O): R;
  <A extends keyof P & string, O extends P[A][number] & string>(action: A, objects: O[]): R;
  <A extends keyof P & string, O extends P[A][number] & string>(action: A, object: O): R;
  <A extends keyof P & string, O extends P[A][number] & string>(action: A[], objects: O[]): R;
  <A extends keyof P & string, O extends P[A][number] & string>(action: A | A[], object: O | O[]): R;
}

export interface CanActOn<A extends keyof P & string, P extends Permissions, R = boolean> {
  <O extends P[A][number] & string>(objects: O | O[]): R;
}

export { type Permissions };