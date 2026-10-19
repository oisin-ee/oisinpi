# @oisin-ee/oisinpi

## 0.7.1

### Patch Changes

- Updated dependencies [[`b2ebd5a`](https://github.com/oisin-ee/oisinpi/commit/b2ebd5aefa0a52d84e7685c014fef5203e30e3a3)]:
  - @oisin-ee/pi-todo@0.7.1
  - @oisin-ee/pi-guardrails@0.7.1
  - @oisin-ee/pi-prewalk@0.7.1

## 0.7.0

### Minor Changes

- [`5a49c73`](https://github.com/oisin-ee/oisinpi/commit/5a49c7387a1be43057bb881c34794347de3769b1) Thanks [@oisincoveney](https://github.com/oisincoveney)! - Remove pi-wrangle from the collection. Install `npm:@oisin-ee/pi-wrangle` on its own, at the same version as the `wrangle` binary, so a wrangle release no longer needs an oisinpi release. The collection now bundles pi-prewalk, pi-todo, and pi-guardrails.

### Patch Changes

- Updated dependencies []:
  - @oisin-ee/pi-guardrails@0.7.0
  - @oisin-ee/pi-prewalk@0.7.0
  - @oisin-ee/pi-todo@0.7.0

## 0.6.0

### Patch Changes

- [`16abba6`](https://github.com/oisin-ee/oisinpi/commit/16abba6b96e8ca0106a011e0fe4629396839b08c) Thanks [@oisincoveney](https://github.com/oisincoveney)! - Bundle pi-wrangle 0.12.3. The widget above the editor uses the wrangle board design again: host meters, the current task, and agents and jobs grouped TO LAND, ATTENTION, RUNNING, and WAITING with aligned columns. Alt+W and `/work` still expand it in place. Wrangle hosts pi-todo's display protocol version 2 view inline.
- Updated dependencies [[`eb67440`](https://github.com/oisin-ee/oisinpi/commit/eb674408bf1dfbdfec7fd319c3863ad05b3d730d)]:
  - @oisin-ee/pi-todo@0.6.0
  - @oisin-ee/pi-guardrails@0.6.0
  - @oisin-ee/pi-prewalk@0.6.0

## 0.5.1

### Patch Changes

- [`0170caa`](https://github.com/oisin-ee/oisinpi/commit/0170caa9c59c4e3d71409627b14925cefcc68679) Thanks [@momo-momokaya[bot]](https://github.com/momo-momokaya%5Bbot%5D)! - Bundle pi-wrangle 0.12.2. Show the current task and named agents and jobs above the editor. Alt+W and `/work` expand the same widget in place, without a popup or editor replacement.
- Updated dependencies []:
  - @oisin-ee/pi-guardrails@0.5.1
  - @oisin-ee/pi-prewalk@0.5.1
  - @oisin-ee/pi-todo@0.5.1

## 0.5.0

### Minor Changes

- Bundle the released shared work strip and panel. Use Wrangle for background jobs and keep todo state on its Pi branch. Include updated guardrails that direct long work to Wrangle without relaxing timeout or wait checks.

### Patch Changes

- Updated dependencies [`1f4a622`]:
  - @oisin-ee/pi-guardrails@0.5.0
  - @oisin-ee/pi-prewalk@0.5.0
  - @oisin-ee/pi-todo@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [[`0a1434e`](https://github.com/oisin-ee/oisinpi/commit/0a1434eedb156c21abd36ae611a124b06f0ad1d8), [`74a563f`](https://github.com/oisin-ee/oisinpi/commit/74a563f9fa806902d9c0cf7d1d2e01edea255dec)]:
  - @oisin-ee/pi-todo@0.4.0
  - @oisin-ee/pi-guardrails@0.4.0
  - @oisin-ee/pi-prewalk@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [[`7f33497`](https://github.com/oisin-ee/oisinpi/commit/7f3349706861ab943f0be931ab3cff49e74d5f37)]:
  - @oisin-ee/pi-todo@0.3.0
  - @oisin-ee/pi-guardrails@0.3.0
  - @oisin-ee/pi-prewalk@0.3.0

## 0.2.0

### Minor Changes

- [#10](https://github.com/oisin-ee/oisinpi/pull/10) [`1c8612b`](https://github.com/oisin-ee/oisinpi/commit/1c8612b7dd1ce00e948d6fd6d3a421f956629e1a) Thanks [@momo-momokaya](https://github.com/apps/momo-momokaya)! - `@oisin-ee/oisinpi` replaces `@oisin-ee/pi-prewalk-kit`. It bundles pi-prewalk, pi-todo, pi-guardrails, and
  pi-wrangle 0.11.0. `@oisin-ee/pi-guardrails` is new: the agent hook policies for pi, Claude Code (`agent-hook`), and
  Codex, ported from the dotfiles hooks runtime.

### Patch Changes

- Updated dependencies [[`1c8612b`](https://github.com/oisin-ee/oisinpi/commit/1c8612b7dd1ce00e948d6fd6d3a421f956629e1a)]:
  - @oisin-ee/pi-guardrails@0.2.0
  - @oisin-ee/pi-prewalk@0.2.0
  - @oisin-ee/pi-todo@0.2.0
