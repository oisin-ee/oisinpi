# @oisin-ee/pi-todo

A `todo` tool for [pi](https://pi.dev). The model keeps one ordered task list for the session. Exactly one task is active.
The list rules run in Rust, compiled to WebAssembly.

```bash
pi install npm:@oisin-ee/pi-todo
```

To install it together with prewalk, use [`@oisin-ee/pi-prewalk-kit`](https://www.npmjs.com/package/@oisin-ee/pi-prewalk-kit).

## The tool

The model calls `todo` with one `op`. Tasks are addressed by their exact content.

| `op`     | Effect                                                       |
| -------- | ------------------------------------------------------------ |
| `init`   | Replaces the list with `items`.                              |
| `append` | Adds `items` to the end.                                     |
| `start`  | Makes `task` the active task.                                |
| `done`   | Completes `task`. Without `task`, completes every open task. |
| `drop`   | Abandons `task`. Without `task`, abandons every open task.   |
| `view`   | Returns the list. It does not change it.                     |

When the active task closes, the next open task starts. An empty task, a repeated task, or an unknown task is an error,
and the list stays as it was.

## State

Each change is saved as a `todo-state` entry on the session branch. There is no other state. So a resumed session,
a `/tree` move, and calls made from inside codemode all see the list of the current branch. A widget shows the list,
and `/todos` prints it.

## Reminder

When the agent stops with open tasks, pi-todo adds a hidden reminder that lists them and continues the turn.
It sends at most 3 reminders per user message. After a reminder, it waits for the list to change before it sends
another. A new user message resets the count.

## Other todo tools

If another package already registers `todo`, pi-todo stays inactive and shows a warning that names that package.

## Source

The operations, the active-task rule, and the reminder follow
[oh-my-pi](https://github.com/can1357/oh-my-pi/tree/e7fe318/packages/coding-agent/src) (`tools/todo`,
`todo-tracker.ts`), MIT. Saving a custom entry on every change follows
[rpiv-todo](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-todo).
