import { expect, expectTypeOf, test } from "bun:test";

import { createAuthorizer, type Permissions, type Authorizer } from "../src";
import { parseExpression } from "../src/parser";
import { fromPolicySource } from "../src/policy";
import { sources } from "./examples";

test("All work in unison", async () => {
  type P = Permissions<"read" | "write" | "delete", "data">;
  const auth = createAuthorizer(() =>
    fromPolicySource<P>(sources.simple, { parseExpression }),
  );

  expectTypeOf(auth).toEqualTypeOf<Authorizer<P>>();

  expect(auth.can("read", "data")).toBeTrue();
  // @ts-expect-error unknown action is rejected by the type and denied at runtime
  expect(auth.can("huh?", "data")).toBeFalse();
  // @ts-expect-error unknown object is rejected by the type and denied at runtime
  expect(auth.can("read", "crap")).toBeFalse();

  expect(auth.can("write", "data")).toBeTrue();
  // @ts-expect-error unknown action
  expect(auth.can("huh?", "data")).toBeFalse();
  // @ts-expect-error unknown object
  expect(auth.can("write", "crap")).toBeFalse();

  expect(auth.can("delete", "data")).toBeTrue();
  // @ts-expect-error unknown action
  expect(auth.can("huh?", "data")).toBeFalse();
  // @ts-expect-error unknown object
  expect(auth.can("delete", "crap")).toBeFalse();
});

test("Example from README", () => {
  const model = `
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
  `;

  // Result from `CasbinJsGetUserPermission`
  const policy = {
    g: [
      ["g", "alice", "reader"],
      ["g", "alice", "writer"],
      ["g", "bob", "reader"],
      ["g", "cathy", "admin"],
    ],
    m: model,
    p: [
      ["p", "reader", "data", "read"],
      ["p", "writer", "data", "write"],
      ["p", "admin", "data", "delete"],
    ],
  };

  // Note that this is a costly function to call
  const permissions = fromPolicySource(policy);
  const user = createAuthorizer(() => permissions);

  expect(user.can("read", "data")).toBeTrue();

  const alicePermissions = fromPolicySource(policy, {
    request: ["r", "alice"],
    parseExpression,
  });
  const alice = createAuthorizer(() => alicePermissions);

  // alice is a reader + writer (per `g`), so she can read but not delete.
  expect(alice.can("read", "data")).toBeTrue();
  expect(alice.can("delete", "data")).toBeFalse();

  // Filtering by request WITHOUT a parser fails closed (denies) instead of granting all.
  const reported: string[] = [];
  const denied = fromPolicySource(policy, {
    request: ["r", "alice"],
    onError: (_e, ctx) => reported.push(ctx),
  });
  expect(denied).toEqual({});
  expect(reported).toEqual(["policy.fromPolicySource"]);
});
