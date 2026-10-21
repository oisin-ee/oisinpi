# oisinpi

Oisin's [pi](https://pi.dev) packages. Prewalk is a planner-to-executor handoff: a frontier model explores the code,
writes a todo list, and makes the first edit, then the same session switches once to a cheaper model. The semantics
follow oh-my-pi's [prewalk](https://github.com/can1357/oh-my-pi/blob/e7fe318/packages/coding-agent/src/session/prewalk.ts).
The guardrails are the hook policies for pi, Claude Code, and Codex. pi-dogsled is published from
[oisin-ee/dogsled](https://github.com/oisin-ee/dogsled) and installs on its own, at the `dogsled` binary's version.

| Package                                             | Contents                                              |
| --------------------------------------------------- | ----------------------------------------------------- |
| [`@oisin-ee/oisinpi`](packages/oisinpi)             | Every package below, in one install.                  |
| [`@oisin-ee/pi-prewalk`](packages/pi-prewalk)       | The handoff: config, flags, commands, `/new` restore. |
| [`@oisin-ee/pi-todo`](packages/pi-todo)             | The `todo` tool and its completion reminder.          |
| [`@oisin-ee/pi-guardrails`](packages/pi-guardrails) | Agent guardrails for pi, Claude Code, and Codex.      |

```bash
pi install npm:@oisin-ee/oisinpi
```

## Layout

The rules live in pure Rust crates (`crates/*-core`) with native tests. The `crates/*-wasm` crates compile them to
WebAssembly with wasm-bindgen and tsify, and validate every input from JavaScript in Rust. Each package under
`packages/` is a thin TypeScript adapter that loads its WebAssembly module and connects it to pi's extension API.
`packages/pi-guardrails` is TypeScript only. pi loads its `src/pi/index.ts`; Claude Code and Codex run its `agent-hook`
command, which `moon run pi-guardrails:build` compiles to `dist/` because Node does not strip types under `node_modules`.

## Todo contracts

The todo tool validates bounded contracts, local activation, and acceptance evidence.
See [Executable todo contracts](docs/todo-workflows.md) for creation, migration, and scope rules.
Worker launch and tool gating are separate integration work.

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

Add a changeset with `pnpm exec changeset` in each pull request that changes a package. The packages here share one
version. On main, the Publish workflow opens a "Version Packages" pull request. Merging it publishes to npm with
trusted publishing.

npm trusts the workflow only for a package that already exists. After the first release that includes a new package,
its publish fails with 404. The npm owner then runs `scripts/npm-first-publish.sh <name>` once. The script publishes
origin/main's copy of the package, trusts the Publish workflow, and re-runs it for the packages that depend on it.

## License

MIT
