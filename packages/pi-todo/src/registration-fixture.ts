import type {
  ExtensionAPI,
  ExtensionToolContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";
import type { TodoParams } from "./tool.ts";
import { Parse as parse } from "typebox/value";

/** The API subset the extension uses, fully typed without loading the SDK. */
type TodoAPI = Readonly<
  Pick<
    ExtensionAPI,
    | "appendEntry"
    | "events"
    | "getAllTools"
    | "on"
    | "registerCommand"
    | "registerShortcut"
    | "registerTool"
    | "sendMessage"
  >
>;
interface Registered {
  readonly name: string;
  readonly parameters: unknown;
  readonly execute: (params: TodoParams, ctx: ExtensionToolContext) => Promise<unknown>;
}

interface Registration {
  readonly api: TodoAPI;
  readonly commands: readonly string[];
  readonly events: readonly string[];
  readonly shortcuts: readonly string[];
  readonly tools: readonly Registered[];
}

/**
 * Captures pi registration facts without loading the SDK.
 * @param {Readonly<Pick<SessionManager, "appendCustomEntry">>} session Pi session append owner.
 * @returns {Registration} Typed registration methods and captured facts.
 */
const silent = (): void => {
    /* Registration has no transport side effects. */
  },
  registration = (
    session: Readonly<Pick<SessionManager, "appendCustomEntry">> = SessionManager.inMemory(),
  ): Registration => {
    const commands: string[] = [],
      events: string[] = [],
      shortcuts: string[] = [],
      tools: Registered[] = [];
    return {
      api: {
        appendEntry: (customType, data): void => {
          session.appendCustomEntry(customType, data);
        },
        events: {
          emit: silent,
          on: (): (() => void) => silent,
        },
        getAllTools: () => [],
        on: (event): (() => void) => {
          events.push(event);
          return (): void => {
            // No subscriptions need cleanup in this mock.
          };
        },
        registerCommand: (name): void => {
          commands.push(name);
        },
        registerShortcut: (key): void => {
          shortcuts.push(key);
        },
        registerTool: <Params extends TSchema, Details, State>(
          tool: Readonly<
            Pick<ToolDefinition<Params, Details, State>, "execute" | "name" | "parameters">
          >,
        ): void => {
          tools.push({
            execute: async (params, ctx) =>
              tool.execute("test", parse(tool.parameters, params), undefined, undefined, ctx),
            name: tool.name,
            parameters: tool.parameters,
          });
        },
        sendMessage: silent,
      },
      commands,
      events,
      shortcuts,
      tools,
    };
  };

export { registration };
