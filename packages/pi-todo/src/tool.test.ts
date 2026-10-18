import { describe, expect, it } from "vitest";
import { STATE_ENTRY } from "./state.ts";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { TodoSession } from "./tool.ts";
import { runTodo } from "./tool.ts";
import { workUnitGuidance } from "./guidance.ts";

interface Fake {
  readonly entries: readonly SessionEntry[];
  readonly session: TodoSession;
}

/**
 * A custom entry as pi's `appendEntry` stores it.
 * @param {unknown} data The entry data.
 * @returns {SessionEntry} The entry.
 */
const entry = (data: unknown): SessionEntry => ({
    customType: STATE_ENTRY,
    data,
    id: crypto.randomUUID(),
    parentId: null,
    timestamp: "2026-10-16T00:00:00.000Z",
    type: "custom",
  }),
  /**
   * A session over an in-memory branch that `append` extends, as pi does.
   * @param {readonly unknown[]} snapshots Snapshots already on the branch.
   * @returns {Fake} The session and a view of its branch.
   */
  fake = (snapshots: readonly unknown[]): Fake => {
    const branch = snapshots.map((data) => entry(data));
    return {
      entries: branch,
      session: {
        append: (_customType, list) => {
          branch.push(entry(list));
        },
        branch: () => branch,
      },
    };
  },
  summary = "Todo list: 0/2 completed\n[ ] Read\n[ ] Fix";

describe("todo init", () => {
  it("stores the list", { timeout: 5000 }, () => {
    expect.hasAssertions();
    const { entries, session } = fake([]);
    expect(runTodo({ items: ["Read", "Fix"], op: "init" }, session).content).toStrictEqual([
      { text: `${summary}\n\n${workUnitGuidance}`, type: "text" },
    ]);
    expect(entries).toMatchObject([
      {
        customType: STATE_ENTRY,
        data: {
          tasks: [
            { content: "Read", status: "pending", subtasks: [] },
            { content: "Fix", status: "pending", subtasks: [] },
          ],
        },
      },
    ]);
  });

  it("throws on a rejected list and stores nothing", { timeout: 5000 }, () => {
    expect.hasAssertions();
    const { entries, session } = fake([]);
    expect(() => runTodo({ items: ["a", "a"], op: "init" }, session)).toThrow(
      'Duplicate task "a" in list',
    );
    expect(entries).toStrictEqual([]);
  });
});

describe("todo changes", () => {
  it.each([
    { op: "start", status: "in_progress", task: "Fix" },
    { op: "done", status: "completed", task: "Fix" },
    { op: "drop", status: "abandoned", task: "Fix" },
  ] as const)("persists $op and its exact snapshot", { timeout: 5000 }, ({ op, status, task }) => {
    expect.hasAssertions();
    const { entries, session } = fake([
        {
          tasks: [
            { content: "Read", status: "in_progress" },
            { content: "Fix", status: "pending" },
          ],
        },
      ]),
      result = runTodo({ op, task }, session);
    expect(result.details.tasks).toContainEqual({ content: task, status, subtasks: [] });
    expect(entries.toReversed().find((stored) => stored.type === "custom")).toMatchObject({
      data: result.details,
    });
  });

  it("appends atomically without activation", { timeout: 5000 }, () => {
    expect.hasAssertions();
    const { entries, session } = fake([{ tasks: [{ content: "Read", status: "completed" }] }]),
      result = runTodo({ items: ["Fix"], op: "append" }, session);
    expect(result.details.tasks).toContainEqual({
      content: "Fix",
      status: "pending",
      subtasks: [],
    });
    expect(() => runTodo({ items: ["New", "Fix"], op: "append" }, session)).toThrow("Duplicate");
    expect(entries).toMatchObject([{ customType: STATE_ENTRY }, { customType: STATE_ENTRY }]);
  });
});

describe("hierarchical tool persistence", () => {
  it("uses parent-scoped targets and never stores a rejected change", { timeout: 5000 }, () => {
    expect.hasAssertions();
    const { entries, session } = fake([]);
    runTodo(
      { items: [{ content: "Outcome", subtasks: ["Build", "Verify"] }], op: "init" },
      session,
    );
    runTodo({ op: "start", parent: "Outcome", task: "Build" }, session);
    const before = [...entries];
    expect(() => runTodo({ op: "done", task: "Outcome" }, session)).toThrow("open subtasks");
    expect(() =>
      runTodo({ items: ["New", "Build"], op: "append", parent: "Outcome" }, session),
    ).toThrow("Duplicate");
    expect(() =>
      runTodo(
        { items: [{ content: "Nested", subtasks: [] }], op: "append", parent: "Outcome" },
        session,
      ),
    ).toThrow("Invalid arguments");
    expect(entries).toStrictEqual(before);
    expect(runTodo({ op: "view" }, session).content).toStrictEqual([
      {
        text: "Todo list: 0/1 completed outcomes; 0/2 subtasks completed\n[/] Outcome\n  [/] Build\n  [ ] Verify",
        type: "text",
      },
    ]);
  });
});

describe("todo view", () => {
  it("reads the latest list back from the branch", { timeout: 5000 }, () => {
    expect.hasAssertions();
    const { session } = fake([{ tasks: [] }]);
    runTodo({ items: ["Read", "Fix"], op: "init" }, session);
    expect(runTodo({ op: "view" }, session).content).toStrictEqual([
      { text: summary, type: "text" },
    ]);
  });

  it("shows an empty list for a branch with no list", { timeout: 5000 }, () => {
    expect.hasAssertions();
    expect(runTodo({ op: "view" }, fake([]).session).content).toStrictEqual([
      { text: "Todo list is empty.", type: "text" },
    ]);
  });

  it("throws on a damaged snapshot instead of rendering", { timeout: 5000 }, () => {
    expect.hasAssertions();
    const { session } = fake([{ tasks: [{ content: "a", status: "lost" }] }]);
    expect(() => runTodo({ op: "view" }, session)).toThrow("unknown variant `lost`");
  });
});
