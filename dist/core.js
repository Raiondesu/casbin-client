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
export {
  authorizer
};
