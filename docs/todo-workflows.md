# Executable todo contracts

The `todo` tool stores branch-local outcomes and leaf contracts. Rust validates operations before Pi appends one snapshot. Failed operations append nothing.

This unit implements contracts, local activation, acceptance, migration, and display. It does not gate other tools or launch workers. Provider handoff and worker import are separate units.

## Create and start

```json
{
  "op": "init",
  "items": [
    {
      "key": "build",
      "content": "Deliver executable contracts",
      "contract": {
        "deliverable": "Validated contracts through the todo tool",
        "scope": {
          "repositoryId": "oisinpi",
          "owns": ["crates/todo-core/", "packages/pi-todo/src/"],
          "reads": ["plans/todo-workflows.md"],
          "generates": ["packages/pi-todo/src/generated/"]
        },
        "acceptance": {
          "kind": "command",
          "cwd": ".",
          "argv": ["moon", "run", "todo-core:test", "pi-todo:test"],
          "expected": "All tests pass"
        },
        "dependsOn": [],
        "assignment": { "kind": "self" }
      }
    }
  ],
  "start": "build"
}
```

The optional `start` selector makes creation and activation atomic. Without it, creation leaves drafts pending. Strings create incomplete drafts. A parent uses `{content, subtasks}` and cannot execute.

Local keys resolve prerequisite references within the same creation request. After creation, selectors use returned unit IDs. Names remain display labels.

An acceptance requirement can instead use `{kind:"review", artifact, criterion}`. Commands describe evidence requirements. The tool never runs them.

## Operations

| Operation         | Effect                                                                           |
| ----------------- | -------------------------------------------------------------------------------- |
| `init` / `append` | Create drafts or complete contracts, with optional atomic `start`                |
| `update`          | Replace contract fields on non-executing open work, with optional atomic `start` |
| `start`           | Activate one complete self-assigned leaf with completed prerequisites            |
| `done`            | Complete an explicitly selected unit with concrete `evidence`                    |
| `drop`            | Abandon open work without cancelling an external process                         |
| `view`            | Read the current branch without persistence                                      |

`update` replaces the draft object rather than merging individual fields. A domain change increments the revision. A status-only change preserves the revision and its origin.

A locally active unit prevents replacement with `init`. Its contract cannot change. Another local leaf cannot start, even with disjoint ownership. A worker assignment uses `{kind:"worker", profile:"general"}`. `start` rejects worker assignments without launching anything.

Executable completion requires a complete contract, completed prerequisites, prior local activation, and nonempty acceptance evidence. Worker acceptance requires the later provider integration. A worker exit does not establish acceptance.

Parents require closed children and explicit integration-review evidence. Closing children does not close their parent. Completed and dropped leaves cannot restart. Dropping a parent preserves completed children.

## Scope and prerequisites

Scope paths are repository-relative files or directory prefixes. Absolute paths, parent traversal, glob patterns, and duplicate paths are invalid. Empty ownership permits read-only work. Read paths do not claim ownership.

Unknown prerequisite IDs and cycles reject the whole mutation. Completed prerequisites satisfy dependencies. Dropped prerequisites do not. Owned and generated paths participate in overlap validation. Scope declarations are not filesystem permissions.

## Identity and migration

The runtime supplies the Pi session ID and a fresh mutation identity. Rust allocates unit IDs and revisions. Agent parameters cannot set these values.

A unit reference contains `sessionId`, `unitId`, `revision`, and `contractEntryId`. The branch reader derives `contractEntryId` from the first Pi entry for that revision. The initial append does not contain its own entry ID. Later status snapshots preserve the original entry reference.

Legacy flat and hierarchical snapshots retain their recorded status and display. A read does not migrate them. The first successful mutation assigns stable IDs and persists migration atomically.

Exact-content selectors apply only before migration. Legacy `in_progress` does not authorize execution. Open legacy work requires `update`, then explicit `start`. An atomic `update` with `start` is also valid. Completed legacy work never reopens automatically.

The shared presentation protocol remains version 2. Pi-todo shows assignment, profile, scope, revision, and parent review state. It stores no queue, host, pane, process, retry, or cancellation state.
