import type { Permissions } from "./types";

export interface AuthorizerAsyncOptions<P extends Permissions> {
  store?: Storage | AsyncStorage;
  key?: string;
  fallback?: <A extends keyof P>(action: A, object: P[A][number]) => boolean;
}

export interface AuthorizerOptions<P extends Permissions> extends AuthorizerAsyncOptions<P> {
  store?: Storage;
}

export function createAuthorizer<const P extends Permissions>(
  getPermissions: () => Promise<P>,
  options?: AuthorizerAsyncOptions<P>,
): Promise<Authorizer<P>>;

export function createAuthorizer<const P extends Permissions>(
  getPermissions: () => P,
  options?: AuthorizerOptions<P>,
): SyncAuthorizer<P>;

export function createAuthorizer<const P extends Permissions>(
  getPermissions: () => P | Promise<P>,
  options: AuthorizerOptions<P> | AuthorizerAsyncOptions<P> = {},
): Authorizer<P> | Promise<Authorizer<P>> {
  const {
    store = globalThis.sessionStorage ?? {},
    key = 'auth',
    fallback = () => false,
  } = options;

  const state = {
    permissions: null as P | null,
    local: store.getItem?.(key),
    wait: undefined as Promise<P> | undefined,
  };

  const remote = getPermissions();

  const captureAuthorizer = (permissions: P) => (state.permissions = permissions, {
    get permissions(): P | null { return state.permissions },

    updatePermissions: () => state.wait = updatePermissions(getPermissions),

    can: new Proxy(can, {
      get(target, p) {
        if (p in target) return target[p as keyof typeof target];

        return can.bind(null, p as keyof P & string);
      },
    }),
  } as Authorizer<P>);

  if (remote instanceof Promise) {
    const updater = remote.then(p => updatePermissions(() => p));

    return (state.wait = Promise.race([
      updater,
      Promise.resolve(state.local)
        .then(parseFromStorage)
        .catch(() => null)
        .then(() => state.wait = updater)
    ])).then(captureAuthorizer);
  }

  state.wait = Promise.resolve(remote);
  return captureAuthorizer(remote);

  function parseFromStorage(r: string | null): any {
    return state.permissions = JSON.parse(r ?? 'null');
  }

  async function updatePermissions(pending: () => Promise<P> | P) {
    const result = state.permissions = await pending();

    try {
      await store.setItem?.(key, JSON.stringify(result));
    } catch {/* log/forward the error? */}

    return result;
  }

  function can<A extends keyof P & string, O extends P[A][number] & string>(
    action: A | A[],
    object: O | O[]
  ): boolean {
    return Array.isArray(action)
      ? action.every(a => can(a, object))
      : Array.isArray(object)
        ? object.every(o => can(action, o))
        : (
          state.permissions?.[action]?.includes(object)
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

export interface Authorizer<P extends Permissions> {
  readonly permissions: P | null;
  updatePermissions(): Promise<P>;

  can: Can<P, boolean> & {
    [A in keyof P & string]: CanActOn<A, P>;
  };
}

export interface SyncAuthorizer<P extends Permissions> extends Authorizer<P> {
  readonly permissions: P;
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