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
  const captureAuth = (permissions) => (state.permissions = permissions, {
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
  if (state.local instanceof Promise) {
    return (state.wait = Promise.race([
      remote,
      state.local.then(parseFromStorage).catch(() => null)
    ])).then(captureAuth);
  }
  if (remote instanceof Promise) {
    state.permissions = parseFromStorage(state.local);
    state.wait = remote;
    return state.wait.then(captureAuth);
  }
  state.wait = Promise.resolve(remote);
  return captureAuth(remote);
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
