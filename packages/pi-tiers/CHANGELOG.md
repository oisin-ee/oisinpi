# @oisin-ee/pi-tiers

## 0.9.1

### Patch Changes

- [#24](https://github.com/oisin-ee/oisinpi/pull/24) [`bcba2d4`](https://github.com/oisin-ee/oisinpi/commit/bcba2d42673c2cf12c23b62079c2a96c0b098e30) Thanks [@momo-momokaya](https://github.com/apps/momo-momokaya)! - Skip tier targets that the model registry does not list. A model that the proxy does not serve yet, such as MiniMax before it is configured, now behaves like an unavailable target. Before, it stopped the turn with "Unknown model".

## 0.9.0

### Minor Changes

- [#21](https://github.com/oisin-ee/oisinpi/pull/21) [`5e80e12`](https://github.com/oisin-ee/oisinpi/commit/5e80e1209af813427b16049c77de3f068d928fd1) Thanks [@momo-momokaya](https://github.com/apps/momo-momokaya)! - Add sticky tier virtual models with bounded recovery, shared gateway circuits, and quota-aware pool selection.
