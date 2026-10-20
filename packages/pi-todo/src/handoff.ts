import type {
  ExtensionAPI,
  ExtensionContext,
  SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import type { TaskProvider } from "./provider.ts";
import { ownsTodo } from "./lifecycle.ts";
import { seedSource } from "./source.ts";

/** Startup transport is read once; branch progress always wins on resume. */
class WorkerImport {
  readonly #pi: Readonly<Pick<ExtensionAPI, "getFlag" | "exec" | "getAllTools">>;
  readonly #provider: Readonly<TaskProvider>;

  public constructor(
    pi: Readonly<Pick<ExtensionAPI, "getFlag" | "exec" | "getAllTools">>,
    provider: Readonly<TaskProvider>,
  ) {
    this.#pi = pi;
    this.#provider = provider;
  }

  /**
   * Activates a seed before the worker's initial request, without an LLM call.
   * @param {SessionStartEvent} event Runtime startup reason.
   * @param {ExtensionContext} ctx Current session authority.
   */
  public async start(event: SessionStartEvent, ctx: ExtensionContext): Promise<void> {
    const file = this.#pi.getFlag("todo-unit-file");
    if (typeof file !== "string" || !ownsTodo(this.#pi)) {
      return;
    }
    try {
      if (this.#requiresImport(event, ctx)) {
        await this.#load(file, ctx);
      }
    } catch (error: unknown) {
      ctx.abort();
      ctx.ui.notify(
        `IMPORT_FAILED: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  #requiresImport(event: SessionStartEvent, ctx: ExtensionContext): boolean {
    const receipt = this.#provider.capability().imported();
    if (!receipt.ok) {
      throw new Error(receipt.error.message);
    }
    if (receipt.value !== null) {
      return false;
    }
    if (
      event.reason !== "startup" ||
      ctx.sessionManager.getEntries().some((entry) => entry.type === "message")
    ) {
      throw new Error("IMPORT_FAILED: cannot seed an existing session");
    }
    return true;
  }

  async #load(file: string, ctx: ExtensionContext): Promise<void> {
    const sessionId = ctx.sessionManager.getSessionId(),
      leaf = ctx.sessionManager.getLeafId(),
      source = seedSource(file),
      origin = await this.#pi.exec("git", ["remote", "get-url", "origin"], { cwd: ctx.cwd }),
      success = 0;
    if (origin.code !== success) {
      throw new Error("IMPORT_FAILED: checkout has no origin");
    }
    if (
      ctx.sessionManager.getSessionId() !== sessionId ||
      ctx.sessionManager.getLeafId() !== leaf
    ) {
      throw new Error("STALE_ORIGIN: session changed while reading repository identity");
    }
    this.#provider.import(source, origin.stdout, ctx);
  }
}

export { WorkerImport };
