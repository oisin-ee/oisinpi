import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import piTodo from "./index.ts";

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
  >
>;
interface Registration {
  readonly api: TodoAPI;
  readonly commands: readonly string[];
  readonly events: readonly string[];
  readonly shortcuts: readonly string[];
  readonly tools: readonly { readonly name: string; readonly parameters: unknown }[];
}

/**
 * Captures pi registration facts without loading the SDK.
 * @returns {Registration} Typed registration methods and captured facts.
 */
const registration = (): Registration => {
  const commands: string[] = [],
    events: string[] = [],
    shortcuts: string[] = [],
    tools: { name: string; parameters: unknown }[] = [];
  return {
    api: {
      appendEntry: (): void => {
        // No session writes during registration.
      },
      events: {
        emit: (): void => {
          // No messages during registration.
        },
        on: (): (() => void) => (): void => {
          // No subscriptions during registration.
        },
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
      registerTool: (tool: { readonly name: string; readonly parameters: unknown }): void => {
        tools.push({ name: tool.name, parameters: tool.parameters });
      },
    },
    commands,
    events,
    shortcuts,
    tools,
  };
};

describe("extension registration", () => {
  it("registers all operations and the branch lifecycle", { timeout: 5000 }, () => {
    expect.hasAssertions();
    const registered = registration();
    piTodo(registered.api);
    expect(registered.tools).toMatchObject([
      {
        name: "todo",
        parameters: {
          properties: { op: { enum: ["init", "start", "done", "drop", "append", "view"] } },
        },
      },
    ]);
    expect(registered.events).toStrictEqual([
      "session_start",
      "session_shutdown",
      "session_tree",
      "agent_before_settle",
    ]);
    expect(registered.commands).toStrictEqual(["todos"]);
    expect(registered.shortcuts).toStrictEqual(["alt+t"]);
  });
});
