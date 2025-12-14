// src/model.ts
var naiveParser = () => () => true;
function parseModel(source, options) {
  const {
    parseExpression = naiveParser
  } = options ?? {};
  const structure = parseStructure(source);
  const model = {
    requestDefinition: [],
    policyDefinition: [],
    roleDefinition: {},
    policyEffect: {},
    matchers: {}
  };
  for (const [section, statements] of Object.entries(structure))
    for (const statement of statements) {
      const [token, def] = statement.split(/=(.*)/).map((s) => s.trim());
      if (!token || !def)
        continue;
      const modelKey = section;
      switch (modelKey) {
        case "requestDefinition":
        case "policyDefinition":
          model[modelKey] = parseByComma(def);
          break;
        case "roleDefinition":
          model.roleDefinition[token] = parseRoles(def);
          break;
        case "matchers":
        case "policyEffect":
          model[modelKey][token] = parseExpression(def, token, modelKey);
          break;
      }
    }
  return model;
}
function parseByComma(def) {
  return def.split(/,\s*/);
}
function parseRoles(def) {
  return def.split(/,\s*/).length;
}
var sectionRegExp = /(?<type>[\w_]+)\](?<expr>[^[]+)/g;
function parseStructure(source) {
  const groups = source.matchAll(sectionRegExp);
  const ir = {};
  for (const group of groups) {
    const { type, expr } = group.groups ?? {};
    if (!type || !expr)
      continue;
    ir[toCamelCaseSimple(type)] = expr.split(`
`).map((s) => s.trim()).filter((s) => !!s);
  }
  return ir;
}
function toCamelCaseSimple(snakeStr) {
  return snakeStr.replace(/_([a-z])/g, (_, $1) => $1.toUpperCase());
}

// src/policy.ts
function fromPolicySource(source, options) {
  const { request, parseExpression } = options ?? {};
  const model = parseModel(source.m, { parseExpression });
  return fromCustomModel(model, source, { request });
}
function fromCustomModel(model, source, options) {
  const { request: presetRequest } = options ?? {};
  const matchers = Object.values(model.matchers);
  const policies = source.p.map(([, ...policy]) => Object.fromEntries(policy.map((value, i) => [model.policyDefinition[i], value])));
  const groups = source.g?.reduce((acc, [g, ...vals]) => ({
    ...acc,
    [g]: (...args) => args.every((a, i) => a === vals[i])
  }), {});
  return policies.reduce((acc, policy) => {
    const key = policy[model.policyDefinition[2]];
    const value = acc[key] ?? [];
    const nextValue = policy[model.policyDefinition[1]];
    const others = model.policyDefinition.slice(3).map((d) => policy[d]);
    const result = () => ({
      ...acc,
      [key]: [...value, nextValue, ...others]
    });
    if (!presetRequest) {
      return result();
    }
    const request = [
      presetRequest[0],
      nextValue,
      key,
      ...others
    ].reduce((acc2, item, i) => ({
      ...acc2,
      [model.requestDefinition[i]]: presetRequest[i] ?? item
    }), {});
    const context = { ...groups, p: policy, r: request };
    return matchers.every((m) => m(context)) ? result() : acc;
  }, {});
}
export {
  fromPolicySource,
  fromCustomModel
};
