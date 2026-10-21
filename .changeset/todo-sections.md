---
"@oisin-ee/pi-todo": minor
"@oisin-ee/oisinpi": minor
---

Publish todo status groups as typed data. The work protocol is now version 3: the version 2 snapshot plus `display.sections`, four sections (`in_progress`, `pending`, `completed`, `abandoned`) that each carry a count and items with text, review flag, contract summary, and subtasks. Pi-todo no longer answers version 2 requests, so an older presenter falls back to standalone todos. Todos also gain an optional `description` on outcomes and subtasks: `content` is now a short headline and the description holds the detail. `update` sets or clears it, `view` prints it under the headline, and `display.sections` carries it for presenters; the Pi widget still shows headlines only.
