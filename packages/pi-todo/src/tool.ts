import { STATE_ENTRY, latestSnapshot } from "./state.ts";
import { apply, parse, view } from "./wasm.ts";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { TodoList } from "./wasm.ts";
import { workUnitGuidance } from "./guidance.ts";

/** One `todo` call, as the schema in `index.ts` admits it. */
interface TodoParams {
  readonly op: "init" | "start" | "done" | "drop" | "append" | "view";
  readonly items?: readonly (
    | string
    | { readonly content: string; readonly subtasks: readonly string[] }
  )[];
  readonly parent?: string;
  readonly task?: string;
}

/** What a call reads from and writes to the session. */
interface TodoSession {
  readonly branch: () => readonly SessionEntry[];
  readonly append: (customType: string, list: TodoList) => void;
}

/** The tool result: the summary for the model and the list for rendering. */
interface TodoResult {
  readonly content: [{ readonly type: "text"; readonly text: string }];
  readonly details: TodoList;
}

/**
 * The result for `list`.
 * @param {TodoList} list A valid list.
 * @param {boolean} creation Whether the call created work.
 * @returns {TodoResult} The summary and the list.
 */
const result = (list: TodoList, creation: boolean): TodoResult => ({
    content: [
      { text: creation ? `${view(list)}\n\n${workUnitGuidance}` : view(list), type: "text" },
    ],
    details: list,
  }),
  /**
   * Runs one call. A rejected operation throws the core's message, so pi marks
   * the result failed, and nothing is stored.
   * @param {TodoParams} params The validated tool arguments.
   * @param {TodoSession} session The branch to read and the entry writer.
   * @returns {TodoResult} The result for the model and the renderer.
   */
  runTodo = (params: TodoParams, session: TodoSession): TodoResult => {
    const current = parse(latestSnapshot(session.branch())),
      { list, persist } = apply(current, params);
    if (persist) {
      session.append(STATE_ENTRY, list);
    }
    return result(list, params.op === "init" || params.op === "append");
  };

export { runTodo };
export type { TodoParams, TodoResult, TodoSession };
