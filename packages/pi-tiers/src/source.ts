import type { Change, Health } from "./health.ts";
import { emptyHealth, parseHealth, updateHealth } from "./health.ts";
import { mkdir, open, readFile, rename, rm, unlink } from "node:fs/promises";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

const ZERO = 0,
  LOCK_WAIT = 25,
  IO_TIMEOUT = 2000,
  /**
   * Recognizes a specific filesystem error without suppressing other failures.
   * @param {unknown} error Failure.
   * @param {string} code Expected code.
   * @returns {boolean} Match.
   */
  hasCode = (error: unknown, code: string): boolean =>
    error instanceof Error && "code" in error && error.code === code,
  /**
   * Reads optional JSON source.
   * @param {string} file Path.
   * @returns {Promise<string | undefined>} Source, absent only for missing files.
   */
  readOptional = async (file: string): Promise<string | undefined> => {
    try {
      return await readFile(file, "utf8");
    } catch (error) {
      if (hasCode(error, "ENOENT")) {
        return undefined;
      }
      throw error;
    }
  },
  /**
   * Sleeps without retaining an abort listener after completion.
   * @param {number} delay Milliseconds.
   * @param {AbortSignal | undefined} signal Cancellation.
   * @returns {Promise<void>} Completion.
   */
  wait = async (delay: number, signal?: AbortSignal): Promise<void> => {
    await setTimeout(Math.max(ZERO, delay), undefined, { signal });
  },
  /**
   * Acquires an exclusive host lock with a bounded wait.
   * @param {string} file Lock path.
   * @param {number} deadline Deadline.
   * @returns {Promise<Awaited<ReturnType<typeof open>>>} Owned handle.
   */
  acquire = async (file: string, deadline: number): Promise<Awaited<ReturnType<typeof open>>> => {
    try {
      return await open(file, "wx");
    } catch (error) {
      if (!hasCode(error, "EEXIST") || Date.now() >= deadline) {
        throw error;
      }
      await wait(LOCK_WAIT);
      return acquire(file, deadline);
    }
  };

/** Atomic host-local circuit and cooldown persistence. */
class Store {
  readonly #directory: string;
  readonly #file: string;

  /**
   * Selects the agent state directory.
   * @param {string} directory State root.
   */
  public constructor(directory = path.join(getAgentDir(), "state", "pi-tiers")) {
    this.#directory = directory;
    this.#file = path.join(directory, "state.json");
  }

  /**
   * Reads an atomic state snapshot.
   * @returns {Promise<Health>} Current shared health.
   */
  public async read(): Promise<Health> {
    const source = await readOptional(this.#file);
    return source === undefined ? emptyHealth() : parseHealth(source);
  }

  /**
   * Writes and syncs a temporary snapshot before atomic replacement.
   * @param {Health} health New state.
   * @returns {Promise<void>} Durable replacement.
   */
  async #write(health: Health): Promise<void> {
    const temporary = path.join(this.#directory, `${crypto.randomUUID()}.tmp`),
      file = await open(temporary, "wx");
    try {
      await file.writeFile(JSON.stringify(health));
      await file.sync();
      await rename(temporary, this.#file);
    } finally {
      await file.close();
      await rm(temporary, { force: true });
    }
  }

  /**
   * Holds the lock across the entire read-modify-rename transaction.
   * @param {Change} change Failure to record.
   * @returns {Promise<void>} Durable completion.
   */
  public async change(change: Change): Promise<void> {
    await mkdir(this.#directory, { recursive: true });
    const lockPath = path.join(this.#directory, "lock"),
      lock = await acquire(lockPath, Date.now() + IO_TIMEOUT);
    try {
      await this.#write(updateHealth(await this.read(), change));
    } finally {
      await lock.close();
      await unlink(lockPath);
    }
  }
}

/**
 * Reads the user-owned tier map.
 * @returns {Promise<string | undefined>} Config source.
 */
const readConfig = async (): Promise<string | undefined> =>
  readOptional(path.join(getAgentDir(), "tiers.json"));

export { readConfig, Store, wait };
