import { Text, truncateToWidth } from "@earendil-works/pi-tui";
import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import type { WidgetKind, WidgetRow } from "./wasm.ts";

const TODO_SHORTCUT = "alt+t",
  horizontalPadding = 1,
  verticalPadding = 0,
  colors: Readonly<Record<WidgetKind, ThemeColor>> = {
    active: "accent",
    done: "success",
    dropped: "dim",
    heading: "muted",
    summary: "muted",
    upcoming: "text",
  };

/** The presentation-only component; task state stays on the session branch. */
class TodoWidget extends Text {
  readonly #rows: readonly Readonly<WidgetRow>[];
  readonly #expanded: boolean;
  readonly #theme: Readonly<Pick<Theme, "fg" | "bold">>;

  /**
   * Retains unstyled rows so each render uses the current theme.
   * @param {readonly Readonly<WidgetRow>[]} rows Rust-owned status groups.
   * @param {boolean} expanded Whether secondary groups are visible.
   * @param {Readonly<Pick<Theme, "fg" | "bold">>} theme Pi theme helpers.
   */
  public constructor(
    rows: readonly Readonly<WidgetRow>[],
    expanded: boolean,
    theme: Readonly<Pick<Theme, "fg" | "bold">>,
  ) {
    super("", horizontalPadding, verticalPadding);
    this.#rows = rows;
    this.#expanded = expanded;
    this.#theme = theme;
  }

  /**
   * Wraps all task text with Pi's native terminal component.
   * @param {number} width Available terminal columns.
   * @returns {string[]} Width-bounded, themed terminal lines.
   */
  public override render(width: number): string[] {
    const lines = this.#rows.map((row) => {
        const text = this.#theme.fg(colors[row.kind], row.text);
        return row.kind === "active" ? this.#theme.bold(text) : text;
      }),
      action = this.#expanded ? "collapse" : "upcoming / done";
    lines.push(this.#theme.fg("dim", `Alt+T · ${action}`));
    this.setText(lines.join("\n"));
    return super.render(width).map((line) => truncateToWidth(line, width));
  }
}

export { TODO_SHORTCUT, TodoWidget };
