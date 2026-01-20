export type MatchAction<P extends Permissions = Permissions> = (
  action: keyof P,
  source?: null | P,
) => P[keyof P] | null | undefined;

export type MatchObject<P extends Permissions = Permissions> = (
  object: P[keyof P][number],
  source?: null | P[keyof P],
) => boolean | null | undefined;

export type PermissionFallback<P extends Permissions> = <A extends keyof P>(
  action: A,
  object: P[A][number],
) => boolean;

export interface AuthorizerOptions<P extends Permissions = Permissions> {
  /**
   * Fallback function that runs if a matching policy wasn't found
   * @param action an action that wasn't found
   * @param object a corresponding object
   */
  fallback?: PermissionFallback<P>;

  /**
   * A function to extract objects by an action key from the permission source
   * @param action an action to find
   * @param source permissions object
   */
  matchAction?: MatchAction<P>;

  /**
   * A function to check object availability by a key from the permission action
   * @param object an object to perform the action on
   * @param source permissions object
   */
  matchObject?: MatchObject;
}

export type Permissions<
  Actions extends string = string,
  Objects extends string = string,
> = {
  [action in Actions]: Array<Objects | undefined>;
};

/**
 * Creates the simplest possible authorizer: a simple function
 *
 * @param permissions a factory that returns a permission object like `{ action: ['resource'] }`
 * @param options specify a fallback in case a permission is missing
 * @returns the `can` function that checks for permissions
 */
export function authorizer<const P extends Permissions>(
  permissions: () => P | null | undefined,
  options?: AuthorizerOptions<P>,
): Can<P> {
  const {
    fallback = () => false,
    matchAction = (action: string, source?: P | null) => source?.[action],
    matchObject = (obj: string, source?: null | Array<string | undefined>) =>
      source?.includes(obj),
  } = options ?? {};

  return function can<
    A extends keyof P & string,
    O extends P[A][number] & string,
  >(action: A | A[], object: O | O[]): boolean {
    return Array.isArray(action)
      ? action.every((a) => can(a, object))
      : Array.isArray(object)
        ? object.every((o) => can(action, o))
        : matchObject(object, matchAction(action, permissions())) ??
          fallback(action, object);
  };
}

export interface Can<P extends Permissions, R = boolean> {
  <A extends keyof P & string, O extends P[A][number] & string>(
    actions: A[],
    object: O,
  ): R;
  <A extends keyof P & string, O extends P[A][number] & string>(
    action: A,
    objects: O[],
  ): R;
  <A extends keyof P & string, O extends P[A][number] & string>(
    action: A,
    object: O,
  ): R;
  <A extends keyof P & string, O extends P[A][number] & string>(
    action: A[],
    objects: O[],
  ): R;
  <A extends keyof P & string, O extends P[A][number] & string>(
    action: A | A[],
    object: O | O[],
  ): R;
  (action: string | string[], object: string | string[]): R;
}
