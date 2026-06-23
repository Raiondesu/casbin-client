// src/parser.ts
import subscript from "subscript";
import"subscript/feature/literal.js";
import"subscript/feature/op/membership.js";
import"subscript/eval/op/membership.js";
import"subscript/feature/collection.js";
import"subscript/eval/collection.js";
import"subscript/feature/op/ternary.js";
import"subscript/eval/op/ternary.js";
import { compile, operator, parse } from "subscript/parse";
parse.string["'"] = true;
operator("in", (a, b) => b && (a = compile(a), b = compile(b), (ctx) => {
  const right = b(ctx), left = a(ctx);
  return Array.isArray(right) ? right.includes(left) : (left in (right ?? {}));
}));
function parseExpression(source) {
  return subscript(source);
}
export {
  parseExpression
};
