# @oisin-ee/pi-guardrails

Agent guardrails for [pi](https://pi.dev), Claude Code, and Codex. One set of policies checks every shell and edit call:

- **Git safety:** no `--no-verify`, no discarding uncommitted work, no stash push and pop in one command, worktrees only
  under `.worktrees/`, no on-the-fly identity.
- **Wait gate:** no `sleep`, `watch`, follow flags, `--wait`/`--watch`, or wait subcommands. Start long work in the
  background instead.
- **Agent typing:** no `herdr agent prompt` or `pane send-*` into another agent's terminal. Use `dogsled send`. For prompt answers, only `herdr agent send-keys` accepts `# dogsled: answer-prompt`; each use is recorded.
- **GitOps:** no imperative `kubectl`, `helm`, `argocd`, or `nix` mutations, and no `fsck`/`mkfs`.
- **Generated paths:** no hand-edits of lockfiles or generated files.

In pi, it also fills a missing shell timeout (120 s) and blocks one above 10 minutes, naming each tool's unit.
Shell text is parsed with `shfmt`, which must be on `PATH`. A command that cannot be parsed is blocked.

## Read-only planning models

A planning model (`tier/plan-claude` or `tier/plan-gpt`) may only read. The guardrails read the model of
each tool call from the session context, so the rule follows a model switch.

A planning model may call:

- the read tools: `read`, `ls`, `find`, `grep`, `hypa_read`, `hypa_ls`, `hypa_find`, `hypa_grep`,
  `web_search`, `web_fetch`, `lsp_diagnostics`, `ctx_search`, `ctx_stats`, the `hindsight` read tools, and
  the `codebase_memory` read tools;
- the workflow controls: `todo`, `ask`, `interview`, `tool_search`, and `codemode`;
- the Dogsled tools `read`, `status`, `inbox`, `send`, and `done`, and a `spawn` of a bound unit by its id;
- a shell read: `pwd`, `ls`, `rg`, `grep`, `find` without `-exec`, `-delete`, or `-fprint`, and `git status`,
  `git diff`, `git log`, `git show`, and `git rev-parse` with read-only options.

The shell check uses the `shfmt` syntax tree, so a redirect, an assignment, a substitution, a glob, or a
background call is blocked even when the command itself reads. `git diff`, `git log -p`, and `git show`
must carry `--no-ext-diff --no-textconv`, because a diff driver or a textconv filter can run a program.

Every other tool, including `write`, `edit`, and any command that changes the repository or the system,
is blocked for a planning model. Other models keep the full policy set.

## pi

```bash
pi install npm:@oisin-ee/pi-guardrails
```

## Claude Code and Codex

Install the package globally, then run `agent-hook` as a `PreToolUse` hook for shell and edit tools. It reads the hook
payload on stdin and exits 2 with the reason on stderr to block.

```json
{ "type": "command", "command": "agent-hook", "timeout": 30 }
```
