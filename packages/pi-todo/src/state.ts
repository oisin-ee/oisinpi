import type { CustomEntry, SessionEntry } from "@earendil-works/pi-coding-agent";

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
  };

export { STATE_ENTRY, latestSnapshot };
