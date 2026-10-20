import type { CustomEntry, SessionEntry } from "@earendil-works/pi-coding-agent";
import type { TodoList, UnitRef } from "./wasm.ts";
import { parse } from "./wasm.ts";

/** The snapshot of a branch with no list yet. */
const EMPTY: unknown = { tasks: [] },
  /** The custom entry that holds the list after every change. */
  STATE_ENTRY = "todo-state",
  /**
   * Whether `entry` is a stored list.
   * @param {SessionEntry} entry A branch entry.
   * @returns {boolean} True for a `todo-state` custom entry.
   */
  isStateEntry = (entry: SessionEntry): entry is CustomEntry =>
    entry.type === "custom" && entry.customType === STATE_ENTRY,
  /**
   * The latest stored snapshot on the branch, unvalidated: the core validates it.
   * @param {readonly SessionEntry[]} branch The session branch, oldest entry first.
   * @returns {unknown} The latest snapshot, or an empty list when there is none.
   */
  latestSnapshot = (branch: readonly SessionEntry[]): unknown => {
    for (const entry of branch.toReversed()) {
      if (isStateEntry(entry)) {
        return entry.data;
      }
    }
    return EMPTY;
  },
  /**
   * Resolves the first branch entry for a contract revision.
   * @param {Readonly<UnitRef>} reference Revision identity.
   * @param {string} entryId Containing Pi entry.
   * @param {Readonly<Map<string, string>>} origins Prior branch origins.
   * @returns {string} The revision's originating entry.
   */
  originFor = (
    reference: Readonly<UnitRef>,
    entryId: string,
    origins: Readonly<Map<string, string>>,
  ): string => {
    const key = JSON.stringify([reference.sessionId, reference.unitId, reference.revision]),
      origin = origins.get(key) ?? entryId;
    origins.set(key, origin);
    return origin;
  },
  /**
   * Reads revision origins from the entries that first introduced them.
   * Status-only snapshots cannot move a revision's origin.
   * @param {readonly SessionEntry[]} branch Current branch in chronological order.
   * @returns {TodoList} Validated snapshot with derived provenance.
   */
  branchSnapshot = (branch: readonly SessionEntry[]): TodoList => {
    const origins = new Map<string, string>();
    let current: TodoList = { tasks: [] };
    for (const entry of branch) {
      if (isStateEntry(entry)) {
        current = parse(entry.data);
        const tasks = current.tasks.flatMap((task) => [task, ...(task.subtasks ?? [])]);
        for (const task of tasks) {
          if (task.unit !== undefined) {
            task.unit.reference.contractEntryId = originFor(task.unit.reference, entry.id, origins);
          }
        }
      }
    }
    return current;
  };

export { STATE_ENTRY, branchSnapshot, latestSnapshot };
