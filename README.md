# pi-prewalk

[pi](https://pi.dev) packages for a planner-to-executor handoff. A frontier model explores the code, writes a todo
list, and makes the first edit. Then the same session switches once to a cheaper model, which continues with the whole
trajectory in context. The semantics follow oh-my-pi's
[prewalk](https://github.com/can1357/oh-my-pi/blob/e7fe318/packages/coding-agent/src/session/prewalk.ts).

| Package                                               | Contents                                              |
| ----------------------------------------------------- | ----------------------------------------------------- |
| [`@oisin-ee/pi-prewalk-kit`](packages/pi-prewalk-kit) | Both packages below, in one install.                  |
| [`@oisin-ee/pi-prewalk`](packages/pi-prewalk)         | The handoff: config, flags, commands, `/new` restore. |
| [`@oisin-ee/pi-todo`](packages/pi-todo)               | The `todo` tool and its completion reminder.          |

```bash
pi install npm:@oisin-ee/pi-prewalk-kit
```

## Layout

The rules live in pure Rust crates (`crates/*-core`) with native tests. The `crates/*-wasm` crates compile them to
WebAssembly with wasm-bindgen and tsify, and validate every input from JavaScript in Rust. Each package under
`packages/` is a thin TypeScript adapter that loads its WebAssembly module and connects it to pi's extension API.

## Development

The toolchain comes from `.prototools` and `rust-toolchain.toml`.

```bash
proto install
pnpm install
moon ci          # the checks CI runs for the changed files
moon run :fix    # format and apply lint fixes
```

To try a package in pi, build its bindings and load it by path:

```bash
moon run pi-todo:generate pi-prewalk:generate
pi -e ./packages/pi-todo -e ./packages/pi-prewalk
```

## Releases

Add a changeset with `pnpm exec changeset` in each pull request that changes a package. The three packages share one
version. On main, the Publish workflow opens a "Version Packages" pull request. Merging it publishes to npm with
trusted publishing.

## License

MIT
