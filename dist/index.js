import {
  authorizer
} from "./core.js";

// src/index.ts
function createAuthorizer(getPermissions, options = {}) {
  const {
    store = globalThis.sessionStorage ?? {},
    key = "auth",
    fallback = () => false
  } = options;
  const captureAuthorizer = (permissions, remote2) => {
    const p = { permissions: null };
    const get = () => {
      const local = getStore();
      updateStore(p.permissions = permissions() ?? p.permissions ?? (local instanceof Promise ? null : local));
      return p.permissions;
    };
    const can = authorizer(get, { fallback });
    return {
      get permissions() {
        return get();
      },
      remote: remote2,
      can: new Proxy(can, {
        get(target, p2) {
          if (p2 in target)
            return target[p2];
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
  const updater = remote.then(async (p) => {
    await updateStore(resolved.permissions = p);
    return resolved.permissions;
  });
  const cached = Promise.resolve(getStore());
  Promise.race([
    updater.catch(() => cached).then((p) => resolved.permissions = p),
    cached.catch(() => updater)
  ]).then((p) => resolved.permissions = p);
  return captureAuthorizer(() => resolved.permissions, updater);
  async function updateStore(permissions) {
    try {
      await store.setItem?.(key, JSON.stringify(permissions));
    } catch {}
  }
  function getStore() {
    const item = store.getItem?.(key);
    if (!(item instanceof Promise))
      return JSON.parse(item ?? "null");
    return item.then((r) => JSON.parse(r ?? "null"));
  }
}
export {
  createAuthorizer
};
