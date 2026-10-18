# @oisin-ee/oisinpi

Oisin's [pi](https://pi.dev) packages in one install, at versions tested together:

| Package                                                                            | Contents                                                                   |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`@oisin-ee/pi-prewalk`](https://www.npmjs.com/package/@oisin-ee/pi-prewalk)       | A frontier model plans and makes the first edit; a cheaper model finishes. |
| [`@oisin-ee/pi-todo`](https://www.npmjs.com/package/@oisin-ee/pi-todo)             | The `todo` tool, which also opens the prewalk gate.                        |
| [`@oisin-ee/pi-wrangle`](https://www.npmjs.com/package/@oisin-ee/pi-wrangle)       | The board, `/wrangle`, and the inbox for children and jobs across hosts.   |
| [`@oisin-ee/pi-guardrails`](https://www.npmjs.com/package/@oisin-ee/pi-guardrails) | Git safety, the wait gate, and the agent-typing gate on every tool call.   |

```bash
pi install npm:@oisin-ee/oisinpi
```

The collection bundles the four packages in its tarball and adds no code. No member imports another, so each one also
installs by itself. pi-wrangle needs the `wrangle` binary at the same version
([oisin-ee/wrangle](https://github.com/oisin-ee/wrangle)).
