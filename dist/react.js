"use client";
// src/core.ts
function authorizer(permissions, options) {
  const {
    fallback = () => false,
    matchAction = (action, source) => source?.[action],
    matchObject = (obj, source) => source?.includes(obj)
  } = options ?? {};
  return function can(action, object) {
    return Array.isArray(action) ? action.length > 0 && action.every((a) => can(a, object)) : Array.isArray(object) ? object.length > 0 && object.every((o) => can(action, o)) : matchObject(object, matchAction(action, permissions())) ?? fallback(action, object);
  };
}

// src/functions.ts
function keyMatch(key1, key2) {
  const i = key2.indexOf("*");
  if (i < 0)
    return key1 === key2;
  return key1.length > i ? key1.slice(0, i) === key2.slice(0, i) : key1 === key2.slice(0, i);
}
function keyMatch2(key1, key2) {
  return regexMatch(key1, `^${key2.replace(/\/\*/g, "/.*").replace(/:[^/]+/g, "[^/]+")}$`);
}
function regexMatch(key1, pattern) {
  return new RegExp(pattern).test(key1);
}
function globMatch(key1, pattern) {
  const re = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\x00").replace(/\*/g, "[^/]*").replace(/\0/g, ".*").replace(/\?/g, "[^/]");
  return new RegExp(`^${re}$`).test(key1);
}
var builtinFunctions = { keyMatch, keyMatch2, regexMatch, globMatch };
var byPattern = (match) => (object, source) => source?.some((pattern) => match(object, pattern)) ?? false;

// src/index.ts
function createAuthorizer(getPermissions, options = {}) {
  const {
    store = globalThis.sessionStorage ?? { getItem: () => null, setItem: () => {} },
    key = "auth",
    fallback = () => false,
    matchAction,
    matchObject,
    onError
  } = options;
  let lastRef;
  let lastWritten;
  const captureAuthorizer = (permissions, remote2) => {
    const cached = getStore();
    const p = { permissions: cached instanceof Promise ? null : cached };
    if (cached instanceof Promise)
      cached.then((c) => {
        p.permissions ??= c;
      });
    const get = () => {
      p.permissions = permissions() ?? p.permissions;
      updateStore(p.permissions);
      return p.permissions;
    };
    const can = authorizer(get, { fallback, matchAction, matchObject, onError });
    return {
      get permissions() {
        return get();
      },
      remote: remote2,
      can: new Proxy(can, {
        get(target, p2, receiver) {
          if (typeof p2 === "symbol" || p2 === "then")
            return Reflect.get(target, p2, receiver);
          return can.bind(null, p2);
        }
      })
    };
  };
  if (!(getPermissions instanceof Promise)) {
    return captureAuthorizer(getPermissions);
  }
  const remote = getPermissions;
  const resolved = { permissions: null };
  Promise.resolve(getStore()).then((cached) => {
    resolved.permissions ??= cached;
  });
  const updater = remote.then(async (p) => {
    await updateStore(resolved.permissions = p);
    return p;
  });
  updater.catch(() => {});
  return captureAuthorizer(() => resolved.permissions, updater);
  async function updateStore(permissions) {
    if (permissions === lastRef)
      return;
    lastRef = permissions;
    const serialized = JSON.stringify(permissions ?? null);
    if (serialized === lastWritten)
      return;
    lastWritten = serialized;
    try {
      await store.setItem?.(key, serialized);
    } catch (error) {
      onError?.(error, "createAuthorizer.updateStore");
    }
  }
  function getStore() {
    const item = store.getItem?.(key);
    if (!(item instanceof Promise))
      return safeParse(item);
    return item.then(safeParse, (error) => {
      onError?.(error, "createAuthorizer.getStore");
      return null;
    });
  }
  function safeParse(raw) {
    try {
      return JSON.parse(raw ?? "null");
    } catch (error) {
      onError?.(error, "createAuthorizer.getStore");
      return null;
    }
  }
}

// src/react.ts
import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useSyncExternalStore
} from "react";
"use client";
var noopStore = { getItem: () => null, setItem: () => {} };
var emptySubscribe = () => () => {};
function useIsHydrated() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
function useAuthorizer(permissions, options) {
  const isHydrated = useIsHydrated();
  const { isLoading, store, storeKey, fallback, matchAction, matchObject, onError } = options ?? {};
  const can = useMemo(() => createAuthorizer(() => permissions ?? null, {
    store: store || noopStore,
    key: storeKey,
    fallback,
    matchAction,
    matchObject,
    onError
  }).can, [permissions, store, storeKey, fallback, matchAction, matchObject, onError]);
  const loading = !isHydrated || !!isLoading;
  return { can, isLoading: loading, isReady: !loading, permissions: permissions ?? null };
}
function renderGate(state, { action, object, not, loading, fallback, children }) {
  if (state.isLoading)
    return loading ?? null;
  const allowed = not ? !state.can(action, object) : state.can(action, object);
  if (typeof children === "function")
    return children({ allowed, isLoading: false });
  return allowed ? children ?? null : fallback ?? null;
}
function Can(props) {
  const { permissions, isLoading, options, store, storeKey, ...gate } = props;
  const state = useAuthorizer(permissions, { ...options, isLoading, store, storeKey });
  return renderGate(state, gate);
}
var MISSING = Symbol("casbin-client: used outside <AuthorizerProvider>");
function createAuthorizerContext() {
  const Context = createContext(MISSING);
  function AuthorizerProvider({
    permissions,
    isLoading,
    options,
    store,
    storeKey,
    children
  }) {
    const state = useAuthorizer(permissions, { ...options, isLoading, store, storeKey });
    const value = useMemo(() => state, [state.can, state.isLoading, state.permissions]);
    return createElement(Context.Provider, { value }, children);
  }
  function useAuthorizerContext() {
    const state = useContext(Context);
    if (state === MISSING)
      throw new Error("casbin-client: hook used outside <AuthorizerProvider>");
    return state;
  }
  return {
    Context,
    AuthorizerProvider,
    useAuthorizer: useAuthorizerContext,
    useCan: () => useAuthorizerContext().can,
    Can: (props) => renderGate(useAuthorizerContext(), props)
  };
}
export {
  useIsHydrated,
  useAuthorizer,
  regexMatch,
  keyMatch2,
  keyMatch,
  globMatch,
  createAuthorizerContext,
  byPattern,
  builtinFunctions,
  Can
};
