import { ownsTodo, settle } from "./lifecycle.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { TodoPresentation } from "./presentation.ts";
import { TodoWork } from "./work.ts";
import { Type } from "typebox";
import type { WorkHost } from "./work.ts";
import { runTodo } from "./tool.ts";

type TodoAPI = WorkHost &
  Readonly<
    Pick<
      ExtensionAPI,
      "appendEntry" | "getAllTools" | "on" | "registerCommand" | "registerShortcut" | "registerTool"
    >
  >;

const items = Type.Immutable(
    Type.Array(Type.String(), { description: "For init or append: tasks, in order." }),
  ),
  parameters = Type.Object({
    items: Type.Optional(items),
    op: StringEnum(["init", "start", "done", "drop", "append", "view"] as const, {
      description:
        "init replaces; start selects; done completes; drop abandons; append adds; view reads.",
    }),
    task: Type.Optional(
      Type.String({ description: "Exact task content. Omit for done/drop to close all tasks." }),
    ),
  });

/**
 * Registers the branch-backed `todo` tool and its completion reminder.
 * @param {TodoAPI} pi The extension API methods used here.
 */
export default function piTodo(pi: TodoAPI): void {
  const presentation = new TodoPresentation(),
    work = new TodoWork(pi, presentation);
  work.register(pi);
  pi.registerTool({
    description:
      "Keep the session todo list. Tasks are addressed by their exact content. One task is active; the next open task starts when it closes.",
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = runTodo(params, {
        append: (customType, list) => {
          pi.appendEntry(customType, list);
        },
        branch: () => ctx.sessionManager.getBranch(),
      });
      work.publish(ctx);
      presentation.refresh(ctx);
      return result;
    },
    executionMode: "sequential",
    label: "Todo",
    name: "todo",
    parameters,
  });
  pi.on("session_start", (_event, ctx) => {
    presentation.start(pi, ctx);
    work.start(ctx);
  });
  pi.on("session_shutdown", () => {
    work.stop();
  });
  pi.on("session_tree", (_event, ctx) => {
    if (ownsTodo(pi)) {
      work.publish(ctx);
      presentation.reset(ctx);
    }
  });
  pi.on("agent_before_settle", (event, ctx) => settle(pi, event, ctx));
}
