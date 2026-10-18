import type { Theme } from "@earendil-works/pi-coding-agent";
import type { TodoList } from "./wasm.ts";
import { TodoView } from "./embedded.ts";
import { view } from "./wasm.ts";

/** Host-owned layout and rendering services for an inline todo view. */
interface ViewHost {
  readonly theme: Readonly<Pick<Theme, "fg" | "bold">>;
  readonly height: () => number;
  readonly requestRender: () => void;
}

/** A provider-owned view. The host forwards updates without interpreting state. */
interface HostedView {
  readonly render: (width: number) => string[];
  readonly handleInput: (input: string) => void;
  readonly invalidate: () => void;
  readonly update: (state: unknown) => void;
  readonly dispose: () => void;
}

/** Transient presentation data, never persisted in a session entry. */
interface TodoDisplay {
  readonly empty: boolean;
  readonly summary: string;
  readonly current: string;
  readonly text: string;
  readonly state: unknown;
  readonly createView: (host: ViewHost) => HostedView;
}

const emptyCount = 0,
  headerIndex = 0,

/**
 * Projects the core's summary and supplies its reusable renderer.
 * @param {TodoList} list The validated current branch snapshot.
 * @returns {TodoDisplay} An in-process presentation capability.
 */
display = (list: TodoList): TodoDisplay => {
  const text = view(list),
    current =
      list.tasks.find((task) => task.status === "in_progress") ??
      list.tasks.find((task) => task.status === "pending");
  return {
    createView: (host) => new TodoView(list, host),
    current: current?.content ?? "",
    empty: list.tasks.length === emptyCount,
    state: list,
    summary: text.split("\n").at(headerIndex) ?? "",
    text,
  };
};

export { display };
export type { HostedView, TodoDisplay, ViewHost };
