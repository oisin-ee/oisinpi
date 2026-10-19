# @oisin-ee/oisinpi

Oisin's [pi](https://pi.dev) packages in one install, at versions tested together:

| Package                                                                            | Contents                                                                   |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`@oisin-ee/pi-prewalk`](https://www.npmjs.com/package/@oisin-ee/pi-prewalk)       | A frontier model plans and makes the first edit; a cheaper model finishes. |
| [`@oisin-ee/pi-todo`](https://www.npmjs.com/package/@oisin-ee/pi-todo)             | The `todo` tool, which also opens the prewalk gate.                        |
| [`@oisin-ee/pi-wrangle`](https://www.npmjs.com/package/@oisin-ee/pi-wrangle)       | The board widget, `/work`, `/wrangle`, and the agent/job inbox.            |
| [`@oisin-ee/pi-guardrails`](https://www.npmjs.com/package/@oisin-ee/pi-guardrails) | Git safety, the wait gate, and the agent-typing gate on every tool call.   |

```bash
pi install npm:@oisin-ee/oisinpi
```

The collection bundles the four packages in its tarball and adds no code. No member imports another, so each one also
installs by itself. pi-wrangle needs the `wrangle` binary at the same version
([oisin-ee/wrangle](https://github.com/oisin-ee/wrangle)).

The board widget above the editor shows host meters, the current task, and agents and jobs grouped TO LAND, ATTENTION, RUNNING, and WAITING.
Alt+W or `/work` expands that widget in place, without a popup. Typing stays in the editor.
Todos follow the active Pi branch. Agents and jobs follow the Herdr owner pane.
Use Wrangle `run`, `read`, and `stop` for background work. The collection does not require `pi-background-tasks`.
Standalone pi-todo keeps its own widget when Wrangle does not claim the shared display.
