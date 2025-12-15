# casbin-client [![](assets/wip.svg)](https://github.com/Raiondesu/casbin-client)

[![](assets/version.svg)](https://www.npmjs.com/package/casbin-client) ![](assets/size-core.svg) ![](assets/size-full.svg) ![](assets/coverage.svg)

`casbin-client` is a library which facilitates manipulation, management, and storage of user permissions in a frontend application for the purposes of authorization. It supports various access control policies, like RBAC, ABAC, ACL, etc.

It is primarily a library for [**Casbin**](https://casbin.org) and strives to be a more modern and polymorphic alternative to the official [Casbin.js](https://github.com/casbin/casbin.js) client library; it is a complete rewrite from the ground up, sharing zero code with its predecessor. It can and will work without any dependencies, however, so having any knowledge of Casbin is entierly optional.

<details>
<summary>
Due to highly modular structure, both complexity and size requirements can grow dynamically as needed.
</summary>

```ts
// simple
const user = { can: authorizer(() => permissions) };

user.can('read', 'data');

// with caching
const user = createAuthorizer(() => permissions, { store: sessionStorage });
// and/or promises
const user = createAuthorizer(Promise.resolve(permissions), { store: sessionStorage });

user.can('read', 'data');

// with full casbin model and policy parsing
const user = createAuthorizer(() => (
  fromPolicySource(policy, { parseExpression })
), { store: sessionStorage });

user.can('read', 'data');
```

</details>


| Feature | `casbin-client` | `casbin.js` |
|---------|-----------------|-------------|
| 🌟 Modern tech-stack and dev practices | ✅ TypeScript, DI, FP | 🥀 Babel, OOP |
| 🏝️ Less external dependencies | ✅ Zero-dependencies version available | 🥀 Mandatory `axios`, `babel`, [`casbin-core`](https://github.com/casbin/casbin-core) |
| 💻 Ergonomic development experience | ✅ Import and use how you like | 🥀 Use in compliance with assumptions hidden in source code |
| 🪄 Support for various runtime modes | ✅ Supports both regular (*sync*) and *async* modes | 🥀 Every method is async |
| 🪶 Lightweight and tree-shakeable | ✅ 0.5KB↔8KB, take what you need | 🥀 90KB+, no tree-shaking |
| 🔌 Extendable | ✅ Pluginable at every step | 🥀 Depend on implementation details |
| 🤝 Type-safe | ✅ Use [typed policies](#typing) to enforce type safety | 🥀 Untyped strings only |
| 🌐 Environment-independent | ✅ Works in any modern JS environment | 🥀 CommonJS build only |
| ⚙️ Reliability | ✅ ![](assets/coverage.svg) | 🥀 No tests... |
| 🔃 More to come... |  |  |

# Install

```bash
npm i casbin-client
# or
bun add casbin-client
```

# Use

## Basics

At the centrepoint is the concept of an *Authorizer* - a singleton that looks at users' *permissions* and decides if the "user" can or cannot do certain actions:

```ts
import { createAuthorizer } from 'casbin-client';

const permissions = {
  read: ['data']
};

const user.can = createAuthorizer(() => permissions);

if (user.can('read', 'data')) {
  console.log('Yay, we can read data!');
}
//...
```

`createAuthorizer` takes a simple `Permissions` factory as its primary argument and provides a semantic interface to read from it.
It never modifies or tampers with the original object, acting like a simple view on it.\
If permissions need changing, simply update them:

```ts
//...
if (!user.can('read', 'users')) {
  console.log('Oops, wrong permissions!');
}

permissions.read = ['data', 'users'];

if (user.can('read', 'users')) {
  console.log('Yay, we can read users!');
}
```

And that's the basics!

## Modules

There are 5 isolated modules:

- [`casbin-client/core`](#authorizer) - the tiny "core" of the package with a single purpose - to create an authorizer
- [`casbin-client`](#createauthorizer) - exports a multi-purpose factory for advanced uses
- [`casbin-client/model`](#casbin-clientmodel) - parser for [Casbin models](https://casbin.org/docs/syntax-for-models)
- [`casbin-client/policy`](#casbin-clientpolicy) - parser for [Casbin policies](https://casbin.org/docs/policy-storage)
- [`casbin-client/parser`](#casbin-clientparser) - parser for [Casbin expressions](https://casbin.org/docs/syntax-for-models#matchers)

Each module is independent from others, and thus very has little effect on the final bundle size of your application.

### `authorizer`

As covered in the [basics](#basics) section, `casbin-client` exports a simple `createAuthorizer` function, with some helper types.\
But what if even this is too much?\
Enter, `casbin-client/core`:

```ts
import { authorizer, type Permissions } from 'casbin-client/core';

const permissions = {
  read: ['data', 'users'] as const
} satisfies Permissions; // enables full autocomplete

const can = authorizer(() => permissions);

if (can('read', 'data')) {
  console.log('Yay, we can read data!');
}
// Logs "Yay, we can read data!"

```

It accepts a simple `AuthorizerOptions` object as its second argument:
```ts
import { type AuthorizerOptions } from 'casbin-client/core';

const options = {
  fallback: (action, object) => object !== 'database' && action !== 'delete',
  // A fallback function to resolve missing permissions
};

const can = authorizer(() => permissions);

if (can('delete', 'database')) {
  console.log('We are doomed!');
} else {
  console.log('Phew, we are safe.');
}
// Logs "Phew, we are safe."
```

### `createAuthorizer`

This is a much more versatile factory function.\
It allows automatic caching using the `Storage` API and working with promises.

`createAuthorizer` also accepts two arguments:
- a `Permissions` object:
  ```ts
  import { type Permissions } from 'casbin-client';

  const permissions: Permissions = {
    read: ['data', 'users']
  };
  ```
- and customization options (optional)
  ```ts
  import { type SyncAuthorizerOptions } from 'casbin-client';

  const options: SyncAuthorizerOptions = {
    store: sessionStorage,
    // A `Storage` object to use as a cache for permissions

    key: 'auth',
    // A unique key to store the permissions in the store

    fallback: (action, object) => object !== 'database' && action !== 'delete',
    // A fallback function to resolve missing permissions
  };
  ```

And allows for simple permission checking:
```ts
import { createAuthorizer } from 'casbin-client';

const user = createAuthorizer(() => permissions, options);

if (user.can('delete', 'database')) {
  console.log('We are doomed!');
} else {
  console.log('Phew, we are safe.');
}
// Logs "Phew, we are safe."
```

> **Note**
>
> The `.can` method always re-runs the permission factory!\
> In reactive UI-frameworks it is advised to wrap its calls with a computed primitive, like `useMemo` or `computed`.

#### Async mode

> **Note**
>
> This mode is **not** for usage with reactive UI frameworks like `react`, `solid`, or `vue`.\
> In the context of reactive data in UI components, it's better to use `createAuthorizer` in combination with reactive primitives like `useQuery`, `createResource`, or `computed`.
>
> The "Async mode" is for the case when there's no way to use a reactive primitive **and** the execution context is synchronous.

`createAuthorizer` makes it easy to work with promises, because the permissions factory can also be a promise:

```ts
const permissionsUrl = 'https://raw.githubusercontent.com/Raiondesu/casbin-client/refs/heads/main/examples/permissions.json';
const remotePermissions = fetch(permissionsUrl).then(r => r.json());
```

`createAuthorizer` simply treats the promise as a factory:

```ts
const user = createAuthorizer(remotePermissions, options);

// ...
// some time later in a file far far away
if (user.can('read', 'data')) {
  console.log('Yay, we can read data!');
}
```

In the context of a single function this is, of course, not possible, so the promise is proxied and can be awaited separately:

```ts
await user.remote;

if (user.can('read', 'data')) {
  console.log('Yay, we can read data!');
}
```

### Typing

Both `authorizer` and `createAuthorizer` accept a generic parameter, which can be automatically inferred from permissions:

```ts
type MyPermissions = {
  read: ['data']
};

const permissions: any = {
  read: ['data']
};

const auth = createAuthorizer<MyPermissions>(() => permissions);

// Full autocomplete and type checking!
auth.can('read', 'data');
```

### `casbin-client/model`

Allows to parse and use a [Casbin model](https://casbin.org/docs/syntax-for-models).

```ts
import { parseModel } from 'casbin-client/model';

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
  m = r.obj == p.obj && r.act == p.act && g(r.sub, p.sub)
`;

const parsed = parseModel(model);

console.log(parsed.matchers.m({
  r: { sub: 'alice', act: 'read', obj: 'data' },
  p: { sub: 'reader', act: 'read', obj: 'data' },
  g: (r, p) => 'alice' === r && 'reader' === p,
  ...parsed.matchers,
  ...parsed.policyEffect
}));
//> true
```

### `casbin-client/policy`

Allows to parse and use a [Casbin model](https://casbin.org/docs/syntax-for-models) with a [Casbin policy](https://casbin.org/docs/policy-storage/#loading-policy-from-a-csv-file).

This module implements the most essential sub-set of read-only features from [`casbin-core`](https://github.com/casbin/casbin-core/).

See [the list of missing features](#roadmap--todo-list) to gauge if this is useful for your project.

```ts
import { createAuthorizer } from 'casbin-client';
import { fromPolicySource } from 'casbin-client/policy';

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
  m = r.obj == p.obj && r.act == p.act && g(r.sub, p.sub)
`;

// Result from `CasbinJsGetUserPermission` or otherwise manually loaded
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
  ]
};

// Note that this is a costly function to call
const permissions = fromPolicySource(policy);

const user = createAuthorizer(() => permissions);

if (user.can('read', 'data')) {
  console.log('Yay, we can read data!');
}

const alicePermissions = fromPolicySource(policy, {
  request: ['r', 'alice']
});

const alice = createAuthorizer(() => alicePermissions);

if (alice.can('read', 'data')) {
  console.log('Yay, alice can read data!');
}

if (!alice.can('delete', 'data')) {
  console.log('Nope, alice cannot delete data!');
}
```

### `casbin-client/parser`

This module uses modified [`subscript`](https://github.com/dy/subscript) with a subset of `justin` syntax.

```ts
import { parseExpression } from 'casbin-client/parser';

const run = parseExpression('"a" in b && b.a() === true');

console.log(run({ b: { a: () => true } }));
//> true
```

It can be passed into model and policy parsers as options, in order to enable complete Casbin experience in JS:

```ts
const reader = fromPolicySource(policy, {
  request: ['r', 'bob'],
  parseExpression,
});

const bob = createAuthorizer(() => reader);

if (bob.can.read('data')) {
  console.log('Yeah, Bob can read');
}
```

# Why

Casbin is amazing for dynamic and polymorphic control of user access. But the official client-side library left a lot to be desired. Being a de-facto extension on the `casbin-core` package for Node.js, it brings in a lot of unneeded dependencies and wraps them in an API that is awkward to use in a modern JS ecosystem.

# Roadmap / TODO list

- [x] Process simple policies (`{ write: ['data'], read: ['data'] }`)
- [x] Custom storage or DB providers for caching
- [x] Simple integration with any network/query client
- [x] Ability to check user permissions using policies and model matchers
- [x] Ability to parse permissions from policies without the baggage of matchers and effects
- [ ] Integrations for popular frontend frameworks
- [ ] Generate ambient types from policy csv or permissions json
- [ ] Parse permissions at the type level from policy source
- [ ] Reliable error reporting
- [ ] Support for complex pattern-matching (`/data/*`, `keyMatch(...)`)
- [ ] Support for internal `eval(...)` and other built-in functions
- [ ] Support for custom matcher contexts
- [ ] Support for [effect expressions](https://casbin.org/docs/syntax-for-models#policy-effect)
- [ ] Full test coverage

Feel like something's missing? [Submit an issue](issues/new)!\
Wanna help? [Fork and submit a PR](fork)!

# Security notice

Parsing [model configuration](https://casbin.org/docs/syntax-for-models) leads to evaluation of user-provided expressions, which can lead to unsafe behavior. Refrain from using arbitrary model parsing on the client-side to avoid potential security risks!

> **Note**\
> Despite lacking a similar warning, [Casbin.js](https://github.com/casbin/casbin.js) has the same potential for introducing vulnerabilities.

# Contributing

> Prerequisites:
> - [`bun`](https://bun.sh):
>   ```bash
>   curl -fsSL https://bun.sh/install | bash
>   ```
>   ```ps
>   powershell -c "irm bun.sh/install.ps1 | iex"
>   ```

To install dependencies:

```bash
bun install
```

## Build

```bash
bun run build
```

## Test

```bash
bun run test
```
