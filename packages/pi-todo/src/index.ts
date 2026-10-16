import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { runTodo } from "./tool.ts";

const items = Type.Immutable(
    Type.Array(Type.String(), { description: "For init: every task, in order." }),
  ),
  parameters = Type.Object({
    items: Type.Optional(items),
    op: StringEnum(["init", "view"] as const, {
      description: "init replaces the whole list with items; view shows the list.",
    }),
  });

/**
 * Registers the `todo` tool.
 * @param {ExtensionAPI} pi The extension API.
 */
export default function piTodo(pi: ExtensionAPI): void {
  pi.registerTool({
    description:
      "Keep the session todo list. Tasks are addressed by their exact content, and the first open task is the active one.",
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return runTodo(params, {
        append: (customType, list) => {
          pi.appendEntry(customType, list);
        },
        branch: () => ctx.sessionManager.getBranch(),
      });
    },
    label: "Todo",
    name: "todo",
    parameters,
  });
}
