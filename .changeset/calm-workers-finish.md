---
"@oisin-ee/pi-todo": patch
"@oisin-ee/oisinpi": patch
---

A worker can call `dogsled done` after it closes its seeded todo leaf. Before, the todo gate blocked `mcp__dogsled__done`, so a finished worker could not report done.
