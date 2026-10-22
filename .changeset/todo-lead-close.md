---
"@oisin-ee/pi-todo": patch
---

The owning lead can close any open leaf with `done` and a short note, or with `drop`. Closing a leaf that a worker holds clears the binding, records the execution as released, and frees its paths. A late settlement for a released execution is a no-op.
