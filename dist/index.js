// src/index.ts
function createAuthorizer(getPermissions, options = {}) {
  const {
    store = globalThis.sessionStorage ?? {},
    key = "auth",
    fallback = () => false
  } = options;
  const state = {
    permissions: null,
    local: store.getItem?.(key),
    wait: undefined
  };
  const remote = getPermissions();
  const captureAuthorizer = (permissions) => (state.permissions = permissions, {
    get permissions() {
      return state.permissions;
    },
    updatePermissions: () => state.wait = updatePermissions(getPermissions),
    can: new Proxy(can, {
      get(target, p) {
        if (p in target)
          return target[p];
        return can.bind(null, p);
      }
    })
  });
  if (remote instanceof Promise) {
    const updater = remote.then((p) => updatePermissions(() => p));
    return (state.wait = Promise.race([
      updater,
      Promise.resolve(state.local).then(parseFromStorage).catch(() => null).then(() => state.wait = updater)
    ])).then(captureAuthorizer);
  }
  state.wait = Promise.resolve(remote);
  return captureAuthorizer(remote);
  function parseFromStorage(r) {
    return state.permissions = JSON.parse(r ?? "null");
  }
  async function updatePermissions(pending) {
    const result = state.permissions = await pending();
    try {
      await store.setItem?.(key, JSON.stringify(result));
    } catch {}
    return result;
  }
  function can(action, object) {
    return Array.isArray(action) ? action.every((a) => can(a, object)) : Array.isArray(object) ? object.every((o) => can(action, o)) : state.permissions?.[action]?.includes(object) ?? fallback(action, object);
  }
}
export {
  createAuthorizer
};
