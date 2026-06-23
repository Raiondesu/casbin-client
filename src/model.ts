import type { DefinitionKey, ErrorReporter, ExpressionParser, Matcher, Model, ModelContext, ModelEffect, ModelRecord, PolicyDefinition, PolicyEffect, RequestDefinition, RoleDefinition } from "./types.js";

export type { Matcher, Model, PolicyEffect, PolicyDefinition, RequestDefinition, ModelContext, ModelEffect, ModelRecord, RoleDefinition, DefinitionKey };

export interface ModelParserOptions {
  parseExpression?: ExpressionParser;

  /** Reports a recoverable parse error; parsing continues and skips the offending statement. */
  onError?: ErrorReporter;
}

export const naiveParser: ExpressionParser = () => () => true;

export function parseModel(source: string, options?: ModelParserOptions) {
  const {
    parseExpression = naiveParser,
    onError,
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
      const at = statement.indexOf('=');
      const token = at < 0 ? '' : statement.slice(0, at).trim();
      const def = at < 0 ? '' : statement.slice(at + 1).trim();

      if (!token || !def) {
        onError?.(new Error(`ignoring malformed statement \`${statement}\``), `model.${section}`);
        continue;
      }

      try {
        switch (section) {
          case 'matchers':
          case 'policyEffect':
            (model[section] as Record<string, PolicyEffect>)[token] = parseExpression(def, token, section);
            break;
          default:
            (model[section] as Record<string, PolicyDefinition>)[token] = def.split(comma);
            break;
        }
      } catch (error) {
        // A single bad expression must not abort the whole model parse.
        onError?.(error, `model.${section}.${token}`);
      }
    }

  return model;
}

const comma = /,\s*/;
const header = /^\[(\w+)\]$/;

function parseStructure(source: string): ModelIR[] {
  const sections: ModelIR[] = [];
  let section: keyof Model | undefined;
  let statements: string[] = [];

  // Normalise CRLF / lone CR up front so the rest is plain `\n` work.
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/#.*$/, '').trim(); // drop `# comments` and surrounding space
    if (!line) continue;

    // A header is a WHOLE line like `[matchers]` — so a `[` inside a matcher body
    // (e.g. an array literal) is kept as part of the statement instead of truncating it.
    const match = header.exec(line);
    if (match) {
      if (section) sections.push([section, statements]);
      section = toCamelCaseSimple(match[1]) as keyof Model;
      statements = [];
    } else if (section) {
      statements.push(line);
    }
  }

  if (section) sections.push([section, statements]);
  return sections;
}

function toCamelCaseSimple(snakeStr: string) {
  return snakeStr.replace(/_([a-z])/g, (_, $1) => $1.toUpperCase());
}

type ModelIR = [keyof Model, string[]];
