# raes-execute — provider-contract-v1.md

## Purpose

This document defines Provider Contract v1 for `raes-execute`.

It separates three concerns that are currently blurred together:

1. What the parent loop must receive before it may record a slice as complete
2. What the operator should see while a slice is running
3. What engineers need for transport- and provider-level debugging

Provider Contract v1 is a product contract. It is intentionally higher-level than any one provider's raw event schema.

## Design Goals

- Preserve one parent-loop contract across Claude, Codex exec, and Codex app-server
- Distinguish operator observability from provider debugging
- Keep the final completion decision strict even when progress streaming is lossy
- Allow transports to differ internally without changing user-facing CLI semantics
- Make provider regressions detectable through contract tests rather than operator intuition

## Contract Layers

### 1. Completion Contract

The Completion Contract governs whether the parent loop may offer:

`Record this slice as complete? [y/N]`

The Completion Contract must be strict.

### 2. Operator Progress Contract

The Operator Progress Contract governs what the CLI shows by default while the child provider is running.

The operator view should answer:

- what slice is running
- what phase the agent is in
- what meaningful action is happening now
- whether work is progressing, blocked, validating, or complete

The operator view should not depend on raw provider payload shapes.

### 3. Debug Contract

The Debug Contract governs raw provider payloads, transport failures, subprocess details, and protocol mismatches.

This layer exists to debug the child process or transport, not to drive the default UX.

## Completion Contract v1

### Rule

The parent loop may only offer slice recording when the provider returns a valid structured final result.

Raw prose may still be shown to the operator, but raw prose alone is not recordable completion output.

### Required Final Result Shape

The child provider's final answer must end with exactly one tagged block:

- `RAES_SUMMARY_START`
- valid JSON
- `RAES_SUMMARY_END`

The JSON must include these top-level keys:

- `slice`
- `artifactsInspected`
- `repoInspection`
- `plan`
- `testsAddedOrUpdated`
- `implementationChanges`
- `findings`
- `validation`
- `gaps`
- `artifactsProduced`
- `flags`
- `nextRecommendedSlice`

All list-shaped fields must be present. Empty arrays are valid.

### Minimum Recordable Validation

A final result is recordable only if:

- exactly one tagged summary block is present
- the JSON parses successfully
- `slice.label` is non-empty
- `slice.type` is `execution` or `review`
- `slice.pipeline.path` is non-empty
- `nextRecommendedSlice.label` is non-empty
- `nextRecommendedSlice.reason` is non-empty
- every list-shaped field exists, even if empty

### Non-Recordable Outcomes

The parent loop must not offer slice recording in these cases:

- provider returned empty or whitespace-only output
- tagged summary block is missing
- tagged summary block is malformed
- required fields are missing
- provider returned a structured provider error

In these cases the CLI may still print:

- raw child output
- a warning or error explaining why completion is not recordable
- provider-specific fix guidance when available

### Warning-Level Conditions

These do not block recordability in v1, but should be surfaced clearly:

- `findings` is empty on a review slice
- `validation` is empty on an execution slice
- `flags` is empty when the child mentioned ambiguity in freeform prose
- the child returned valid JSON but the prose before the tagged block appears contradictory

These are quality signals, not hard contract failures in v1.

## Operator Progress Contract v1

### Principle

Default CLI progress should describe what the agent is doing, not how the transport encoded it.

### Operator Event Taxonomy

The parent loop should render the following normalized event types.

| Event | Meaning | Minimum fields | Default visibility |
| --- | --- | --- | --- |
| `session.started` | Child provider session or subprocess is ready | `summary` | operator |
| `turn.started` | Agent began the slice turn | `summary` | operator |
| `phase.changed` | Agent moved into a meaningful phase such as inspect, edit, validate, summarize | `phase`, `summary` | operator |
| `plan.updated` | Agent updated its plan in a user-meaningful way | `summary`, `plan?` | operator |
| `artifact.inspecting` | Agent is reading artifacts or repo state | `summary`, `refs?` | operator |
| `command.started` | Agent started a command relevant to operator understanding | `command`, `summary` | operator |
| `command.output` | Selected command output worth surfacing | `command`, `snippet` | operator |
| `command.completed` | Agent completed a meaningful command | `command`, `status`, `exitCode?` | operator |
| `files.changed` | Agent changed one or more files | `summary`, `files` | operator |
| `agent.note` | Child emitted a meaningful natural-language update | `summary` | operator |
| `turn.completed` | Child completed the slice turn | `summary` | operator |
| `failure` | Provider, transport, protocol, or agent execution failed | `failureClass`, `summary`, `fix?` | operator |
| `debug.raw` | Raw provider event or payload detail | `providerEventType`, `payloadSnippet` | debug only |

### Event Semantics

- `summary` must be human-readable and concise
- `phase` must be provider-neutral
- `snippet` must be truncated to operator-safe length
- `files` should contain only relevant file paths and coarse change kinds
- `debug.raw` must never be shown in default progress mode

### Required Phase Vocabulary

Providers should map their raw events into this shared phase vocabulary where possible:

- `inspect`
- `plan`
- `edit`
- `test`
- `validate`
- `review`
- `summarize`
- `blocked`

Providers may omit phase changes if they cannot infer them safely, but they must not invent them.

### Minimum Provider Floor

Every provider used by `raes-execute` must supply enough progress for the parent to communicate:

- session started
- turn started
- at least one meaningful in-progress event
- final completion or failure

Anything richer than that is transport-specific enhancement.

## Debug Contract v1

### Principle

Debug mode answers how the child accomplished the task.

This includes:

- raw provider event types
- JSONL or JSON-RPC parsing failures
- subprocess spawn failures
- stderr diagnostics
- request timeouts
- session lifecycle details
- transport-specific payload mismatches

### Debug Output Rules

- debug output may include raw event names and payload fragments
- debug output must not replace normalized operator events
- provider-specific payloads must stay provider-specific; they are not product contracts
- transport failure classes must still be normalized before they reach the parent loop

## Failure Classification Contract

Every provider must classify failures into one of these user-visible categories:

- `auth_failure`
- `binary_missing`
- `transport_startup_failure`
- `transport_runtime_failure`
- `protocol_failure`
- `agent_execution_failure`
- `invalid_final_output`

Every failure surfaced to the parent loop must include:

- stable failure class
- human-readable summary
- actionable fix guidance when known

## Provider Comparison Table

### Current Implementation Status

| Dimension | Claude child process | Codex exec | Codex app-server |
| --- | --- | --- | --- |
| Process model | one-shot subprocess | one-shot subprocess | long-lived session subprocess |
| Final output source | stream-json `result` or fallback text fields | `turn.completed` JSONL event | `turn/completed` notification with layered fallbacks |
| Valid structured summary enforced by parent | no | no | no |
| Rich normalized progress | low | medium-low | high |
| Phase metadata | no | no | yes |
| Command visibility | tool name only | coarse | strong |
| File-change visibility | no | no | yes |
| Plan visibility | no | no | yes |
| Debug raw-event support | minimal | minimal | strong |
| Auth failure classification | yes | yes | yes |
| Startup failure classification | coarse | coarse | stronger |
| Session reuse | no | no | yes |
| `provider.model` honored | no | no | yes |

### Provider Contract v1 Target

| Dimension | Claude child process | Codex exec | Codex app-server |
| --- | --- | --- | --- |
| Recordable final output requires valid tagged summary | yes | yes | yes |
| Minimum progress floor | yes | yes | yes |
| Normalized failure classes | yes | yes | yes |
| Debug/raw event channel separated from operator channel | yes | yes | yes |
| `provider.model` behavior explicit and documented | yes | yes | yes |
| Transport-specific richness beyond minimum floor | optional | optional | expected |

## Normative Decisions For v1

### Final Output

- Structured final output is authoritative
- Raw prose is informational, not authoritative
- Parent loops must not record a slice from raw prose alone

### Operator View

- Operator mode shows normalized events only
- Operator mode is product-shaped, not provider-shaped
- Default progress should privilege meaning over payload fidelity

### Debug View

- Debug mode may show provider-specific raw events
- Debug mode exists to debug child-process behavior and transport bugs
- Debug mode does not change slice completion rules

### Transport Differences

- Transports may differ in richness
- Transports may not differ in recordable completion rules
- Transports may not silently change config semantics without documentation

## Required Follow-Up Work

1. Enforce the Completion Contract in `execution-loop.ts` and `review-loop.ts`
2. Reconcile `output-summary.ts` with the prompt contract so empty arrays are valid
3. Add a stable failure-class field to provider errors surfaced to the parent loop
4. Define the normalized progress adapter expected from all providers
5. Raise Claude to the minimum progress floor expected by the parent renderer
6. Decide whether `provider.model` is truly shared or should become transport-specific config
7. Add cross-provider contract tests that assert the same parent-loop behavior for:
   - valid structured completion
   - malformed structured completion
   - missing structured completion
   - empty output
   - auth failure
   - binary missing
   - protocol failure

## Non-Goals For v1

- Full event-schema parity across all providers
- Requiring every provider to expose file diffs or plan updates
- Replacing raw debug payloads with a universal transport protocol
- Solving all child-process lifecycle issues in this document

## Summary

Provider Contract v1 makes one key move:

`raes-execute` should be strict about completion, intentional about operator observability, and permissive only in debug mode.

That lets Codex app-server remain the richest path without letting Claude or Codex exec drift into a different product.
