// src/model.ts
var naiveParser = (_, token) => ({ token, compiled: () => true });
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
          {
            const { compiled, token: _token } = parseExpression(def, token, modelKey);
            model[modelKey][_token] = compiled;
          }
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
export {
  parseModel,
  naiveParser
};
