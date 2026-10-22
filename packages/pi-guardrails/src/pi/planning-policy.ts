/*
 * The read-only policy for planning models. A planning model may read the
 * repository and the tools that report on it; it may not change anything.
 *
 * The model identity comes from the context of the call, read fresh for each
 * tool call: the session can switch models between calls.
 *
 * Every trusted name here is exact. A tool whose name only ends with a trusted
 * name, such as `dangerous_read` or `mcp__untrusted__read`, is a different
 * tool, so the policy blocks it. The same rule holds for the executable of a
 * read command: only `pwd`, `ls`, `rg`, `grep`, `find`, and `git` are reads,
 * not every path whose basename is one of them.
 */
import { isRecord } from "../common.ts";
import type { Command } from "../common.ts";
import { literalShellCalls } from "../shell-parser.ts";

/** The provider of the planning models. */
const PLANNING_PROVIDER = "tier",
  /** The model ids that plan. */
  PLANNING_MODEL_IDS: ReadonlySet<string> = new Set(["plan-claude", "plan-gpt"]);

/** The model of a tool call, as the context reports it. */
interface ModelIdentity {
  readonly provider?: string;
  readonly id?: string;
}

/**
 * Whether the model of a tool call is a planning model.
 * @param {ModelIdentity | undefined} model The current model.
 * @returns {boolean} True for a planning model.
 */
function isPlanningModel(model: ModelIdentity | undefined): boolean {
  return (
    model?.provider === PLANNING_PROVIDER &&
    model.id !== undefined &&
    PLANNING_MODEL_IDS.has(model.id)
  );
}

/** The tools that only report on the repository, by exact name. */
const READ_TOOLS: ReadonlySet<string> = new Set([
    "read",
    "ls",
    "find",
    "grep",
    "hypa_read",
    "hypa_ls",
    "hypa_find",
    "hypa_grep",
    "web_search",
    "web_fetch",
    "lsp_diagnostics",
    "ctx_search",
    "ctx_stats",
    "mcp__context_mode__ctx_search",
    "mcp__context_mode__ctx_stats",
    "hindsight_search_knowledge_pages",
    "hindsight_list_knowledge_pages",
    "hindsight_read_knowledge_page",
    "hindsight_reflect",
    "hindsight_sync_status",
    "hindsight_diagnose",
    "mcp__codebase_memory__search_graph",
    "mcp__codebase_memory__get_code_snippet",
    "mcp__codebase_memory__trace_path",
    "mcp__codebase_memory__detect_changes",
  ]),
  /** The workflow controls a planning model keeps. */
  WORKFLOW_TOOLS: ReadonlySet<string> = new Set([
    "todo",
    "ask",
    "interview",
    "tool_search",
    "codemode",
  ]),
  /** The Dogsled tools a planning model may use, by full name. */
  DOGSLED_TOOLS: ReadonlySet<string> = new Set([
    "mcp__dogsled__read",
    "mcp__dogsled__status",
    "mcp__dogsled__inbox",
    "mcp__dogsled__send",
    "mcp__dogsled__done",
  ]),
  /** The shell tools a planning model may use, by exact name. */
  SHELL_TOOLS: ReadonlySet<string> = new Set([
    "bash",
    "shell",
    "hypa_shell",
    "ctx_execute",
    "ctx_batch_execute",
    "ctx_execute_file",
    "mcp__context_mode__ctx_execute",
    "mcp__context_mode__ctx_batch_execute",
    "mcp__context_mode__ctx_execute_file",
    "mcp__gateway__keen_bash",
  ]),
  /** The shell tools that take a list of commands. */
  BATCH_SHELL_TOOLS: ReadonlySet<string> = new Set([
    "ctx_batch_execute",
    "mcp__context_mode__ctx_batch_execute",
  ]),
  /** The shell tools that take a script in a language. */
  CODE_SHELL_TOOLS: ReadonlySet<string> = new Set([
    "ctx_execute",
    "ctx_execute_file",
    "mcp__context_mode__ctx_execute",
    "mcp__context_mode__ctx_execute_file",
  ]);

const READ_MESSAGE =
  "planning-readonly: a planning model may only read. Allowed tools: read, ls, find, grep, " +
  "hypa_read/hypa_ls/hypa_find/hypa_grep, web_search, web_fetch, lsp_diagnostics, ctx_search, " +
  "ctx_stats, the hindsight and codebase_memory read tools, todo, ask, interview, tool_search, " +
  "codemode, and the Dogsled read/status/inbox/send/done tools. A planning model may not write, " +
  "edit, or run commands that change anything.";

/**
 * The message for a tool a planning model may not call.
 * @param {string} toolName The tool name.
 * @returns {string} The block message.
 */
function toolMessage(toolName: string): string {
  return `${READ_MESSAGE} Blocked tool: ${toolName}.`;
}

/**
 * Whether a tool call is a bound Dogsled spawn, which a planning model may use
 * to start a bound unit.
 * @param {Readonly<Record<string, unknown>>} input The tool input.
 * @returns {boolean} True for a spawn with a unit id.
 */
function isBoundSpawn(input: Readonly<Record<string, unknown>>): boolean {
  const unit = input["unit"];
  if (!isRecord(unit)) {
    return false;
  }
  const id = unit["id"];
  return typeof id === "string" && id.length > 0;
}

/**
 * The value of a text field.
 * @param {unknown} value The field value.
 * @returns {string | undefined} The text, when the value is a string.
 */
function textOf(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * The command text of a shell tool input.
 * @param {Readonly<Record<string, unknown>>} input The tool input.
 * @returns {string | null} The command, or null when the input carries none.
 */
function commandTextOf(input: Readonly<Record<string, unknown>>): string | null {
  return textOf(input["command"]) ?? textOf(input["cmd"]) ?? textOf(input["commandText"]) ?? null;
}

/**
 * The argument list of a raw command. The runner splits a raw command on
 * whitespace and does not parse quotes, so the argv holds the words between
 * the spaces.
 * @param {string} text The raw command.
 * @returns {string[]} The words of the argument list.
 */
function rawWords(text: string): string[] {
  return text.split(/\s+/u).filter((word) => word.length > 0);
}

/** The options of a command, and the values its options accept. */
interface OptionTables {
  /** The options that take no value. */
  readonly flags: ReadonlySet<string>;
  /** The options that take a value. */
  readonly valueFlags: ReadonlySet<string>;
  /** The values each option accepts, when it accepts only some. */
  readonly enumValues: Readonly<Record<string, ReadonlySet<string>>>;
}

/** The options of each read command that stay read-only. */
const READ_COMMAND_FLAGS: Readonly<Record<string, ReadonlySet<string>>> = {
    pwd: new Set(["-L", "-P"]),
    ls: new Set([
      "-1",
      "-a",
      "-A",
      "-d",
      "-F",
      "-h",
      "-l",
      "-r",
      "-R",
      "-S",
      "-t",
      "--all",
      "--almost-all",
      "--human-readable",
      "--long",
    ]),
    rg: new Set([
      "-c",
      "-C",
      "-e",
      "-F",
      "-g",
      "-i",
      "-l",
      "-n",
      "-r",
      "-s",
      "-v",
      "-w",
      "--count",
      "--files-with-matches",
      "--fixed-strings",
      "--ignore-case",
      "--line-number",
      "--no-heading",
      "--no-ignore-case",
      "--word-regexp",
    ]),
    grep: new Set([
      "-A",
      "-B",
      "-C",
      "-c",
      "-e",
      "-E",
      "-F",
      "-i",
      "-l",
      "-n",
      "-o",
      "-r",
      "-s",
      "-v",
      "-w",
      "--count",
      "--files-with-matches",
      "--ignore-case",
      "--line-number",
      "--recursive",
      "--word-regexp",
    ]),
    find: new Set([
      "-E",
      "-H",
      "-L",
      "-name",
      "-iname",
      "-iregex",
      "-maxdepth",
      "-mindepth",
      "-newer",
      "-not",
      "-path",
      "-print",
      "-printf",
      "-regex",
      "-type",
    ]),
  },
  /** The options that take a value. */
  READ_COMMAND_VALUE_FLAGS: Readonly<Record<string, ReadonlySet<string>>> = {
    ls: new Set(["--color", "--time-style"]),
    rg: new Set(["-C", "-e", "-g", "--color", "--context", "--glob", "--max-count"]),
    grep: new Set(["-A", "-B", "-C", "-e", "--color", "--context"]),
    find: new Set([
      "-name",
      "-iname",
      "-iregex",
      "-maxdepth",
      "-mindepth",
      "-newer",
      "-path",
      "-regex",
      "-type",
    ]),
  },
  /** The values each read option accepts, when it accepts only some. */
  READ_COMMAND_ENUM_VALUES: Readonly<
    Record<string, Readonly<Record<string, ReadonlySet<string>>>>
  > = {
    ls: {
      "--color": new Set(["always", "auto", "never"]),
      "--time-style": new Set(["long-iso"]),
    },
    rg: { "--color": new Set(["never"]) },
    grep: { "--color": new Set(["never"]) },
  },
  /** The find options that change the filesystem. */
  FIND_MUTATIONS: ReadonlySet<string> = new Set([
    "-delete",
    "-exec",
    "-execdir",
    "-fls",
    "-fprint",
    "-fprintf",
    "-ok",
    "-okdir",
  ]),
  /** The executables a planning model may run. */
  READ_COMMANDS: ReadonlySet<string> = new Set(["pwd", "ls", "rg", "grep", "find", "git"]),
  /** The git subcommands a planning model may run. */
  GIT_READ_SUBCOMMANDS: ReadonlySet<string> = new Set([
    "diff",
    "log",
    "rev-parse",
    "show",
    "status",
  ]),
  /** The git global options a planning model may use. */
  GIT_GLOBAL_FLAGS: ReadonlySet<string> = new Set(["--no-pager", "--literal-pathspecs"]),
  /** The git global options that take a value. */
  GIT_GLOBAL_VALUE_FLAGS: ReadonlySet<string> = new Set(["-C", "--git-dir", "--work-tree"]),
  /** The git options of each read subcommand. */
  GIT_SUBCOMMAND_FLAGS: Readonly<Record<string, ReadonlySet<string>>> = {
    status: new Set([
      "--branch",
      "--ignored",
      "--long",
      "--porcelain",
      "--short",
      "-b",
      "-l",
      "-s",
      "-uno",
      "-unormal",
      "-uall",
    ]),
    diff: new Set([
      "--cached",
      "--name-only",
      "--name-status",
      "--no-ext-diff",
      "--no-textconv",
      "--stat",
      "--staged",
      "-M",
    ]),
    log: new Set([
      "--abbrev-commit",
      "--decorate",
      "--graph",
      "--no-color",
      "--no-ext-diff",
      "--no-textconv",
      "--oneline",
      "--name-only",
      "--name-status",
      "--patch",
      "--stat",
      "-p",
    ]),
    show: new Set([
      "--abbrev-commit",
      "--no-color",
      "--no-ext-diff",
      "--no-textconv",
      "--oneline",
      "--stat",
    ]),
    "rev-parse": new Set([
      "--abbrev-ref",
      "--git-dir",
      "--is-inside-work-tree",
      "--quiet",
      "--short",
      "--show-prefix",
      "--show-toplevel",
      "--symbolic-full-name",
    ]),
  },
  /** The git options that take a value. */
  GIT_SUBCOMMAND_VALUE_FLAGS: Readonly<Record<string, ReadonlySet<string>>> = {
    status: new Set(["--untracked-files"]),
    diff: new Set(["--color"]),
    log: new Set(["-n", "--max-count", "--color"]),
    show: new Set(["--color"]),
    "rev-parse": new Set(["--verify"]),
  },
  /** The values each git option accepts, when it accepts only some. */
  GIT_SUBCOMMAND_ENUM_VALUES: Readonly<
    Record<string, Readonly<Record<string, ReadonlySet<string>>>>
  > = {
    status: { "--untracked-files": new Set(["all", "normal", "no"]) },
    diff: { "--color": new Set(["never"]) },
    log: { "--color": new Set(["never"]) },
    show: { "--color": new Set(["never"]) },
  };

const EXT_DIFF_MESSAGE =
  "planning-readonly: blocked a git command that can run an external diff driver or a textconv " +
  "filter. Add --no-ext-diff --no-textconv and run it again.";

/**
 * Whether a word is an option of a command, so it cannot be the value of the
 * option before it.
 * @param {string} word The word.
 * @param {OptionTables} tables The options of the command.
 * @returns {boolean} True for an option word.
 */
function isOptionWord(word: string, tables: OptionTables): boolean {
  if (!word.startsWith("-") || word === "-") {
    return false;
  }
  if (tables.flags.has(word) || tables.valueFlags.has(word)) {
    return true;
  }
  if (word.startsWith("--") && word.includes("=")) {
    const name = word.slice(0, word.indexOf("="));
    return tables.flags.has(name) || tables.valueFlags.has(name);
  }
  if (word.startsWith("--")) {
    return false;
  }
  for (const letter of word.slice(1)) {
    if (!tables.flags.has(`-${letter}`) && !tables.valueFlags.has(`-${letter}`)) {
      return false;
    }
  }
  return true;
}

/**
 * The block message for an option a planning model may not use.
 * @param {string} detail The option and its value, for the message.
 * @returns {string} The block message.
 */
function blockedOption(detail: string): string {
  return `planning-readonly: blocked ${detail}. A planning model may use only read-only options.`;
}

/**
 * The reason an option word is not allowed, or null when it is.
 * @param {readonly string[]} words The words of the call.
 * @param {number} index The index of the option.
 * @param {OptionTables} tables The options of the command.
 * @param {string} label The name of the command, for the message.
 * @returns {string | null} The block message.
 */
function optionReason(
  words: readonly string[],
  index: number,
  tables: OptionTables,
  label: string,
): string | null {
  const word = words[index] ?? "",
    { flags, valueFlags, enumValues } = tables,
    blocked = blockedOption,
    needsValue = (): string =>
      `planning-readonly: blocked the option ${word} of ${label}. The option needs a value.`;
  if (word === "--" || !word.startsWith("-") || word === "-") {
    return null;
  }
  const equals = word.indexOf("="),
    name = word.startsWith("--") && equals !== -1 ? word.slice(0, equals) : word,
    inline = word.startsWith("--") && equals !== -1 ? word.slice(equals + 1) : undefined;
  if (valueFlags.has(name)) {
    const allowed = enumValues[name];
    if (inline !== undefined) {
      return allowed !== undefined && !allowed.has(inline)
        ? blocked(`the option ${word} of ${label}`)
        : null;
    }
    const value = words[index + 1];
    if (value === undefined || value === "--" || isOptionWord(value, tables)) {
      return needsValue();
    }
    return allowed !== undefined && !allowed.has(value)
      ? blocked(`the option ${word} of ${label} with the value ${value}`)
      : null;
  }
  if (flags.has(name)) {
    return null;
  }
  if (word.startsWith("--")) {
    return blocked(`the option ${word} of ${label}`);
  }
  // A short cluster such as `-la` matches when every letter is a known option.
  const letters: string[] = [];
  for (const letter of word.slice(1)) {
    letters.push(`-${letter}`);
  }
  if (letters.length < 2) {
    return blocked(`the option ${word} of ${label}`);
  }
  for (const [position, letter] of letters.entries()) {
    if (flags.has(letter)) {
      continue;
    }
    // A letter that takes a value must be the last of the cluster, because it
    // takes the word that follows the cluster.
    if (valueFlags.has(letter) && position === letters.length - 1) {
      const value = words[index + 1];
      if (value === undefined || value === "--" || isOptionWord(value, tables)) {
        return needsValue();
      }
      continue;
    }
    return blocked(`the option ${word} of ${label}`);
  }
  return null;
}

/**
 * The number of words an option occupies, so the value of an option is not
 * read as an option itself.
 * @param {readonly string[]} words The words of the call.
 * @param {number} index The index of the option.
 * @param {OptionTables} tables The options of the command.
 * @returns {number} The number of words.
 */
function optionWidth(words: readonly string[], index: number, tables: OptionTables): number {
  const word = words[index] ?? "",
    name = word.startsWith("--") && word.includes("=") ? word.slice(0, word.indexOf("=")) : word;
  if (word.includes("=")) {
    return 1;
  }
  if (tables.valueFlags.has(name)) {
    const value = words[index + 1];
    return value === undefined || value === "--" || isOptionWord(value, tables) ? 1 : 2;
  }
  // A short cluster that ends in a letter that takes a value takes the word
  // that follows the cluster.
  if (word.startsWith("-") && !word.startsWith("--") && word.length > 1) {
    const last = `-${word.slice(-1)}`;
    if (tables.valueFlags.has(last)) {
      const value = words[index + 1];
      return value === undefined || value === "--" || isOptionWord(value, tables) ? 1 : 2;
    }
  }
  return 1;
}

/**
 * The reason a git command is not a read, or null when it is one.
 * @param {readonly string[]} words The words of the call, without `git`.
 * @returns {string | null} The block message.
 */
function gitReason(words: readonly string[]): string | null {
  const rest = [...words];
  while (rest.length > 0) {
    const word = rest[0] ?? "";
    if (GIT_GLOBAL_VALUE_FLAGS.has(word)) {
      const value = rest[1];
      if (value === undefined) {
        return `planning-readonly: blocked the git option ${word}. The option needs a value.`;
      }
      rest.splice(0, 2);
      continue;
    }
    if (GIT_GLOBAL_FLAGS.has(word)) {
      rest.shift();
      continue;
    }
    break;
  }
  const subcommand = rest.shift();
  if (subcommand === undefined || !GIT_READ_SUBCOMMANDS.has(subcommand)) {
    return (
      "planning-readonly: a planning model may only run git status, git diff, git log, git show, " +
      "and git rev-parse."
    );
  }
  const tables: OptionTables = {
    flags: GIT_SUBCOMMAND_FLAGS[subcommand] ?? new Set<string>(),
    valueFlags: GIT_SUBCOMMAND_VALUE_FLAGS[subcommand] ?? new Set<string>(),
    enumValues: GIT_SUBCOMMAND_ENUM_VALUES[subcommand] ?? {},
  };
  let noExtDiff = false,
    noTextconv = false;
  for (let index = 0; index < rest.length; index += 1) {
    const word = rest[index] ?? "";
    // After `--` every word is a path, not an option, so it cannot ask for a
    // safe diff driver.
    if (word === "--") {
      break;
    }
    if (subcommand === "log" && /^-\d+$/u.test(word)) {
      continue;
    }
    const reason = optionReason(rest, index, tables, `git ${subcommand}`);
    if (reason !== null) {
      return reason;
    }
    if (word === "--no-ext-diff") {
      noExtDiff = true;
    }
    if (word === "--no-textconv") {
      noTextconv = true;
    }
    index += optionWidth(rest, index, tables) - 1;
  }
  const patches = subcommand === "diff" || subcommand === "show",
    logsPatch = subcommand === "log" && rest.some((word) => word === "-p" || word === "--patch");
  if ((patches || logsPatch) && !(noExtDiff && noTextconv)) {
    return EXT_DIFF_MESSAGE;
  }
  return null;
}

/**
 * The reason a read command is not read-only, or null when it is one.
 * @param {readonly string[]} words The words of the call.
 * @returns {string | null} The block message.
 */
function readCommandReason(words: readonly string[]): string | null {
  const base = words[0] ?? "";
  if (!READ_COMMANDS.has(base)) {
    return (
      `planning-readonly: blocked the command ${base}. A planning model may only run pwd, ls, ` +
      "rg, grep, find, and read-only git commands."
    );
  }
  if (base === "git") {
    return gitReason(words.slice(1));
  }
  const tables: OptionTables = {
    flags: READ_COMMAND_FLAGS[base] ?? new Set<string>(),
    valueFlags: READ_COMMAND_VALUE_FLAGS[base] ?? new Set<string>(),
    enumValues: READ_COMMAND_ENUM_VALUES[base] ?? {},
  };
  for (let index = 1; index < words.length; index += 1) {
    const word = words[index] ?? "";
    if (base === "find" && FIND_MUTATIONS.has(word)) {
      return (
        `planning-readonly: blocked the find option ${word}. A planning model may only list ` +
        "files."
      );
    }
    const reason = optionReason(words, index, tables, base);
    if (reason !== null) {
      return reason;
    }
    index += optionWidth(words, index, tables) - 1;
  }
  return null;
}

/**
 * The reason a shell command is not read-only, or null when it is one.
 * @param {Command} command The shell text or an argument list.
 * @returns {string | null} The block message.
 */
function planningShellReason(command: Command): string | null {
  if (typeof command !== "string") {
    if (command.length === 0) {
      return "planning-readonly: blocked an empty shell command.";
    }
    return readCommandReason([...command]);
  }
  const calls = literalShellCalls(command);
  if (calls === null) {
    return (
      "planning-readonly: blocked a shell command that uses a redirect, an assignment, a " +
      "substitution, a glob, or other dynamic syntax. A planning model may only run plain " +
      "read-only commands."
    );
  }
  if (calls.length === 0) {
    return "planning-readonly: blocked an empty shell command.";
  }
  for (const words of calls) {
    if (words.length === 0) {
      return "planning-readonly: blocked an empty shell command.";
    }
    const reason = readCommandReason(words);
    if (reason !== null) {
      return reason;
    }
  }
  return null;
}

/**
 * The reason a shell tool call is not read-only, or null when it is one.
 * @param {string} toolName The tool name.
 * @param {Readonly<Record<string, unknown>>} input The tool input.
 * @returns {string | null} The block message.
 */
function planningShellToolReason(
  toolName: string,
  input: Readonly<Record<string, unknown>>,
): string | null {
  if (BATCH_SHELL_TOOLS.has(toolName)) {
    const commands = input["commands"];
    if (!Array.isArray(commands)) {
      return `planning-readonly: blocked ${toolName}. The commands must be a list.`;
    }
    for (const entry of commands) {
      if (!isRecord(entry)) {
        return `planning-readonly: blocked ${toolName}. A command of the batch is malformed.`;
      }
      const text = textOf(entry["command"]);
      if (text === undefined) {
        return `planning-readonly: blocked ${toolName}. A command of the batch has no command.`;
      }
      const reason = planningShellReason(text);
      if (reason !== null) {
        return reason;
      }
    }
    return null;
  }
  if (CODE_SHELL_TOOLS.has(toolName)) {
    if (input["language"] !== "shell") {
      return `planning-readonly: blocked ${toolName}. A planning model may only run shell code.`;
    }
    const code = textOf(input["code"]);
    if (code === undefined) {
      return `planning-readonly: blocked ${toolName}. The code is missing.`;
    }
    return planningShellReason(code);
  }
  const text = commandTextOf(input);
  if (text === null) {
    return `planning-readonly: blocked ${toolName}. The command is missing.`;
  }
  // A raw command runs without a shell, so the runner splits it on whitespace
  // and the words are the argument list.
  if (toolName === "hypa_shell" && input["raw"] === true) {
    return planningShellReason(rawWords(text));
  }
  return planningShellReason(text);
}

/**
 * The block message for a tool call a planning model may not make, or null
 * when the call is a read the policy allows.
 * @param {string} toolName The tool name.
 * @param {Readonly<Record<string, unknown>>} input The tool input.
 * @returns {string | null} The block message.
 */
function planningToolReason(
  toolName: string,
  input: Readonly<Record<string, unknown>>,
): string | null {
  if (WORKFLOW_TOOLS.has(toolName)) {
    return null;
  }
  if (DOGSLED_TOOLS.has(toolName)) {
    return null;
  }
  if (toolName === "mcp__dogsled__spawn") {
    return isBoundSpawn(input)
      ? null
      : "planning-readonly: blocked a Dogsled spawn without a bound unit. A planning model may " +
          "only spawn a bound unit by its id.";
  }
  if (READ_TOOLS.has(toolName)) {
    return null;
  }
  if (SHELL_TOOLS.has(toolName)) {
    return planningShellToolReason(toolName, input);
  }
  return toolMessage(toolName);
}

export { isPlanningModel, planningShellReason, planningToolReason, readCommandReason };
export type { ModelIdentity };
