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

// src/model.ts
var naiveParser = () => () => true;
function parseModel(source, options) {
  const {
    parseExpression = naiveParser,
    onError
  } = options ?? {};
  const model = {
    requestDefinition: {},
    policyDefinition: {},
    roleDefinition: {},
    policyEffect: {},
    matchers: {}
  };
  for (const [section, statements] of parseStructure(source))
    for (const statement of statements) {
      const at = statement.indexOf("=");
      const token = at < 0 ? "" : statement.slice(0, at).trim();
      const def = at < 0 ? "" : statement.slice(at + 1).trim();
      if (!token || !def) {
        onError?.(new Error(`ignoring malformed statement \`${statement}\``), `model.${section}`);
        continue;
      }
      try {
        switch (section) {
          case "matchers":
          case "policyEffect":
            model[section][token] = parseExpression(def, token, section);
            break;
          default:
            model[section][token] = def.split(comma);
            break;
        }
      } catch (error) {
        onError?.(error, `model.${section}.${token}`);
      }
    }
  return model;
}
var comma = /,\s*/;
var header = /^\[(\w+)\]$/;
function parseStructure(source) {
  const sections = [];
  let section;
  let statements = [];
  for (const raw of source.replace(/\r\n?/g, `
`).split(`
`)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line)
      continue;
    const match = header.exec(line);
    if (match) {
      if (section)
        sections.push([section, statements]);
      section = toCamelCaseSimple(match[1]);
      statements = [];
    } else if (section) {
      statements.push(line);
    }
  }
  if (section)
    sections.push([section, statements]);
  return sections;
}
function toCamelCaseSimple(snakeStr) {
  return snakeStr.replace(/_([a-z])/g, (_, $1) => $1.toUpperCase());
}

// src/policy.ts
var defaultPermissionModel = ["act", "obj"];
function fromPolicySource(source, options) {
  const {
    request,
    parseExpression,
    onError,
    functions,
    permissionModel = defaultPermissionModel
  } = options ?? {};
  if (request && !parseExpression) {
    onError?.(new Error("`request` filtering requires `parseExpression`; denying to fail closed"), "policy.fromPolicySource");
    return {};
  }
  const model = parseModel(source.m, { parseExpression, onError });
  return fromCustomModel(model, source, { request, permissionModel, onError, functions });
}
function fromCustomModel(model, source, options) {
  const {
    request: presetRequest,
    permissionModel = defaultPermissionModel,
    onError,
    functions
  } = options ?? {};
  const [requestGroup, ...request] = presetRequest ?? ["r"];
  const requestType = getSectionType(requestGroup);
  const groups = createRoleContext(model.roleDefinition, source.g);
  const matcher = model.matchers[`m${requestType === 1 ? "" : requestType}`];
  if (presetRequest && !matcher) {
    onError?.(new Error(`no matcher \`m${requestType === 1 ? "" : requestType}\` to filter the request; denying`), "policy.fromCustomModel");
    return {};
  }
  const [keyProp, objProp] = permissionModel;
  const matched = [];
  for (const [policyGroup, ...policy] of source.p) {
    if (requestType !== getSectionType(policyGroup))
      continue;
    const def = model.policyDefinition[policyGroup];
    if (!def)
      continue;
    const policyContext = toModelContext(def, policy);
    if (presetRequest) {
      const context = {
        [requestGroup]: toModelContext(def, request, policyContext),
        [policyGroup]: policyContext,
        ...groups,
        ...builtinFunctions,
        ...functions,
        ...model.matchers,
        ...model.policyEffect
      };
      if (!matcher(context))
        continue;
    }
    const key = policyContext[keyProp];
    const obj = policyContext[objProp];
    if (key == null || obj == null) {
      onError?.(new Error(`policy row \`${policy.join(", ")}\` is missing its \`${key == null ? keyProp : objProp}\` column; skipping`), "policy.fromCustomModel");
      continue;
    }
    matched.push({ key, obj, deny: policyContext.eft === "deny" });
  }
  const denied = new Set(matched.filter((m) => m.deny).map((m) => `${m.key} ${m.obj}`));
  const perms = {};
  for (const { key, obj, deny } of matched) {
    if (deny || denied.has(`${key} ${obj}`))
      continue;
    const list = perms[key] ??= [];
    if (!list.includes(obj))
      list.push(obj);
  }
  return perms;
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
      [g]: (...args) => hasRole(vals[g], args)
    };
  }, {});
}
function hasRole(edges, args) {
  const [subject, role, ...domain] = args;
  const inDomain = (edge) => domain.every((d, i) => edge[2 + i] === d);
  const seen = new Set;
  const reaches = (from) => from === role || !seen.has(from) && (seen.add(from), edges.some((edge) => edge[0] === from && inDomain(edge) && reaches(edge[1])));
  return reaches(subject);
}
export {
  toModelContext,
  fromPolicySource,
  fromCustomModel,
  defaultPermissionModel,
  createRoleContext
};
