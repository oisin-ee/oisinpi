import type { Request, TodoList } from "./wasm.ts";
import { apply, init, parse, view, widget } from "./wasm.ts";
import { describe, expect, it } from "vitest";
import { TodoView } from "./embedded.ts";
import { display } from "./display.ts";

const width = 80,
  height = 30,
  outcome = { content: "Ship", subtasks: ["Implement and test", "Integrate and test"] },
  create = (): TodoList =>
    apply(init(["Old"]), {
      items: [outcome, "Docs"],
      op: "init",
      parent: undefined,
      task: undefined,
    }).list,
  host = {
    height: (): number => height,
    requestRender: (): void => {
      /* No terminal in this boundary test. */
    },
    theme: {
      bold: (text: string): string => text,
      fg: (_color: string, text: string): string => text,
    },
  },
  /**
   * Applies an exact child operation through the real WASM boundary.
   * @param {TodoList} list Current state.
   * @param {Request["op"]} op Child transition.
   * @param {string} task Exact child label.
   * @returns {TodoList} Updated state.
   */
  child = (list: TodoList, op: Request["op"], task: string): TodoList =>
    apply(list, { items: undefined, op, parent: "Ship", task }).list,
  active = (): TodoList =>
    child(child(create(), "start", "Implement and test"), "start", "Integrate and test"),
  ready = (): TodoList =>
    child(child(active(), "done", "Implement and test"), "drop", "Integrate and test");

describe("hierarchical WASM callers", () => {
  it("starts siblings in parallel through the shared renderer", { timeout: 5000 }, () => {
    expect.hasAssertions();
    const list = active(),
      component = new TodoView(list, host);
    expect(display(list).current).toContain("Ship → Implement and test");
    expect(display(list).current).toContain("Ship → Integrate and test");
    expect(component.render(width).join("\n")).toContain("  ● Implement and test");
    expect(() =>
      apply(list, { items: undefined, op: "done", parent: undefined, task: undefined }),
    ).toThrow("open subtasks");
    component.dispose();
  });

  it(
    "keeps a ready parent for explicit review and projects separate progress",
    { timeout: 5000 },
    () => {
      expect.hasAssertions();
      const list = ready(),
        component = new TodoView(active(), host);
      component.update(list);
      expect(component.render(width).join("\n")).toContain("Ready for review");
      expect(view(list)).toContain("0/2 completed outcomes; 1/2 subtasks completed");
      expect(widget(list, true)).toContainEqual({ kind: "done", text: "  ✓ Implement and test" });
      expect(
        apply(list, { items: undefined, op: "done", parent: undefined, task: "Ship" }).list.tasks,
      ).toMatchObject([
        { content: "Ship", status: "completed" },
        { content: "Docs", status: "pending" },
      ]);
      component.dispose();
    },
  );
});

describe("snapshot validation", () => {
  it("reads old snapshots without normalization", { timeout: 5000 }, () => {
    expect.hasAssertions();
    expect(parse({ tasks: [{ content: "Old", status: "in_progress" }] })).toStrictEqual({
      tasks: [{ content: "Old", status: "in_progress", subtasks: [] }],
    });
  });

  it.each([
    {
      tasks: [
        {
          content: "Closed",
          status: "completed",
          subtasks: [{ content: "Open", status: "in_progress" }],
        },
      ],
    },
    {
      tasks: [
        {
          content: "Dropped",
          status: "abandoned",
          subtasks: [{ content: "Open", status: "pending" }],
        },
      ],
    },
    { tasks: [{ content: " ", status: "pending" }] },
    {
      tasks: [
        { content: "Same", status: "pending" },
        { content: "Same", status: "completed" },
      ],
    },
    {
      tasks: [
        {
          content: "Root",
          status: "pending",
          subtasks: [{ content: "Child", status: "pending", subtasks: [] }],
        },
      ],
    },
  ])("rejects malformed state %j", { timeout: 5000 }, (snapshot: unknown) => {
    expect.hasAssertions();
    expect(() => parse(snapshot)).toThrow(/Missing|Duplicate|Invalid|open subtasks/u);
  });
});
