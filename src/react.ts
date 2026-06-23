'use client';

// React bindings for casbin-client. Authored with `createElement` (no JSX) so the raw `.ts`
// source stays consumable as the types entry without a `jsx` tsconfig. `react` is an optional
// peer dependency. Three never-collapsed states are exposed: loading / allowed / denied - a
// pending policy denies by default (secure), and loading is a separate field, never folded into
// `can()`. SSR is mismatch-proof via `useSyncExternalStore`'s server snapshot.
import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type { AuthorizerOptions } from './core.js';
import { createAuthorizer, type Authorizer, type Permissions, type WebStorage } from './index.js';

export { byPattern, builtinFunctions, globMatch, keyMatch, keyMatch2, regexMatch } from './functions.js';
export type { Authorizer, AuthorizerOptions, Permissions, WebStorage };

/** A storage that touches nothing - the default in React so render never reads `sessionStorage`. */
const noopStore: WebStorage = { getItem: () => null, setItem: () => {} };

/** The slice returned by `useAuthorizer` and the factory hooks. */
export interface AuthorizerState<P extends Permissions> {
  /** The authorizer's `can` - both `can('read', 'data')` and curried `can.read('data')`. */
  can: Authorizer<P>['can'];
  /** True while permissions are pending (hydrating or `isLoading`). Branch on this BEFORE `can`. */
  isLoading: boolean;
  /** Convenience inverse of `isLoading`. */
  isReady: boolean;
  /** The resolved policy, or `null` while loading. */
  permissions: P | null;
}

export interface UseAuthorizerOptions<P extends Permissions> extends AuthorizerOptions<P> {
  /** Set true while permissions are still loading (e.g. a query's `isLoading`). */
  isLoading?: boolean;
  /** Storage to persist permissions in. Defaults to none - render never touches storage. */
  store?: WebStorage | false;
  /** Key to store the permissions at. */
  storeKey?: string;
}

const emptySubscribe = () => () => {};

/**
 * `false` on the server and on the first client paint, then `true` after commit - via the
 * mismatch-proof `useSyncExternalStore` server snapshot. Folded into `isLoading` so server HTML
 * and the first client render both take the loading branch (no hydration mismatch, no flash of
 * denied). Exported for consumers who want the same guarantee elsewhere.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/**
 * The headless, Provider-free hook. The consumer owns fetching/shaping and passes the resolved
 * policy plus a loading flag; the hook memoizes the authorizer on the policy reference and the
 * individual options (NOT options identity, so an inline-but-equal options object doesn't thrash).
 *
 * @param permissions the resolved policy, or `null`/`undefined` while loading
 * @param options authorizer options plus `isLoading`, `store`, `storeKey`
 */
export function useAuthorizer<const P extends Permissions>(
  permissions: P | null | undefined,
  options?: UseAuthorizerOptions<P>,
): AuthorizerState<P> {
  const isHydrated = useIsHydrated();
  const { isLoading, store, storeKey, fallback, matchAction, matchObject, onError } = options ?? {};

  const can = useMemo(
    () => createAuthorizer<P>(() => permissions ?? null, {
      store: store || noopStore,
      key: storeKey,
      fallback,
      matchAction,
      matchObject,
      onError,
    }).can,
    [permissions, store, storeKey, fallback, matchAction, matchObject, onError],
  );

  const loading = !isHydrated || !!isLoading;
  return { can, isLoading: loading, isReady: !loading, permissions: permissions ?? null };
}

/** Props for the declarative `<Can>` gate (the action/object pair plus the three render slots). */
export interface CanProps<P extends Permissions, A extends keyof P & string> {
  /** The action(s) to check. */
  action: A | A[];
  /** The object(s) to check - autocompletes to the chosen action's objects. */
  object: (P[A][number] & string) | (P[A][number] & string)[];
  /** Invert the decision (render children when NOT allowed). */
  not?: boolean;
  /** Rendered while permissions are loading. */
  loading?: ReactNode;
  /** Rendered when the check is denied. */
  fallback?: ReactNode;
  /** Rendered (or called with the decision) when allowed. */
  children?: ReactNode | ((state: { allowed: boolean; isLoading: boolean }) => ReactNode);
}

function renderGate<P extends Permissions, A extends keyof P & string>(
  state: AuthorizerState<P>,
  { action, object, not, loading, fallback, children }: CanProps<P, A>,
): ReactNode {
  if (state.isLoading) return loading ?? null;

  const allowed = not
    ? !(state.can as Authorizer<Permissions>['can'])(action, object)
    : (state.can as Authorizer<Permissions>['can'])(action, object);

  if (typeof children === 'function') return children({ allowed, isLoading: false });
  return allowed ? children ?? null : fallback ?? null;
}

/**
 * Standalone declarative gate - no Provider. Takes the policy + loading as props, ideal for
 * tests, Storybook, or single-component gating.
 */
export function Can<const P extends Permissions, A extends keyof P & string>(
  props: CanProps<P, A> & {
    permissions: P | null | undefined;
    isLoading?: boolean;
    options?: AuthorizerOptions<P>;
    store?: WebStorage | false;
    storeKey?: string;
  },
): ReactNode {
  const { permissions, isLoading, options, store, storeKey, ...gate } = props;
  const state = useAuthorizer<P>(permissions, { ...options, isLoading, store, storeKey });
  return renderGate(state, gate);
}

const MISSING = Symbol('casbin-client: used outside <AuthorizerProvider>');

export interface AuthorizerProviderProps<P extends Permissions> {
  /** The resolved policy, or `null`/`undefined` while loading. */
  permissions: P | null | undefined;
  /** Set true while permissions are still loading. */
  isLoading?: boolean;
  /** Authorizer options (forwarded verbatim). Hoist to module scope for stable identity. */
  options?: AuthorizerOptions<P>;
  /** Storage to persist permissions in. Defaults to none. */
  store?: WebStorage | false;
  /** Key to store the permissions at. */
  storeKey?: string;
  children?: ReactNode;
}

/**
 * Create a per-app, fully-typed scope. Baking `P` in once threads the literal action/object
 * unions through the context boundary, so `can.read('data')` autocomplete survives the Provider.
 * Returns pre-typed bindings; the generic is never re-passed at call sites.
 */
export function createAuthorizerContext<const P extends Permissions = Permissions>() {
  const Context = createContext<AuthorizerState<P> | typeof MISSING>(MISSING);

  function AuthorizerProvider({
    permissions, isLoading, options, store, storeKey, children,
  }: AuthorizerProviderProps<P>): ReactNode {
    const state = useAuthorizer<P>(permissions, { ...options, isLoading, store, storeKey });
    // Stabilise the context value so consumers re-render only when a field actually changes.
    const value = useMemo(
      () => state,
      [state.can, state.isLoading, state.permissions],
    );
    return createElement(Context.Provider, { value }, children);
  }

  function useAuthorizerContext(): AuthorizerState<P> {
    const state = useContext(Context);
    if (state === MISSING) throw new Error('casbin-client: hook used outside <AuthorizerProvider>');
    return state;
  }

  return {
    Context,
    AuthorizerProvider,
    /** Read the full `{ can, isLoading, isReady, permissions }` from context. */
    useAuthorizer: useAuthorizerContext,
    /** Read just `can` from context. */
    useCan: (): AuthorizerState<P>['can'] => useAuthorizerContext().can,
    /** Context-bound declarative gate - reads the policy/loading from the Provider. */
    Can: <A extends keyof P & string>(props: CanProps<P, A>): ReactNode =>
      renderGate(useAuthorizerContext(), props),
  };
}
