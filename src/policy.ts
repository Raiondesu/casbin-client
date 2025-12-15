import type { Permissions } from "./core";
import { parseModel, type ModelParserOptions, type ModelContext } from "./model";
import type { DefinitionKey, Model, ModelRecord, PolicyDefinition, RoleContext, RoleDefinitions } from "./types";

export interface PolicySource {
  m: string;
  p: string[][];
  g?: string[][];
}

export interface PolicyParserOptions {
  request?: [DefinitionKey<'r'>, ...string[]];
  permissionModel?: string[];
}

export const defaultPermissionModel = ['act', 'obj'];

export function fromPolicySource<P extends Permissions>(
  source: PolicySource,
  options?: PolicyParserOptions & ModelParserOptions
): P {
  const {
    request, parseExpression,
    permissionModel = defaultPermissionModel
  } = options ?? {};
  const model = parseModel(source.m, { parseExpression });

  return fromCustomModel<P>(model, source, { request, permissionModel });
}

export function fromCustomModel<P extends Permissions>(
  model: Model,
  source: Omit<PolicySource, 'm'>,
  options?: PolicyParserOptions
) {
  const {
    request: presetRequest,
    permissionModel = defaultPermissionModel
  } = options ?? {};
  const [requestGroup, ...request] = presetRequest ?? ['r'];
  const requestType = getSectionType(requestGroup);

  const groups = createRoleContext(model.roleDefinition, source.g);
  const matcher = model.matchers[`m${requestType === 1 ? '' : requestType}`];

  return source.p.reduce(
    (perms, [policyGroup, ...policy]) => {
      const policyType = getSectionType(policyGroup);

      if (requestType !== policyType) return perms;

      const def = model.policyDefinition[policyGroup as DefinitionKey<'p'>]!;
      const policyContext = toModelContext(def, policy);

      const [key, nextValue] = permissionModel.map(key => policyContext[key]);

      const previous = perms[key] ?? [];
      const result = () => ({
        ...perms,
        [key]: [...previous, nextValue],
      });

      if (!presetRequest) return result();

      const requestContext = toModelContext(def, request, policyContext);

      const context = {
        [requestGroup]: requestContext,
        [policyGroup]: policyContext,
        ...groups,
        ...model.matchers,
        ...model.policyEffect
      } as ModelContext;

      return matcher(context)
        ? result()
        : perms;
    },
    {} as P
  );
}

function getSectionType(group: string) {
  return Number(group.slice(1) || '1');
}

export function toModelContext(def: PolicyDefinition, policy: string[], fallback?: ModelRecord) {
  return def.reduce((ctx, prop, i) => ({
    ...ctx,
    [prop]: policy[i] ?? fallback?.[prop],
  }), {} as ModelRecord);
}

export function createRoleContext(roleModel: RoleDefinitions, roleGroups?: string[][]) {
  const vals: Record<string, string[][]> = {};

  return roleGroups?.reduce((acc, [g, ..._vals]) => {
    vals[g] ??= [];
    vals[g].push(_vals);

    return {
      ...acc,
      [g as DefinitionKey<'g'>]: (...args: string[]) => {
        return vals[g].some(val => args.every((a, i) => val[i] === a));
      },
    };
  }, {} as RoleContext);
}
