/*
 * The read-only policy for planning models. A planning model may read the
 * repository and the tools that report on it; it may not change anything.
 *
 * The model identity comes from the context of the call, read fresh for each
 * tool call: the session can switch models between calls.
 */
import { commandName } from "../common.ts";
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

/** The tools that only report on the repository. */
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
    "hindsight_search_knowledge_pages",
    "hindsight_list_knowledge_pages",
    "hindsight_read_knowledge_page",
    "hindsight_reflect",
    "hindsight_sync_status",
    "hindsight_diagnose",
    "search_graph",
    "get_code_snippet",
    "trace_path",
    "detect_changes",
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
  /** The shell tools a planning model may use for a read. */
  PLANNING_SHELL_TOOLS: ReadonlySet<string> = new Set([
    "bash",
    "ctx_execute",
    "ctx_batch_execute",
    "ctx_execute_file",
    "hypa_shell",
    "shell",
  ]);

/**
 * The value of a text field.
 * @param {unknown} value The field value.
 * @returns {string | undefined} The text, when the value is a string.
 */
function textOf(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * The last segment of a tool name, so an MCP tool matches its plain name.
 * @param {string} name The tool name.
 * @returns {string} The last segment.
 */
function lastSegment(name: string): string {
  return name.split("__").at(-1) ?? name;
}

/**
 * Whether a tool name is one of `names`, allowing a namespace prefix.
 * @param {string} name The tool name.
 * @param {ReadonlySet<string>} names The plain tool names.
 * @returns {boolean} True for a match.
 */
function matchesTool(name: string, names: ReadonlySet<string>): boolean {
  if (names.has(name) || names.has(lastSegment(name))) {
    return true;
  }
  for (const candidate of names) {
    if (name.endsWith(`_${candidate}`)) {
      return true;
    }
  }
  return false;
}

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
  if (typeof unit !== "object" || unit === null) {
    return false;
  }
  const id = (unit as Record<string, unknown>)["id"];
  return typeof id === "string" && id.length > 0;
}

/**
 * The shell text of a tool input, for the tools that carry one.
 * @param {string} toolName The tool name.
 * @param {Readonly<Record<string, unknown>>} input The tool input.
 * @returns {string | null} The shell text, or null when the tool carries none.
 */
function shellTextOf(toolName: string, input: Readonly<Record<string, unknown>>): string | null {
  const name = lastSegment(toolName);
  if (name === "ctx_batch_execute") {
    const commands = input["commands"];
    if (!Array.isArray(commands)) {
      return null;
    }
    return commands
      .map((entry: unknown) =>
        typeof entry === "object" && entry !== null
          ? (textOf((entry as Record<string, unknown>)["command"]) ?? "")
          : "",
      )
      .join("\n");
  }
  if (name === "ctx_execute" || name === "ctx_execute_file") {
    return input["language"] === "shell" ? (textOf(input["code"]) ?? "") : null;
  }
  return textOf(input["command"]) ?? textOf(input["cmd"]) ?? textOf(input["commandText"]) ?? "";
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
      "--color=always",
      "--color=auto",
      "--color=never",
      "--human-readable",
      "--long",
      "--time-style=long-iso",
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
      "--color=never",
      "--context",
      "--count",
      "--files-with-matches",
      "--fixed-strings",
      "--glob",
      "--ignore-case",
      "--line-number",
      "--max-count",
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
      "--color=never",
      "--context",
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
    rg: new Set(["-C", "-e", "-g", "--context", "--glob", "--max-count"]),
    grep: new Set(["-A", "-B", "-C", "-e", "--context"]),
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
      "--untracked-files=all",
      "--untracked-files=normal",
      "--untracked-files=no",
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
      "--color=never",
    ]),
    log: new Set([
      "--abbrev-commit",
      "--decorate",
      "--graph",
      "--no-color",
      "--no-ext-diff",
      "--no-textconv",
      "--oneline",
      "-n",
      "--max-count",
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
      "--verify",
    ]),
  },
  /** The git options that take a value. */
  GIT_SUBCOMMAND_VALUE_FLAGS: Readonly<Record<string, ReadonlySet<string>>> = {
    status: new Set(["--untracked-files"]),
    log: new Set(["-n", "--max-count"]),
  };

const EXT_DIFF_MESSAGE =
  "planning-readonly: blocked a git command that can run an external diff driver or a textconv " +
  "filter. Add --no-ext-diff --no-textconv and run it again.";

/**
 * The reason a git command is not a read, or null when it is one.
 * @param {readonly string[]} words The words of the call.
 * @returns {string | null} The block message.
 */
function gitReason(words: readonly string[]): string | null {
  const rest = [...words];
  while (rest.length > 0) {
    const word = rest[0] ?? "";
    if (GIT_GLOBAL_VALUE_FLAGS.has(word)) {
      rest.splice(0, 2);
      continue;
    }
    if (GIT_GLOBAL_FLAGS.has(word) || word === "--no-pager") {
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
  const flags = GIT_SUBCOMMAND_FLAGS[subcommand] ?? new Set<string>(),
    valueFlags = GIT_SUBCOMMAND_VALUE_FLAGS[subcommand] ?? new Set<string>();
  let noExtDiff = false,
    noTextconv = false;
  for (let index = 0; index < rest.length; index += 1) {
    const word = rest[index] ?? "";
    if (subcommand === "log" && /^-\d+$/u.test(word)) {
      continue;
    }
    const match = matchOption(word, flags, valueFlags);
    if (match === "blocked") {
      return (
        `planning-readonly: blocked the git option ${word}. A planning model may use only ` +
        "read-only git options."
      );
    }
    if (match === "value" && !word.includes("=")) {
      index += 1;
    }
    if (word === "--no-ext-diff") {
      noExtDiff = true;
    }
    if (word === "--no-textconv") {
      noTextconv = true;
    }
  }
  const patches = subcommand === "diff" || subcommand === "show",
    logsPatch = subcommand === "log" && rest.some((word) => word === "-p" || word === "--patch");
  if ((patches || logsPatch) && !(noExtDiff && noTextconv)) {
    return EXT_DIFF_MESSAGE;
  }
  return null;
}

/** How an option word matches the known options. */
type OptionMatch = "ok" | "value" | "blocked";

/**
 * How an option word matches the known options of a command. A long option
 * matches by its name before `=`. A short cluster such as `-la` matches when
 * every letter is a known option.
 * @param {string} word The option word.
 * @param {ReadonlySet<string>} flags The options without a value.
 * @param {ReadonlySet<string>} valueFlags The options with a value.
 * @returns {OptionMatch} The match.
 */
function matchOption(
  word: string,
  flags: ReadonlySet<string>,
  valueFlags: ReadonlySet<string>,
): OptionMatch {
  if (!word.startsWith("-") || word === "-" || word === "--") {
    return "ok";
  }
  if (word.startsWith("--")) {
    const name = word.includes("=") ? word.slice(0, word.indexOf("=")) : word;
    if (valueFlags.has(name)) {
      return "value";
    }
    return flags.has(name) ? "ok" : "blocked";
  }
  if (valueFlags.has(word)) {
    return "value";
  }
  if (flags.has(word)) {
    return "ok";
  }
  const letters: string[] = [];
  for (const letter of word.slice(1)) {
    letters.push(`-${letter}`);
  }
  if (letters.length < 2 || letters.some((letter) => !flags.has(letter))) {
    return "blocked";
  }
  return "ok";
}

/**
 * The reason a read command is not read-only, or null when it is one.
 * @param {readonly string[]} words The words of the call.
 * @returns {string | null} The block message.
 */
function readCommandReason(words: readonly string[]): string | null {
  const base = commandName(words[0] ?? "");
  if (base === "git") {
    return gitReason(words.slice(1));
  }
  const flags = READ_COMMAND_FLAGS[base];
  if (flags === undefined) {
    return (
      `planning-readonly: blocked the command ${base}. A planning model may only run pwd, ls, ` +
      "rg, grep, find, and read-only git commands."
    );
  }
  const valueFlags = READ_COMMAND_VALUE_FLAGS[base] ?? new Set<string>();
  for (let index = 1; index < words.length; index += 1) {
    const word = words[index] ?? "";
    if (base === "find" && FIND_MUTATIONS.has(word)) {
      return (
        `planning-readonly: blocked the find option ${word}. A planning model may only list ` +
        "files."
      );
    }
    const match = matchOption(word, flags, valueFlags);
    if (match === "blocked") {
      return (
        `planning-readonly: blocked the option ${word} of ${base}. A planning model may use ` +
        "only read-only options."
      );
    }
    if (match === "value" && !word.includes("=")) {
      index += 1;
    }
  }
  return null;
}

/**
 * The reason a shell command is not read-only, or null when it is one.
 * @param {Command} command The shell text or an argument list.
 * @returns {string | null} The block message.
 */
function planningShellReason(command: Command): string | null {
  const calls = typeof command === "string" ? literalShellCalls(command) : [[...command]];
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
  if (matchesTool(toolName, WORKFLOW_TOOLS)) {
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
  if (matchesTool(toolName, READ_TOOLS)) {
    return null;
  }
  if (matchesTool(toolName, PLANNING_SHELL_TOOLS)) {
    const text = shellTextOf(toolName, input);
    if (text === null) {
      return (
        `planning-readonly: blocked ${toolName}. A planning model may only run plain ` +
        "read-only shell commands."
      );
    }
    return planningShellReason(text);
  }
  return toolMessage(toolName);
}

export { isPlanningModel, planningShellReason, planningToolReason, readCommandReason };
export type { ModelIdentity };
