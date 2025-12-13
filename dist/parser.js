// src/parser.ts
import { compile } from "jse-eval";
function parseExpression(source, token) {
  return {
    compiled: compile(source),
    token
  };
}
export {
  parseExpression
};
