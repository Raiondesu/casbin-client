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
export {
  createAuthorizer
};
