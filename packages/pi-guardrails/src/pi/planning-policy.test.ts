import assert from "node:assert/strict";
import { test } from "vitest";

import { isPlanningModel, planningShellReason, planningToolReason } from "./planning-policy.ts";

const PLANNER = { provider: "tier", id: "plan-claude" };

test("only the tier planning models are planning models", () => {
  assert.equal(isPlanningModel(PLANNER), true);
  assert.equal(isPlanningModel({ provider: "tier", id: "plan-gpt" }), true);
  assert.equal(isPlanningModel({ provider: "tier", id: "plan-claude-high" }), false);
  assert.equal(isPlanningModel({ provider: "tier", id: "worker-gpt" }), false);
  assert.equal(isPlanningModel({ provider: "anthropic", id: "plan-claude" }), false);
  assert.equal(isPlanningModel({ provider: "tier" }), false);
});

test("a planning model may run plain read-only shell commands", () => {
  for (const command of [
    "pwd",
    "ls",
    "ls -la packages",
    "rg 'hooks|agent-browser' packages",
    "grep -rn 'tool_call' src",
    "find . -name '*.ts' -type f",
    "git status",
    "git status --short",
    "git rev-parse --show-toplevel",
    "git log --oneline -n 5",
    "git diff --no-ext-diff --no-textconv",
    "git show --no-ext-diff --no-textconv HEAD",
    "ls && pwd",
    "ls | grep src",
  ]) {
    assert.equal(planningShellReason(command), null, command);
  }
});

test("a planning model may not run a command that changes anything", () => {
  for (const command of [
    "rm file",
    "git add .",
    "git commit -m x",
    "git push",
    "npm install",
    "find . -delete",
    "find . -exec rm {} +",
    "find . -fprint out.txt",
  ]) {
    assert.notEqual(planningShellReason(command), null, command);
  }
});

test("a planning model may not use dynamic or redirecting shell syntax", () => {
  for (const command of [
    "ls > out.txt",
    "cat < file",
    "A=1 ls",
    "ls $(pwd)",
    "ls `pwd`",
    "ls $HOME",
    "ls *.ts",
    "ls & pwd",
    "sh -c 'ls'",
    "python -c 'print(1)'",
  ]) {
    assert.notEqual(planningShellReason(command), null, command);
  }
});

test("a planning model may not use an unknown option of a read command", () => {
  assert.equal(planningShellReason("ls --color=always"), null);
  assert.equal(planningShellReason("ls --time-style=long-iso"), null);
  assert.equal(planningShellReason("ls -la"), null);
  assert.notEqual(planningShellReason("rg --pre /bin/cat pattern"), null);
  assert.notEqual(planningShellReason("git status --bogus"), null);
  assert.equal(planningShellReason("git log --graph --oneline"), null);
});

test("a planning model must ask for no external diff driver on git diff and log", () => {
  const message = planningShellReason("git diff");
  assert.match(message ?? "", /--no-ext-diff --no-textconv/u);
  assert.equal(planningShellReason("git diff --no-ext-diff --no-textconv"), null);
  assert.equal(planningShellReason("git log -p --no-ext-diff --no-textconv"), null);
});

test("a planning model may use the read tools and the workflow controls", () => {
  for (const toolName of [
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
    "todo",
    "ask",
    "interview",
    "tool_search",
    "codemode",
    "mcp__dogsled__read",
    "mcp__dogsled__status",
    "mcp__dogsled__inbox",
    "mcp__dogsled__send",
    "mcp__dogsled__done",
  ]) {
    assert.equal(planningToolReason(toolName, {}), null, toolName);
  }
});

test("a planning model may only call a tool by its exact trusted name", () => {
  for (const toolName of [
    "dangerous_read",
    "mcp__untrusted__read",
    "mcp__untrusted__find",
    "fake_codemode",
    "mcp__untrusted__codemode",
    "fake_shell",
    "mcp__untrusted__bash",
    "search_graph",
    "get_code_snippet",
    "trace_path",
    "detect_changes",
  ]) {
    assert.match(planningToolReason(toolName, {}) ?? "", /^planning-readonly:/u, toolName);
  }
});

test("a planning model may not write or run an unknown tool", () => {
  for (const toolName of ["write", "edit", "apply_patch", "mcp__context_mode__ctx_run"]) {
    assert.match(planningToolReason(toolName, {}) ?? "", /^planning-readonly:/u, toolName);
  }
});

test("a planning model may only spawn a bound Dogsled unit", () => {
  assert.equal(planningToolReason("mcp__dogsled__spawn", { unit: { id: "u-1" } }), null);
  assert.notEqual(planningToolReason("mcp__dogsled__spawn", { unit: { id: "" } }), null);
  assert.notEqual(planningToolReason("mcp__dogsled__spawn", {}), null);
  assert.notEqual(planningToolReason("mcp__dogsled__run", { cmd: ["ls"] }), null);
  assert.notEqual(planningToolReason("mcp__dogsled__place", { branch: "x" }), null);
});

test("a planning model may run a read-only shell command through a shell tool", () => {
  assert.equal(planningToolReason("bash", { command: "ls" }), null);
  assert.equal(
    planningToolReason("mcp__context_mode__ctx_execute", { code: "ls", language: "shell" }),
    null,
  );
  assert.equal(planningToolReason("ctx_batch_execute", { commands: [{ command: "pwd" }] }), null);
  assert.notEqual(planningToolReason("bash", { command: "rm x" }), null);
  assert.notEqual(
    planningToolReason("ctx_execute", { code: "print(1)", language: "python" }),
    null,
  );
});

test("a planning model may not use a dollar-quoted word", () => {
  for (const command of ["find . $'-delete'", "rg $'--pre=./evil' pattern .", 'ls $"*.ts"']) {
    assert.notEqual(planningShellReason(command), null, command);
  }
});

test("a planning model may only run an exact known executable", () => {
  for (const command of [
    "./ls",
    "/repo/tools/git status",
    "ls@evil",
    "find@1 .",
    "git.exe status",
  ]) {
    assert.notEqual(planningShellReason(command), null, command);
  }
});

test("a planning model may not use an option that needs a value", () => {
  for (const command of [
    "rg --max-count",
    "rg --max-count --line-number pattern .",
    "grep --context",
    "find . -name",
    "git log -n",
    "git log --max-count",
    "git -C",
    "find . -maxdepth",
    "rg -C",
  ]) {
    assert.notEqual(planningShellReason(command), null, command);
  }
});

test("a planning model may use a short cluster of read-only options", () => {
  assert.equal(planningShellReason("ls -la"), null);
  assert.equal(planningShellReason("grep -rn 'tool_call' src"), null);
  assert.notEqual(planningShellReason("ls -lx"), null);
  assert.notEqual(planningShellReason("ls -lZ"), null);
});

test("a planning model may use an enumerated option value", () => {
  assert.equal(planningShellReason("ls --color=never"), null);
  assert.equal(planningShellReason("git status --untracked-files=all"), null);
  assert.notEqual(planningShellReason("ls --color=bogus"), null);
  assert.notEqual(planningShellReason("git status --untracked-files=bogus"), null);
});

test("a planning model may not read a git option after the terminator", () => {
  assert.notEqual(planningShellReason("git diff -- --no-ext-diff --no-textconv"), null);
  assert.equal(planningShellReason("git diff --no-ext-diff --no-textconv -- src/a.ts"), null);
});

test("a raw command is classified by its argument list", () => {
  assert.equal(planningToolReason("hypa_shell", { command: "ls", raw: true }), null);
  assert.notEqual(
    planningToolReason("hypa_shell", { command: 'find . -name "* -o -delete -name *', raw: true }),
    null,
  );
  assert.notEqual(planningToolReason("hypa_shell", { command: "rm x", raw: true }), null);
});

test("a raw command keeps the words of a quoted argument", () => {
  assert.equal(
    planningToolReason("hypa_shell", { command: "rg 'hooks|agent-browser' packages", raw: true }),
    null,
  );
});

test("a batch validates every command on its own", () => {
  assert.equal(
    planningToolReason("ctx_batch_execute", { commands: [{ command: "ls" }, { command: "pwd" }] }),
    null,
  );
  assert.notEqual(
    planningToolReason("ctx_batch_execute", { commands: [{ command: "ls" }, { command: "rm x" }] }),
    null,
  );
  assert.notEqual(planningToolReason("ctx_batch_execute", { commands: ["ls"] }), null);
  assert.notEqual(planningToolReason("ctx_batch_execute", { commands: [{ label: "x" }] }), null);
  assert.notEqual(planningToolReason("ctx_batch_execute", { commands: "ls" }), null);
});
