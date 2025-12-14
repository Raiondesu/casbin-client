import type { ExpressionParser, Matcher, Model, ModelContext, ModelEffect, ModelRecord, PolicyDefinition, PolicyEffect, RequestDefinition, RoleDefinition, RoleGroups } from "./types";

export type { Matcher, Model, PolicyEffect, PolicyDefinition, RequestDefinition, ModelContext, ModelEffect, ModelRecord, RoleDefinition, RoleGroups };

export interface ModelParserOptions {
  parseExpression?: ExpressionParser;
}

export const naiveParser: ExpressionParser = () => () => true;

export function parseModel(source: string, options?: ModelParserOptions) {
  const {
    parseExpression = naiveParser,
  } = options ?? {};
  const structure = parseStructure(source);

  const model: Model = {
    requestDefinition: [],
    policyDefinition: [],
    roleDefinition: {},
    policyEffect: {},
    matchers: {},
  };

  for (const [section, statements] of Object.entries(structure))
    for (const statement of statements) {
      const [token, def] = statement.split(/=(.*)/).map(s => s.trim());

      if (!token || !def) continue;

      const modelKey = section as keyof ModelIR;

      switch (modelKey) {
        case 'requestDefinition':
        case 'policyDefinition':
          model[modelKey] = parseByComma(def);
          break;
        case 'roleDefinition':
          model.roleDefinition[token] = parseRoles(def);
          break;
        case 'matchers':
        case 'policyEffect':
          model[modelKey][token] = parseExpression(def, token, modelKey);
          break;
      }
    }

  return model;
}

function parseByComma(def: string): RequestDefinition {
  return def.split(/,\s*/);
}

function parseRoles(def: string): number {
  return def.split(/,\s*/).length;
}

const sectionRegExp = /(?<type>[\w_]+)\](?<expr>[^[]+)/g;

function parseStructure(source: string) {
  const groups = source.matchAll(sectionRegExp);
  const ir = {} as ModelIR;

  for (const group of groups) {
    const { type, expr } = group.groups ?? {};

    if (!type || !expr) continue;

    ir[toCamelCaseSimple(type) as keyof Model] = expr
      .split('\n')
      .map(s => s.trim())
      .filter(s => !!s);
  }

  return ir;
}

function toCamelCaseSimple(snakeStr: string) {
  return snakeStr.replace(/_([a-z])/g, (_, $1) => $1.toUpperCase());
}

type ModelIR = {
  [key in keyof Model]: string[];
}
