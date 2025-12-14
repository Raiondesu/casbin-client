// src/parser.ts
import"subscript/feature/number.js";
import"subscript/feature/string.js";
import"subscript/feature/call.js";
import"subscript/feature/access.js";
import"subscript/feature/group.js";
import"subscript/feature/ternary.js";
import"subscript/feature/bool.js";
import"subscript/feature/array.js";
import"subscript/feature/object.js";
import"subscript/feature/arrow.js";
import"subscript/feature/optional.js";
import"subscript/feature/spread.js";
import"subscript/feature/logic.js";
import"subscript/feature/compare.js";
import { compile, operator } from "subscript/compile";
import { binary, err, parse, token } from "subscript/parse";
binary("in", 90);
operator("in", (a, b) => b && (a = compile(a), b = compile(b), (ctx) => {
  const _b = b(ctx), _a = a(ctx);
  return Array.isArray(_b) ? _b.includes(_a) : (_a in (_b ?? {}));
}));
token("undefined", 20, (a) => a ? err() : [, undefined]);
token("NaN", 20, (a) => a ? err() : [, NaN]);
token("null", 20, (a) => a ? err() : [, null]);
function parseExpression(source) {
  return compile(parse(source));
}
export {
  parseExpression
};
