// src/parser.ts
import bake, { binary, compile, operator, token } from "subscript";
import { err } from "subscript/parse";
binary("in", 90);
operator("in", (a, b) => b && (a = compile(a), b = compile(b), (ctx) => (a(ctx) in b(ctx))));
token("undefined", 20, (a) => a ? err() : [, undefined]);
token("NaN", 20, (a) => a ? err() : [, NaN]);
token("null", 20, (a) => a ? err() : [, null]);
function parseExpression(source) {
  return bake(source);
}
export {
  parseExpression
};
