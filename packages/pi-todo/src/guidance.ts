/** Shared instructions for creation results, tool calls, and approved plans. */
const workUnitGuidance =
  "Size each executable unit for one agent session, with one deliverable, clear scope, and an acceptance condition. " +
  "Split independent outcomes or work that needs another session. Combine trivial steps with their deliverable and tests. " +
  "Delegate independent units separately; the lead can execute one unit. Keep dependent units ordered. " +
  "Do not delegate an oversized parent as one assignment. Close children before explicit parent integration review.";

export { workUnitGuidance };
