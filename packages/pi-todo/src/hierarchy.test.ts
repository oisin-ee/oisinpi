import type { Request, TodoList } from "./wasm.ts";
import { apply, init, parse, view, widget } from "./wasm.ts";
import { describe, expect, it } from "vitest";
import { TodoView } from "./embedded.ts";
import { display } from "./display.ts";
import { runTodo } from "./tool.ts";

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

describe("strict operation input", () => {
  it.each([
    { op: "view", unexpected: true },
    { items: [{ content: "Root", subtasks: [], unexpected: true }], op: "init" },
  ] as const)("rejects unknown fields without persisting %j", { timeout: 5000 }, (params) => {
    expect.hasAssertions();
    const stored: TodoList[] = [];
    expect(() =>
      runTodo(params, {
        append: (_kind, list) => {
          stored.push(list);
        },
        branch: () => [],
      }),
    ).toThrow(/unknown field|untagged enum Item/u);
    expect(stored).toStrictEqual([]);
  });
});

describe("strict WASM operation input", () => {
  it("rejects unknown request and outcome keys directly in WASM", { timeout: 5000 }, () => {
    expect.hasAssertions();
    const request: Request = {
        items: undefined,
        op: "view",
        parent: undefined,
        task: undefined,
      },
      invalidRequest = Object.assign({}, request, { unexpected: true }),
      invalidOutcome = Object.assign({}, outcome, { unexpected: true });
    expect(() => apply(create(), invalidRequest)).toThrow("unknown field `unexpected`");
    expect(() =>
      apply(
        create(),
        Object.assign({}, request, {
          items: [invalidOutcome],
          op: "init" as const,
        }),
      ),
    ).toThrow("untagged enum Item");
  });

  it(
    "rejects duplicate request keys even when the first value is absent",
    { timeout: 5000 },
    () => {
      expect.hasAssertions();
      const request = {
        items: undefined,
        op: "view" as const,
        parent: undefined,
        task: undefined,
        [Symbol.iterator]: (): IterableIterator<unknown> =>
          [
            ["op", "view"],
            ["task", undefined],
            ["task", undefined],
          ].values(),
      };
      expect(() => apply(create(), request)).toThrow("duplicate field `task`");
    },
  );
});

// Iterable pairs preserve duplicate keys that ordinary JavaScript objects cannot represent.
describe("duplicate snapshot keys", () => {
  it.each([
    {
      tasks: [],
      [Symbol.iterator]: (): IterableIterator<unknown> =>
        [
          ["tasks", []],
          ["tasks", []],
        ].values(),
    },
    {
      tasks: [
        [
          ["content", "Root"],
          ["content", "Root"],
          ["status", "pending"],
        ],
      ],
    },
    {
      tasks: [
        {
          content: "Root",
          status: "pending",
          subtasks: [
            [
              ["content", "Child"],
              ["status", "pending"],
              ["status", "pending"],
            ],
          ],
        },
      ],
    },
  ])("rejects repeated map entries %j", { timeout: 5000 }, (snapshot: unknown) => {
    expect.hasAssertions();
    expect(() => parse(snapshot)).toThrow("duplicate field");
  });
});

describe("snapshot validation", () => {
  it("enumerates unknown list keys through the real WASM map visitor", { timeout: 5000 }, () => {
    expect.hasAssertions();
    expect(() => parse({ tasks: [], unexpected: true })).toThrow("unknown field `unexpected`");
  });

  it("reads old snapshots without normalization", { timeout: 5000 }, () => {
    expect.hasAssertions();
    expect(parse({ tasks: [{ content: "Old", status: "in_progress" }] })).toStrictEqual({
      tasks: [{ content: "Old", status: "in_progress", subtasks: [] }],
    });
  });

  it.each([
    { tasks: [], unexpected: true },
    { tasks: [{ content: "Root", status: "pending", unexpected: true }] },
    {
      tasks: [
        {
          content: "Root",
          status: "pending",
          subtasks: [{ content: "Child", status: "pending", unexpected: true }],
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
    expect(() => parse(snapshot)).toThrow(/Missing|Duplicate|Invalid|unknown field/u);
  });
});
