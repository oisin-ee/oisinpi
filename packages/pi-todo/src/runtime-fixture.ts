import {
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  createAgentSession,
  createCodemodeExtension,
  createEventBus,
} from "@earendil-works/pi-coding-agent";
import {
  InMemoryCredentialStore,
  InMemoryModelsStore,
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { TaskProviderV1 } from "./provider.ts";
import type { TodoParams } from "./tool.ts";
import { Type } from "typebox";
import { contract } from "./contract-fixture.ts";
import piTodo from "./index.ts";

type Session = Awaited<ReturnType<typeof createAgentSession>>["session"];
interface Startup {
  readonly cwd: string;
  readonly seedPath: string;
}
interface RuntimeFixture {
  readonly session: Readonly<Pick<Session, "dispose" | "abort" | "messages">> & {
    readonly extensionRunner: Readonly<Pick<Session["extensionRunner"], "emitToolResult" | "emit">>;
  };
  readonly manager: SessionManager;
  readonly provider: () => TaskProviderV1;
  readonly call: (name: string, args: Readonly<Record<string, string>>) => Promise<void>;
  readonly create: () => Promise<void>;
  readonly todo: (params: TodoParams) => Promise<unknown>;
}

/**
 * Creates resources without user configuration or external services.
 * @param {ExtensionFactory} later Optional additional guard or test tool.
 * @param {boolean} collision Whether the other todo owner loads first.
 * @param {Startup | undefined} startup Optional worker startup configuration.
 * @returns {object} Local resource owners.
 */
const resources = (
    later: ExtensionFactory | undefined,
    collision: boolean,
    startup: Startup | undefined,
  ): {
    events: ReturnType<typeof createEventBus>;
    manager: SessionManager;
    settings: SettingsManager;
    loader: DefaultResourceLoader;
  } => {
    const events = createEventBus(),
      manager = SessionManager.inMemory(),
      settings = SettingsManager.inMemory({
        compaction: { enabled: false },
        retry: { enabled: false },
      }),
      loader = new DefaultResourceLoader({
        additionalExtensionPaths: collision ? [] : [new URL("index.ts", import.meta.url).pathname],
        agentDir: "/nonexistent/pi-todo-test",
        cwd: startup?.cwd ?? "/tmp",
        eventBus: events,
        extensionFactories: [
          createCodemodeExtension(),
          ...(later === undefined ? [] : [later]),
          ...(collision ? [piTodo] : []),
        ],
        noContextFiles: true,
        noExtensions: true,
        noPromptTemplates: true,
        noSkills: true,
        noThemes: true,
        settingsManager: settings,
      });
    return { events, loader, manager, settings };
  },
  /**
   * Requires one synchronous response from the real event bus.
   * @param {Readonly<object>} events Runtime event bus.
   * @returns {TaskProviderV1} Acquired extension capability.
   */
  acquire = (events: Readonly<ReturnType<typeof createEventBus>>): TaskProviderV1 => {
    const replies: TaskProviderV1[] = [],
      version = 1;
    events.emit("oisin.tasks.acquire.v1", {
      reply: (value: TaskProviderV1): void => {
        replies.push(value);
      },
      version,
    });
    const [provider] = replies;
    if (provider === undefined || replies.length !== version) {
      throw new Error("Expected exactly one synchronous provider");
    }
    return provider;
  },
  /**
   * Executes the registered todo entry point, including its persistence checks.
   * @param {Session} session Real SDK session.
   * @param {TodoParams} params Requested mutation.
   * @returns {Promise<unknown>} Actual tool result.
   */
  todoCall = async (
    session: {
      readonly extensionRunner: Readonly<
        Pick<Session["extensionRunner"], "getToolDefinition" | "createToolContext">
      >;
    },
    params: TodoParams,
  ): Promise<unknown> => {
    const tool = session.extensionRunner.getToolDefinition("todo");
    if (tool === undefined) {
      throw new Error("Missing todo registration");
    }
    return tool.execute(
      "review",
      params,
      undefined,
      undefined,
      session.extensionRunner.createToolContext("review", new AbortController().signal),
    );
  },
  /**
   * Executes a scripted tool request through the actual model runtime.
   * @param {Session} session Session execution owner.
   * @param {Readonly<ReturnType<typeof fauxProvider>>} faux Scripted provider.
   * @returns {RuntimeFixture["call"]} Request function.
   */
  caller =
    (
      session: Readonly<Pick<Session, "prompt">>,
      faux: Readonly<Pick<ReturnType<typeof fauxProvider>, "setResponses">>,
    ): RuntimeFixture["call"] =>
    async (name, args): Promise<void> => {
      faux.setResponses([
        fauxAssistantMessage(fauxToolCall(name, args)),
        fauxAssistantMessage("Done."),
      ]);
      await session.prompt("Exercise one tool.");
    },
  /**
   * Loads the real runner and codemode with a scripted model.
   * @param {ExtensionFactory} later Additional extension.
   * @param {boolean} collision Loads a competing owner first.
   * @param {Startup | undefined} startup Optional worker startup configuration.
   * @returns {Promise<RuntimeFixture>} Isolated runtime and callers.
   */
  runtimeFixture = async (
    later?: ExtensionFactory,
    collision = false,
    startup?: Startup,
  ): Promise<RuntimeFixture> => {
    const setup = resources(later, collision, startup),
      modelRuntime = await ModelRuntime.create({
        credentials: new InMemoryCredentialStore(),
        modelsPath: null,
        modelsStore: new InMemoryModelsStore(),
        refreshOnCreate: false,
      }),
      faux = fauxProvider({ tokensPerSecond: 0 });
    modelRuntime.registerNativeProvider(faux.provider);
    await setup.loader.reload();
    const { session } = await createAgentSession({
      cwd: startup?.cwd ?? "/tmp",
      model: faux.getModel(),
      modelRuntime,
      resourceLoader: setup.loader,
      sessionManager: setup.manager,
      settingsManager: setup.settings,
      thinkingLevel: "off",
    });
    if (startup !== undefined) {
      session.extensionRunner.setFlagValue("todo-unit-file", startup.seedPath);
    }
    await session.bindExtensions({});
    session.setActiveToolsByName([...session.getActiveToolNames(), "codemode"]);
    return {
      call: caller(session, faux),
      create: async (): Promise<void> => {
        await todoCall(session, {
          items: [{ content: "Build", contract: contract(), key: "build" }],
          op: "init",
          start: "build",
        });
      },
      manager: setup.manager,
      provider: () => acquire(setup.events),
      session,
      todo: async (params): Promise<unknown> => todoCall(session, params),
    };
  },
  /**
   * Produces a deterministic tool result.
   * @returns {object} Successful content.
   */
  emptyResult = (): { content: [{ type: "text"; text: string }]; details: undefined } => ({
    content: [{ text: "ok", type: "text" }],
    details: undefined,
  }),
  emptyParameters = Type.Object({});

export { emptyParameters, emptyResult, runtimeFixture };
export type { RuntimeFixture };
