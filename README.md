# casbin-client

> 🚧 WIP
>
> For now, this library only implements the most essential sub-set of Casbin.js features, but it [will be expanded later](#roadmap--todo-list).
> Some features may not work as expected

`casbin-client` is a frontend library for [**Casbin**](https://casbin.org), which facilitates manipulation, management, and storage of user permissions in a frontend application.

It strives to be a more modern and polymorphic alternative to the official [Casbin.js](https://github.com/casbin/casbin.js) client library; it is a complete rewrite from the ground up, sharing zero code with its predecessor.

| Feature | `casbin-client` | `casbin.js` |
|---------|-----------------|-------------|
| 🌟 Modern tech-stack and dev practices | ✅ TypeScript, DI, FP | 🥀 Babel, OOP |
| 🏝️ Less external dependencies | ✅ Zero-dependencies version available | 🥀 Mandatory `axios`, `babel`, [`casbin-core`](https://github.com/casbin/casbin-core) |
| 💻 Ergonomic development experience | ✅ Import and use how you like | 🥀 Use in compliance with assumptions hidden in source code |
| 🪄 Support for various runtime modes | ✅ Supports both regular (*sync*) and *async* modes | 🥀 Every method is async |
| 🪶 Lightweight and tree-shakeable | ✅ 1KB↔8KB, take what you need | 🥀 90KB+, no tree-shaking |
| 🔌 Extendable | ✅ Pluginable at every step | 🥀 Depend on implementation details |
| 🤝 Type-safe | ✅ Use typed policies to enforce type safety | 🥀 Plain strings only |
| 🌐 Environment-independent | ✅ Works in any modern JS environment | 🥀 CommonJS build only |
| ⚙️ Reliability | ✅ ![](assets/coverage.svg) | 🥀 No tests... |
| 🔃 More to come... |  |  |

# Install

Due to extremely early WIP status of this package, installation is only awailable from github for now:
```bash
npm i github:raiondesu/casbin-client
# or
bun add github:raiondesu/casbin-client
```

# Use



# Why

Casbin is amazing for dynamic and polymorphic control of user access. But the official client-side library left a lot to be desired.

# Roadmap / TODO list

- [x] Process simple policies (`{ write: ['data'], read: ['data'] }`)
- [x] Custom storage or DB providers for caching
- [x] Simple integration with any network/query client
- [x] Ability to check user permissions using policies and model matchers
- [x] Ability to parse permissions from policies without the baggage of matchers and effects
- [ ] Generate ambient types from policy csv or permissions json automatically
- [ ] Integrations for popular frontend frameworks
- [ ] Reliable error reporting
- [ ] Support for complex pattern-matching (`/data/*`, `keyMatch(...)`)
- [ ] Support for internal `eval(...)` and other built-in functions
- [ ] Support for custom matcher contexts
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
bun test
```

### Updating coverage badge

> Prerequisites:
> - [`coverage-badge`](https://github.com/ozankasikci/rust-test-coverage-badge):\
>   `cargo install coverage-badge`

```bash
bun run test
```
