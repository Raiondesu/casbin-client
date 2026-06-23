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
export {
  regexMatch,
  keyMatch2,
  keyMatch,
  globMatch,
  byPattern,
  builtinFunctions
};
