/*
 * Loads the Rust core. The `wasm-bindgen --target web` loader fetches its
 * `.wasm` by URL, and Node's fetch rejects `file:` URLs, so the bytes are read
 * from disk and instantiated synchronously, as pi-mcp-adapter does
 * (`mcp-script-wasm.ts`). The extension factory is synchronous, so the core
 * must be ready before it returns. An importer of this module runs after this
 * body, so the re-exports below are always initialized.
 */
import { initSync } from "./generated/todo_core.js";
import { readFileSync } from "node:fs";

initSync({
  module: readFileSync(new URL("generated/todo_core_bg.wasm", import.meta.url)),
});

export {
  apply,
  completion_reminder as completionReminder,
  init,
  parse,
  view,
  widget,
} from "./generated/todo_core.js";
export type {
  Operation,
  ReminderFact,
  Request,
  Status,
  Task,
  TodoList,
  WidgetKind,
  WidgetRow,
} from "./generated/todo_core.js";
