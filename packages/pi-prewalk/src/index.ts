import type {
  AgentBeforeSettleEvent,
  ContextEvent,
  ExtensionAPI,
  SessionStartEvent,
  TurnEndEvent,
} from "@earendil-works/pi-coding-agent";
import { branchRecords, calls } from "./branch.ts";
import { previousBranch, readConfig } from "./config.ts";
import { Adapter } from "./adapter.ts";
import { project } from "./wasm.ts";

/**
 * Registers actionable boundaries and context projection.
 * @param {ExtensionAPI} pi Host API.
 * @param {Adapter} adapter Protocol adapter.
 */
const LAST = -1,
  boundaries = (pi: ExtensionAPI, adapter: Adapter): void => {
    pi.on("turn_end", async (event: Readonly<TurnEndEvent>, ctx) =>
      event.outcome === "completed" && event.message.role === "assistant"
        ? adapter.run(
            { calls: event.toolResults.flatMap((result) => calls(result)), kind: "turn" },
            ctx,
            event.entries,
          )
        : undefined,
    );
    pi.on("agent_before_settle", async (event: Readonly<AgentBeforeSettleEvent>, ctx) =>
      event.outcome === "completed"
        ? adapter.run({ kind: "settle" }, ctx, event.entries)
        : undefined,
    );
    pi.on("context", (event: Readonly<ContextEvent>, ctx) => {
      const projection = project({ records: branchRecords(ctx.sessionManager.getBranch()) }),
        nudges = event.messages.filter(
          (message) => message.role === "custom" && message.customType === "prewalk-plan",
        ),
        latest = nudges.at(LAST);
      return {
        messages: event.messages.filter(
          (message) =>
            message.role !== "custom" ||
            message.customType !== "prewalk-plan" ||
            (projection.keep_plan && message === latest),
        ),
      };
    });
  };

/**
 * Registers prewalk flags, lifecycle, commands, and boundaries.
 * @param {ExtensionAPI} pi Host API.
 */
export default function prewalk(pi: ExtensionAPI): void {
  pi.registerFlag("prewalk", {
    description: "Arm a one-shot prewalk for the startup session.",
    type: "boolean",
  });
  pi.registerFlag("no-prewalk", {
    description: "Keep the startup session unarmed.",
    type: "boolean",
  });
  pi.registerFlag("prewalk-into", {
    description: "Arm prewalk into provider/model.",
    type: "string",
  });
  const adapter = new Adapter(pi, { config: readConfig, previous: previousBranch });
  boundaries(pi, adapter);
  pi.on("session_start", async (event: Readonly<SessionStartEvent>, ctx) => {
    if (event.reason === "new") {
      await adapter.newSession(event.previousSessionFile, ctx);
    } else {
      const into = pi.getFlag("prewalk-into");
      await adapter.run(
        {
          flags: {
            into: typeof into === "string" ? into : undefined,
            no_prewalk: pi.getFlag("no-prewalk") === true,
            prewalk: pi.getFlag("prewalk") === true,
          },
          kind: "start",
          reason: event.reason,
        },
        ctx,
      );
    }
  });
  pi.on("input", async (_event, ctx) => {
    await adapter.run({ kind: "input" }, ctx);
    return { action: "continue" };
  });
  pi.registerCommand("prewalk", {
    description: "Arm a handoff, or use off, restart, status.",
    async handler(command, ctx) {
      await adapter.run({ command: command.trim(), kind: "command" }, ctx);
    },
  });
}
