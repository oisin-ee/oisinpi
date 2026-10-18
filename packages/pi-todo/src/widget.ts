import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import type { WidgetKind, WidgetRow } from "./wasm.ts";
import { Text, truncateToWidth } from "@earendil-works/pi-tui";

const TODO_SHORTCUT = "alt+t",
  colors: Readonly<Record<WidgetKind, ThemeColor>> = {
    active: "accent",
    done: "success",
    dropped: "dim",
    heading: "muted",
    summary: "muted",
    upcoming: "text",
  };

/** The presentation-only component; task state stays on the session branch. */
class TodoWidget {
  readonly #rows: readonly Readonly<WidgetRow>[];
  readonly #expanded: boolean;
  readonly #theme: Readonly<Pick<Theme, "fg" | "bold">>;

  /**
   * Retains unstyled rows so each render uses the current theme.
   * @param {readonly Readonly<WidgetRow>[]} rows Rust-owned status groups.
   * @param {boolean} expanded Whether secondary groups are visible.
   * @param {Readonly<Pick<Theme, "fg" | "bold">>} theme Pi theme helpers.
   */
  constructor(
    rows: readonly Readonly<WidgetRow>[],
    expanded: boolean,
    theme: Readonly<Pick<Theme, "fg" | "bold">>,
  ) {
    this.#rows = rows;
    this.#expanded = expanded;
    this.#theme = theme;
  }

  /** There is no cached layout or styled text to discard. */
  invalidate(): void {
    // Text and semantic colors are rebuilt for the current width and theme.
  }

  /**
   * Wraps all task text with Pi's native terminal component.
   * @param {number} width Available terminal columns.
   * @returns {string[]} Width-bounded, themed terminal lines.
   */
  render(width: number): string[] {
    const lines = this.#rows.map((row) => {
        const text = this.#theme.fg(colors[row.kind], row.text);
        return row.kind === "active" ? this.#theme.bold(text) : text;
      }),
      action = this.#expanded ? "collapse" : "upcoming / done";
    lines.push(this.#theme.fg("dim", `Alt+T · ${action}`));
    return new Text(lines.join("\n"), 1, 0)
      .render(width)
      .map((line) => truncateToWidth(line, width));
  }
}

export { TODO_SHORTCUT, TodoWidget };
