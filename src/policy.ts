import type { Permissions } from "./core.js";
import { parseModel, type ModelParserOptions, type ModelContext } from "./model.js";
import type { DefinitionKey, ErrorReporter, Model, ModelRecord, PolicyDefinition, RoleContext, RoleDefinitions } from "./types.js";

export interface PolicySource {
  m: string;
  p: string[][];
  g?: string[][];
}

export interface PolicyParserOptions {
  request?: [DefinitionKey<'r'>, ...string[]];
  permissionModel?: string[];

  /** Reports a recoverable error; request filtering fails closed (denies) after reporting. */
  onError?: ErrorReporter;
}

export const defaultPermissionModel = ['act', 'obj'];

export function fromPolicySource<P extends Permissions>(
  source: PolicySource,
  options?: PolicyParserOptions & ModelParserOptions
): P {
  const {
    request, parseExpression, onError,
    permissionModel = defaultPermissionModel
  } = options ?? {};

  // Filtering by request needs a real matcher. Without `parseExpression` the default
  // naive parser matches everything, which would silently grant ALL policies to the
  // subject - so we report and fail closed (deny) instead of failing open.
  if (request && !parseExpression) {
    onError?.(
      new Error('`request` filtering requires `parseExpression`; denying to fail closed'),
      'policy.fromPolicySource',
    );
    return {} as P;
  }

  const model = parseModel(source.m, { parseExpression, onError });

  return fromCustomModel<P>(model, source, { request, permissionModel, onError });
}

export function fromCustomModel<P extends Permissions>(
  model: Model,
  source: Omit<PolicySource, 'm'>,
  options?: PolicyParserOptions
) {
  const {
    request: presetRequest,
    permissionModel = defaultPermissionModel,
    onError
  } = options ?? {};
  const [requestGroup, ...request] = presetRequest ?? ['r'];
  const requestType = getSectionType(requestGroup);

  const groups = createRoleContext(model.roleDefinition, source.g);
  const matcher = model.matchers[`m${requestType === 1 ? '' : requestType}`];

  // A request needs a matcher to evaluate against. If the model has none, deny.
  if (presetRequest && !matcher) {
    onError?.(
      new Error(`no matcher \`m${requestType === 1 ? '' : requestType}\` to filter the request; denying`),
      'policy.fromCustomModel',
    );
    return {} as P;
  }

  const [keyProp, objProp] = permissionModel;
  const matched: Array<{ key: string; obj: string; deny: boolean }> = [];

  for (const [policyGroup, ...policy] of source.p) {
    if (requestType !== getSectionType(policyGroup)) continue;

    const def = model.policyDefinition[policyGroup as DefinitionKey<'p'>];
    if (!def) continue;

    const policyContext = toModelContext(def, policy);

    if (presetRequest) {
      const context = {
        [requestGroup]: toModelContext(def, request, policyContext),
        [policyGroup]: policyContext,
        ...groups,
        ...model.matchers,
        ...model.policyEffect,
      } as ModelContext;

      if (!matcher!(context)) continue;
    }

    const key = policyContext[keyProp];
    const obj = policyContext[objProp];
    if (key == null || obj == null) {
      onError?.(
        new Error(`policy row \`${policy.join(', ')}\` is missing its \`${key == null ? keyProp : objProp}\` column; skipping`),
        'policy.fromCustomModel',
      );
      continue;
    }

    matched.push({ key, obj, deny: policyContext.eft === 'deny' });
  }

  // Allow rows grant; matching deny rows (eft == 'deny') override them - a fail-safe
  // deny-override that also stops deny rows from being added as permissions. Deduped.
  const denied = new Set(
    matched.filter(m => m.deny).map(m => `${m.key} ${m.obj}`),
  );
  const perms: Record<string, string[]> = {};

  for (const { key, obj, deny } of matched) {
    if (deny || denied.has(`${key} ${obj}`)) continue;
    const list = (perms[key] ??= []);
    if (!list.includes(obj)) list.push(obj);
  }

  return perms as unknown as P;
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
      [g as DefinitionKey<'g'>]: (...args: string[]) => hasRole(vals[g], args),
    };
  }, {} as RoleContext);
}

/**
 * Transitive role check with a cycle guard. `args` is `[subject, role, ...domain]` and
 * each edge is `[child, parent, ...domain]`; a role is reachable through intermediate
 * roles as long as any trailing (domain) arguments match at every hop. This implements
 * Casbin's role inheritance - `g(alice, admin)` + `g(admin, super)` ⇒ `g(alice, super)` -
 * instead of a single direct-edge lookup.
 */
function hasRole(edges: string[][], args: string[]): boolean {
  const [subject, role, ...domain] = args;
  const inDomain = (edge: string[]) => domain.every((d, i) => edge[2 + i] === d);

  const seen = new Set<string>();
  const reaches = (from: string): boolean =>
    from === role ||
    (!seen.has(from) && (seen.add(from),
      edges.some(edge => edge[0] === from && inDomain(edge) && reaches(edge[1]))));

  return reaches(subject);
}
