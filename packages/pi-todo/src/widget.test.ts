import { describe, expect, it, vi } from "vitest";
import { init, widget } from "./wasm.ts";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { TodoWidget } from "./widget.ts";

const theme = {
  bold: (text: string): string => `\u001b[1m${text}\u001b[22m`,
  fg: (_color: string, text: string): string => text,
};

describe("todo rendering", () => {
  it("renders active work and reveals grouped details only on expansion", { timeout: 5000 }, () => {
    expect.hasAssertions();
    const list = init(["Build the widget", "Check the layout"]),
      collapsed = new TodoWidget(widget(list, false) ?? [], false, theme),
      expanded = new TodoWidget(widget(list, true) ?? [], true, theme);
    expect(collapsed.render(80).map((line) => stripTerminalSequences(line).trimEnd())).toStrictEqual([
      " In progress · 1",
      " ● Build the widget",
      " Alt+T · upcoming / done",
    ]);
    expect(expanded.render(80).map(stripTerminalSequences).join("\n")).toContain("Upcoming · 1");
    expect(expanded.render(80).map(stripTerminalSequences).join("\n")).toContain(
      "○ Check the layout",
    );
    expect(expanded.render(80).map(stripTerminalSequences).join("\n")).toContain(
      "Alt+T · collapse",
    );
  });

  it.each([1, 2, 12, 40, 100])(
    "fits wide characters and long labels into %i columns",
    { timeout: 5000 },
    (width) => {
      expect.hasAssertions();
      const content = "Review 日本語 tasks 👩‍💻 with a long label and café combining marks",
        component = new TodoWidget(widget(init([content]), false) ?? [], false, theme),
        lines = component.render(width);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.every((line) => visibleWidth(line) <= width)).toBe(true);
    },
  );

  it("reapplies theme tokens after invalidation", { timeout: 5000 }, () => {
    expect.hasAssertions();
    const fg = vi.fn(theme.fg),
      component = new TodoWidget(widget(init(["Active"]), false) ?? [], false, {
        bold: theme.bold,
        fg,
      });
    component.render(80);
    expect(fg).toHaveBeenCalledWith("accent", "● Active");
    fg.mockClear();
    component.invalidate();
    component.render(40);
    expect(fg).toHaveBeenCalledWith("accent", "● Active");
    expect(fg).toHaveBeenCalledWith("dim", "Alt+T · upcoming / done");
  });
});
