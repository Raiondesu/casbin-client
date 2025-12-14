import type { DefinitionKey, ExpressionParser, Matcher, Model, ModelContext, ModelEffect, ModelRecord, PolicyDefinition, PolicyEffect, RequestDefinition, RoleDefinition } from "./types";

export type { Matcher, Model, PolicyEffect, PolicyDefinition, RequestDefinition, ModelContext, ModelEffect, ModelRecord, RoleDefinition, DefinitionKey };

export interface ModelParserOptions {
  parseExpression?: ExpressionParser;
}

export const naiveParser: ExpressionParser = () => () => true;

export function parseModel(source: string, options?: ModelParserOptions) {
  const {
    parseExpression = naiveParser,
  } = options ?? {};

  const model = {
    requestDefinition: {},
    policyDefinition: {},
    roleDefinition: {},
    policyEffect: {},
    matchers: {},
  } as Model;

  for (const [section, statements] of parseStructure(source))
    for (const statement of statements) {
  const [token, def] = statement.split(eq).map(s => s.trim()) as [keyof Model, string];

  if (!token || !def) continue;

  switch (section) {
    case 'matchers':
    case 'policyEffect':
      (model[section] as Record<string, PolicyEffect>)
        [token] = parseExpression(def, token, section);
      break;
    default:
      (model[section] as Record<string, PolicyDefinition>)
        [token] = def.split(comma);
      break;
    }
  }

  return model;
}

const eq = /=(.*)/;
const comma = /,\s*/;
const sectionRegExp = /(?<type>[\w_]+)\]\n(?<expr>[^[]+)/g;

function* parseStructure(source: string): Generator<ModelIR> {
  const groups = source.matchAll(sectionRegExp);

  for (const group of groups) {
    const { type, expr } = group.groups ?? {};

    if (!type || !expr) continue;

    yield [
      toCamelCaseSimple(type) as keyof Model,
      expr
        .split('\n')
        .map(s => s.trim())
        .filter(s => !!s)
    ];
  }
}

function toCamelCaseSimple(snakeStr: string) {
  return snakeStr.replace(/_([a-z])/g, (_, $1) => $1.toUpperCase());
}

type ModelIR = [keyof Model, string[]];
