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
  assert.notEqual(planningShellReason("ls --color=always"), null);
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
