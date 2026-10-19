# @oisin-ee/pi-todo

## 0.7.0

No changes in this release.

## 0.6.0

### Minor Changes

- [`eb67440`](https://github.com/oisin-ee/oisinpi/commit/eb674408bf1dfbdfec7fd319c3863ad05b3d730d) Thanks [@momo-momokaya[bot]](https://github.com/momo-momokaya%5Bbot%5D)! - Add two-level outcomes and bounded subtasks with exact parent-scoped targets. Creation stays pending, and explicit starts preserve parallel active work. Automatic activation is removed.

  Keep parents open for explicit integration review after children close. Reject premature completion atomically. Preserve completed children when dropping a parent.

  Show hierarchy and separate progress in shared rendering, model output, and reminders. Add work-unit guidance to tool results and approved-plan continuation. Old flat snapshots remain readable.

  Pi-todo now supplies the renderer hosted by Wrangle's inline widget through display protocol version 2. Shared presentation requires a matching Wrangle release. Older integrations retain standalone todos instead of flattening subtasks.

## 0.5.1

No changes in this release.

## 0.5.0

No changes in this release.

## 0.4.0

### Minor Changes

- [`0a1434e`](https://github.com/oisin-ee/oisinpi/commit/0a1434eedb156c21abd36ae611a124b06f0ad1d8) Thanks [@momo-momokaya[bot]](https://github.com/momo-momokaya%5Bbot%5D)! - Continue approved Plannotator plans with the existing todo tool when external execution is enabled. Keep one branch-backed task list instead of a separate Plannotator checklist.

- [`74a563f`](https://github.com/oisin-ee/oisinpi/commit/74a563f9fa806902d9c0cf7d1d2e01edea255dec) Thanks [@momo-momokaya[bot]](https://github.com/momo-momokaya%5Bbot%5D)! - Publish validated todo snapshots for Wrangle's shared work display. Keep task state on the Pi session branch and restore the standalone widget when shared presentation ends.

## 0.3.0

### Minor Changes

- [`7f33497`](https://github.com/oisin-ee/oisinpi/commit/7f3349706861ab943f0be931ab3cff49e74d5f37) Thanks [@momo-momokaya[bot]](https://github.com/momo-momokaya%5Bbot%5D)! - Show only in-progress tasks in a themed, width-aware widget by default. Alt+T and /todos toggle grouped upcoming, done, and dropped tasks inline. Use /todos list for the full text summary.

## 0.2.0

### Minor Changes

- [#10](https://github.com/oisin-ee/oisinpi/pull/10) [`1c8612b`](https://github.com/oisin-ee/oisinpi/commit/1c8612b7dd1ce00e948d6fd6d3a421f956629e1a) Thanks [@momo-momokaya](https://github.com/apps/momo-momokaya)! - `@oisin-ee/oisinpi` replaces `@oisin-ee/pi-prewalk-kit`. It bundles pi-prewalk, pi-todo, pi-guardrails, and
  pi-wrangle 0.11.0. `@oisin-ee/pi-guardrails` is new: the agent hook policies for pi, Claude Code (`agent-hook`), and
  Codex, ported from the dotfiles hooks runtime.

## 0.1.1

### Patch Changes

- [#8](https://github.com/oisin-ee/pi-prewalk/pull/8) [`785734f`](https://github.com/oisin-ee/pi-prewalk/commit/785734ff387908f263c9031d8b16392ece7198f5) Thanks [@momo-momokaya](https://github.com/apps/momo-momokaya)! - `/prewalk on` arms a handoff, the same as `/prewalk`. The todo widget is hidden while the list has no tasks.

## 0.1.0

### Minor Changes

- [#7](https://github.com/oisin-ee/pi-prewalk/pull/7) [`f528eab`](https://github.com/oisin-ee/pi-prewalk/commit/f528eab26e4d2de300e1fdb9a3d5ec52e06ca9b6) Thanks [@momo-momokaya](https://github.com/apps/momo-momokaya)! - First release: the `todo` tool, the prewalk planner-to-executor handoff, and the kit that installs both.
