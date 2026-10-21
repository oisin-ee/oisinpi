/** Shared instructions for creation results, tool calls, and approved plans. */
const workUnitGuidance =
  "Size each executable unit for one agent session, with one deliverable, clear scope, and an acceptance condition. " +
  "Split independent outcomes or work that needs another session. Combine trivial steps with their deliverable and tests. " +
  "Delegate independent units separately; the lead can execute one unit. Keep dependent units ordered. " +
  "Do not delegate an oversized parent as one assignment. Close children before explicit parent integration review. " +
  "Supply deliverable, repository-relative scope, acceptance, prerequisite IDs, and self or worker/profile assignment. " +
  "Use local keys for new prerequisites and the optional start selector for atomic creation and activation. " +
  "Use returned IDs after creation. Update drafts before start; only one complete self leaf executes locally. " +
  "Done requires concrete acceptance evidence; worker exit alone is not acceptance. " +
  "Keep content a short headline (aim under 60 characters, imperative, no trailing detail); " +
  "put context, approach, or acceptance detail in the optional description (one or two sentences).";

export { workUnitGuidance };
