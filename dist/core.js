// src/core.ts
function authorizer(permissions, options) {
  const { fallback = () => false } = options ?? {};
  return function can(action, object) {
    return Array.isArray(action) ? action.every((a) => can(a, object)) : Array.isArray(object) ? object.every((o) => can(action, o)) : permissions()?.[action]?.includes(object) ?? fallback(action, object);
  };
}
export {
  authorizer
};

