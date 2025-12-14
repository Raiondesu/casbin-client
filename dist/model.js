// src/model.ts
var naiveParser = () => () => true;
function parseModel(source, options) {
  const {
    parseExpression = naiveParser
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
      const [token, def] = statement.split(eq).map((s) => s.trim());
      if (!token || !def)
        continue;
      switch (section) {
        case "matchers":
        case "policyEffect":
          model[section][token] = parseExpression(def, token, section);
          break;
        default:
          model[section][token] = def.split(comma);
          break;
      }
    }
  return model;
}
var eq = /=(.*)/;
var comma = /,\s*/;
var sectionRegExp = /(?<type>[\w_]+)\]\n(?<expr>[^[]+)/g;
function* parseStructure(source) {
  const groups = source.matchAll(sectionRegExp);
  for (const group of groups) {
    const { type, expr } = group.groups ?? {};
    if (!type || !expr)
      continue;
    yield [
      toCamelCaseSimple(type),
      expr.split(`
`).map((s) => s.trim()).filter((s) => !!s)
    ];
  }
}
function toCamelCaseSimple(snakeStr) {
  return snakeStr.replace(/_([a-z])/g, (_, $1) => $1.toUpperCase());
}
export {
  parseModel,
  naiveParser
};

