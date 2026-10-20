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

Appending children to a completed or dropped root fails without changing its snapshot. New scope requires a new outcome.

## Scope and prerequisites

Scope paths are repository-relative files or directory prefixes. Absolute paths, parent traversal, glob patterns, and duplicate paths are invalid. Empty ownership permits read-only work. Read paths do not claim ownership.

Unknown prerequisite IDs and cycles reject the whole mutation. Completed prerequisites satisfy dependencies. Dropped prerequisites do not. Owned and generated paths participate in overlap validation. Scope declarations are not filesystem permissions.

## Local execution gate and extension capability

Pi-todo blocks shell, arbitrary code, mutations, and unknown tools without an active local leaf.
Structured reads and exact workflow-control tool names remain available. Codemode itself needs no lease. Its nested calls use their own runtime IDs.
A running call protects its revision from completion or replacement until its matching `tool_execution_end` event.
An abort request does not release a call that still executes. Shutdown clears runtime-only leases.
Other guardrails retain their own blocking decisions.

Extensions acquire the synchronous capability through `oisin.tasks.acquire.v1` with `{version: 1, reply}`.
Only the winning `todo` owner responds. Consumers must reject multiple responses.
Methods are `inspect`, `claim`, `settle`, `active`, and `imported`. They return `{ok, value}` or `{ok:false, error}`.
The importer is a separate unit. Until it exists, `imported()` returns successful `null`, never an acknowledgement.

Rust owns claim and settlement validation. A claim stores the binding and exact canonical export bytes in one branch snapshot.
Same-execution replay returns the frozen export. Settlement stores accepted event identities across later revisions, so reordered duplicates cannot release a newer binding.
`not_started` identifies only the origin and execution. Returned and stopped results also require the exact export digest.
Held bindings block task replacement, updates, completion, and parent cascades. Released evidence permits explicit `todo done` review, not automatic acceptance.
A new execution requires `update` to establish a new revision, even when the draft fields stay unchanged.

The digest is SHA-256 over compact UTF-8 JSON, excluding `digest`. Field order follows the normative schema and preserves array order.
The fixed brief contains title, deliverable, repository, owned/read/generated paths, acceptance, and origin.
Shared test data comes unchanged from Dogsled `51059cb`, `tests/fixtures/unit-exports.json`.
This is trusted extension coordination, not operating-system isolation. Pi-todo does not launch workers, query processes, resolve profiles, or poll.

## Identity and migration

The runtime supplies the Pi session ID and a fresh mutation identity. Rust allocates unit IDs and revisions. Agent parameters cannot set these values.

A unit reference contains `sessionId`, `unitId`, `revision`, and `contractEntryId`. The branch reader derives `contractEntryId` from the first Pi entry for that revision. The initial append does not contain its own entry ID. Later status snapshots preserve the original entry reference.

Legacy flat and hierarchical snapshots retain their recorded status and display. A read does not migrate them. The first successful mutation assigns stable IDs and persists migration atomically.

Exact-content selectors apply only before migration. Legacy `in_progress` does not authorize execution. Open legacy work requires `update`, then explicit `start`. An atomic `update` with `start` is also valid. Completed legacy work never reopens automatically.

The shared presentation protocol remains version 2. Pi-todo shows assignment, profile, scope, revision, and parent review state. It stores no queue, host, pane, process, retry, or cancellation state.
