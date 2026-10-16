import type {
  BoundaryResult,
  ExtensionUIContext,
  SessionBoundaryDraft,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { REMINDER_ENTRY, reminder } from "./reminder.ts";
import { parse, view } from "./wasm.ts";
import { latestSnapshot } from "./state.ts";

interface TodoContext {
  readonly sessionManager: { readonly getBranch: () => readonly SessionEntry[] };
  readonly ui: Readonly<Pick<ExtensionUIContext, "notify" | "setWidget">>;
}
interface SettleEvent {
  readonly outcome: "completed" | "aborted" | "error";
  readonly continue: boolean;
  readonly context: { readonly canContinue: boolean };
  readonly entries: readonly SessionBoundaryDraft[];
}
interface TodoHost {
  readonly getAllTools: () => readonly {
    readonly name: string;
    readonly sourceInfo: { readonly path: string };
  }[];
}

const ownPath = decodeURIComponent(new URL("index.ts", import.meta.url).pathname),
  /**
   * Whether this source owns the todo registration.
   * @param {TodoHost} pi Tool metadata reader.
   * @returns {boolean} Whether this source won.
   */
  ownsTodo = (pi: TodoHost): boolean =>
    pi.getAllTools().some((tool) => tool.name === "todo" && tool.sourceInfo.path === ownPath),
  /**
   * Renders the selected branch snapshot.
   * @param {TodoContext} ctx Branch and UI methods.
   */
  replay = (ctx: TodoContext): void => {
    const list = parse(latestSnapshot(ctx.sessionManager.getBranch()));
    ctx.ui.setWidget("pi-todo", view(list).split("\n"));
  },
  /**
   * Applies the completion decision at pi's final actionable boundary.
   * @param {TodoHost} pi Tool metadata reader.
   * @param {SettleEvent} event The boundary facts.
   * @param {TodoContext} ctx Branch and UI methods.
   * @returns {BoundaryResult} The unchanged boundary or an added hidden reminder.
   */
  settle = (pi: TodoHost, event: SettleEvent, ctx: TodoContext): BoundaryResult => {
    if (event.outcome !== "completed" || event.continue || !ownsTodo(pi)) {
      return {};
    }
    const content = reminder(ctx.sessionManager.getBranch(), event.entries);
    return typeof content === "string"
      ? {
          continue: true,
          entries: [
            ...event.entries,
            { content, customType: REMINDER_ENTRY, display: false, type: "custom_message" },
          ],
        }
      : {};
  },
  /**
   * Prints the branch list for /todos.
   * @param {TodoContext} ctx Branch and UI methods.
   */
  show = (ctx: TodoContext): void => {
    const list = parse(latestSnapshot(ctx.sessionManager.getBranch()));
    ctx.ui.notify(view(list), "info");
  },
  /**
   * Replays or reports the winning source at startup.
   * @param {TodoHost} pi Tool metadata reader.
   * @param {TodoContext} ctx Branch and UI methods.
   */
  start = (pi: TodoHost, ctx: TodoContext): void => {
    if (ownsTodo(pi)) {
      replay(ctx);
    } else {
      const owner = pi.getAllTools().find((tool) => tool.name === "todo"),
        source = owner ? owner.sourceInfo.path : "another source";
      ctx.ui.notify(`pi-todo is inactive: todo belongs to ${source}.`, "warning");
    }
  };

export { ownsTodo, replay, settle, show, start };
export type { SettleEvent, TodoContext, TodoHost };
