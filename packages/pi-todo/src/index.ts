import { ownsTodo, settle } from "./lifecycle.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { PlannotatorHandoff } from "./plannotator.ts";
import { StringEnum } from "@earendil-works/pi-ai";
import { TodoPresentation } from "./presentation.ts";
import { TodoWork } from "./work.ts";
import { Type } from "typebox";
import type { WorkHost } from "./work.ts";
import { runTodo } from "./tool.ts";
import { workUnitGuidance } from "./guidance.ts";

type TodoAPI = WorkHost &
  Readonly<
    Pick<
      ExtensionAPI,
      | "appendEntry"
      | "getAllTools"
      | "on"
      | "registerCommand"
      | "registerShortcut"
      | "registerTool"
      | "sendMessage"
    >
  >;

const subtasks = Type.Immutable(Type.Array(Type.String())),
  outcome = Type.Immutable(
    Type.Object({ content: Type.String(), subtasks }, { additionalProperties: false }),
  ),
  item = Type.Union([Type.String(), outcome]),
  items = Type.Immutable(
    Type.Array(item, {
      description:
        "Pending outcomes for init/append. With parent, append accepts string work units only. Two levels only.",
    }),
  ),
  parameters = Type.Object({
    items: Type.Optional(items),
    op: StringEnum(["init", "start", "done", "drop", "append", "view"] as const, {
      description:
        "init replaces; start explicitly activates without demoting others; done completes; drop abandons open work; append adds pending work; view reads.",
    }),
    parent: Type.Optional(
      Type.String({
        description:
          "Exact root content to target a child. Child start/done/drop also require task.",
      }),
    ),
    task: Type.Optional(
      Type.String({
        description:
          "Exact task content within parent, or at root. Omit for done/drop to close open roots. Complete children before parents.",
      }),
    ),
  });

/**
 * Registers the branch-backed `todo` tool and its completion reminder.
 * @param {TodoAPI} pi The extension API methods used here.
 */
export default function piTodo(pi: TodoAPI): void {
  const handoff = new PlannotatorHandoff(pi),
    presentation = new TodoPresentation(),
    work = new TodoWork(pi, presentation);
  work.register(pi);
  pi.registerTool({
    description: `Keep branch-local outcomes and optional bounded subtasks. Address exact content plus optional parent. Creation is pending. Start explicitly; parallel starts preserve other active work. Parents require explicit integration review after children close. ${workUnitGuidance}`,
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
    handoff.start(ctx);
  });
  pi.on("session_shutdown", () => {
    handoff.stop();
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
