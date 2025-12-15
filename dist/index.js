// src/index.ts
function createAuthorizer(getPermissions, options = {}) {
  const {
    store = globalThis.sessionStorage ?? {},
    key = "auth",
    fallback = () => false
  } = options;
  const local = store.getItem?.(key);
  const captureAuthorizer = (permissions, remote2) => {
    const p = { permissions: null };
    const get = () => {
      updateStore(p.permissions = permissions() ?? p.permissions);
      return p.permissions;
    };
    return {
      get permissions() {
        return get();
      },
      remote: remote2,
      can: new Proxy(can.bind(null, get), {
        get(target, p2) {
          if (p2 in target)
            return target[p2];
          return can.bind(null, get, p2);
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
  const cached = Promise.resolve(local).then((r) => JSON.parse(r ?? "null"));
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
  function can(permissions, action, object) {
    return Array.isArray(action) ? action.every((a) => can(permissions, a, object)) : Array.isArray(object) ? object.every((o) => can(permissions, action, o)) : permissions()?.[action]?.includes(object) ?? fallback(action, object);
  }
}
export {
  createAuthorizer
};
