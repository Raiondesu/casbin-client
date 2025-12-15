export type ModelRecord = Record<string, string>;
export type ModelEffect = (...args: any) => boolean;

export type ModelContext =
  | Record<DefinitionKey<'e' | 'm' | 'g'>, ModelEffect>
  & Record<DefinitionKey<'r' | 'p'>, ModelRecord>;

export type DefinitionKey<Mark extends string = string> = `${Mark}${'' | number}`;

export type PolicyContext = Record<DefinitionKey<'p'>, ModelRecord>;
export type RequestContext = Record<DefinitionKey<'r'>, ModelRecord>;
export type RoleContext = Record<DefinitionKey<'g'>, ModelEffect>;
export type EffectContext = Record<DefinitionKey<'e'>, ModelEffect>;

export interface Model {
  requestDefinition: RequestDefinitions;
  policyDefinition: PolicyDefinitions;
  roleDefinition: RoleDefinitions;
  policyEffect: PolicyEffects;
  matchers: Matchers;
}

export type RequestDefinitions = Record<DefinitionKey<'r'>, RequestDefinition>;
export type PolicyDefinitions = Record<DefinitionKey<'p'>, PolicyDefinition>;
export type RoleDefinitions = Record<DefinitionKey<'g'>, RoleDefinition>;
export type PolicyEffects = Record<DefinitionKey<'e'>, PolicyEffect>;
export type Matchers = Record<DefinitionKey<'m'>, Matcher>;

export type RequestDefinition = string[];
export type PolicyDefinition = string[];
export type RoleDefinition = string[];
export interface PolicyEffect {
  (ctx: ModelContext): boolean;
}
export interface Matcher {
  (ctx: ModelContext): boolean;
}

export type ExpressionParser<R extends Matcher | PolicyEffect = Matcher | PolicyEffect> = (
  source: string,
  token: string,
  type: 'matchers' | 'policyEffect'
) => R;