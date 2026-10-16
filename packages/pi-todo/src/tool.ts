import { STATE_ENTRY, latestSnapshot } from "./state.ts";
import { init, parse, view } from "./wasm.ts";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { TodoList } from "./wasm.ts";

/** One `todo` call, as the schema in `index.ts` admits it. */
interface TodoParams {
  readonly op: "init" | "view";
  readonly items?: readonly string[];
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
 * @returns {TodoResult} The summary and the list.
 */
const result = (list: TodoList): TodoResult => ({
    content: [{ text: view(list), type: "text" }],
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
    if (params.op === "init") {
      const list = init([...(params.items ?? [])]);
      session.append(STATE_ENTRY, list);
      return result(list);
    }
    const snapshot = latestSnapshot(session.branch());
    return result(parse(snapshot));
  };

export { runTodo };
export type { TodoParams, TodoResult, TodoSession };
