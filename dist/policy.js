import {
  parseModel
} from "./model.js";

// src/policy.ts
var defaultPermissionModel = ["act", "obj"];
function fromPolicySource(source, options) {
  const {
    request,
    parseExpression,
    permissionModel = defaultPermissionModel
  } = options ?? {};
  const model = parseModel(source.m, { parseExpression });
  return fromCustomModel(model, source, { request, permissionModel });
}
function fromCustomModel(model, source, options) {
  const {
    request: presetRequest,
    permissionModel = defaultPermissionModel
  } = options ?? {};
  const [requestGroup, ...request] = presetRequest ?? ["r"];
  const requestType = getSectionType(requestGroup);
  const groups = createRoleContext(model.roleDefinition, source.g);
  const matcher = model.matchers[`m${requestType === 1 ? "" : requestType}`];
  return source.p.reduce((perms, [policyGroup, ...policy]) => {
    const policyType = getSectionType(policyGroup);
    if (requestType !== policyType)
      return perms;
    const def = model.policyDefinition[policyGroup];
    const policyContext = toModelContext(def, policy);
    const [key, nextValue] = permissionModel.map((key2) => policyContext[key2]);
    const previous = perms[key] ?? [];
    const result = () => ({
      ...perms,
      [key]: [...previous, nextValue]
    });
    if (!presetRequest)
      return result();
    const requestContext = toModelContext(def, request, policyContext);
    const context = {
      [requestGroup]: requestContext,
      [policyGroup]: policyContext,
      ...groups,
      ...model.matchers,
      ...model.policyEffect
    };
    return matcher(context) ? result() : perms;
  }, {});
}
function getSectionType(group) {
  return Number(group.slice(1) || "1");
}
function toModelContext(def, policy, fallback) {
  return def.reduce((ctx, prop, i) => ({
    ...ctx,
    [prop]: policy[i] ?? fallback?.[prop]
  }), {});
}
function createRoleContext(roleModel, roleGroups) {
  const vals = {};
  return roleGroups?.reduce((acc, [g, ..._vals]) => {
    vals[g] ??= [];
    vals[g].push(_vals);
    return {
      ...acc,
      [g]: (...args) => {
        return vals[g].some((val) => args.every((a, i) => val[i] === a));
      }
    };
  }, {});
}
export {
  toModelContext,
  fromPolicySource,
  fromCustomModel,
  defaultPermissionModel,
  createRoleContext
};
