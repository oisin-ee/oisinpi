# @oisin-ee/pi-prewalk-kit

One install for [pi](https://pi.dev) that gives you both packages at matching versions:

- [`@oisin-ee/pi-prewalk`](https://www.npmjs.com/package/@oisin-ee/pi-prewalk): a frontier model explores the code,
  writes a todo list, and makes the first edit. Then the session switches once to a cheaper model, which continues
  with the whole trajectory in context.
- [`@oisin-ee/pi-todo`](https://www.npmjs.com/package/@oisin-ee/pi-todo): the `todo` tool that opens the prewalk gate.

```bash
pi install npm:@oisin-ee/pi-prewalk-kit
```

Then set the target model in `<agent-dir>/prewalk.json` (usually `~/.pi/agent/prewalk.json`):

```json
{
  "enabled": true,
  "target": { "model": "provider/cheaper-model", "thinking": "medium" }
}
```

Or arm one run from the command line:

```bash
pi --model provider/frontier-model --prewalk-into provider/cheaper-model
```

The kit bundles both packages in its tarball. Install either one by itself if you do not need the other.
The [pi-prewalk README](https://github.com/oisin-ee/pi-prewalk/tree/main/packages/pi-prewalk#readme) documents the
commands, the flags, the config, and Shepherdr subagents.
