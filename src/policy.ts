import { parseModel, type ModelParserOptions, type ModelContext } from "./model";
import type { Model, Permissions } from "./types";

export interface PolicySource {
  m: string;
  p: string[][];
  g?: string[][];
}

export interface PolicyParserOptions {
  request?: string[];
}

export function fromPolicySource<P extends Permissions>(
  source: PolicySource,
  options?: PolicyParserOptions & ModelParserOptions
): P {
  const { request, parseExpression } = options ?? {};
  const model = parseModel(source.m, { parseExpression });

  return fromCustomModel<P>(model, source, { request });
}

export function fromCustomModel<P extends Permissions>(
  model: Model,
  source: Omit<PolicySource, 'm'>,
  options?: PolicyParserOptions
) {
  const { request: presetRequest } = options ?? {};

  const matchers = Object.values(model.matchers);

  const policies = source.p.map<Record<string, string>>(([, ...policy]) => (
    Object.fromEntries(policy.map((value, i) => [model.policyDefinition[i], value]))
  ));

  const groups = source.g?.reduce((acc, [g, ...vals]) => ({
    ...acc,
    [g!]: (...args: string[]) => args.every((a, i) => a === vals[i]),
  }), {} as Record<string, (...args: string[]) => boolean>);

  return policies.reduce(
    (acc, policy) => {
      const key = policy[model.policyDefinition[2]!]!;
      const value = acc[key] ?? [];
      const nextValue = policy[model.policyDefinition[1]!]!;
      const others = model.policyDefinition.slice(3).map(d => policy[d]);

      const result = () => ({
        ...acc,
        [key]: [...value, nextValue, ...others],
      });

      if (!presetRequest) {
        return result();
      }

      const request = [
        presetRequest[0],
        nextValue,
        key,
        ...others
      ].reduce((acc, item, i) => ({
        ...acc,
        [model.requestDefinition[i]!]: presetRequest[i] ?? item,
      }), {});

      const context = { ...groups, p: policy, r: request } as ModelContext;

      return matchers.every(m => m(context))
        ? result()
        : acc;
    },
    {} as P
  );
}
