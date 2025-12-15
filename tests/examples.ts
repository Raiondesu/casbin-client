import type { PolicySource } from "../src/policy";

export const sources = {
  simple: {
    "g": [
      ["g", "alice", "reader"],
      ["g", "alice", "writer"],
      ["g", "bob", "reader"],
      ["g", "cathy", "admin"],
    ],
    "m": `
      [request_definition]
      r = sub, obj, act

      [policy_definition]
      p = sub, obj, act

      [role_definition]
      g = _, _

      [policy_effect]
      e = some(where (p.eft == allow))

      [matchers]
      m = r.obj == p.obj && r.act == p.act && "sub" in r && g(r.sub, p.sub)
    `,
    "p": [
      ["p", "reader", "data", "read"],
      ["p", "writer", "data", "write"],
      ["p", "admin", "data", "delete"],
    ]
  },
  abac: {
    "g": [],
    "m": `[request_definition]
r = sub, obj, act

[policy_definition]
p = sub_rule, obj, act

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = eval(p.sub_rule) && r.obj == p.obj && r.act == p.act`,
    "p": [
      ["p", "r.sub.Age > 18 && r.sub.Age < 60", "/data1", "read"]
    ]
  }
} satisfies Record<string, PolicySource>;
