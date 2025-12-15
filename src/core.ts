export interface AuthorizerOptions<P extends Permissions = Permissions> {
  /**
   * Fallback function that runs if a matching policy wasn't found
   * @param action an action that wasn't found
   * @param object a corresponding object
   */
  fallback?: <A extends keyof P>(action: A, object: P[A][number]) => boolean;
}

export type Permissions<Actions extends string = string, Objects extends string = string> = {
  [action in Actions]: Array<Objects | undefined>;
}

/**
 * Creates the simplest possible authorizer: a simple function
 *
 * @param permissions a factory that returns a permission object like `{ action: ['resource'] }`
 * @param options specify a fallback in case a permission is missing
 * @returns the `can` function that checks for permissions
 */
export function authorizer<const P extends Permissions>(
  permissions: () => P | null | undefined,
  options?: AuthorizerOptions<P>
): Can<P> {
  const { fallback = () => false } = options ?? {};

  return function can<A extends keyof P & string, O extends P[A][number] & string>(
    action: A | A[],
    object: O | O[]
  ): boolean {
    return Array.isArray(action)
      ? action.every(a => can(a, object))
      : Array.isArray(object)
        ? object.every(o => can(action, o))
        : (
          permissions()?.[action]?.includes(object)
          ?? fallback(action, object)
        );
  }
}

export interface Can<P extends Permissions, R = boolean> {
  <A extends keyof P & string, O extends P[A][number] & string>(actions: A[], object: O): R;
  <A extends keyof P & string, O extends P[A][number] & string>(action: A, objects: O[]): R;
  <A extends keyof P & string, O extends P[A][number] & string>(action: A, object: O): R;
  <A extends keyof P & string, O extends P[A][number] & string>(action: A[], objects: O[]): R;
  <A extends keyof P & string, O extends P[A][number] & string>(action: A | A[], object: O | O[]): R;
  (action: string | string[], object: string | string[]): R;
}
