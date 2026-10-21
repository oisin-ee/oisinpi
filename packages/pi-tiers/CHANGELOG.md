# @oisin-ee/pi-tiers

## 0.9.2

### Patch Changes

- [#26](https://github.com/oisin-ee/oisinpi/pull/26) [`3e750ac`](https://github.com/oisin-ee/oisinpi/commit/3e750ace481cfcf55296da1df034473d86d74347) Thanks [@momo-momokaya](https://github.com/apps/momo-momokaya)! - Match tier targets to registry models and quota pools without regard to case. The tier file says `minimax-m3.1-flash`, but the provider lists `MiniMax-M3.1-Flash`. Before, the router treated that model as unlisted forever and filed its quota under the wrong pool. It now dispatches the registry's exact id and uses the `minimax` pool.

## 0.9.1

### Patch Changes

- [#24](https://github.com/oisin-ee/oisinpi/pull/24) [`bcba2d4`](https://github.com/oisin-ee/oisinpi/commit/bcba2d42673c2cf12c23b62079c2a96c0b098e30) Thanks [@momo-momokaya](https://github.com/apps/momo-momokaya)! - Skip tier targets that the model registry does not list. A model that the proxy does not serve yet, such as MiniMax before it is configured, now behaves like an unavailable target. Before, it stopped the turn with "Unknown model".

## 0.9.0

### Minor Changes

- [#21](https://github.com/oisin-ee/oisinpi/pull/21) [`5e80e12`](https://github.com/oisin-ee/oisinpi/commit/5e80e1209af813427b16049c77de3f068d928fd1) Thanks [@momo-momokaya](https://github.com/apps/momo-momokaya)! - Add sticky tier virtual models with bounded recovery, shared gateway circuits, and quota-aware pool selection.
