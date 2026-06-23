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
export {
  parseModel,
  naiveParser
};
