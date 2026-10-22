/*
 * The pi adapter: the same shell and edit policies as the Claude Code and
 * Codex hooks, plus pi's timeout and sandbox-wait gates, on every tool call.
 */
import {
  EDIT_TOOL_NAMES,
  SHELL_TOOL_NAMES,
  canonicalToolName,
  commandsFromToolInput,
} from "./tool-inputs.ts";
import { codeWaitViolation, enforceTimeout } from "./tool-timeouts.ts";
import { isPlanningModel, planningToolReason } from "./planning-policy.ts";
import { classifyEdits, editInputsFromPayload } from "../policies/edit.ts";
import { SHELL_CLASSIFIERS } from "../policies/shell.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isRecord } from "../common.ts";
import type { Command } from "../common.ts";

type GuardrailsAPI = Readonly<Pick<ExtensionAPI, "on">>;

/** The parts of a tool call the gates read; `input` is mutable, as pi allows. */
interface ToolCall {
  readonly toolName: string;
  readonly input: Record<string, unknown>;
}

/** The model of the session, as the context reports it. */
interface CallModel {
  readonly provider?: string;
  readonly id?: string;
}

// A codemode script's nested calls nest at most this deep before the gate stops looking.
const MAX_NESTING = 8,
  /**
   * The block message of the first shell policy that refuses one of `commands`.
   * @param {readonly Command[]} commands The commands a tool call runs.
   * @param {string} cwd The working directory.
   * @returns {string | null} The block message.
   */
  shellPolicyViolation = (commands: readonly Command[], cwd: string): string | null => {
    for (const command of commands) {
      for (const classify of SHELL_CLASSIFIERS) {
        const message = classify(command, cwd);
        if (message !== null) {
          return message;
        }
      }
    }
    return null;
  },
  shellViolation = (call: ToolCall, cwd: string): string | null =>
    shellPolicyViolation(
      commandsFromToolInput(call.toolName, call.input).filter((command) => command.length > 0),
      cwd,
    ),
  editViolation = (call: ToolCall, cwd: string): string | null =>
    classifyEdits(editInputsFromPayload({ tool_input: call.input, tool_name: call.toolName }), cwd),
  /**
   * The nested calls of a codemode input. A malformed envelope is a failure
   * for a planning model, so it is reported rather than skipped.
   * @param {Readonly<Record<string, unknown>>} input The tool input.
   * @returns {{ calls: ToolCall[]; malformed: boolean }} The calls and the
   *   state of the envelope.
   */
  nestedCalls = (
    input: Readonly<Record<string, unknown>>,
  ): { calls: ToolCall[]; malformed: boolean } => {
    const uses = input["tool_uses"];
    if (uses === undefined) {
      return { calls: [], malformed: false };
    }
    if (!Array.isArray(uses)) {
      return { calls: [], malformed: true };
    }
    const calls: ToolCall[] = [];
    let malformed = false;
    for (const use of uses) {
      if (!isRecord(use)) {
        malformed = true;
        continue;
      }
      const toolName = use["recipient_name"];
      const parameters = use["parameters"];
      if (typeof toolName !== "string") {
        malformed = true;
      }
      if (parameters !== undefined && !isRecord(parameters)) {
        malformed = true;
      }
      calls.push({
        input: isRecord(parameters) ? parameters : {},
        toolName: typeof toolName === "string" ? toolName : "",
      });
    }
    return { calls, malformed };
  },
  toolViolation = (
    event: ToolCall,
    cwd: string,
    model: CallModel | undefined,
    depth = 0,
  ): string | null => {
    const planning = isPlanningModel(model);
    if (depth > MAX_NESTING) {
      // A planning model fails closed: a call it cannot inspect is a call it
      // cannot allow. Other models keep the old behaviour.
      return planning
        ? `planning-readonly: blocked a nested call deeper than ${MAX_NESTING} levels. A planning ` +
            "model may only run calls it can inspect."
        : null;
    }
    const call = { input: event.input, toolName: canonicalToolName(event.toolName) },
      own =
        enforceTimeout(call.toolName, call.input) ??
        codeWaitViolation(call.toolName, call.input) ??
        // The planning policy authorizes the raw event name, so a tool that
        // only ends with a trusted name is not that tool.
        (planning ? planningToolReason(event.toolName, event.input) : null) ??
        (SHELL_TOOL_NAMES.has(call.toolName) ? shellViolation(call, cwd) : null) ??
        (EDIT_TOOL_NAMES.has(call.toolName) ? editViolation(call, cwd) : null);
    if (own !== null) {
      return own;
    }
    const nested = nestedCalls(call.input);
    if (nested.malformed && planning) {
      return (
        "planning-readonly: blocked a nested call with a malformed envelope. A planning model " +
        "may only run calls it can inspect."
      );
    }
    for (const child of nested.calls) {
      const message = toolViolation(child, cwd, model, depth + 1);
      if (message !== null) {
        return message;
      }
    }
    return null;
  };

/**
 * Registers the guardrails on pi's `tool_call` event. A policy that throws,
 * such as an unparsable command, blocks the call with its message.
 * @param {GuardrailsAPI} pi The extension API methods used here.
 */
export default function piGuardrails(pi: GuardrailsAPI): void {
  pi.on("tool_call", (event, ctx) => {
    try {
      const message = toolViolation(event, ctx.cwd, ctx.model);
      return message === null ? undefined : { block: true, reason: message };
    } catch (error) {
      return { block: true, reason: error instanceof Error ? error.message : String(error) };
    }
  });
}

export { shellPolicyViolation };
