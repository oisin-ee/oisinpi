---
"@oisin-ee/pi-guardrails": minor
---

Enforce a read-only policy for planning models. A `tier/plan-claude` or `tier/plan-gpt` model may only read the
repository and the tools that report on it; writes, unknown execution, and non-read shell syntax are blocked.
The model of each tool call comes from the session context, so the rule follows a model switch.

The policy authorizes a tool and a command by its exact name, so a name that only resembles a trusted one is
blocked. Each command has its own option grammar, so an option without a value, an unknown value, or a flag
after `--` is blocked. A raw shell command is classified by its argument list, every command of a batch is
checked on its own, and a nested call the policy cannot inspect is blocked.
