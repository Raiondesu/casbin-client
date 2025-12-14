export type Permissions<Actions extends string = string, Objects extends string = string> = {
  [action in Actions]: Array<Objects | undefined>;
}

export type ModelRecord = Record<string, any>;

export type ModelEffect = (...args: any) => boolean;

export type ModelContext = {
  [_ in `g${'' | number}` | 'm']?: ModelEffect;
} & {
  r: ModelRecord;
  p: ModelRecord;
};

export interface Model {
  requestDefinition: RequestDefinition;
  policyDefinition: PolicyDefinition;
  roleDefinition: RoleGroups;
  policyEffect: Record<string, PolicyEffect>;
  matchers: Record<string, Matcher>;
}

export interface PolicyEffect {
  (ctx: ModelContext): boolean;
}

export interface Matcher {
  (ctx: ModelContext): boolean;
}

export type RequestDefinition = string[];

export type PolicyDefinition = string[];

export type RoleDefinition = number;

export type RoleGroups = Record<string, RoleDefinition>;

export type ExpressionParser<R extends Matcher | PolicyEffect = Matcher | PolicyEffect> = (
  source: string,
  token: string,
  type: 'matchers' | 'policyEffect'
) => R;