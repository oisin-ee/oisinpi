# @oisin-ee/pi-guardrails

## 0.11.0

### Minor Changes

- [`49b00f1`](https://github.com/oisin-ee/oisinpi/commit/49b00f117d4d64a51cdb2b502ac505a99ffe83dc) Thanks [@momo-momokaya[bot]](https://github.com/momo-momokaya%5Bbot%5D)! - Enforce a read-only policy for planning models. A `tier/plan-claude` or `tier/plan-gpt` model may only read the
  repository and the tools that report on it; writes, unknown execution, and non-read shell syntax are blocked.
  The model of each tool call comes from the session context, so the rule follows a model switch.

  The policy authorizes a tool and a command by its exact name, so a name that only resembles a trusted one is
  blocked. Each command has its own option grammar, so an option without a value, an unknown value, or a flag
  after `--` is blocked. A raw shell command is classified by its argument list, every command of a batch is
  checked on its own, and a nested call the policy cannot inspect is blocked.

## 0.10.2

No changes in this release.

## 0.10.1

No changes in this release.

## 0.10.0

No changes in this release.

## 0.9.3

No changes in this release.

## 0.9.2

No changes in this release.

## 0.9.1

No changes in this release.

## 0.9.0

No changes in this release.

## 0.8.0

No changes in this release.

## 0.7.2

### Patch Changes

- [#16](https://github.com/oisin-ee/oisinpi/pull/16) [`f31e9a6`](https://github.com/oisin-ee/oisinpi/commit/f31e9a6043d5b7cbe351540b51f87eadf85c9af3) Thanks [@momo-momokaya](https://github.com/apps/momo-momokaya)! - Use Dogsled commands and MCP tool names in guardrail guidance. Require `# dogsled: answer-prompt` for prompt answers; the old marker no longer authorizes keys. Update current documentation to the Dogsled consumer contract.

## 0.7.1

No changes in this release.

## 0.7.0

No changes in this release.

## 0.6.0

No changes in this release.

## 0.5.1

No changes in this release.

## 0.5.0

### Patch Changes

- Direct blocked long Pi jobs to Wrangle run, read, and stop instead of the removed background-task tools. Preserve timeout limits, wait blocking, and guidance for other harnesses.

## 0.4.0

No changes in this release.

## 0.3.0

No changes in this release.

## 0.2.0

### Minor Changes

- [#10](https://github.com/oisin-ee/oisinpi/pull/10) [`1c8612b`](https://github.com/oisin-ee/oisinpi/commit/1c8612b7dd1ce00e948d6fd6d3a421f956629e1a) Thanks [@momo-momokaya](https://github.com/apps/momo-momokaya)! - `@oisin-ee/oisinpi` replaces `@oisin-ee/pi-prewalk-kit`. It bundles pi-prewalk, pi-todo, pi-guardrails, and
  pi-wrangle 0.11.0. `@oisin-ee/pi-guardrails` is new: the agent hook policies for pi, Claude Code (`agent-hook`), and
  Codex, ported from the dotfiles hooks runtime.
