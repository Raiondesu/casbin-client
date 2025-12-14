// src/index.ts
function createAuthorizer(remote, options = {}) {
  const {
    store = globalThis.sessionStorage ?? {},
    key = "auth",
    fallback = () => false
  } = options;
  const state = {
    permissions: null,
    local: store.getItem?.(key)
  };
  const captureAuthorizer = (permissions) => ({
    get permissions() {
      return permissions;
    },
    can: new Proxy(can.bind(null, permissions), {
      get(target, p) {
        if (p in target)
          return target[p];
        return can.bind(null, permissions, p);
      }
    })
  });
  if (remote instanceof Promise) {
    const updater = remote.then(updatePermissions);
    return Promise.race([
      updater,
      Promise.resolve(state.local).then((r) => JSON.parse(r ?? "null")).catch(() => null).then(() => updater)
    ]).then(captureAuthorizer);
  }
  Promise.resolve(remote);
  return captureAuthorizer(remote);
  async function updatePermissions(pending) {
    const result = await pending;
    try {
      await store.setItem?.(key, JSON.stringify(result));
    } catch {}
    return result;
  }
  function can(permissions, action, object) {
    return Array.isArray(action) ? action.every((a) => can(permissions, a, object)) : Array.isArray(object) ? object.every((o) => can(permissions, action, o)) : permissions?.[action]?.includes(object) ?? fallback(action, object);
  }
}
export {
  createAuthorizer
};
