---
"@oisin-ee/pi-guardrails": minor
---

Enforce a read-only policy for planning models. A `tier/plan-claude` or `tier/plan-gpt` model may only read the
repository and the tools that report on it; writes, unknown execution, and non-read shell syntax are blocked.
The model of each tool call comes from the session context, so the rule follows a model switch.
