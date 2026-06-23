// Ambient types for the `subscript` subpaths we use. The package ships types for its bare
// `subscript` entry; we declare the small extra surface we depend on here, so `parser.ts`
// stays type-clean without `allowJs` and without a separate `.d.ts` build step.

declare module 'subscript/parse' {
  /** Compile an AST node into an evaluator. */
  export const compile: (node: any) => (ctx?: any) => any;
  /** Register or override an operator's compiler (chainable). */
  export const operator: (op: string, fn: (...args: any[]) => any) => void;
  /** Parse a source string into an AST node; carries per-dialect config (e.g. `parse.string`). */
  export const parse: { (source: string): any; string: Record<string, boolean> };
}

// Side-effect-only feature/eval modules (pluggable syntax). No bindings to type.
declare module 'subscript/feature/*';
declare module 'subscript/eval/*';
